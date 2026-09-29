/**
 * Batches of two to five hundred, proved on the live server.
 *
 * The twelve thousand arrive as batches, so what has to be true is not "twelve
 * thousand can be imported" but "one batch is safe": it is refused if it is too
 * big, it is previewed without writing, it is committed once, it cannot be
 * committed against a different file, a batch that half-works says so, and
 * nothing that happens to one batch touches another.
 *
 * Every address here is created by this run and deleted at the end.
 *
 *   node scripts/ops/demo-batch-e2e.mjs
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
const STAMP = Date.now().toString(36);
const host = (n) => `https://sv-batch-${STAMP}-${n}.example.com/`;

function sql(query) {
  const out = execFileSync(
    process.execPath,
    ["scripts/ops/db.mjs", "--sql", `select coalesce((${query})::text, 'NULL') as answer`],
    { encoding: "utf8", timeout: 180_000 },
  );
  const lines = out.split("\n").map((l) => l.trim());
  const i = lines.findIndex((l) => l === "answer");
  return i >= 0 ? (lines[i + 2] ?? "") : out.trim();
}
const run = (statement) =>
  execFileSync(process.execPath, ["scripts/ops/db.mjs", "--sql", statement], {
    encoding: "utf8",
    timeout: 180_000,
  });

let passed = 0;
let failed = 0;
const step = (name, ok, detail = "") => {
  ok ? (passed += 1) : (failed += 1);
  console.log(`  ${(ok ? "PASS" : "FAIL").padEnd(5)} ${name.padEnd(56)} ${detail}`);
};

const slug = sql(
  "select slug from marketplace_products where visible and moderation_status='approved' order by created_at limit 1",
);
const takenUrl = sql("select url from product_demo_urls where product_id is not null order by created_at limit 1");
const takenProduct = sql(
  `select product_id from product_demo_urls where url = '${takenUrl}' limit 1`,
);

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(180_000);
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

const assign = (payload) => call("/api/demo/assign", payload);
const fileOf = (urls) => ["url", ...urls].join("\n");

/* ------------------------------------------------------- one address is a batch */
{
  const before = sql("select count(*) from product_demo_urls");
  const preview = await assign({ action: "file-preview", text: fileOf([host("one")]), filename: "one.csv" });
  step("a batch of one is previewed", preview.status === 200 && preview.body.counts.VALID === 1, `valid=${preview.body?.counts?.VALID}`);
  step("the preview is given a batch id", /^[0-9a-f-]{36}$/i.test(String(preview.body?.batchId)), String(preview.body?.batchId).slice(0, 8));

  const during = sql("select count(*) from product_demo_urls");
  step("the preview wrote nothing", before === during, `rows ${before} -> ${during}`);

  const commit = await assign({ action: "commit", batchId: preview.body.batchId, rows: preview.body.rows });
  step("it commits", commit.status === 200 && commit.body.totals.UNMATCHED === 1, `status=${commit.body?.status}`);
  step("the batch is recorded as committed", commit.body?.status === "COMMITTED", String(commit.body?.status));

  const stored = sql(
    `select processing->'assignment'->>'batch_id' from product_demo_urls where url = '${host("one").replace(/\/$/, "")}'`,
  );
  step("the row carries the batch it came from", stored === preview.body.batchId, stored.slice(0, 8));

  /* ------------------------------------------------ a batch is committed once */
  const again = await assign({ action: "commit", batchId: preview.body.batchId, rows: preview.body.rows });
  step(
    "a second commit of the same batch is refused",
    again.status === 409 && again.body.error === "BATCH_ALREADY_COMMITTED",
    `${again.status} ${again.body?.error}`,
  );

  /* ------------------------------ committing a different file against that batch */
  const other = await assign({
    action: "file-preview",
    text: fileOf([host("stale-a"), host("stale-b")]),
    filename: "stale.csv",
    register: true,
  });
  const stale = await assign({ action: "commit", batchId: other.body.batchId, rows: [{ url: host("not-in-that-file") }] });
  step(
    "committing addresses that were not previewed is refused",
    stale.status === 409 && stale.body.error === "STALE_PREVIEW",
    `${stale.status} ${stale.body?.error}`,
  );
  await assign({ action: "cancel", batchId: other.body.batchId });
}

