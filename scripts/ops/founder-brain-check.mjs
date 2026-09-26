/**
 * Does the Company Brain keep its promises?
 *
 * Runs against the database the application reads and removes everything it
 * writes. The checks are the ones the feature is worthless without: that an
 * unauthorised reader gets nothing, that a model cannot file an inference as a
 * company fact, that the same document ingested twice is one item, that a
 * superseded item has to say what replaced it, that the learning log cannot be
 * rewritten, that a pattern needs more than one case, and that a report with
 * no data says so rather than looking clean.
 *
 *   node scripts/ops/founder-brain-check.mjs
 */
import { readFileSync } from "node:fs";

function readEnv(file) {
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const at = line.indexOf("=");
    if (at < 0 || line.trim().startsWith("#")) continue;
    out[line.slice(0, at).trim()] = line
      .slice(at + 1)
      .trim()
      .replace(/^(["'])([\s\S]*)\1$/, "$2");
  }
  return out;
}

const env = process.env.SUPABASE_URL ? process.env : readEnv(".env.ops");
const BASE = (env.SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!BASE || !KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed");
  process.exit(1);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const MARK = `braincheck-${Date.now().toString(36)}`;
let pass = 0;
let fail = 0;

function check(name, ok, detail = "") {
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function post(table, body) {
  return fetch(`${BASE}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...H, Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
}
async function patch(table, filter, body) {
  return fetch(`${BASE}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify(body),
  });
}
async function get(path) {
  const r = await fetch(`${BASE}/rest/v1/${path}`, { headers: H });
  return r.ok ? r.json() : [];
}
async function del(path) {
  await fetch(`${BASE}/rest/v1/${path}`, { method: "DELETE", headers: H });
}
// Accepts either a Response or the promise of one, because every call site
// here passes the promise straight through.
async function one(input) {
  const res = await input;
  return res.ok ? (await res.json())[0] : null;
}

const item = (over = {}) => ({
  kind: "POLICY",
  claim: "CURRENT_FACT",
  title: `${MARK} refund policy`,
  body: "Refunds are approved by finance above ten thousand rupees.",
  source_system: MARK,
  ...over,
});

console.log(`marker: ${MARK}\n`);

// ------------------------------------------------------------- claims
console.log("a model cannot file an inference as a company fact");

const aiFact = await post(
  "founder_knowledge",
  item({ produced_by_ai: true, claim: "CURRENT_FACT" }),
);
check("AI-produced content cannot be a CURRENT_FACT", !aiFact.ok, `status ${aiFact.status}`);

const aiInference = await post(
  "founder_knowledge",
  item({ produced_by_ai: true, claim: "AI_INFERENCE", title: `${MARK} inferred pattern` }),
);
check("AI-produced content can be an AI_INFERENCE", aiInference.ok, `status ${aiInference.status}`);

const humanFact = await one(post("founder_knowledge", item()));
check("a human-sourced fact is accepted", Boolean(humanFact));

const blank = await post("founder_knowledge", item({ body: "   ", title: `${MARK} blank` }));
check("an empty body is refused", !blank.ok, `status ${blank.status}`);

// ------------------------------------------------------------- dedupe
console.log("\nthe same document twice is one item");

const dupA = await one(
  post(
    "founder_knowledge",
    item({ title: `${MARK} sop`, content_hash: `${MARK}-hash`, source_system: MARK }),
  ),
);
const dupB = await post(
  "founder_knowledge",
  item({ title: `${MARK} sop`, content_hash: `${MARK}-hash`, source_system: MARK }),
);
check("a duplicate ingestion is refused", !dupB.ok && dupB.status === 409, `status ${dupB.status}`);
check("the first one is there", Boolean(dupA));

// ------------------------------------------------------------- lifecycle
console.log("\nknowledge is retired, not lost");

if (humanFact) {
  const orphan = await patch("founder_knowledge", `id=eq.${humanFact.id}`, {
    status: "superseded",
  });
  check("superseding with nothing to point at is refused", !orphan.ok, `status ${orphan.status}`);

  const replacement = await one(
    post("founder_knowledge", item({ title: `${MARK} refund policy v2` })),
  );
  const superseded = await patch("founder_knowledge", `id=eq.${humanFact.id}`, {
    status: "superseded",
    superseded_by: replacement.id,
  });
  check("superseding with a replacement is allowed", superseded.ok, `status ${superseded.status}`);

  const history = await get(`founder_knowledge_history?select=id&knowledge_id=eq.${humanFact.id}`);
  check("the previous version was kept", history.length >= 1, `${history.length} versions`);
}

// ------------------------------------------------------------- permissions
console.log("\nretrieval is permission-aware");

const restricted = await one(
  post("founder_knowledge", item({ title: `${MARK} finance only`, allowed_roles: ["finance"] })),
);
check("a restricted item can be created", Boolean(restricted));

// The clause the server builds for a reader holding only "support".
const asSupport = await get(
  `founder_knowledge?select=id,title&source_system=eq.${MARK}` +
    `&or=(allowed_roles.eq.{},allowed_roles.ov.{"support"})`,
);
const leaked = asSupport.some((r) => r.id === restricted?.id);
check("a support reader does not receive the finance-only item", !leaked);

const asFinance = await get(
  `founder_knowledge?select=id&source_system=eq.${MARK}` +
    `&or=(allowed_roles.eq.{},allowed_roles.ov.{"finance"})`,
);
check(
  "a finance reader does receive it",
  asFinance.some((r) => r.id === restricted?.id),
);

// ------------------------------------------------------------- search
console.log("\nsearch finds what was ingested");

const hits = await get(
  `founder_knowledge?select=id,title&search_text=wfts(english).${encodeURIComponent("refunds finance")}` +
    `&source_system=eq.${MARK}`,
);
check("full-text search returns the policy", hits.length >= 1, `${hits.length} hits`);

const noHits = await get(
  `founder_knowledge?select=id&search_text=wfts(english).${encodeURIComponent("zebra")}` +
    `&source_system=eq.${MARK}`,
);
check("a term that is not there returns nothing", noHits.length === 0, `${noHits.length} hits`);

// ------------------------------------------------------------- stale
console.log("\nstale knowledge is detectable");

const stale = await one(
  post(
    "founder_knowledge",
    item({
      title: `${MARK} overdue review`,
      review_due: new Date(Date.now() - 86_400_000).toISOString(),
    }),
  ),
);
const overdue = await get(
  `founder_knowledge?select=id&source_system=eq.${MARK}&status=eq.active&review_due=lt.${new Date().toISOString()}`,
);
check(
  "an item past its review date is found",
  overdue.some((r) => r.id === stale?.id),
);

// ------------------------------------------------------------- learning log
console.log("\nthe learning log records the loop");

const thread = await one(
  post("founder_learning", {
    stage: "OBSERVATION",
    title: `${MARK} backlog rose`,
    detail: "support backlog rose 18 per cent week on week",
    actor_kind: "SYSTEM",
    source_system: MARK,
  }),
);
check("an observation is recorded", Boolean(thread));

const orphanOutcome = await post("founder_learning", {
  stage: "OUTCOME",
  title: `${MARK} outcome`,
  detail: "it worked",
  actor_kind: "HUMAN",
  source_system: MARK,
});
check(
  "an outcome with no decision is refused",
  !orphanOutcome.ok,
  `status ${orphanOutcome.status}`,
);

const anecdote = await post("founder_learning", {
  stage: "PATTERN",
  title: `${MARK} pattern`,
  detail: "seen once",
  actor_kind: "SYSTEM",
  source_system: MARK,
  pattern_key: "x",
  sample_size: 1,
});
check("a pattern resting on one case is refused", !anecdote.ok, `status ${anecdote.status}`);

const realPattern = await post("founder_learning", {
  stage: "PATTERN",
  title: `${MARK} pattern`,
  detail: "seen five times",
  actor_kind: "SYSTEM",
  source_system: MARK,
  pattern_key: "reallocate-over-hire",
  sample_size: 5,
});
check(
  "a pattern resting on five cases is accepted",
  realPattern.ok,
  `status ${realPattern.status}`,
);

if (thread) {
  const rewrite = await patch("founder_learning", `id=eq.${thread.id}`, { detail: "rewritten" });
  check("the learning log cannot be rewritten", !rewrite.ok, `status ${rewrite.status}`);
}

// ------------------------------------------------------------- reports
console.log("\na report with no data says so");

const empty = await post("founder_reports", {
  report_type: "KPI_REVIEW",
  title: `${MARK} empty`,
  period_start: new Date(Date.now() - 7 * 86_400_000).toISOString(),
  period_end: new Date().toISOString(),
  basis: { generatedFrom: ["founder_kpis"] },
  findings: [],
  limitations: [],
  status: "generated",
});
check(
  "a report with no findings and no limitations is refused",
  !empty.ok,
  `status ${empty.status}`,
);

const honest = await post("founder_reports", {
  report_type: "KPI_REVIEW",
  title: `${MARK} honest`,
  period_start: new Date(Date.now() - 7 * 86_400_000).toISOString(),
  period_end: new Date().toISOString(),
  basis: { generatedFrom: ["founder_kpis"] },
  findings: [],
  limitations: ["No sufficient data available for this period."],
  insufficient_data: true,
  confidence: "UNKNOWN",
  status: "generated",
});
check("a report that says it found nothing is accepted", honest.ok, `status ${honest.status}`);

const noBasis = await post("founder_reports", {
  report_type: "KPI_REVIEW",
  title: `${MARK} no basis`,
  period_start: new Date().toISOString(),
  period_end: new Date().toISOString(),
  basis: {},
  findings: [{ kind: "FACT", statement: "x", source: "y" }],
  status: "generated",
});
check(
  "a report that cannot name what it was built from is refused",
  !noBasis.ok,
  `${noBasis.status}`,
);

const backwards = await post("founder_reports", {
  report_type: "KPI_REVIEW",
  title: `${MARK} backwards`,
  period_start: new Date().toISOString(),
  period_end: new Date(Date.now() - 86_400_000).toISOString(),
  basis: { generatedFrom: ["x"] },
  findings: [{ kind: "FACT", statement: "x", source: "y" }],
  status: "generated",
});
check(
  "a period that ends before it starts is refused",
  !backwards.ok,
  `status ${backwards.status}`,
);

// ------------------------------------------------------- totals are SQL
// The two screens draw headline counts. They must be counted by the database,
// not measured from whatever page of rows the screen fetched, and the reports
// count must be scoped to the reader's roles or a restricted reader is told
// how many reports exist that they cannot open.

const learningTotals = await get("founder_learning_totals?select=*&limit=1");
check(
  "the learning totals view answers with one row of counts",
  learningTotals.length === 1 &&
    ["learning_records", "decisions_on_record", "overridden", "recommendations_answered"].every(
      (k) => Number.isFinite(Number(learningTotals[0][k])),
    ),
  JSON.stringify(learningTotals[0] ?? null),
);

async function reportTotals(roles) {
  const r = await fetch(`${BASE}/rest/v1/rpc/founder_report_totals`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ p_roles: roles }),
  });
  if (!r.ok) return null;
  const rows = await r.json();
  return Array.isArray(rows) ? rows[0] : rows;
}

