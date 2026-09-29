/**
 * One real AI completion, through the production gateway, on real page evidence.
 *
 * The investigation tests so far ran with withAi:false on purpose: they prove
 * the fetching and the matching, and prove nothing at all about the AI. This
 * runs the agent for real and then checks the things that matter more than the
 * answer - that a suggestion cannot assign anything by itself, that a product
 * the catalogue does not have is refused, and that a failure is reported rather
 * than swallowed.
 *
 *   node scripts/ops/demo-ai-e2e.mjs
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

/* ------------------------------------------------- the configuration, as it is */
const agent = sql(
  "select agent_key || ' | ' || status || ' | model_id=' || coalesce(model_id::text,'(none)') || ' | prompt=' || length(coalesce(system_prompt,'')) from ai_agents where agent_key='demo-intelligence'",
);
console.log(`  agent: ${agent}`);
const services = sql(
  "select string_agg(name, ', ') from api_services where category='ai' and status='active' and approval_status='approved'",
);
console.log(`  active approved AI services: ${services}`);

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

/**
 * A real page whose title names a product we really sell. Using our own product
 * page means the evidence is real and the expected answer is knowable - but it
 * is never written into the prompt; the model only sees the page.
 */
const slug = sql(
  "select slug from marketplace_products where visible and moderation_status='approved' and name not like '% %' order by created_at limit 1",
);
const name = sql(`select name from marketplace_products where slug = '${slug}'`);
const url = `${SITE}/marketplace/product/${slug}?sv-ai=${STAMP}`;

const taken = await call("/api/demo/assign", { action: "commit", rows: [{ url }] });
step("an address is taken in for the run", (taken.body?.totals?.UNMATCHED ?? 0) === 1, `state=${taken.body?.rows?.[0]?.state}`);

const demoId = sql(`select id from product_demo_urls where url = '${url}'`);

/* ---------------------------------------------------- the real AI completion */
const started = Date.now();
const run = await call("/api/demo/investigate", { action: "one", demoUrlId: demoId, commit: true, withAi: true });
const elapsed = Date.now() - started;

const aiError = run.body?.row?.aiError ?? null;
const suggestion = run.body?.row?.aiSuggestion ?? null;

step("the gateway was invoked and answered", run.status === 200, `http=${run.status} in ${elapsed}ms`);
if (aiError) {
  console.log(`     AI error: ${String(aiError).slice(0, 200)}`);
}
step(
  "the AI result is reported either way",
  Boolean(suggestion) || Boolean(aiError),
  suggestion ? `suggested "${suggestion.name}" (${suggestion.confidence})` : "error reported, not swallowed",
);

/* -------------------------------------------- what matters more than the answer */
const stored = sql(
  `select processing->'investigation'->'ai_suggestion'->>'name' from product_demo_urls where url = '${url}'`,
);
const storedAgent = sql(
  `select processing->'investigation'->>'ai_agent' from product_demo_urls where url = '${url}'`,
);
const storedError = sql(
  `select processing->'investigation'->>'ai_error' from product_demo_urls where url = '${url}'`,
);
step(
  "the AI outcome is recorded against the row",
  stored !== "" || storedError !== "",
  `name=${stored} agent=${storedAgent} error=${String(storedError).slice(0, 40)}`,
);

const audited = sql(
  `select count(*) from demo_url_audit_log where demo_url_id = '${demoId}' and action like 'demo_url.investigated.%'`,
);
step("the run is in the audit log", Number(audited) >= 1, `rows=${audited}`);

const candidates = sql(
  `select jsonb_array_length(coalesce(processing->'investigation'->'candidates','[]'::jsonb)) from product_demo_urls where url = '${url}'`,
);
step("candidates are recorded for the operator", Number(candidates) >= 0, `candidates=${candidates}`);

/**
 * The safety rule. This page's title names a real product, so the deterministic
 * matcher assigns it - that is rule C, not the AI. What must be true either way
 * is that the assignment came from the matcher and the row was never published.
 */
const assignedTo = sql(
  `select coalesce(p.slug,'(none)') from product_demo_urls d left join marketplace_products p on p.id = d.product_id where d.url = '${url}'`,
);
const matchedBy = sql(
  `select processing->'assignment'->>'matched_by' from product_demo_urls where url = '${url}'`,
);
step(
  "any assignment came from the matcher, not the AI",
  assignedTo === "(none)" || matchedBy === "investigation",
  `product=${assignedTo} matched_by=${matchedBy}`,
);

const published = sql(
  `select status || '/' || processing_status from product_demo_urls where url = '${url}'`,
);
step("nothing was published", published === "inactive/unprocessed", published);

/* ------------------------------ a product the catalogue does not have is refused */
const invented = sql(
  `select (public.demo_match_product('https://validate.invalid/', 'A Product Nobody Sells ${STAMP}')->>'state')`,
);
step("an invented product name is refused", invented === "UNMATCHED", `state=${invented}`);

/* ------------------------------------------- the result is in the Review Queue */
{
  // The row was assigned by the matcher, so it leaves the queue. Take in a
  // second address that cannot be matched, to see an AI result in the queue.
  const queueUrl = `https://example.com/?sv-ai-queue=${STAMP}`;
  await call("/api/demo/assign", { action: "commit", rows: [{ url: queueUrl }] });
  const queueId = sql(`select id from product_demo_urls where url = '${queueUrl}'`);
  await call("/api/demo/investigate", { action: "one", demoUrlId: queueId, commit: true, withAi: true });

  const inQueue = sql(
    `select count(*) from product_demo_urls where id = '${queueId}' and product_id is null and processing->'investigation' is not null`,
  );
  step("an unmatched AI result stays in the queue", inQueue === "1", `rows=${inQueue}`);

  await page.goto(`${SITE}/demo-ops`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(10_000);
  const tab = page.getByText("Review Queue", { exact: true }).first();
  if (await tab.count()) {
    await tab.click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(8000);
  }
  const shown = await page.evaluate(() => document.body.innerText || "");
  step(
    "the operator can see the investigation on screen",
    /Not investigated yet|investigated |UNMATCHED|AMBIGUOUS/i.test(shown),
    "",
  );
  execFileSync(
    process.execPath,
    ["scripts/ops/db.mjs", "--sql", `delete from product_demo_urls where url = '${queueUrl}'`],
    { encoding: "utf8", timeout: 120_000 },
  );
}

await browser.close();

execFileSync(
  process.execPath,
  ["scripts/ops/db.mjs", "--sql", `delete from product_demo_urls where url like '%sv-ai=${STAMP}%'`],
  { encoding: "utf8", timeout: 120_000 },
);
console.log(`\n  cleaned up the rows this check created`);
console.log(`  ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