/* ------------------------------------------------------------- two hundred */
{
  const urls = Array.from({ length: 200 }, (_, i) => host(`c200-${i}`));
  const started = Date.now();
  const preview = await assign({ action: "file-preview", text: fileOf(urls), filename: "200.csv" });
  step("two hundred are previewed", preview.status === 200 && preview.body.counts.VALID === 200, `valid=${preview.body?.counts?.VALID}`);

  const commit = await assign({ action: "commit", batchId: preview.body.batchId, rows: preview.body.rows });
  const taken = sql(
    `select count(*) from product_demo_urls where processing->'assignment'->>'batch_id' = '${preview.body.batchId}'`,
  );
  step("two hundred are taken in", commit.status === 200 && taken === "200", `rows=${taken} in ${Date.now() - started}ms`);

  const progress = await assign({ action: "batch", batchId: preview.body.batchId });
  step(
    "the batch reports its own progress",
    progress.status === 200 && progress.body.progress.ROWS_TAKEN === 200 && progress.body.progress.PENDING_INVESTIGATION === 200,
    `taken=${progress.body?.progress?.ROWS_TAKEN} pending=${progress.body?.progress?.PENDING_INVESTIGATION}`,
  );
}

/* --------------------------------------------------------------- five hundred */
let bigBatchId = null;
{
  const urls = Array.from({ length: 500 }, (_, i) => host(`c500-${i}`));
  const started = Date.now();
  const preview = await assign({ action: "file-preview", text: fileOf(urls), filename: "500.csv" });
  step("five hundred are previewed", preview.status === 200 && preview.body.counts.VALID === 500, `valid=${preview.body?.counts?.VALID}`);

  const commit = await assign({ action: "commit", batchId: preview.body.batchId, rows: preview.body.rows });
  bigBatchId = preview.body.batchId;
  const taken = sql(
    `select count(*) from product_demo_urls where processing->'assignment'->>'batch_id' = '${bigBatchId}'`,
  );
  step("five hundred are taken in", commit.status === 200 && taken === "500", `rows=${taken} in ${Date.now() - started}ms`);
}

/* ------------------------------------------------------- five hundred and one */
{
  const before = sql("select count(*) from product_demo_urls");
  const urls = Array.from({ length: 501 }, (_, i) => host(`over-${i}`));
  const preview = await assign({ action: "file-preview", text: fileOf(urls), filename: "501.csv" });
  step(
    "five hundred and one is refused",
    preview.status === 413 && preview.body.error === "BATCH_SIZE_EXCEEDED",
    `${preview.status} ${preview.body?.error}`,
  );
  step(
    "the refusal names both numbers",
    preview.body?.received === 501 && preview.body?.maximum === 500,
    `received=${preview.body?.received} maximum=${preview.body?.maximum}`,
  );

  const direct = await assign({ action: "commit", rows: urls.map((url) => ({ url })) });
  step(
    "the same limit applies to a direct commit",
    direct.status === 413 && direct.body.error === "BATCH_SIZE_EXCEEDED",
    `${direct.status} ${direct.body?.error}`,
  );

  const after = sql("select count(*) from product_demo_urls");
  step("an oversized batch wrote nothing at all", before === after, `rows ${before} -> ${after}`);
}

/* ----------------------------------------------------------------- duplicates */
{
  const twice = host("dup-in-file");
  const preview = await assign({ action: "file-preview", text: fileOf([twice, twice, host("dup-other")]), filename: "dup.csv" });
  step(
    "the same address twice in one file counts once",
    preview.body?.counts?.DUPLICATE_IN_FILE === 1 && preview.body?.counts?.VALID === 2,
    `in_file=${preview.body?.counts?.DUPLICATE_IN_FILE} valid=${preview.body?.counts?.VALID}`,
  );
  await assign({ action: "commit", batchId: preview.body.batchId, rows: preview.body.rows });

  // The same address in a later batch: recognised, not taken in again.
  const second = await assign({ action: "file-preview", text: fileOf([twice, host("dup-new")]), filename: "dup2.csv" });
  step(
    "an address an earlier batch holds is a duplicate",
    second.body?.counts?.DUPLICATE_ACROSS_BATCHES === 1,
    `across=${second.body?.counts?.DUPLICATE_ACROSS_BATCHES}`,
  );

  const commit = await assign({ action: "commit", batchId: second.body.batchId, rows: second.body.rows });
  const rows = sql(
    `select count(*) from product_demo_urls where url = '${twice.replace(/\/$/, "")}'`,
  );
  step("it is not taken in twice", rows === "1" && commit.body.totals.DUPLICATE === 1, `rows=${rows}`);
}

/* ------------------------------------- a mixed batch, and partial completion */
{
  const text = [
    "Demo URL,Product Slug",
    `${host("mix-a")},${slug}`,
    `${host("mix-b")},`,
    `${takenUrl},`,
    "not-a-url,",
    "http://127.0.0.1:9000/,",
  ].join("\n");

  const preview = await assign({ action: "file-preview", text, filename: "mixed.csv" });
  const c = preview.body?.counts ?? {};
  step(
    "a mixed batch is classified line by line",
    c.EXPLICIT_PRODUCT_MATCH === 1 && c.ALREADY_ASSIGNED === 1 && c.INVALID >= 1,
    `explicit=${c.EXPLICIT_PRODUCT_MATCH} already=${c.ALREADY_ASSIGNED} invalid=${c.INVALID}`,
  );

  const commit = await assign({ action: "commit", batchId: preview.body.batchId, rows: preview.body.rows });
  step(
    "a batch with a refused line is partially completed",
    commit.body?.status === "PARTIALLY_COMPLETED",
    `status=${commit.body?.status} totals=${JSON.stringify(commit.body?.totals)}`,
  );

  const stillOn = sql(`select product_id from product_demo_urls where url = '${takenUrl}'`);
  step("the address already on a product keeps it", stillOn === takenProduct, stillOn.slice(0, 8));
}

