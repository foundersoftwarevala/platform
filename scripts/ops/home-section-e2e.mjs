/**
 * Does Marketplace Manager actually control what the homepage renders?
 *
 * The chain is supposed to be: an operator toggles a section in the manager,
 * setSectionEnabled calls mm_section_set_enabled, that writes
 * marketplace_homepage_sections, the route loader reads it back through
 * mm_homepage_sections, and renderSections leaves out what is disabled. Every
 * link can be read in the code. None of that is evidence.
 *
 * Two things this script got wrong before, both worth keeping written down:
 *
 *   It called mm_section_set_enabled straight from psql and was refused. The
 *   function guards on has_role(auth.uid(), 'admin') and a database session
 *   carries no auth.uid(). That refusal is the guard working, and it is why
 *   this has to be driven through the real screen — which is the honest test
 *   anyway, since it exercises the login, the server function, the policy and
 *   the public render in one pass.
 *
 *   It asked psql for `enabled::text` and then looked for a bare "t". psql
 *   prints "true" for a cast boolean, so every answer came back false and it
 *   reported a section disabled that had been enabled the whole time. It asks
 *   for an unambiguous word now.
 *
 * So: sign in, open the manager, click the toggle, read the database, load the
 * public page, then click it back. The restore is verified against the
 * database in a finally block, and prints the statement to run by hand if it
 * could not confirm one.
 *
 *   node scripts/ops/home-section-e2e.mjs [section-key]
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const KEY = process.argv[2] ?? "partner-ecosystem";

function ops() {
  const out = {};
  for (const line of readFileSync(".env.ops", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
  }
  return out;
}
const O = ops();
const SITE = (O.SV_SITE ?? "https://softwarevala.net").replace(/\/+$/, "");

function sql(text) {
  return execFileSync("node", ["scripts/ops/db.mjs", "--sql", text], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
}

/** One yes/no answer, read out of psql without guessing at its formatting. */
function yesNo(text) {
  const out = sql(text);
  const line = out
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l === "YES" || l === "NO");
  if (!line) throw new Error("could not read an answer from psql:\n" + out);
  return line === "YES";
}

/**
 * Whether the homepage would render this section right now.
 *
 * Not whether mm_homepage_sections mentions it — it returns every section, with
 * enabled and live_now flags, and the renderer does the filtering. Asking for
 * mere presence made an earlier run report that a disabled section was still
 * being served while the public page had already dropped it. live_now is the
 * function own word for "would render right now", so that is what this asks.
 */
function served(key) {
  return yesNo(
    "select case when coalesce((x->>'live_now')::boolean, false) then 'YES' else 'NO' end" +
      " from jsonb_array_elements(public.mm_homepage_sections()) x" +
      " where x->>'key' = '" +
      key +
      "'",
  );
}

function enabledInTable(key) {
  return yesNo(
    "select case when enabled then 'YES' else 'NO' end" +
      " from public.marketplace_homepage_sections where key = '" +
      key +
      "'",
  );
}

/** The title the manager lists a section by, which is not its key. */
function titleOf(key) {
  const out = sql(
    "select title from public.marketplace_homepage_sections where key = '" + key + "'",
  );
  const lines = out.split("\n").map((l) => l.trim());
  const rule = lines.findIndex((l) => /^-{3,}$/.test(l));
  return rule >= 0 && lines[rule + 1] ? lines[rule + 1] : key;
}

async function signIn(page, email, password) {
  await page.goto(SITE + "/login", { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForTimeout(2000);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page
    .waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 })
    .catch(() => {});
}

