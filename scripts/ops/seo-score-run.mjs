/**
 * Score every page the crawler knows about, a batch at a time.
 *
 * The scoring engine lives in the application, so this drives it over the
 * loopback interface rather than reimplementing it: one implementation, one
 * set of rules, and no chance of a script and a screen disagreeing about what
 * a page is worth.
 *
 * It walks with the offset the endpoint hands back, so the pass never asks for
 * the whole table at once and keeps working as the catalogue grows.
 *
 *   node scripts/ops/seo-score-run.mjs
 *   node scripts/ops/seo-score-run.mjs --batch 100
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const BATCH = Number(args.includes("--batch") ? args[args.indexOf("--batch") + 1] : 200) || 200;

/**
 * The environment the application is actually running with.
 *
 * Not the .env file beside it: those two disagree on this server, and a run
 * that read the file would score against a database the site does not use.
 * Only variable names are ever printed, never values.
 */
function appEnv() {
  const name = process.env.SV_PM2_NAME || "softwarevala-staging";
  let pid = "";
  try {
    pid = execSync(`pm2 pid ${name}`, { encoding: "utf8" }).replace(/[^0-9]/g, "");
  } catch {
    pid = "";
  }
  if (!pid) return {};
  try {
    const out = {};
    for (const item of readFileSync(`/proc/${pid}/environ`).toString("utf8").split("\0")) {
      const at = item.indexOf("=");
      if (at > 0) out[item.slice(0, at)] = item.slice(at + 1);
    }
    return out;
  } catch {
    return {};
  }
}

const env = { ...process.env, ...appEnv() };
const TOKEN = (env.INTERNAL_API_TOKEN || "").trim();
const PORT = (env.PORT || "3000").trim();
const ORIGIN = `http://127.0.0.1:${PORT}`;

if (!TOKEN) {
  console.error("INTERNAL_API_TOKEN is not set on the running application");
  process.exit(1);
}

console.log(`origin : ${ORIGIN}`);
console.log(`batch  : ${BATCH}`);
console.log("");

let offset = 0;
let considered = 0;
let scored = 0;
let skipped = 0;
let failedWrites = 0;
const bands = {};
const worst = [];

for (;;) {
  const response = await fetch(`${ORIGIN}/api/seo/score`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-internal-token": TOKEN },
    body: JSON.stringify({ limit: BATCH, offset }),
  });

  if (!response.ok) {
    console.error(`the scoring endpoint answered HTTP ${response.status}`);
    console.error((await response.text()).slice(0, 300));
    process.exit(1);
  }

  const result = await response.json();
  considered += result.considered;
  scored += result.scored;
  skipped += result.skipped_no_evidence;
  failedWrites += result.failed_writes;
  for (const [band, count] of Object.entries(result.bands ?? {})) {
    bands[band] = (bands[band] ?? 0) + count;
  }
  worst.push(...(result.worst ?? []));

  console.log(
    `  ${String(offset).padStart(6)} → ${String(offset + result.considered).padStart(6)}  ` +
      `scored ${String(result.scored).padStart(4)}  ` +
      `no evidence ${String(result.skipped_no_evidence).padStart(4)}` +
      (result.failed_writes ? `  writes failed ${result.failed_writes}` : ""),
  );

  if (result.next_offset === null || result.considered === 0) break;
  offset = result.next_offset;
}

worst.sort((a, b) => a.score - b.score);

console.log("");
console.log(`considered   : ${considered}`);
console.log(`scored       : ${scored}`);
console.log(`no evidence  : ${skipped}  (left alone rather than written as zero)`);
if (failedWrites) console.log(`failed writes: ${failedWrites}`);
console.log("");
console.log("bands:");
for (const band of ["critical", "warning", "fair", "healthy"]) {
  if (bands[band]) console.log(`  ${band.padEnd(9)} ${bands[band]}`);
}
console.log("");
console.log("worst pages:");
for (const page of worst.slice(0, 10)) {
  console.log(`  ${String(page.score).padStart(3)}  ${page.issues} issues  ${page.url}`);
}

if (scored === 0) {
  console.log("");
  console.log("RESULT: nothing was scored. That is a failure to measure, not a clean site.");
  process.exit(1);
}
console.log("");
console.log(`RESULT: ${scored} pages scored from real evidence.`);
