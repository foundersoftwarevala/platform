/**
 * Run the SEO safety gate over every page this site serves, and record what it
 * decided.
 *
 * This is meant to run ON the server. It reads the application's own
 * environment from the running process - the same trick rebuild-with-env.sh
 * uses - so no credential is typed, stored beside it or printed. It then asks
 * the application, over the loopback interface, to evaluate the pages in
 * slices, which keeps memory flat whether the catalogue holds seven thousand
 * pages or eighteen thousand.
 *
 * The gate itself is src/lib/seo/indexing-gate.ts. Nothing here re-implements
 * a check: this drives the job and does the one pass a database does better
 * than a process, which is finding every page whose only difference from
 * another is a country name.
 *
 *   node scripts/ops/seo-gate-run.mjs                 # every kind, dry pass included
 *   node scripts/ops/seo-gate-run.mjs --kind slot
 *   node scripts/ops/seo-gate-run.mjs --cross-only    # just the duplicate pass
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const only = args.includes("--kind") ? args[args.indexOf("--kind") + 1] : null;
const crossOnly = args.includes("--cross-only");
const SLICE = Number(args.includes("--slice") ? args[args.indexOf("--slice") + 1] : 200) || 200;

// ------------------------------------------------- the application's own env
/**
 * Read the running application's environment.
 *
 * The values never leave this process and are never printed. Only the names of
 * the variables it needed are reported, so a missing one is diagnosable
 * without exposing the ones that are present.
 */
function appEnv() {
  const name = process.env.SV_PM2_NAME || "softwarevala-staging";
  let pid = "";
  try {
    pid = execSync(`pm2 pid ${name}`, { encoding: "utf8" }).replace(/[^0-9]/g, "");
  } catch {
    pid = "";
  }
  if (!pid) throw new Error(`could not find the running ${name} process`);

  const raw = readFileSync(`/proc/${pid}/environ`);
  const env = {};
  for (const item of raw.toString("utf8").split("\0")) {
    const at = item.indexOf("=");
    if (at > 0) env[item.slice(0, at)] = item.slice(at + 1);
  }
  return env;
}

const env = process.env.SUPABASE_URL ? process.env : appEnv();
const TOKEN = (env.INTERNAL_API_TOKEN || "").trim();
const BASE = (env.SUPABASE_URL || "").trim();
const KEY = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const PORT = (env.PORT || "3000").trim();
const ORIGIN = `http://127.0.0.1:${PORT}`;

const missing = [];
if (!TOKEN) missing.push("INTERNAL_API_TOKEN");
if (!BASE) missing.push("SUPABASE_URL");
if (!KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
if (missing.length) {
  console.error(`missing from the application environment: ${missing.join(", ")}`);
  process.exit(1);
}
console.log(`origin  : ${ORIGIN}`);
console.log(`auth    : internal token (present, not printed)`);

const HEAD = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function readAll(path) {
  const out = [];
  let from = 0;
  for (;;) {
    const res = await fetch(`${BASE}/rest/v1/${path}`, {
      headers: { ...HEAD, Range: `${from}-${from + 999}` },
    });
    if (!res.ok)
      throw new Error(`${path} -> HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    const page = await res.json();
    out.push(...page);
    if (page.length < 1000) return out;
    from += 1000;
  }
}

// ----------------------------------------------------------- the slice pass
const KINDS = only ? [only] : ["slot", "product", "category", "country", "blog"];

async function runKind(kind) {
  let offset = 0;
  const totals = { evaluated: 0, eligible: 0, byState: {} };
  const samples = [];
  for (;;) {
    const res = await fetch(
      `${ORIGIN}/api/internal/seo-gate?kind=${kind}&offset=${offset}&limit=${SLICE}`,
      { method: "POST", headers: { "x-internal-token": TOKEN } },
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${kind} at ${offset} -> HTTP ${res.status} ${body.slice(0, 300)}`);
    }
    const payload = await res.json();
    if (payload.error) throw new Error(`${kind} at ${offset} -> ${payload.error}`);

    totals.evaluated += payload.evaluated ?? 0;
    totals.eligible += payload.eligible ?? 0;
    for (const [state, count] of Object.entries(payload.byState ?? {})) {
      totals.byState[state] = (totals.byState[state] ?? 0) + count;
    }
    for (const blocked of payload.blocked ?? []) {
      if (samples.length < 6) samples.push(blocked);
    }
    process.stdout.write(`  ${kind}: ${totals.evaluated} evaluated\r`);
    if (payload.done || !payload.evaluated) break;
    offset += SLICE;
  }
  console.log(
    `  ${kind.padEnd(9)} evaluated ${String(totals.evaluated).padStart(5)} | ` +
      `eligible ${String(totals.eligible).padStart(5)} | ${JSON.stringify(totals.byState)}`,
  );
  for (const sample of samples) {
    console.log(
      `      held back ${sample.url} [${sample.state}] ${String(sample.reason).slice(0, 120)}`,
    );
  }
  return totals;
}

