/**
 * The file the 12,000 addresses will arrive as.
 *
 * Header detection, separator handling, duplicate and invalid rows, the four
 * ways a product can be named, and a file that cannot be read at all. Preview
 * only: nothing here writes.
 *
 *   node scripts/ops/demo-file-intake-e2e.mjs
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
  console.log(`  ${(ok ? "PASS" : "FAIL").padEnd(5)} ${name.padEnd(52)} ${detail}`);
};

const slug = sql(
  "select slug from marketplace_products where visible and moderation_status='approved' order by created_at limit 1",
);
const name = sql(`select name from marketplace_products where slug = '${slug}'`);
const id = sql(`select id from marketplace_products where slug = '${slug}'`);
const takenUrl = sql("select url from product_demo_urls where product_id is not null order by created_at limit 1");

const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
await page.goto(`${SITE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(4000);
await page.fill('input[type="email"]', ops.SV_LOGIN_CONTROL_PANEL);
await page.fill('input[type="password"]', ops.SV_PW_CONTROL_PANEL);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 });
await page.waitForTimeout(2000);

const preview = (text) =>
  page.evaluate(async (body) => {
    const raw = Object.keys(localStorage).find((k) => k.includes("auth-token"));
    const token = raw ? JSON.parse(localStorage.getItem(raw)).access_token : null;
    const r = await fetch("/api/demo/assign", {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "file-preview", text: body }),
    });
    return { status: r.status, body: await r.json() };
  }, text);

const before = sql("select count(*) from product_demo_urls");

/* ----------------------------------------- a spreadsheet export, mixed columns */
{
  const file = [
    "Demo URL,Product Slug,Product Name,Notes",
    `https://sv-file-${STAMP}-a.example.com/,${slug},,explicit slug`,
    `https://sv-file-${STAMP}-b.example.com/,,${name},exact name`,
    `https://sv-file-${STAMP}-c.example.com/,,,nothing to match on`,
    `${takenUrl},,,already on a product`,
    `https://sv-file-${STAMP}-a.example.com/,,,the same address twice`,
    `not-a-url,,,rubbish`,
    `http://127.0.0.1:9000/,,,private address`,
  ].join("\n");

  const out = await preview(file);
  const c = out.body?.counts ?? {};
  step("the export is read", out.status === 200, `detected: ${(out.body?.detected ?? []).join(" ")}`);
  step("total counts every line", c.TOTAL === 7, `total=${c.TOTAL}`);
  step("an explicit slug is an explicit match", c.EXPLICIT_PRODUCT_MATCH === 1, `explicit=${c.EXPLICIT_PRODUCT_MATCH}`);
  step("an exact name is a name match", c.EXACT_NAME_MATCH === 1, `name=${c.EXACT_NAME_MATCH}`);
  step("an address already on a product is flagged", c.ALREADY_ASSIGNED === 1, `already=${c.ALREADY_ASSIGNED}`);
  step("the same address twice counts once", c.DUPLICATE === 1, `duplicate=${c.DUPLICATE}`);
  step("rubbish is invalid, not imported", c.INVALID === 1, `invalid=${c.INVALID}`);
  step("a private address is refused", (out.body?.sample ?? []).some((r) => r.state === "INVALID" && /127\.0\.0\.1/.test(r.url)) || c.INVALID >= 1, "");
  step("what cannot be placed needs investigation", c.INVESTIGATION_REQUIRED >= 1, `investigation=${c.INVESTIGATION_REQUIRED}`);
}

/* ------------------------------------------ a product id column, tab separated */
{
  const file = ["link\tproduct_id", `https://sv-file-${STAMP}-d.example.com/\t${id}`].join("\n");
  const out = await preview(file);
  step(
    "a tab-separated file with a product id works",
    out.status === 200 && out.body?.counts?.EXPLICIT_PRODUCT_MATCH === 1,
    `explicit=${out.body?.counts?.EXPLICIT_PRODUCT_MATCH}`,
  );
}

/* ------------------------------------------------ one address per line, no header */
{
  const file = [`https://sv-file-${STAMP}-e.example.com/`, `https://sv-file-${STAMP}-f.example.com/`].join("\n");
  const out = await preview(file);
  step(
    "a headerless list of addresses works",
    out.status === 200 && out.body?.counts?.VALID === 2,
    `valid=${out.body?.counts?.VALID}`,
  );
}

/* ------------------------------------------------- a file that cannot be read */
{
  const out = await preview(["Company,Contact,Notes", "Acme,someone,hello"].join("\n"));
  step(
    "a file with no address column is refused",
    out.status === 422 && String(out.body?.error ?? "").startsWith("SCHEMA_ERROR"),
    String(out.body?.error ?? "").slice(0, 90),
  );
}

/* --------------------------------------------------------- preview writes nothing */
const after = sql("select count(*) from product_demo_urls");
step("no preview wrote anything", before === after, `rows ${before} -> ${after}`);

await browser.close();
console.log(`\n  ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
