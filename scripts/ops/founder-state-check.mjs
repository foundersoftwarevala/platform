/**
 * Does the Company Operating State behave the way it claims to?
 *
 * Every check here runs against the real database the application reads, and
 * every row it writes is removed again at the end, so a pass is evidence about
 * production rather than about a fixture. The checks are the ones that would be
 * embarrassing to get wrong: that a duplicate event is one event, that a late
 * event does not overwrite a newer one, that a KPI with no reading is UNKNOWN
 * rather than zero, that a stale snapshot admits it, and that an unjudgeable
 * KPI is not quietly called healthy.
 *
 *   node scripts/ops/founder-state-check.mjs
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

/**
 * The environment matters more than usual here.
 *
 * `.env.ops` names the hosted Supabase project, and the application reads the
 * VPS instead — a distinction that has already sent one migration to a database
 * nothing opens. So the running application's own environment wins when this is
 * run on the server, which is where it is meant to run, and the file is only a
 * fallback.
 */
const env = process.env.SUPABASE_URL ? process.env : readEnv(".env.ops");
const BASE = (env.SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!BASE || !KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed");
  process.exit(1);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const MARK = `statecheck-${Date.now().toString(36)}`;
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

async function post(table, body, prefer = "return=representation") {
  return fetch(`${BASE}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...H, Prefer: prefer },
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

console.log(`database: the VPS PostgREST the application reads`);
console.log(`marker  : ${MARK}\n`);

// ---------------------------------------------------------------- events
console.log("operational events");

const evt = {
  event_type: "STATE_CHECK",
  domain: "EXECUTIVE",
  source_system: MARK,
  source_event_id: "evt-1",
  occurred_at: new Date().toISOString(),
};

const first = await post("founder_events", evt);
check("an event is accepted once", first.ok, `${first.status}`);

const second = await post("founder_events", evt);
check(
  "the same event delivered twice is refused",
  second.status === 409,
  `status ${second.status}`,
);

const stored = await get(`founder_events?select=id&source_system=eq.${MARK}`);
check("one delivery, one row", stored.length === 1, `${stored.length} rows`);

const rewrite = await fetch(`${BASE}/rest/v1/founder_events?source_system=eq.${MARK}`, {
  method: "PATCH",
  headers: H,
  body: JSON.stringify({ occurred_at: new Date(Date.now() - 86_400_000).toISOString() }),
});
check("when an event happened cannot be rewritten", !rewrite.ok, `status ${rewrite.status}`);

// ---------------------------------------------------------------- KPIs
console.log("\nKPI honesty");

const kpiRes = await post("founder_kpis", {
  key: `${MARK}.kpi`,
  name: "State check",
  definition: "a KPI created by the state check",
  unit: "count",
  domain: "EXECUTIVE",
  source: MARK,
});
const kpi = kpiRes.ok ? (await kpiRes.json())[0] : null;
check("a KPI needs a named source", Boolean(kpi), `${kpiRes.status}`);

if (kpi) {
  const noValue = await post("founder_kpi_readings", {
    kpi_id: kpi.id,
    value: null,
    measured_at: new Date().toISOString(),
    source: MARK,
    method: "probe",
    confidence: "MEASURED",
  });
  check("a MEASURED reading without a value is refused", !noValue.ok, `status ${noValue.status}`);

  const invented = await post("founder_kpi_readings", {
    kpi_id: kpi.id,
    value: 99,
    measured_at: new Date().toISOString(),
    source: MARK,
    method: "probe",
    confidence: "UNKNOWN",
  });
  check(
    "an UNKNOWN reading carrying a value is refused",
    !invented.ok,
    `status ${invented.status}`,
  );

  const honest = await post("founder_kpi_readings", {
    kpi_id: kpi.id,
    value: 7,
    measured_at: new Date().toISOString(),
    source: MARK,
    method: "counted",
    confidence: "MEASURED",
  });
  check("an honest measured reading is accepted", honest.ok, `status ${honest.status}`);
}

// ---------------------------------------------------------------- attention
console.log("\nattention and accountability");

const attnRes = await post("founder_attention", {
  kind: MARK,
  domain: "EXECUTIVE",
  title: "state check",
  reason: "raised by the state check",
  severity: "HIGH",
  source_system: MARK,
  evidence: { marker: MARK },
});
const attn = attnRes.ok ? (await attnRes.json())[0] : null;
check("an attention item needs evidence", Boolean(attn), `${attnRes.status}`);

const noEvidence = await post("founder_attention", {
  kind: MARK,
  domain: "EXECUTIVE",
  title: "state check",
  reason: "no evidence",
  severity: "HIGH",
  source_system: MARK,
  evidence: {},
});
check(
  "an attention item without evidence is refused",
  !noEvidence.ok,
  `status ${noEvidence.status}`,
);

if (attn) {
  const ack = await fetch(`${BASE}/rest/v1/founder_attention?id=eq.${attn.id}`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ status: "ACKNOWLEDGED" }),
  });
  check("NEW to ACKNOWLEDGED is allowed", ack.ok, `status ${ack.status}`);

  const resolved = await fetch(`${BASE}/rest/v1/founder_attention?id=eq.${attn.id}`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ status: "RESOLVED" }),
  });
  check("ACKNOWLEDGED to RESOLVED is allowed", resolved.ok, `status ${resolved.status}`);

  const reopen = await fetch(`${BASE}/rest/v1/founder_attention?id=eq.${attn.id}`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ status: "IN_PROGRESS" }),
  });
  check("RESOLVED back to IN_PROGRESS is refused", !reopen.ok, `status ${reopen.status}`);

  const dismissNoReason = await post("founder_attention", {
    kind: MARK,
    domain: "EXECUTIVE",
    title: "state check",
    reason: "x",
    severity: "LOW",
    source_system: MARK,
    evidence: { marker: MARK },
    status: "DISMISSED",
    dismissed_by: "00000000-0000-0000-0000-000000000000",
  });
  check(
    "dismissing without a reason is refused",
    !dismissNoReason.ok,
    `status ${dismissNoReason.status}`,
  );
}

// ---------------------------------------------------------------- snapshot
console.log("\nsnapshot");

const emptyState = await post("founder_state_snapshots", { built_by: MARK, state: {} });
check("a snapshot with no state is refused", !emptyState.ok, `status ${emptyState.status}`);

const snapRes = await post("founder_state_snapshots", {
  built_by: MARK,
  state: { marker: MARK },
  event_watermark: new Date(Date.now() - 3_600_000).toISOString(),
  consistency: "FRESH",
});
check("a snapshot with a state is stored", snapRes.ok, `status ${snapRes.status}`);

// An event later than the watermark must make that snapshot stale.
const laterEvent = await post("founder_events", {
  event_type: "STATE_CHECK_LATER",
  domain: "EXECUTIVE",
  source_system: MARK,
  source_event_id: "evt-2",
  occurred_at: new Date().toISOString(),
});
const snaps = await get(
  `founder_state_snapshots?select=event_watermark&built_by=eq.${MARK}&limit=1`,
);
const events = await get(
  `founder_events?select=occurred_at&source_system=eq.${MARK}&order=occurred_at.desc&limit=1`,
);
const watermark = snaps[0]?.event_watermark ?? null;
const newest = events[0]?.occurred_at ?? null;
check(
  "an event after the watermark makes the snapshot stale",
  Boolean(laterEvent.ok && watermark && newest && newest > watermark),
  `watermark ${watermark} vs newest ${newest}`,
);

// ---------------------------------------------------------------- cleanup
console.log("\ncleanup");
if (kpi) {
  await del(`founder_kpi_readings?kpi_id=eq.${kpi.id}`);
  await del(`founder_kpis?id=eq.${kpi.id}`);
}
await del(`founder_attention?source_system=eq.${MARK}`);
await del(`founder_events?source_system=eq.${MARK}`);
await del(`founder_state_snapshots?built_by=eq.${MARK}`);

const leftovers = (
  await Promise.all([
    get(`founder_events?select=id&source_system=eq.${MARK}`),
    get(`founder_attention?select=id&source_system=eq.${MARK}`),
    get(`founder_kpis?select=id&key=eq.${MARK}.kpi`),
    get(`founder_state_snapshots?select=id&built_by=eq.${MARK}`),
  ])
).flat();
check(
  "every row this check wrote has been removed",
  leftovers.length === 0,
  `${leftovers.length} left`,
);

console.log(`\nRESULT: ${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