/* ----------------------------------------- investigating one batch, resumably */
{
  const first = await call("/api/demo/investigate", {
    action: "commit",
    batchId: bigBatchId,
    limit: 3,
    withAi: false,
  });
  step(
    "an investigation can be scoped to one batch",
    first.status === 200 && first.body.rows.length === 3,
    `rows=${first.body?.rows?.length} remaining=${first.body?.remainingPending}`,
  );
  step(
    "it only touched this batch's addresses",
    (first.body?.rows ?? []).every((r) => r.url.includes(`sv-batch-${STAMP}-c500-`)),
    "",
  );

  const investigatedAfterFirst = sql(
    `select count(*) from product_demo_urls where processing->'assignment'->>'batch_id' = '${bigBatchId}' and processing->'investigation' is not null`,
  );

  const second = await call("/api/demo/investigate", {
    action: "commit",
    batchId: bigBatchId,
    limit: 3,
    withAi: false,
  });
  const investigatedAfterSecond = sql(
    `select count(*) from product_demo_urls where processing->'assignment'->>'batch_id' = '${bigBatchId}' and processing->'investigation' is not null`,
  );
  step(
    "starting again continues rather than repeating",
    Number(investigatedAfterSecond) === Number(investigatedAfterFirst) + 3 &&
      (second.body?.rows ?? []).every((r) => !(first.body?.rows ?? []).some((f) => f.url === r.url)),
    `${investigatedAfterFirst} -> ${investigatedAfterSecond}`,
  );

  /* ----------------------------------------------------------------- retrying */
  const noRetry = await call("/api/demo/investigate", {
    action: "preview",
    batchId: bigBatchId,
    limit: 3,
    withAi: false,
    retryFailed: false,
  });
  const retried = await call("/api/demo/investigate", {
    action: "preview",
    batchId: bigBatchId,
    limit: 3,
    withAi: false,
    retryFailed: true,
  });
  step(
    "a failure is retried only when retry is asked for",
    (noRetry.body?.rows ?? []).every((r) => !(second.body?.rows ?? []).some((s) => s.url === r.url)) &&
      retried.status === 200,
    `plain=${noRetry.body?.rows?.length} retry=${retried.body?.rows?.length}`,
  );

  const progress = await assign({ action: "batch", batchId: bigBatchId });
  step(
    "progress counts what has actually been done",
    progress.body?.progress?.INVESTIGATED === Number(investigatedAfterSecond),
    `investigated=${progress.body?.progress?.INVESTIGATED} retryable=${progress.body?.progress?.RETRYABLE}`,
  );
}

/* ----------------------------------------------------------- history and audit */
{
  const history = await assign({ action: "batches", limit: 50 });
  const mine = (history.body?.batches ?? []).filter((b) =>
    ["one.csv", "200.csv", "500.csv", "dup.csv", "dup2.csv", "mixed.csv", "stale.csv"].includes(b.source_filename),
  );
  step("every batch is in the history", mine.length >= 6, `batches=${mine.length}`);

  const five = mine.find((b) => b.source_filename === "500.csv");
  step(
    "the history carries each batch's real counts",
    five && five.rows_taken === 500 && five.total_rows === 500,
    five ? `taken=${five.rows_taken} status=${five.status}` : "not found",
  );

  const cancelled = (history.body?.batches ?? []).find((b) => b.source_filename === "stale.csv");
  step("a cancelled batch says so and holds no rows", cancelled?.status === "CANCELLED" && cancelled?.rows_taken === 0, String(cancelled?.status));

  const untouched = mine.find((b) => b.source_filename === "200.csv");
  step(
    "a batch that failed elsewhere left this one alone",
    untouched && untouched.rows_taken === 200,
    `taken=${untouched?.rows_taken}`,
  );
}

await browser.close();

/* -------------------------------------------------------------------- cleanup */
run(
  `delete from demo_url_audit_log where demo_url_id in (select id from product_demo_urls where url like '%sv-batch-${STAMP}-%')`,
);
run(`delete from product_demo_urls where url like '%sv-batch-${STAMP}-%'`);
run(
  `delete from demo_intake_batches where source_filename in ('one.csv','200.csv','500.csv','501.csv','dup.csv','dup2.csv','mixed.csv','stale.csv')`,
);
console.log("\n  cleaned up every address and batch this check created");
console.log(`  ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
