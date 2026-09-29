/**
 * The investigation pipeline, end to end against the live site.
 *
 * Three addresses are taken in unassigned and then investigated:
 *   one real page whose title names a product in the catalogue  -> MATCHED
 *   one real page whose title names nothing we sell             -> UNMATCHED
 *   one host that does not resolve                              -> FETCH_FAILED
 *
 * Plus the safety rules: a private address is refused before any request is
 * made, preview writes nothing, and the batch is resumable.
 *
 * Every row it creates is removed at the end.
 *
 *   node scripts/ops/demo-investigate-e2e.mjs
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
  console.log(`  ${(ok ? "PASS" : "FAIL").padEnd(5)} ${name.padEnd(54)} ${detail}`);
};

const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
await page.goto(`${SITE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(4000);
await page.fill('input[type="email"]', ops.SV_LOGIN_CONTROL_PANEL);
await page.fill('input[type="password"]', ops.SV_PW_CONTROL_PANEL);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 });
await page.waitForTimeout(2000);

const call = (path, payload) =>
  page.evaluate(
    async ([p, body]) => {
      const raw = Object.keys(localStorage).find((k) => k.includes("auth-token"));
      const token = raw ? JSON.parse(localStorage.getItem(raw)).access_token : null;
      const r = await fetch(p, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      return { status: r.status, body: await r.json() };
    },
    [path, payload],
  );

/* --------------------------------------------- a private address is refused */
{
  const ssrf = await call("/api/demo/assign", {
    action: "commit",
    rows: [
      { url: "http://169.254.169.254/latest/meta-data/" },
      { url: "http://127.0.0.1:3000/" },
      { url: "http://10.0.0.5/" },
    ],
  });
  step(
    "private and metadata addresses are refused at intake",
    ssrf.body?.totals?.INVALID === 3,
    `invalid=${ssrf.body?.totals?.INVALID}`,
  );
  const written = sql(
    "select count(*) from product_demo_urls where url like 'http://169.254%' or url like 'http://127.0.0.1%' or url like 'http://10.0.0.5%'",
  );
  step("none of them was written", written === "0", `rows=${written}`);
}

/* ------------------------------- three addresses taken in, then investigated */
// A page whose <title> really is a product we sell: our own product page.
const knownSlug = sql(
  "select slug from marketplace_products where visible and moderation_status='approved' and name not like '% %' order by created_at limit 1",
);
const knownName = sql(
  `select name from marketplace_products where slug = '${knownSlug}'`,
);

const urls = [
  { url: `${SITE}/marketplace/product/${knownSlug}?sv-e2e=${STAMP}`, expect: "page that names a product" },
  { url: `https://example.com/?sv-e2e=${STAMP}`, expect: "page that names nothing we sell" },
  { url: `https://sv-nothing-here-${STAMP}.example.com/`, expect: "host that does not resolve" },
];

const taken = await call("/api/demo/assign", {
  action: "commit",
  rows: urls.map((u) => ({ url: u.url })),
});
step(
  "three addresses are taken in unassigned",
  (taken.body?.totals?.UNMATCHED ?? 0) === 3,
  `unmatched=${taken.body?.totals?.UNMATCHED}`,
);

/* -------------------------------------------------- preview writes nothing */
{
  const before = sql("select count(*) from product_demo_urls where product_id is not null");
  const preview = await call("/api/demo/investigate", { action: "preview", limit: 10, withAi: false });
  const after = sql("select count(*) from product_demo_urls where product_id is not null");
  step("a preview investigates", preview.status === 200 && (preview.body?.rows?.length ?? 0) >= 3,
    `rows=${preview.body?.rows?.length}`);
  step("a preview assigns nothing", before === after, `assigned ${before} -> ${after}`);
  step("a preview records nothing", sql(
    `select count(*) from product_demo_urls where url like '%sv-e2e=${STAMP}%' and processing->'investigation' is not null`,
  ) === "0");

  // Addresses are stored without a trailing slash, so keys are compared that way.
  const key = (u) => String(u).replace(//+$/, "");
  const states = Object.fromEntries((preview.body?.rows ?? []).map((r) => [key(r.url), r.state]));
  step("the product page is matched from its title", states[key(urls[0].url)] === "MATCHED", `${states[key(urls[0].url)]} (${knownName})`);
  step("a page naming nothing we sell stays unmatched", states[key(urls[1].url)] === "UNMATCHED", states[key(urls[1].url)]);
  step("an unreachable host is FETCH_FAILED", states[key(urls[2].url)] === "FETCH_FAILED", states[key(urls[2].url)]);
}

/* ------------------------------------------------------------- the commit */
{
  const commit = await call("/api/demo/investigate", { action: "commit", limit: 10, withAi: false });
  step("the commit runs", commit.status === 200, `http=${commit.status}`);

  const matchedProduct = sql(
    `select p.slug from product_demo_urls d join marketplace_products p on p.id=d.product_id where d.url like '%${knownSlug}?sv-e2e=${STAMP}%'`,
  );
  step("only the certain one is assigned", matchedProduct === knownSlug, `${matchedProduct}`);

  const stillUnassigned = sql(
    `select count(*) from product_demo_urls where url like '%sv-e2e=${STAMP}%' and product_id is null`,
  );
  step("the uncertain ones stay unassigned", stillUnassigned === "1", `rows=${stillUnassigned}`);

  const notPublished = sql(
    `select status || '/' || processing_status from product_demo_urls where url like '%${knownSlug}?sv-e2e=${STAMP}%'`,
  );
  step("nothing is published by investigating", notPublished === "inactive/unprocessed", notPublished);

  const evidence = sql(
    `select processing->'investigation'->'evidence'->>'title' from product_demo_urls where url like '%${knownSlug}?sv-e2e=${STAMP}%'`,
  );
  step("the evidence is kept", evidence !== "NULL" && evidence.length > 3, evidence.slice(0, 40));

  const audited = sql(
    `select count(*) from demo_url_audit_log where action like 'demo_url.investigated.%' and created_at > now() - interval '10 minutes'`,
  );
  step("each investigation is audited", Number(audited) >= 3, `rows=${audited}`);
}

/* ------------------------------------------------------------ resumability */
{
  const again = await call("/api/demo/investigate", { action: "commit", limit: 10, withAi: false });
  const reInvestigated = (again.body?.rows ?? []).filter((r) => String(r.url).includes(`sv-e2e=${STAMP}`));
  step(
    "a second run does not re-fetch what it already answered",
    reInvestigated.length === 0,
    `re-done=${reInvestigated.length}`,
  );
}

/* -------------------------------------------- the AI path reports its state */
{
  const withAi = await call("/api/demo/investigate", { action: "preview", limit: 1, withAi: true });
  const row = (withAi.body?.rows ?? [])[0];
  const aiState = withAi.status === 409 ? "AI_CONFIGURATION_ERROR" : (row?.aiError ? "error reported" : row?.aiSuggestion ? "suggested" : "no rows left");
  step("the AI path reports honestly", withAi.status === 200 || withAi.status === 409, `${withAi.status}: ${aiState}`);
  if (row?.aiError) console.log(`     AI said: ${String(row.aiError).slice(0, 120)}`);
}

await browser.close();

execFileSync(
  process.execPath,
  ["scripts/ops/db.mjs", "--sql", `delete from product_demo_urls where url like '%sv-e2e=${STAMP}%' or url like 'https://sv-nothing-here-${STAMP}%'`],
  { encoding: "utf8", timeout: 120_000 },
);
console.log(`\n  cleaned up the rows this check created`);
console.log(`  ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