const openBefore = await reportTotals([]);
check(
  "the reports totals function answers with counts",
  openBefore !== null && Number.isFinite(Number(openBefore.total)),
  JSON.stringify(openBefore),
);

// A report only a named role may read must not appear in anybody else's count.
const restrictedRole = `${MARK}-role`;
const restrictedReport = await post("founder_reports", {
  report_type: "KPI_REVIEW",
  title: `${MARK} restricted`,
  period_start: new Date(Date.now() - 86_400_000).toISOString(),
  period_end: new Date().toISOString(),
  basis: { generatedFrom: ["founder_kpis"] },
  findings: [],
  limitations: ["No sufficient data available for this period."],
  insufficient_data: true,
  status: "generated",
  allowed_roles: [restrictedRole],
});
check(
  "a role-restricted report can be filed",
  restrictedReport.ok,
  `status ${restrictedReport.status}`,
);

const openAfter = await reportTotals([]);
const holderAfter = await reportTotals([restrictedRole]);
check(
  "a restricted report is not counted for a reader without the role",
  openAfter !== null && Number(openAfter.total) === Number(openBefore.total),
  `before ${openBefore?.total}, after ${openAfter?.total}`,
);
check(
  "a restricted report is counted for the role that may read it",
  holderAfter !== null && Number(holderAfter.total) === Number(openBefore.total) + 1,
  `open ${openBefore?.total}, holder ${holderAfter?.total}`,
);

// ------------------------------------------------------------- cleanup
console.log("\ncleanup");
await del(`founder_reports?title=like.${MARK}*`);
await fetch(`${BASE}/rest/v1/rpc/founder_purge_check_learning`, {
  method: "POST",
  headers: H,
  body: JSON.stringify({ p_marker: `${MARK}` }),
}).catch(() => {});
await del(`founder_knowledge_links?knowledge_id=in.(select id from founder_knowledge)`);
// Supersede links have to be cleared before the rows they point at.
await patch(`founder_knowledge`, `source_system=eq.${MARK}`, {
  superseded_by: null,
  status: "archived",
});
await del(`founder_knowledge?source_system=eq.${MARK}`);

const leftKnowledge = await get(`founder_knowledge?select=id&source_system=eq.${MARK}`);
const leftLearning = await get(`founder_learning?select=id&source_system=eq.${MARK}`);
const leftReports = await get(`founder_reports?select=id&title=like.${MARK}*`);
check(
  "every row this check wrote has been removed",
  leftKnowledge.length === 0 && leftLearning.length === 0 && leftReports.length === 0,
  `${leftKnowledge.length} knowledge, ${leftLearning.length} learning, ${leftReports.length} reports`,
);

console.log(`\nRESULT: ${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
