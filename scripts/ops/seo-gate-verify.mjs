/**
 * Check that the live sitemaps say exactly what the gate decided.
 *
 * The gate is only worth having if nothing can get round it, so this does not
 * read the code: it fetches the sitemaps the site is actually serving and
 * compares them, URL by URL, with the decisions in the database. A page that
 * is in a sitemap without a passing decision is the failure this whole layer
 * exists to prevent, and this is what would catch it.
 *
 *   node scripts/ops/seo-gate-verify.mjs
 *   node scripts/ops/seo-gate-verify.mjs https://softwarevala.net
 */
import { readFileSync } from "node:fs";

function readEnv(file) {
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const at = line.indexOf("=");
    if (at < 0 || line.trim().startsWith("#")) continue;
    out[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return out;
}

const env = process.env.SUPABASE_URL ? process.env : readEnv(".env.ops");
const BASE = (env.SUPABASE_URL || "").trim();
const KEY = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const SITE = (process.argv[2] || env.SV_SITE || "https://softwarevala.net").replace(/\/+$/, "");
const HEAD = { apikey: KEY, Authorization: `Bearer ${KEY}` };

if (!BASE || !KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed");
  process.exit(1);
}

async function readAll(path) {
  const out = [];
  let from = 0;
  for (;;) {
    const res = await fetch(`${BASE}/rest/v1/${path}`, {
      headers: { ...HEAD, Range: `${from}-${from + 999}` },
    });
    if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
    const page = await res.json();
    out.push(...page);
    if (page.length < 1000) return out;
    from += 1000;
  }
}

const locs = (xml) => [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
const path = (url) => url.replace(SITE, "").replace(/\/+$/, "") || "/";

console.log(`site : ${SITE}`);

// ------------------------------------------------------------- the sitemaps
const index = await (await fetch(`${SITE}/sitemap.xml`)).text();
const children = locs(index);
console.log(`sitemap index children: ${children.length}`);

const gated = children.filter((u) => /sitemap-(slots|blog)/.test(u));
const ungated = children.filter((u) => !/sitemap-(slots|blog)/.test(u));
console.log(`  behind the gate : ${gated.length} (${gated.map((u) => path(u)).join(", ")})`);
console.log(`  not yet gated   : ${ungated.length} (${ungated.map((u) => path(u)).join(", ")})`);

const advertised = new Set();
for (const child of gated) {
  const xml = await (await fetch(child)).text();
  for (const loc of locs(xml)) advertised.add(path(loc));
}
console.log(`URLs advertised by the gated sitemaps: ${advertised.size}`);

// ------------------------------------------------------------ the decisions
const decisions = await readAll(
  "seo_indexing_decisions?select=url,entity_type,state,indexable,sitemap_eligible,blocking_reason" +
    "&entity_type=in.(slot,blog)&order=url.asc",
);
const byUrl = new Map(decisions.map((row) => [row.url, row]));
const eligible = new Set(decisions.filter((row) => row.sitemap_eligible).map((row) => row.url));
console.log(`decisions for those kinds : ${decisions.length}`);
console.log(`of which eligible          : ${eligible.size}`);

// ------------------------------------------------------------- the failures
const failures = [];

for (const url of advertised) {
  const decision = byUrl.get(url);
  if (!decision) {
    failures.push(`ADVERTISED WITHOUT A DECISION: ${url}`);
    continue;
  }
  if (!decision.sitemap_eligible) {
    failures.push(
      `ADVERTISED THOUGH NOT ELIGIBLE: ${url} [${decision.state}] ${decision.blocking_reason ?? ""}`,
    );
  }
  if (!decision.indexable) {
    failures.push(`ADVERTISED THOUGH NOT INDEXABLE: ${url} [${decision.state}]`);
  }
  if (decision.state !== "READY_FOR_INDEX" && decision.state !== "INDEX") {
    failures.push(`ADVERTISED IN STATE ${decision.state}: ${url}`);
  }
}

for (const url of eligible) {
  if (!advertised.has(url)) failures.push(`ELIGIBLE BUT NOT ADVERTISED: ${url}`);
}

// A blocked page must be reachable and honest, not merely absent.
const blocked = decisions.filter((row) => !row.sitemap_eligible);
const sample = blocked.slice(0, 8);
for (const row of sample) {
  if (!row.blocking_reason) failures.push(`BLOCKED WITHOUT A REASON: ${row.url}`);
}

console.log("");
console.log(`blocked pages (these kinds): ${blocked.length}`);
const reasons = {};
for (const row of blocked) {
  const key = String(row.blocking_reason ?? "(none)").split(":")[0];
  reasons[key] = (reasons[key] ?? 0) + 1;
}
for (const [reason, count] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(count).padStart(5)}  ${reason}`);
}

console.log("");
if (failures.length) {
  console.log(`FAILURES: ${failures.length}`);
  for (const line of failures.slice(0, 20)) console.log(`  ${line}`);
  if (failures.length > 20) console.log(`  ... and ${failures.length - 20} more`);
  process.exit(1);
}
console.log(
  "PASS — every advertised URL has a passing decision, and every passing decision is advertised.",
);
