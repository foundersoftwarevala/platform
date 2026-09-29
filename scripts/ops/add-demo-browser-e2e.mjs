/**
 * The Add Demo screen, driven in a browser the way an operator drives it.
 *
 * The point: this form used to write into `demos` and say "Demo created
 * successfully", so a browser test that only read the toast would have passed
 * while nothing reached the storefront. Every claim here is checked against the
 * database afterwards, and the row it creates is removed at the end.
 *
 *   node scripts/ops/add-demo-browser-e2e.mjs
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";

const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
const SITE = "https://softwarevala.net";
const STAMP = Date.now();
const URL_UNDER_TEST = `https://sv-adddemo-${STAMP}.example.com`;

function sql(query) {
  const out = execFileSync(
    process.execPath,
    ["scripts/ops/db.mjs", "--sql", `select coalesce((${query})::text, 'NULL') as answer`],
    { encoding: "utf8", timeout: 120_000 },
  );
  const lines = out.split("\n").map((l) => l.trim());
  const i = lines.findIndex((l) => l === "answer");
  return i >= 0 ? (lines[i + 2] ?? "") : out.trim();
}

let passed = 0;
let failed = 0;
const step = (name, ok, detail = "") => {
  ok ? (passed += 1) : (failed += 1);
  console.log(`  ${(ok ? "PASS" : "FAIL").padEnd(5)} ${name.padEnd(50)} ${detail}`);
};

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1100 } })).newPage();
const problems = [];
page.on("pageerror", (e) => problems.push(String(e).slice(0, 100)));

await page.goto(`${SITE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(4000);
await page.fill('input[type="email"]', ops.SV_LOGIN_CONTROL_PANEL);
await page.fill('input[type="password"]', ops.SV_PW_CONTROL_PANEL);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 });
await page.waitForTimeout(2000);

await page.goto(`${SITE}/product-demo-manager`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(10_000);
await page.getByText("Add Demo", { exact: true }).first().click({ timeout: 8000 }).catch(() => {});
await page.waitForTimeout(6000);

step("the Add Demo screen opens", (await page.locator("form, input").count()) > 0, `errors=${problems.length}`);

/**
 * The form is stepped, so this walks it the way a person does rather than
 * setting values the screen has not asked for yet.
 */
const fill = async (label, value) => {
  const box = page.locator(`input, textarea`).filter({ hasNot: page.locator("[type=file]") });
  const byPlaceholder = page.getByPlaceholder(label, { exact: false }).first();
  if (await byPlaceholder.count()) {
    await byPlaceholder.fill(value).catch(() => {});
    return true;
  }
  void box;
  return false;
};

// Walk forward through whatever steps the form has, filling what it shows.
for (let i = 0; i < 6; i += 1) {
  await fill("demo title", `SV Add Demo Check ${STAMP}`);
  await fill("https://demo.example.com", URL_UNDER_TEST);
  await fill("Demo description", "Created by add-demo-browser-e2e, removed afterwards.");
  await fill("Search the catalogue", "CounterPOS");

  // A category or type may be a select; take the first real option when present.
  const trigger = page.locator("[role=combobox]").first();
  if (await trigger.count()) {
    await trigger.click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(600);
    const option = page.locator("[role=option]").first();
    if (await option.count()) await option.click({ timeout: 4000 }).catch(() => {});
  }

  // Search the catalogue, then choose the product it finds.
  const search = page.getByRole("button", { name: /^\s*Search\s*$/i }).first();
  if (await search.count()) {
    await search.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(4000);
    const hit = page.locator("button", { hasText: "CounterPOS" }).first();
    if (await hit.count()) await hit.click({ timeout: 4000 }).catch(() => {});
  }

  const next = page.getByRole("button", { name: /next|continue/i }).first();
  if (await next.count()) {
    await next.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    continue;
  }
  break;
}

const submit = page.getByRole("button", { name: /create|add demo|submit|save/i }).first();
step("the form offers a submit", (await submit.count()) > 0);
if (await submit.count()) {
  await submit.click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(9000);
}

/* ------------------------------------------- what reached the real database */
const inCanonical = sql(
  `select count(*) from product_demo_urls where url = '${URL_UNDER_TEST}'`,
);
const inLegacy = sql(`select count(*) from demos where url = '${URL_UNDER_TEST}'`);
const state = sql(
  `select status || '/' || processing_status from product_demo_urls where url = '${URL_UNDER_TEST}'`,
);
const product = sql(
  `select p.slug from product_demo_urls d join marketplace_products p on p.id = d.product_id where d.url = '${URL_UNDER_TEST}'`,
);

step("the demo reached product_demo_urls", inCanonical === "1", `rows=${inCanonical}`);
step("nothing was written to the legacy demos table", inLegacy === "0", `rows=${inLegacy}`);
step("it is attached to the product chosen", product !== "NULL" && product.length > 1, product);
step("it is not published by being added", state === "inactive/unprocessed", state);

await browser.close();

const removed = execFileSync(
  process.execPath,
  ["scripts/ops/db.mjs", "--sql", `delete from product_demo_urls where url = '${URL_UNDER_TEST}' returning url`],
  { encoding: "utf8", timeout: 120_000 },
);
console.log(`\n  cleaned up ${(removed.match(/sv-adddemo/g) ?? []).length} row(s)`);
console.log(`  ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
