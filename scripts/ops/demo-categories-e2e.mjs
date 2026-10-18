/**
 * Can twelve thousand demo URLs actually be filed where they belong?
 *
 * The owner has the list ready and was blocked on one thing: the category each
 * demo has to be put under was not on offer. This checks the whole path he will
 * use, on the live site:
 *
 *   demo_categories has the marketplace's categories
 *     -> the add screen offers them
 *       -> the bulk creator offers them, and takes a pasted list of URLs
 *         -> a demo saves with the category that was chosen
 *
 * It creates one clearly-marked demo and removes it, so the table is left as it
 * was found.
 *
 *   node scripts/ops/demo-categories-e2e.mjs
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const ops = {};
for (const line of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
const SITE = (ops.SV_SITE ?? "https://softwarevala.net").replace(/\/$/, "");

const results = [];
const step = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "OK  " : "FAIL"}  ${name.padEnd(50)} ${detail}`);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 110)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text().slice(0, 110));
});

await page.goto(`${SITE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(4000);
await page.fill('input[type="email"]', ops.SV_LOGIN_CONTROL_PANEL);
await page.fill('input[type="password"]', ops.SV_PW_CONTROL_PANEL);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 });
await page.waitForTimeout(2500);

const api = (method, path, body) =>
  page.evaluate(
    async ([method, path, body]) => {
      let token = null;
      for (const k of Object.keys(localStorage)) {
        if (!/auth-token|supabase/i.test(k)) continue;
        try {
          const v = JSON.parse(localStorage.getItem(k));
          token = v?.access_token ?? v?.currentSession?.access_token ?? token;
        } catch {}
      }
      const r = await fetch(`/rest/v1/${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await r.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {}
      return { status: r.status, json, text: text.slice(0, 200) };
    },
    [method, path, body ?? null],
  );

// ---- the list itself ----------------------------------------------------
const cats = await api("GET", "demo_categories?select=name,display_order&is_active=is.true&order=display_order");
const names = (cats.json ?? []).map((r) => r.name);
step("demo_categories is populated", names.length > 50, `${names.length} categories`);

const marketplace = await api("GET", "marketplace_categories?select=name");
const mNames = new Set((marketplace.json ?? []).map((r) => String(r.name).toLowerCase().trim()));
const missing = names.filter((n) => !mNames.has(String(n).toLowerCase().trim()));
step(
  "every demo category is a real marketplace category",
  missing.length === 0,
  missing.length ? `not in the catalogue: ${missing.slice(0, 3).join(", ")}` : "all of them",
);

// ---- the bulk creator screen -------------------------------------------
await page.goto(`${SITE}/demo-manager`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(11_000);

const onScreen = await page.evaluate(() => {
  const text = document.body.innerText || "";
  return {
    restricted: /access restricted|checking workspace access/i.test(text),
    bulkTab: /bulk/i.test(text),
    importPanel: /Import a list of demo URLs/i.test(text),
    pasteBox: document.querySelectorAll("textarea").length,
    selects: document.querySelectorAll('[role="combobox"], button[aria-haspopup="listbox"]').length,
    categoryOffer: (text.match(/Select one of (\d+)/) ?? [])[1] ?? null,
  };
});
step("Demo Manager opens for an operator", !onScreen.restricted);

// The bulk creator may be behind a tab or its own route; try the route too.
let panel = onScreen;
if (!panel.importPanel) {
  // The bulk creator is a view of ProductDemoManager, which is /demo-workspace.
  await page.goto(`${SITE}/demo-workspace`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(9000);
  const bulkButton = page.locator("button, a").filter({ hasText: /bulk/i }).first();
  if (await bulkButton.count()) { await bulkButton.click({ timeout: 8000 }).catch(() => {}); }
  await page.waitForTimeout(9000);
  panel = await page.evaluate(() => {
    const text = document.body.innerText || "";
    return {
      importPanel: /Import a list of demo URLs/i.test(text),
      pasteBox: document.querySelectorAll("textarea").length,
      categoryOffer: (text.match(/Select one of (\d+)/) ?? [])[1] ?? null,
    };
  });
}
step(
  "the import panel is reachable",
  Boolean(panel.importPanel),
  panel.importPanel ? `paste boxes: ${panel.pasteBox}` : "not found on /demo-workspace either",
);
step(
  "the category selector offers the real list",
  panel.categoryOffer ? Number(panel.categoryOffer) > 50 : false,
  panel.categoryOffer ? `offers ${panel.categoryOffer}` : "no count shown",
);

// ---- a demo saves with the chosen category -----------------------------
const category = names[0];
const marker = `E2E CATEGORY CHECK - safe to delete ${new Date().toISOString()}`;
let createdId = null;
if (category) {
  const created = await api("POST", "demos", {
    title: marker,
    url: "https://softwarevala.net/",
    category,
    status: "inactive",
    is_bulk_created: true,
  });
  createdId = Array.isArray(created.json) ? created.json[0]?.id ?? null : null;
  step(
    "a demo saves with a real category",
    created.status < 300 && Boolean(createdId),
    createdId ? `filed under "${category}"` : `HTTP ${created.status} ${created.text}`,
  );

  if (createdId) {
    const back = await api("GET", `demos?select=category,is_bulk_created&id=eq.${createdId}`);
    const row = (back.json ?? [])[0];
    step(
      "it reads back under that category",
      row?.category === category,
      row ? `category "${row.category}", bulk ${row.is_bulk_created}` : "not found",
    );
    await api("DELETE", `demos?id=eq.${createdId}`);
    const gone = await api("GET", `demos?select=id&id=eq.${createdId}`);
    step("the check removed its own row", (gone.json ?? []).length === 0);
  }
}

step("no console errors", errors.length === 0, errors.slice(0, 2).join(" | "));

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
