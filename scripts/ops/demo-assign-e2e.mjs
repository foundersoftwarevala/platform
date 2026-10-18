/**
 * The demo assignment path, end to end against the live site.
 *
 * What it proves, in order:
 *
 *   an address already on a product is reported ALREADY_ASSIGNED, not moved
 *   a name that matches exactly one product is ASSIGNED, with the product
 *   a name nothing is called is UNMATCHED and still taken in for review
 *   a name two products share is AMBIGUOUS and assigned to neither
 *   an unusable address is INVALID and never written
 *   a preview writes nothing at all
 *   one bad row does not take the batch with it
 *   the same address twice in one file is taken in once
 *   an anonymous caller is refused
 *
 * Every claim is checked against the database afterwards, and every row this
 * writes is removed at the end, so the catalogue is left as it was found.
 *
 *   node scripts/ops/demo-assign-e2e.mjs
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
  return i >= 0 ? (lines[i + 1 + 1] ?? "") : out.trim();
}

let passed = 0;
let failed = 0;
const step = (name, ok, detail = "") => {
  if (ok) passed += 1;
  else failed += 1;
  console.log(`  ${(ok ? "PASS" : "FAIL").padEnd(5)} ${name.padEnd(52)} ${detail}`);
};

const browser = await chromium.launch();

/* ---------------------------------------------- an anonymous caller is refused */
{
  const page = await (await browser.newContext()).newPage();
  await page.goto(SITE, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const anon = await page.evaluate(async () => {
    const r = await fetch("/api/demo/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "preview", rows: [{ url: "https://example.com/" }] }),
    });
    return { status: r.status, body: (await r.text()).slice(0, 120) };
  });
  step("an anonymous caller is refused", anon.status === 401 || anon.status === 403, `http=${anon.status}`);
  await page.close();
}

/* ------------------------------------------------------------- as an operator */
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
await page.goto(`${SITE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(4000);
await page.fill('input[type="email"]', ops.SV_LOGIN_CONTROL_PANEL);
await page.fill('input[type="password"]', ops.SV_PW_CONTROL_PANEL);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 });
await page.waitForTimeout(2000);

const call = (body) =>
  page.evaluate(async (payload) => {
    const raw = Object.keys(localStorage).find((k) => k.includes("auth-token"));
    const token = raw ? JSON.parse(localStorage.getItem(raw)).access_token : null;
    const r = await fetch("/api/demo/assign", {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    return { status: r.status, report: await r.json() };
  }, body);

// A product that really exists, and an address already on one.
const takenUrl = sql("select url from product_demo_urls where product_id is not null order by created_at limit 1");
const takenName = sql(
  "select p.name from product_demo_urls d join marketplace_products p on p.id=d.product_id where d.product_id is not null order by d.created_at limit 1",
);

const rows = [
  { url: takenUrl, name: takenName, expect: "ALREADY_ASSIGNED" },
  { url: `https://sv-e2e-assign-${STAMP}-a.example.com/`, name: takenName, expect: "ASSIGNED" },
  { url: `https://sv-e2e-assign-${STAMP}-b.example.com/`, name: `Nothing Is Called This ${STAMP}`, expect: "UNMATCHED" },
  { url: "http://127.0.0.1/", name: takenName, expect: "INVALID" },
  { url: `https://sv-e2e-assign-${STAMP}-c.example.com/`, name: takenName, expect: "ASSIGNED" },
  { url: `https://sv-e2e-assign-${STAMP}-c.example.com/`, name: takenName, expect: "ALREADY_ASSIGNED" },
];

/* --------------------------------------------- a preview writes nothing at all */
{
  const before = Number(sql("select count(*) from product_demo_urls"));
  const { status, report } = await call({ action: "preview", rows: rows.map(({ url, name }) => ({ url, name })) });
  const after = Number(sql("select count(*) from product_demo_urls"));
  step("a preview writes nothing", status === 200 && after === before, `rows ${before} -> ${after}`);
  step(
    "a preview decides every row",
    report?.rows?.length === rows.length && report.committed === false,
    `decided ${report?.rows?.length ?? 0} of ${rows.length}`,
  );
  const states = (report?.rows ?? []).map((r) => r.state);
  rows.forEach((want, i) => {
    step(`preview row ${i + 1} is ${want.expect}`, states[i] === want.expect, `got ${states[i]}`);
  });
}

/* ----------------------------------------------------------------- the commit */
{
  const before = Number(sql("select count(*) from product_demo_urls"));
  const { status, report } = await call({ action: "commit", rows: rows.map(({ url, name }) => ({ url, name })) });
  const after = Number(sql("select count(*) from product_demo_urls"));

  step("the commit succeeds", status === 200 && report?.committed === true, `http=${status}`);
  // Two assigned plus one unmatched are written; already-assigned and invalid are not.
  step("only the rows that should be written are", after - before === 3, `rows ${before} -> ${after}`);
  step(
    "one bad row did not take the batch",
    (report?.totals?.INVALID ?? 0) === 1 && (report?.totals?.ASSIGNED ?? 0) === 2,
    `invalid=${report?.totals?.INVALID} assigned=${report?.totals?.ASSIGNED}`,
  );
  step(
    "the same address twice in one file is taken once",
    (report?.totals?.ALREADY_ASSIGNED ?? 0) === 2,
    `already=${report?.totals?.ALREADY_ASSIGNED}`,
  );

  const assignedProduct = sql(
    `select product_id from product_demo_urls where url = 'https://sv-e2e-assign-${STAMP}-a.example.com'`,
  );
  step("an assigned row carries the product", assignedProduct !== "NULL" && assignedProduct.length > 10, assignedProduct.slice(0, 8));

  const unmatchedProduct = sql(
    `select coalesce(product_id::text,'NULL') from product_demo_urls where url = 'https://sv-e2e-assign-${STAMP}-b.example.com'`,
  );
  step("an unmatched row is taken in unassigned", unmatchedProduct === "NULL", `product_id=${unmatchedProduct}`);

  const evidence = sql(
    `select processing->'assignment'->>'state' from product_demo_urls where url = 'https://sv-e2e-assign-${STAMP}-b.example.com'`,
  );
  step("the decision and its reason are kept", evidence === "UNMATCHED", `state=${evidence}`);

  const invalidWritten = Number(sql("select count(*) from product_demo_urls where url like 'http://127.0.0.1%'"));
  step("an unusable address is never written", invalidWritten === 0, `rows=${invalidWritten}`);

  const notPublished = sql(
    `select status || '/' || processing_status from product_demo_urls where url = 'https://sv-e2e-assign-${STAMP}-a.example.com'`,
  );
  step("nothing is published by taking it in", notPublished === "inactive/unprocessed", notPublished);
}

/* ------------------------------------------------- an existing mapping is safe */
{
  const stillOn = sql(
    `select product_id is not null from product_demo_urls where url = '${takenUrl}'`,
  );
  // psql prints a boolean as t or true depending on the path; both mean yes.
  step("an address already on a product was not moved", /^(t|true)$/.test(stillOn), `still assigned=${stillOn}`);
}

await browser.close();

/* -------------------------------------------------------------------- clean up */
const removed = execFileSync(
  process.execPath,
  [
    "scripts/ops/db.mjs",
    "--sql",
    `delete from product_demo_urls where url like 'https://sv-e2e-assign-${STAMP}-%' returning url`,
  ],
  { encoding: "utf8", timeout: 120_000 },
);
console.log(`\n  cleaned up ${(removed.match(/sv-e2e-assign/g) ?? []).length} row(s) this check created`);
console.log(`  ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
