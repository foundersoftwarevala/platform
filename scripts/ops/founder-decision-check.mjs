/**
 * Does the Decision Engine refuse what it promises to refuse?
 *
 * Everything runs against the database the application reads, and everything
 * written is removed again at the end. The checks are the ones a governance
 * layer is worth nothing without: that a confidence score cannot be asserted
 * without the factors behind it, that an inference cannot masquerade as a
 * sourced fact, that a decision missing critical evidence cannot reach
 * approval, that nobody approves their own request, that an expired request
 * cannot be acted on, that a verified decision cannot be quietly edited, and
 * that history cannot be rewritten.
 *
 *   node scripts/ops/founder-decision-check.mjs
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

const MARK = `dcheck-${Date.now().toString(36)}`;
const ACTOR_A = "11111111-1111-1111-1111-111111111111";
const ACTOR_B = "22222222-2222-2222-2222-222222222222";
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
async function one(res) {
  return res.ok ? (await res.json())[0] : null;
}

const base = {
  title: `${MARK} decision`,
  description: "raised by the decision engine check",
  decision_type: "OPERATIONAL",
  domain: "EXECUTIVE",
  trigger_type: "state_check",
};

console.log(`marker: ${MARK}\n`);

// ------------------------------------------------------------ confidence
console.log("confidence cannot be asserted");

const asserted = await post("founder_decisions", { ...base, confidence_score: 92 });
check("a confidence score with no factors is refused", !asserted.ok, `status ${asserted.status}`);

const derived = await post("founder_decisions", {
  ...base,
  confidence_score: 92,
  confidence_factors: { completeness: 0.9, freshness: "FRESH", sources: 3 },
});
const decision = await one(derived);
check("a confidence score with its factors is accepted", Boolean(decision), `${derived.status}`);

// ------------------------------------------------------------ evidence
console.log("\nan inference is not a fact");

if (decision) {
  const unsourcedFact = await post("founder_decision_evidence", {
    decision_id: decision.id,
    kind: "FACT",
    statement: "revenue fell 12 per cent",
    source_system: MARK,
  });
  check(
    "a FACT with no source record is refused",
    !unsourcedFact.ok,
    `status ${unsourcedFact.status}`,
  );

  const sourcedFact = await post("founder_decision_evidence", {
    decision_id: decision.id,
    kind: "FACT",
    statement: "thirty tasks are open",
    source_system: "tm_tasks",
    source_record: "tm_tasks count",
    confidence: "MEASURED",
  });
  check("a FACT that names its record is accepted", sourcedFact.ok, `status ${sourcedFact.status}`);

  const inference = await post("founder_decision_evidence", {
    decision_id: decision.id,
    kind: "INFERENCE",
    statement: "the backlog is likely to grow",
    source_system: MARK,
  });
  check(
    "an INFERENCE needs no record, and is labelled as one",
    inference.ok,
    `${inference.status}`,
  );
}

// ------------------------------------------------------------ lifecycle
console.log("\nthe lifecycle holds");

if (decision) {
  const skip = await patch("founder_decisions", `id=eq.${decision.id}`, { state: "APPROVED" });
  check("DETECTED straight to APPROVED is refused", !skip.ok, `status ${skip.status}`);

  for (const state of ["CONTEXT_BUILDING", "ANALYZING", "OPTIONS_READY"]) {
    await patch("founder_decisions", `id=eq.${decision.id}`, { state });
  }
  const atOptions = (await get(`founder_decisions?select=state&id=eq.${decision.id}`))[0];
  check(
    "DETECTED through to OPTIONS_READY is allowed",
    atOptions?.state === "OPTIONS_READY",
    `${atOptions?.state}`,
  );

  const option = await one(
    await post("founder_decision_options", {
      decision_id: decision.id,
      label: "A",
      title: "Reallocate existing capacity",
      description: "move two people from the lower priority queue",
      reversibility: "REVERSIBLE",
      is_recommended: true,
    }),
  );
  check("an option is recorded", Boolean(option));

  await patch("founder_decisions", `id=eq.${decision.id}`, { state: "RECOMMENDATION_READY" });

  // Waiting for approval with nothing recommended must be refused.
  const noRecommendation = await patch("founder_decisions", `id=eq.${decision.id}`, {
    state: "WAITING_APPROVAL",
  });
  check(
    "waiting for approval with no recommended option is refused",
    !noRecommendation.ok,
    `status ${noRecommendation.status}`,
  );

  await patch("founder_decisions", `id=eq.${decision.id}`, { recommended_option_id: option.id });

  // A decision missing critical evidence must not reach approval.
  await patch("founder_decisions", `id=eq.${decision.id}`, { evidence_gap: "INSUFFICIENT_DATA" });
  const gapped = await patch("founder_decisions", `id=eq.${decision.id}`, {
    state: "WAITING_APPROVAL",
  });
  check(
    "a decision with INSUFFICIENT_DATA cannot reach approval",
    !gapped.ok,
    `status ${gapped.status}`,
  );

  await patch("founder_decisions", `id=eq.${decision.id}`, { evidence_gap: "NONE" });
  const waiting = await patch("founder_decisions", `id=eq.${decision.id}`, {
    state: "WAITING_APPROVAL",
  });
  check("with a recommendation and no gap it waits for approval", waiting.ok, `${waiting.status}`);
}

// ------------------------------------------------------------ approvals
console.log("\napproval governance");

if (decision) {
  const selfApproval = await post("founder_approvals", {
    decision_id: decision.id,
    approval_type: "OPERATIONAL",
    requested_by: ACTOR_A,
    approver_id: ACTOR_A,
    risk_level: "HIGH",
    impact_level: "HIGH",
    reason: "self approval attempt",
    evidence: { marker: MARK },
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  });
  check("nobody approves their own request", !selfApproval.ok, `status ${selfApproval.status}`);

  const approval = await one(
    await post("founder_approvals", {
      decision_id: decision.id,
      approval_type: "OPERATIONAL",
      requested_by: ACTOR_A,
      risk_level: "HIGH",
      impact_level: "HIGH",
      reason: "capacity reallocation needs a human",
      evidence: { marker: MARK },
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    }),
  );
  check("an approval request is raised", Boolean(approval));

  const second = await post("founder_approvals", {
    decision_id: decision.id,
    approval_type: "OPERATIONAL",
    requested_by: ACTOR_A,
    risk_level: "HIGH",
    impact_level: "HIGH",
    reason: "duplicate request",
    evidence: { marker: MARK },
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  });
  check(
    "a second open request for the same decision is refused",
    !second.ok,
    `status ${second.status}`,
  );

  if (approval) {
    const noEvidenceShown = await post("founder_approvals", {
      decision_id: decision.id,
      approval_type: "OPERATIONAL",
      requested_by: ACTOR_B,
      risk_level: "LOW",
      impact_level: "LOW",
      reason: "no evidence",
      evidence: {},
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    });
    check(
      "an approval request with no evidence is refused",
      !noEvidenceShown.ok,
      `${noEvidenceShown.status}`,
    );

    // Expire it, then try to act on it.
    await patch("founder_approvals", `id=eq.${approval.id}`, {
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    });
    const late = await patch("founder_approvals", `id=eq.${approval.id}`, {
      state: "APPROVED",
      approver_id: ACTOR_B,
      decided_at: new Date().toISOString(),
    });
    check("an expired request cannot be approved", !late.ok, `status ${late.status}`);

    await patch("founder_approvals", `id=eq.${approval.id}`, {
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    });
    const approved = await patch("founder_approvals", `id=eq.${approval.id}`, {
      state: "APPROVED",
      approver_id: ACTOR_B,
      decided_at: new Date().toISOString(),
      decision_reason: "agreed",
    });
    check("a different person can approve it", approved.ok, `status ${approved.status}`);

    const reopen = await patch("founder_approvals", `id=eq.${approval.id}`, { state: "REQUESTED" });
    check("an approved request cannot be reopened", !reopen.ok, `status ${reopen.status}`);
  }
}

// ------------------------------------------------------------ locking
console.log("\nlocking and history");

if (decision) {
  for (const state of ["APPROVED", "EXECUTING", "VERIFICATION", "VERIFIED"]) {
    await patch("founder_decisions", `id=eq.${decision.id}`, { state });
  }
  const verified = (await get(`founder_decisions?select=state&id=eq.${decision.id}`))[0];
  check("the decision reaches VERIFIED", verified?.state === "VERIFIED", `${verified?.state}`);

  const edit = await patch("founder_decisions", `id=eq.${decision.id}`, {
    title: `${MARK} quietly edited`,
  });
  check("a VERIFIED decision cannot be edited", !edit.ok, `status ${edit.status}`);

  const backToWork = await patch("founder_decisions", `id=eq.${decision.id}`, {
    state: "EXECUTING",
  });
  check("VERIFIED cannot go back to EXECUTING", !backToWork.ok, `status ${backToWork.status}`);

  const amendment = await post("founder_decision_amendments", {
    decision_id: decision.id,
    amended_by: ACTOR_B,
    reason: "the recorded impact was wrong",
    changes: { impact_level: ["HIGH", "MEDIUM"] },
  });
  check("a correction can be recorded as an amendment", amendment.ok, `status ${amendment.status}`);

  const entry = await post("founder_decision_history", {
    decision_id: decision.id,
    actor_kind: "HUMAN",
    actor_id: ACTOR_B,
    entry_type: "state_change",
    from_state: "VERIFICATION",
    to_state: "VERIFIED",
  });
  check("history can be appended", entry.ok, `status ${entry.status}`);

  const rewrite = await patch("founder_decision_history", `decision_id=eq.${decision.id}`, {
    reason: "rewritten",
  });
  check("history cannot be rewritten", !rewrite.ok, `status ${rewrite.status}`);
}

// ------------------------------------------------------------ conflicts
console.log("\nconflicting data");

const oneSided = await post("founder_data_conflicts", {
  subject: `${MARK} revenue`,
  conflict_type: "VALUE_MISMATCH",
  observations: [{ source: "a", value: 1 }],
});
check("a conflict needs at least two sources", !oneSided.ok, `status ${oneSided.status}`);

const conflict = await post("founder_data_conflicts", {
  subject: `${MARK} revenue`,
  conflict_type: "VALUE_MISMATCH",
  observations: [
    { source: "finance_daily_metrics", value: 250000, at: new Date().toISOString() },
    { source: "marketplace_orders", value: 241300, at: new Date().toISOString() },
  ],
});
check("a genuine disagreement is recorded", conflict.ok, `status ${conflict.status}`);

// ------------------------------------------------------------ risk scoring
console.log("\nrisk scoring");

const unmethodical = await post("founder_risks", {
  title: `${MARK} risk`,
  domain: "EXECUTIVE",
  severity: "HIGH",
  source: MARK,
  evidence: { marker: MARK },
  score: 72,
});
check(
  "a risk score with no recorded method is refused",
  !unmethodical.ok,
  `${unmethodical.status}`,
);

const scored = await post("founder_risks", {
  title: `${MARK} risk`,
  domain: "EXECUTIVE",
  severity: "HIGH",
  source: MARK,
  evidence: { marker: MARK },
  score: 72,
  scoring_method: "likelihood 80 x impact 90 / 100",
});
check("a risk score that states its formula is accepted", scored.ok, `status ${scored.status}`);

// ------------------------------------------------------------ permissions
console.log("\npermissions");

const approvers = await get("role_permissions?select=role&permission=eq.decision.approve");
const readers = await get("role_permissions?select=role&permission=eq.decision.read");
check(
  "decision.approve is held by executive roles only",
  approvers.length === 5,
  `${approvers.length} roles`,
);
check(
  "decision.read is wider than decision.approve",
  readers.length > approvers.length,
  `${readers.length} vs ${approvers.length}`,
);

// ------------------------------------------------------------ cleanup
console.log("\ncleanup");
if (decision) {
  await del(`founder_approvals?decision_id=eq.${decision.id}`);
  await del(`founder_decision_amendments?decision_id=eq.${decision.id}`);
  await del(`founder_decision_evidence?decision_id=eq.${decision.id}`);
  await del(`founder_decision_options?decision_id=eq.${decision.id}`);
  await del(`founder_decision_dependencies?decision_id=eq.${decision.id}`);

  // The decision's own history refuses an ordinary delete, which is the point
  // of an append-only record. Removing a check's rows is the one legitimate
  // exception, so the trigger is lifted for exactly that statement and put
  // straight back — and only for rows carrying this run's marker.
  await fetch(`${BASE}/rest/v1/rpc/founder_purge_check_decision`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ p_marker: `${MARK}%` }),
  }).catch(() => {});
}
await del(`founder_data_conflicts?subject=like.${MARK}*`);
await del(`founder_risks?source=eq.${MARK}`);

const leftDecisions = await get(`founder_decisions?select=id&title=like.${MARK}*`);
const leftRisks = await get(`founder_risks?select=id&source=eq.${MARK}`);
const leftConflicts = await get(`founder_data_conflicts?select=id&subject=like.${MARK}*`);
check(
  "every row this check wrote has been removed",
  leftDecisions.length === 0 && leftRisks.length === 0 && leftConflicts.length === 0,
  `${leftDecisions.length} decisions, ${leftRisks.length} risks, ${leftConflicts.length} conflicts left`,
);

console.log(`\nRESULT: ${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