async function clickToggle(page, key, title) {
  await page.goto(SITE + "/marketplace-manager?section=Layout%20Order", {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  await page.waitForTimeout(5000);

  // Match the key line the screen prints under each title: it is unique,
  // where a title can appear in a heading as well as in its row.
  let row = page.locator("text=key: " + key).first();
  if ((await row.count()) === 0) row = page.locator("text=" + title).first();
  if ((await row.count()) === 0) row = page.locator("text=" + key).first();
  if ((await row.count()) === 0) {
    return { ok: false, why: 'no row for "' + title + '" or "' + key + '" on the screen' };
  }

  // Walk up to the first ancestor that actually holds the row controls; the
  // innermost div around the title has none, which is what the first attempt
  // picked and then reported as "its buttons are []".
  const container = row.locator("xpath=ancestor::*[.//button][1]");
  const buttons = container.locator("button");
  const n = await buttons.count();
  for (let i = 0; i < n; i++) {
    const label = ((await buttons.nth(i).textContent()) ?? "").trim().toLowerCase();
    if (/enable|disable|hide|show|^on$|^off$/.test(label)) {
      await buttons.nth(i).click();
      await page.waitForTimeout(3000);
      return { ok: true, clicked: label };
    }
  }
  const labels = [];
  for (let i = 0; i < n; i++) labels.push(((await buttons.nth(i).textContent()) ?? "").trim());
  return { ok: false, why: "row found; its buttons are [" + labels.join(", ") + "]" };
}

async function pageHasSection(page, key) {
  await page.goto(SITE + "/marketplace", { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForTimeout(2500);
  return page.evaluate((k) => {
    const words = k.split("-").filter((w) => w.length > 3);
    const text = (document.body.innerText ?? "").toLowerCase();
    return words.length > 0 && words.every((w) => text.includes(w));
  }, key);
}

const email = O.SV_LOGIN_ADMIN;
const password = O.SV_PW_ADMIN ?? O.SV_PW_TEST;
if (!email || !password) {
  console.error("No admin credentials in .env.ops; the layout guard needs an admin.");
  process.exit(1);
}

const TITLE = titleOf(KEY);
const startedEnabled = enabledInTable(KEY);
console.log("section:                 " + KEY + '  ("' + TITLE + '")');
console.log("enabled in table:        " + (startedEnabled ? "yes" : "no"));
console.log("served to the homepage:  " + (served(KEY) ? "yes" : "no"));

const browser = await chromium.launch();
let restored = false;
let clicked = false;
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  await signIn(page, email, password);

  const onPageBefore = await pageHasSection(page, KEY);
  console.log("on the public page:      " + (onPageBefore ? "yes" : "no"));

  const click = await clickToggle(page, KEY, TITLE);
  if (!click.ok) {
    console.log("\ncould not reach the control: " + click.why);
  } else {
    clicked = true;
    console.log('\nclicked "' + click.clicked + '" in the manager');
    const nowEnabled = enabledInTable(KEY);
    const nowServed = served(KEY);
    console.log("enabled in table now:    " + (nowEnabled ? "yes" : "no"));
    console.log("served to the homepage:  " + (nowServed ? "yes" : "no"));
    const onPageAfter = await pageHasSection(page, KEY);
    console.log("on the public page:      " + (onPageAfter ? "yes" : "no"));

    const flipped = nowEnabled !== startedEnabled;
    const followed = nowServed === nowEnabled && onPageAfter === nowServed;
    console.log("");
    console.log("the manager wrote the database:   " + (flipped ? "YES" : "NO"));
    console.log("the homepage followed the write:  " + (followed ? "YES" : "NO"));
    if (!flipped) console.log("  the click did not change the row.");
    else if (!followed) console.log("  the row changed but the public page did not follow it.");

    await clickToggle(page, KEY, TITLE);
  }
  await ctx.close();
} finally {
  const endEnabled = enabledInTable(KEY);
  restored = endEnabled === startedEnabled;
  console.log("\nrestored:                " + (restored ? "yes" : "NO — CHECK IT"));
  if (!restored && clicked) {
    console.log("  put it back with:");
    console.log(
      "    update public.marketplace_homepage_sections set enabled = " +
        startedEnabled +
        " where key = '" +
        KEY +
        "';",
    );
  }
  await browser.close();
}

process.exit(restored ? 0 : 1);
