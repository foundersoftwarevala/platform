/**
 * The review queue, end to end: an address the matcher will not place is taken
 * in, appears in the queue, is given a product by an operator, and the decision
 * is recorded. The row is removed afterwards.
 *
 *   node scripts/ops/demo-review-e2e.mjs
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
const URL_UNDER_TEST = `https://sv-review-${STAMP}.example.com`;

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
const page = await (await browser.newContext({ viewport: { width: 1600, height: 1100 } })).newPage();
const problems = [];
page.on("pageerror", (e) => problems.push(String(e).slice(0, 120)));

await page.goto(`${SITE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(4000);
await page.fill('input[type="email"]', ops.SV_LOGIN_CONTROL_PANEL);
await page.fill('input[type="password"]', ops.SV_PW_CONTROL_PANEL);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 });
await page.waitForTimeout(2000);

const api = (body) =>
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
    return { status: r.status, body: await r.json() };
  }, body);

// An address with a name nothing is called: the matcher must refuse to place it.
const taken = await api({
  action: "commit",
  rows: [{ url: URL_UNDER_TEST, name: `Nothing Is Called This ${STAMP}` }],
});
step(
  "an unplaceable address is taken in unassigned",
  taken.status === 200 && taken.body?.totals?.UNMATCHED === 1,
  `unmatched=${taken.body?.totals?.UNMATCHED}`,
);

const demoId = sql(`select id from product_demo_urls where url = '${URL_UNDER_TEST}'`);
step("it is in the canonical table with no product", demoId !== "NULL", demoId.slice(0, 8));

const inQueue = sql(
  `select jsonb_array_length(mm_demo_ops(30)->'review')`,
);
step("the ops overview shows it waiting", Number(inQueue) >= 1, `waiting=${inQueue}`);

/* ------------------------------------------- the operator assigns a product */
const product = sql(
  "select slug from marketplace_products where visible and moderation_status='approved' order by created_at limit 1",
);
const resolved = await api({ action: "resolve", demoUrlId: demoId, product });
step("the operator can assign it", resolved.status === 200, `http=${resolved.status} ${JSON.stringify(resolved.body).slice(0, 80)}`);

const nowOn = sql(
  `select p.slug from product_demo_urls d join marketplace_products p on p.id=d.product_id where d.url='${URL_UNDER_TEST}'`,
);
step("the canonical mapping is written", nowOn === product, `${nowOn} (wanted ${product})`);

const recorded = sql(
  `select processing->'assignment'->>'previous_state' from product_demo_urls where url='${URL_UNDER_TEST}'`,
);
step("the state it overruled is kept", recorded === "UNMATCHED", `previous_state=${recorded}`);

const audited = sql(
  `select count(*) from demo_url_audit_log where demo_url_id = '${demoId}' and action='demo_url.assignment.resolved'`,
);
step("the decision is in the audit log", Number(audited) === 1, `rows=${audited}`);

// A second resolve must not move a mapping that now exists.
const again = await api({ action: "resolve", demoUrlId: demoId, product });
step("an existing mapping is not overwritten", again.status === 409, `http=${again.status}`);

/* -------------------------------------------------- the screen an operator uses */
await page.goto(`${SITE}/demo-ops`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(11_000);
const queueTab = page.getByText("Review Queue", { exact: true }).first();
step("the Review Queue section exists", (await queueTab.count()) > 0);
if (await queueTab.count()) {
  await queueTab.click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(8000);
  // The mismatch list sits below the queue, so the whole page is read.
  const text = await page.evaluate(() => document.body.innerText || "");
  step(
    "it renders without falling over",
    !text.includes("didn't load") && problems.length === 0,
    problems[0] ?? "no page errors",
  );
  step("the mismatch list is on screen", /Category mismatch/i.test(text), "");
}

// Re-process, on the same screen, through the real pipeline.
await page.goto(`${SITE}/demo-ops`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(10000);
const reTab = page.getByText("Re-process", { exact: true }).first();
step("the Re-process section exists", (await reTab.count()) > 0);
if (await reTab.count()) {
  await reTab.click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(8000);
  const rows = await page.locator("[data-reprocess]").count();
  step("it lists the assigned demos", rows > 0, `rows=${rows}`);
  const txt = await page.evaluate(() => document.body.innerText || "");
  step("it renders without falling over", !txt.includes("didn't load"), "");
}

await browser.close();

execFileSync(
  process.execPath,
  ["scripts/ops/db.mjs", "--sql", `delete from product_demo_urls where url = '${URL_UNDER_TEST}'`],
  { encoding: "utf8", timeout: 120_000 },
);
console.log(`\n  cleaned up the row this check created`);
console.log(`  ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