if (!crossOnly) {
  console.log("\n== evaluating ==");
  for (const kind of KINDS) {
    await runKind(kind);
  }
}

// ------------------------------------------------------- the duplicate pass
/**
 * Find every page whose only difference from another is a name.
 *
 * One hash per page is read, not one page per page: fifteen thousand rows of
 * sixty-four characters is under two megabytes, which is why this grouping can
 * be done here and why it would still be affordable at eighteen thousand.
 */
console.log("\n== duplicate pass ==");
const masked = await readAll("seo_fingerprints?select=url,hash&layer=eq.body_masked&order=url.asc");
const exact = await readAll("seo_fingerprints?select=url,hash&layer=eq.body&order=url.asc");
console.log(`  masked fingerprints : ${masked.length}`);
console.log(`  body fingerprints   : ${exact.length}`);

const group = (rows) => {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.hash)) map.set(row.hash, []);
    map.get(row.hash).push(row.url);
  }
  return [...map.values()].filter((urls) => urls.length > 1);
};

const exactGroups = group(exact);
const maskedGroups = group(masked).filter(
  // A group that is already an exact duplicate is reported as that, not twice.
  (urls) => !exactGroups.some((other) => other.length === urls.length && other[0] === urls[0]),
);

console.log(
  `  exact duplicate groups : ${exactGroups.length} (${exactGroups.flat().length} pages)`,
);
console.log(
  `  country-swap groups    : ${maskedGroups.length} (${maskedGroups.flat().length} pages)`,
);
for (const urls of maskedGroups.slice(0, 5)) {
  console.log(
    `    ${urls.length} pages share a masked hash, e.g. ${urls.slice(0, 2).join("  ==  ")}`,
  );
}

async function block(urls, classification, reason) {
  let done = 0;
  for (let at = 0; at < urls.length; at += 100) {
    const slice = urls.slice(at, at + 100);
    const res = await fetch(
      `${BASE}/rest/v1/seo_indexing_decisions?url=in.(${slice.map((u) => `"${u}"`).join(",")})`,
      {
        method: "PATCH",
        headers: { ...HEAD, Prefer: "return=minimal" },
        body: JSON.stringify({
          fingerprint_class: classification,
          // sitemap_eligible must be cleared first or the check constraint that
          // keeps a non-indexable page out of the sitemap would refuse the row.
          sitemap_eligible: false,
          indexable: false,
          state: "CONTENT_NOT_READY",
          blocking_reason: reason,
        }),
      },
    );
    if (!res.ok) {
      console.error(`    PATCH failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
      process.exit(1);
    }
    done += slice.length;
  }
  return done;
}

let blocked = 0;
if (exactGroups.length) {
  blocked += await block(
    exactGroups.flat(),
    "EXACT_DUPLICATE",
    "content_differentiation: this page is word for word identical to another page on this site.",
  );
}
if (maskedGroups.length) {
  blocked += await block(
    maskedGroups.flat(),
    "LOW_VALUE_DUPLICATE",
    "content_differentiation: once this page's own country, category and product names are " +
      "masked it is identical to another page, so the names are the only difference between them.",
  );
}
console.log(`  pages held back by the duplicate pass: ${blocked}`);

// ------------------------------------------------------------------ summary
const decisions = await readAll(
  "seo_indexing_decisions?select=state,entity_type,sitemap_eligible&order=url.asc",
);
const byState = {};
const byKind = {};
for (const row of decisions) {
  byState[row.state] = (byState[row.state] ?? 0) + 1;
  if (!byKind[row.entity_type]) byKind[row.entity_type] = { total: 0, eligible: 0 };
  byKind[row.entity_type].total += 1;
  if (row.sitemap_eligible) byKind[row.entity_type].eligible += 1;
}
console.log("\n== decisions ==");
console.log(`  total            : ${decisions.length}`);
console.log(`  sitemap eligible : ${decisions.filter((row) => row.sitemap_eligible).length}`);
console.log(`  by state         : ${JSON.stringify(byState)}`);
for (const [kind, counts] of Object.entries(byKind)) {
  console.log(`  ${kind.padEnd(9)} ${counts.eligible}/${counts.total} eligible`);
}
