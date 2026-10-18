/**
 * Does the header's Apply menu really come from the registry?
 *
 * The seeded items are the same list that used to be compiled into
 * TopUtilityBar.tsx, which is deliberate — nothing was supposed to look
 * different. But it also means reading the menu off the page proves nothing on
 * its own: both sources agree. So this changes the registry, looks, and changes
 * it back.
 *
 * It swaps the first two items, opens the live page, reads the order out of the
 * rendered dropdown, and restores the original order whatever happens. The
 * change is live for a few seconds and is a reordering of two entries in one
 * menu, which is reversible and destroys nothing; the restore runs in a finally
 * block so an exception cannot leave the storefront swapped.
 *
 *   node scripts/ops/topbar-menu-e2e.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

function ops() {
  const out = {};
  for (const line of readFileSync(".env.ops", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
  }
  return out;
}

const SITE = (ops().SV_SITE ?? "https://softwarevala.net").replace(/\/+$/, "");

/** Run SQL on the VPS through the ops script, and hand back stdout. */
function sql(text) {
  return execFileSync("node", ["scripts/ops/db.mjs", "--sql", text], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
}

function applyKeys() {
  const out = sql(
    "select string_agg(i->>'key', ',' order by n) from " +
      "jsonb_array_elements(public.mm_topbar_modules()) with ordinality x(x, m), " +
      "jsonb_array_elements(x.x->'config'->'items') with ordinality i(i, n) " +
      "where x.x->>'module_key' = 'apply-now'",
  );
  const line = out
    .split("\n")
    .map((l) => l.trim())
    .find((l) => /^[a-z]+(,[a-z-]+)+$/.test(l));
  return line ? line.split(",") : [];
}

/** Read the Apply dropdown out of the rendered page. */
async function readApplyMenu(page) {
  await page.goto(SITE, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForTimeout(2500);
  const trigger = page.locator("button", { hasText: /Apply Now/i }).first();
  await trigger.click();
  await page.waitForTimeout(900);
  // Scope to the open menu. The page body carries its own /apply/ links — the
  // first pass of this script counted those too and reported a false negative
  // while the dropdown underneath it had followed the change perfectly.
  return page.evaluate(() => {
    const menu =
      document.querySelector('[role="menu"][data-state="open"]') ??
      document.querySelector('[role="menu"]');
    if (!menu) return [];
    return [...menu.querySelectorAll('a[href*="/apply/"]')].map((a) => ({
      href: a.getAttribute("href") ?? "",
      label: (a.textContent ?? "").replace(/\s+/g, " ").trim(),
    }));
  });
}

const original = applyKeys();
console.log(`registry order before:  ${original.join(" > ")}`);
if (original.length < 2) {
  console.error("Need at least two items to swap. Nothing changed.");
  process.exit(1);
}

const browser = await chromium.launch();
let restored = false;
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const before = await readApplyMenu(page);
  console.log(`page order before:      ${before.map((i) => i.href.split("/").pop()).join(" > ")}`);

  // Swap the first two items, in the database, through the same function the
  // manager screen calls.
  sql(
    "select public.mm_topbar_items_set('apply-now', (" +
      "  select jsonb_agg(i order by case n when 1 then 2 when 2 then 1 else n end)" +
      "    from jsonb_array_elements(" +
      "      (select config->'items' from public.marketplace_topbar_modules" +
      "        where module_key='apply-now')) with ordinality t(i, n)))",
  );
  console.log(`registry order after:   ${applyKeys().join(" > ")}`);

  const after = await readApplyMenu(page);
  console.log(`page order after:       ${after.map((i) => i.href.split("/").pop()).join(" > ")}`);

  const beforeKeys = before.map((i) => i.href.split("/").pop());
  const afterKeys = after.map((i) => i.href.split("/").pop());
  const swapped =
    beforeKeys.length === afterKeys.length &&
    beforeKeys.length >= 2 &&
    afterKeys[0] === beforeKeys[1] &&
    afterKeys[1] === beforeKeys[0];

  console.log("");
  console.log(`the header read the registry: ${swapped ? "YES" : "NO"}`);
  if (!swapped) {
    console.log("  the rendered order did not follow the change, so the menu is");
    console.log("  still coming from the constant compiled into the component.");
  }
  await ctx.close();
} finally {
  // Whatever happened above, put the menu back the way it was.
  const items = original.map((k) => `'${k}'`).join(",");
  sql(
    "select public.mm_topbar_items_set('apply-now', (" +
      "  select jsonb_agg(i order by array_position(ARRAY[" +
      items +
      "]::text[], i->>'key'))" +
      "    from jsonb_array_elements(" +
      "      (select config->'items' from public.marketplace_topbar_modules" +
      "        where module_key='apply-now')) t(i)))",
  );
  restored = applyKeys().join(",") === original.join(",");
  console.log(`\nregistry restored:      ${restored ? "yes" : "NO — CHECK IT"}`);
  console.log(`registry order now:     ${applyKeys().join(" > ")}`);
  await browser.close();
}

process.exit(restored ? 0 : 1);
