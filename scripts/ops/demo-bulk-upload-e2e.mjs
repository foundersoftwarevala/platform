/**
 * Uploads a real CSV through the real Bulk Add screen, and checks the rows
 * actually landed.
 *
 * This is the path the twelve thousand demo URLs will take, and the screen it
 * goes through used to announce success and save nothing - so "it looked like
 * it worked" is not evidence here. The check reads the database afterwards.
 *
 * It uploads the same file twice: the first time to prove the rows go in, the
 * second to prove a URL already in the catalogue is skipped rather than
 * duplicated. Everything it creates is clearly marked and removed at the end.
 *
 *   node scripts/ops/demo-bulk-upload-e2e.mjs
 */
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { chromium } from "@playwright/test";

const ops = {};
for (const line of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
const SITE = (ops.SV_SITE ?? "https://softwarevala.net").replace(/\/$/, "");
const STAMP = Date.now();
const CSV = `sv-bulk-e2e-${STAMP}.csv`;

const results = [];
const step = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "OK  " : "FAIL"}  ${name.padEnd(52)} ${detail}`);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 110)));

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
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await r.text();
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch {}
      return { status: r.status, json, text: text.slice(0, 200) };
    },
    [method, path, body ?? null],
  );

const cats = await api("GET", "demo_categories?select=name&is_active=is.true&order=display_order&limit=2");
const categoryA = cats.json?.[0]?.name;
const categoryB = cats.json?.[1]?.name ?? categoryA;
step("categories are available to file under", Boolean(categoryA), `${categoryA} / ${categoryB}`);

// A file with the awkward shapes a real list has: a header, quoted commas, a
// blank line, a bad row, a repeat, and a category that does not exist.
writeFileSync(
  CSV,
  [
    "title,category,demo_type,url,description",
    `"E2E Bulk One, with a comma",${categoryA},web,https://demo-e2e-${STAMP}-1.example.com/login,first`,
    `E2E Bulk Two,${categoryB},mobile,https://DEMO-E2E-${STAMP}-2.example.com/Login/,second`,
    "",
    `E2E Bulk Bad,${categoryA},web,not-a-url,should be skipped`,
    `E2E Bulk Unknown Category,No Such Category Xyz,web,https://demo-e2e-${STAMP}-3.example.com/,should be skipped`,
    `E2E Bulk Repeat,${categoryA},web,https://demo-e2e-${STAMP}-1.example.com/login/,repeat of the first`,
  ].join("\n"),
  "utf8",
);

async function openBulkDemos() {
  await page.goto(`${SITE}/product-demo-manager`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(9000);
  await page.locator("button, a").filter({ hasText: /^\s*Bulk Add\s*$/i }).first().click({ timeout: 10_000 });
  await page.waitForTimeout(3000);
  await page.locator("text=Bulk Add Demos").first().click({ timeout: 10_000 });
  await page.waitForTimeout(2000);
}

await openBulkDemos();
const onScreen = await page.evaluate(() => ({
  hasDrop: /Drag & drop your CSV/i.test(document.body.innerText || ""),
  hasColumns: /url.*category.*required|Columns/i.test(document.body.innerText || ""),
}));
step("the Bulk Add Demos panel is open", onScreen.hasDrop, onScreen.hasColumns ? "columns documented" : "");

await page.setInputFiles('input[type="file"]', CSV);
await page.waitForTimeout(3500);

const afterParse = await page.evaluate(() => {
  const t = document.body.innerText || "";
  return {
    willAdd: Number((t.match(/(\d+)\s+rows? will be added/) ?? [])[1] ?? 0),
    skipped: Number((t.match(/(\d+)\s+skipped/) ?? [])[1] ?? 0),
    repeated: Number((t.match(/(\d+)\s+repeated inside the file/) ?? [])[1] ?? 0),
    text: t.slice(0, 0),
  };
});
step(
  "the file is parsed and the plan is shown before writing",
  afterParse.willAdd === 2 && afterParse.skipped === 2 && afterParse.repeated === 1,
  `will add ${afterParse.willAdd}, skipped ${afterParse.skipped}, repeated-in-file ${afterParse.repeated}`,
);

await page.locator("button").filter({ hasText: /^Add \d+ demos?$/ }).first().click({ timeout: 10_000 });
await page.waitForTimeout(7000);

const landed = await api("GET", `demos?select=id,title,category,url,normalized_url,is_bulk_created&title=like.E2E%20Bulk%25&order=created_at`);
const rows = landed.json ?? [];
step("the rows really are in the database", rows.length === 2, `${rows.length} row(s) found`);
step(
  "each row carries the category that was chosen",
  rows.every((r) => r.category === categoryA || r.category === categoryB),
  rows.map((r) => r.category).join(" | "),
);
step(
  "the URL was normalised on the way in",
  rows.some((r) => String(r.normalized_url ?? "").startsWith("https://demo-e2e-")) &&
    rows.every((r) => !String(r.normalized_url ?? "").endsWith("/")),
  rows.map((r) => r.normalized_url).join(" | ").slice(0, 110),
);

// ---- the same file again: nothing should be duplicated -------------------
await openBulkDemos();
await page.setInputFiles('input[type="file"]', CSV);
await page.waitForTimeout(3500);
await page.locator("button").filter({ hasText: /^Add \d+ demos?$/ }).first().click({ timeout: 10_000 });
await page.waitForTimeout(7000);

const again = await api("GET", `demos?select=id&title=like.E2E%20Bulk%25`);
step(
  "uploading the same file again adds nothing",
  (again.json ?? []).length === 2,
  `${(again.json ?? []).length} row(s) after the second upload`,
);
const reported = await page.evaluate(() => {
  const t = document.body.innerText || "";
  return (t.match(/(\d+) added · (\d+) already in the catalogue/) ?? []).slice(1, 3).join("/");
});
step("and says so honestly", reported === "0/2", reported ? `reported ${reported} (added/already there)` : "no outcome line");

// ---- clean up ------------------------------------------------------------
await api("DELETE", "demos?title=like.E2E%20Bulk%25");
const gone = await api("GET", "demos?select=id&title=like.E2E%20Bulk%25");
step("the check removed everything it made", (gone.json ?? []).length === 0);
step("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));

rmSync(CSV, { force: true });
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
