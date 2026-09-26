import { evaluatePolicy } from "./policy.server";
import type {
  ApprovalRecord,
  ApprovalSuggestion,
  ConfidenceAssessment,
  DecisionDetail,
  DecisionEvidence,
  DecisionExplanation,
  DecisionOption,
  DecisionRecord,
  DecisionState,
  EvidenceGap,
  PolicyDecision,
} from "./decision.types";
import { freshnessOf, type Severity } from "./state.types";

/**
 * The decision lifecycle.
 *
 * A decision is detected from something traceable, has its context built from
 * evidence that says what kind of claim each piece is, gets options rather than
 * one answer, and only then reaches a recommendation. Confidence is derived
 * from the evidence rather than asserted, and where the evidence is missing or
 * disagrees the decision says so and routes to escalation instead of
 * recommending anyway.
 *
 * Nothing here executes anything. The furthest this goes is asking a human.
 */

type Row = Record<string, unknown>;

function restUrl(): string {
  return process.env["SUPABASE_URL"]?.trim() ?? "";
}

function restHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim() ?? "";
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function rows(table: string, query: string): Promise<Row[]> {
  const base = restUrl();
  if (!base) throw new Error("SUPABASE_URL is not configured");
  const response = await fetch(`${base}/rest/v1/${table}?${query}`, { headers: restHeaders() });
  if (!response.ok) throw new Error(`${table}: ${response.status} ${await response.text()}`);
  return (await response.json()) as Row[];
}

async function insert(table: string, body: unknown): Promise<Row | null> {
  const base = restUrl();
  if (!base) throw new Error("SUPABASE_URL is not configured");
  const response = await fetch(`${base}/rest/v1/${table}`, {
    method: "POST",
    headers: restHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify(body),
  });
  if (!response.ok)
    throw new Error(`${table}: ${response.status} ${(await response.text()).slice(0, 300)}`);
  return ((await response.json()) as Row[])[0] ?? null;
}

async function update(table: string, filter: string, body: unknown): Promise<void> {
  const base = restUrl();
  if (!base) throw new Error("SUPABASE_URL is not configured");
  const response = await fetch(`${base}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: restHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok)
    throw new Error(`${table}: ${response.status} ${(await response.text()).slice(0, 300)}`);
}

function str(row: Row, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function num(row: Row, key: string): number | null {
  const value = row[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function sev(row: Row, key: string, fallback: Severity = "LOW"): Severity {
  const value = (str(row, key) ?? "").toUpperCase();
  const allowed: Severity[] = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"];
  return allowed.includes(value as Severity) ? (value as Severity) : fallback;
}

const SOURCED_KINDS = new Set(["FACT", "OBSERVATION", "CALCULATION"]);
const SOFT_KINDS = new Set(["ASSUMPTION", "INFERENCE"]);

/**
 * Confidence, derived from the evidence rather than asserted.
 *
 * Four things move it: how much of the evidence is actually sourced rather
 * than assumed, how fresh that evidence is, how many independent systems it
 * came from, and whether any of them disagree. A decision resting mostly on
 * inference cannot be highly confident however plausible it reads, and one
 * built on a single stale source is capped for the same reason.
 *
 * The factors travel with the score, because the database refuses a score
 * without them — and because "why is this 40 per cent" has to be answerable.
 */
export function assessConfidence(
  evidence: DecisionEvidence[],
  conflicts: number,
): ConfidenceAssessment {
  const notes: string[] = [];

  if (evidence.length === 0) {
    return {
      score: 0,
      level: "INSUFFICIENT",
      factors: {
        completeness: 0,
        freshness: 0,
        sourceCount: 0,
        conflicts,
        assumptions: 0,
        notes: ["No evidence has been gathered, so nothing can be concluded."],
      },
    };
  }

  const sourced = evidence.filter((e) => SOURCED_KINDS.has(e.kind));
  const soft = evidence.filter((e) => SOFT_KINDS.has(e.kind));
  const completeness = sourced.length / evidence.length;

  const dated = sourced.filter((e) => e.measuredAt);
  const fresh = dated.filter((e) => freshnessOf(e.measuredAt) === "FRESH");
  const freshness = dated.length === 0 ? 0 : fresh.length / dated.length;
  if (dated.length === 0 && sourced.length > 0) {
    notes.push("No piece of sourced evidence carries a measurement time.");
  }

  const sources = new Set(sourced.map((e) => e.sourceSystem));

  // Start from how much of this is measured, then temper it.
  let score = completeness * 70 + freshness * 20;
  if (sources.size >= 3) score += 10;
  else if (sources.size === 2) score += 5;
  else if (sources.size <= 1) notes.push("Everything rests on a single source system.");

  if (soft.length > sourced.length) {
    score = Math.min(score, 35);
    notes.push("More of this is assumption or inference than measurement.");
  }
  if (conflicts > 0) {
    score = Math.min(score, 30);
    notes.push(`${conflicts} source disagreement${conflicts === 1 ? "" : "s"} are unresolved.`);
  }
  if (dated.length > 0 && freshness === 0) {
    score = Math.min(score, 40);
    notes.push("Every dated measurement is stale.");
  }

  const rounded = Math.max(0, Math.min(100, Math.round(score)));
  const level: ConfidenceAssessment["level"] =
    rounded >= 75 ? "HIGH" : rounded >= 50 ? "MODERATE" : rounded >= 25 ? "LOW" : "INSUFFICIENT";

  return {
    score: rounded,
    level,
    factors: {
      completeness: Math.round(completeness * 100) / 100,
      freshness: Math.round(freshness * 100) / 100,
      sourceCount: sources.size,
      conflicts,
      assumptions: soft.length,
      notes,
    },
  };
}

/**
 * What is missing, judged from the evidence rather than assumed away.
 *
 * This is the gate that stops the engine recommending "increase marketing
 * spend because revenue dropped" when the revenue source was unreadable.
 */
export function assessGap(evidence: DecisionEvidence[], conflicts: number): EvidenceGap {
  if (conflicts > 0) return "CONFLICTING_DATA";
  if (evidence.length === 0) return "INSUFFICIENT_DATA";

  const sourced = evidence.filter((e) => SOURCED_KINDS.has(e.kind));
  if (sourced.length === 0) return "INSUFFICIENT_DATA";

  const dated = sourced.filter((e) => e.measuredAt);
  if (dated.length > 0 && dated.every((e) => freshnessOf(e.measuredAt) === "STALE")) {
    return "STALE_DATA";
  }
  if (sourced.length < evidence.length / 3) return "INSUFFICIENT_DATA";
  return "NONE";
}

function toEvidence(row: Row): DecisionEvidence {
  return {
    id: String(row.id),
    kind: (str(row, "kind") ?? "OBSERVATION") as DecisionEvidence["kind"],
    statement: str(row, "statement") ?? "",
    sourceSystem: str(row, "source_system") ?? "",
    sourceEntity: str(row, "source_entity"),
    sourceRecord: str(row, "source_record"),
    measuredAt: str(row, "measured_at"),
    calculation: str(row, "calculation"),
    freshness: str(row, "freshness"),
    confidence: (str(row, "confidence") ?? "UNKNOWN") as DecisionEvidence["confidence"],
  };
}

function toOption(row: Row): DecisionOption {
  return {
    id: String(row.id),
    label: str(row, "label") ?? "",
    title: str(row, "title") ?? "",
    description: str(row, "description") ?? "",
    expectedBenefit: str(row, "expected_benefit"),
    expectedCost: str(row, "expected_cost"),
    financialImpact: num(row, "financial_impact"),
    financialBasis: str(row, "financial_basis"),
    customerImpact: str(row, "customer_impact") as Severity | null,
    operationalImpact: str(row, "operational_impact") as Severity | null,
    reputationImpact: str(row, "reputation_impact") as Severity | null,
    securityImpact: str(row, "security_impact") as Severity | null,
    complianceImpact: str(row, "compliance_impact") as Severity | null,
    resourceImpact: str(row, "resource_impact"),
    timeToEffect: str(row, "time_to_effect"),
    reversibility: str(row, "reversibility") as DecisionOption["reversibility"],
    riskSummary: str(row, "risk_summary"),
    dependencies: Array.isArray(row.dependencies) ? row.dependencies.map(String) : [],
    constraints: Array.isArray(row.constraints) ? row.constraints.map(String) : [],
    confidenceScore: num(row, "confidence_score"),
    isRecommended: row.is_recommended === true,
  };
}

function toDecision(row: Row): DecisionRecord {
  return {
    id: String(row.id),
    title: str(row, "title") ?? "",
    description: str(row, "description") ?? "",
    decisionType: str(row, "decision_type") ?? "OPERATIONAL",
    domain: str(row, "domain") ?? "EXECUTIVE",
    state: (str(row, "state") ?? "DETECTED") as DecisionState,
    priority: num(row, "priority") ?? 3,
    triggerType: str(row, "trigger_type") ?? "",
    triggerReference: str(row, "trigger_reference"),
    confidenceScore: num(row, "confidence_score"),
    confidenceLevel: str(row, "confidence_level"),
    confidenceFactors: (row.confidence_factors as DecisionRecord["confidenceFactors"]) ?? {},
    evidenceGap: (str(row, "evidence_gap") ?? "NONE") as EvidenceGap,
    riskLevel: sev(row, "risk_level"),
    impactLevel: sev(row, "impact_level"),
    approvalRequired: row.approval_required !== false,
    recommendedOptionId: str(row, "recommended_option_id"),
    selectedOptionId: str(row, "selected_option_id"),
    overrideReason: str(row, "override_reason"),
    policyId: str(row, "policy_id"),
    policyVersion: num(row, "policy_version"),
    decisionDueAt: str(row, "decision_due_at"),
    approvalDueAt: str(row, "approval_due_at"),
    outcome: str(row, "outcome"),
    outcomeRecordedAt: str(row, "outcome_recorded_at"),
    createdAt: str(row, "created_at") ?? "",
    updatedAt: str(row, "updated_at") ?? "",
    actorKind: (str(row, "actor_kind") ?? "AI") as DecisionRecord["actorKind"],
  };
}

function toApproval(row: Row): ApprovalRecord {
  const expiresAt = str(row, "expires_at") ?? "";
  const state = (str(row, "state") ?? "REQUESTED") as ApprovalRecord["state"];
  return {
    id: String(row.id),
    decisionId: String(row.decision_id),
    approvalType: str(row, "approval_type") ?? "",
    requestedBy: str(row, "requested_by"),
    requesterKind: str(row, "requester_kind") ?? "AI",
    awaitingRole: str(row, "awaiting_role"),
    approverId: str(row, "approver_id"),
    riskLevel: sev(row, "risk_level"),
    impactLevel: sev(row, "impact_level"),
    reason: str(row, "reason") ?? "",
    state,
    decisionReason: str(row, "decision_reason"),
    requestedAt: str(row, "requested_at") ?? "",
    decidedAt: str(row, "decided_at"),
    expiresAt,
    // Worked out at read time; a stored flag would be wrong the moment the
    // deadline passed with nobody looking.
    isExpired:
      (state === "REQUESTED" || state === "VIEWED") &&
      Boolean(expiresAt) &&
      new Date(expiresAt).getTime() < Date.now(),
  };
}

/** Record a history entry. Append-only, enforced by a trigger. */
async function appendHistory(entry: {
  decisionId: string;
  actorKind: "HUMAN" | "AI" | "SYSTEM" | "EXTERNAL";
  actorId?: string | null;
  entryType: string;
  fromState?: DecisionState | null;
  toState?: DecisionState | null;
  reason?: string | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    await insert("founder_decision_history", {
      decision_id: entry.decisionId,
      actor_kind: entry.actorKind,
      actor_id: entry.actorId ?? null,
      entry_type: entry.entryType,
      from_state: entry.fromState ?? null,
      to_state: entry.toState ?? null,
      reason: entry.reason ?? null,
      detail: entry.detail ?? {},
    });
  } catch (error) {
    console.error("[founder/decisions] history append failed:", error);
  }
}

export interface NewDecision {
  title: string;
  description: string;
  decisionType: string;
  domain: string;
  triggerType: string;
  triggerReference?: string | null;
  triggerEventId?: string | null;
  priority?: number;
  riskLevel?: Severity;
  impactLevel?: Severity;
  /** Repeated analysis of the same condition must not raise a second decision. */
  idempotencyKey?: string | null;
  actorKind?: "HUMAN" | "AI" | "SYSTEM";
  createdBy?: string | null;
  contextRef?: Record<string, unknown>;
}

/**
 * Raise a decision.
 *
 * Idempotent where a key is given: the same condition analysed twice returns
 * the decision that already exists rather than a second one.
 */
export async function createDecision(
  input: NewDecision,
): Promise<{ created: boolean; decision: DecisionRecord }> {
  if (input.idempotencyKey) {
    const existing = await rows(
      "founder_decisions",
      `select=*&idempotency_key=eq.${encodeURIComponent(input.idempotencyKey)}&limit=1`,
    );
    if (existing[0]) return { created: false, decision: toDecision(existing[0]) };
  }

  const row = await insert("founder_decisions", {
    title: input.title,
    description: input.description,
    decision_type: input.decisionType,
    domain: input.domain,
    trigger_type: input.triggerType,
    trigger_reference: input.triggerReference ?? null,
    trigger_event_id: input.triggerEventId ?? null,
    priority: input.priority ?? 3,
    risk_level: input.riskLevel ?? "LOW",
    impact_level: input.impactLevel ?? "LOW",
    idempotency_key: input.idempotencyKey ?? null,
    actor_kind: input.actorKind ?? "AI",
    created_by: input.createdBy ?? null,
    context_ref: input.contextRef ?? {},
  });
  if (!row) throw new Error("the decision was not created");

  const decision = toDecision(row);
  await appendHistory({
    decisionId: decision.id,
    actorKind: decision.actorKind,
    actorId: input.createdBy ?? null,
    entryType: "detected",
    toState: "DETECTED",
    reason: `Raised by ${input.triggerType}`,
    detail: { triggerReference: input.triggerReference ?? null },
  });

  return { created: true, decision };
}

/** Move a decision along. The database refuses an invalid move. */
export async function transition(
  decisionId: string,
  to: DecisionState,
  actor: { kind: "HUMAN" | "AI" | "SYSTEM"; id?: string | null },
  reason?: string,
): Promise<{ ok: boolean; error?: string }> {
  const current = await rows("founder_decisions", `select=state&id=eq.${decisionId}&limit=1`);
  const from = current[0] ? ((str(current[0], "state") ?? null) as DecisionState | null) : null;

  try {
    await update("founder_decisions", `id=eq.${decisionId}`, {
      state: to,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "transition refused" };
  }

  await appendHistory({
    decisionId,
    actorKind: actor.kind,
    actorId: actor.id ?? null,
    entryType: "state_change",
    fromState: from,
    toState: to,
    reason: reason ?? null,
  });
  return { ok: true };
}

/**
 * Build the context, derive confidence, and settle on a recommendation.
 *
 * This is where the engine refuses to pretend. If the evidence is missing,
 * stale or contradictory the decision carries that gap, is not given a
 * recommendation, and goes to escalation — because a recommendation resting on
 * absent data is the one output that must never be produced.
 */
export async function analyseDecision(
  decisionId: string,
  actor: { kind: "HUMAN" | "AI" | "SYSTEM"; id?: string | null },
): Promise<{ ok: boolean; state: DecisionState; gap: EvidenceGap; error?: string }> {
  const [decisionRows, evidenceRows, optionRows, conflictRows] = await Promise.all([
    rows("founder_decisions", `select=*&id=eq.${decisionId}&limit=1`),
    rows("founder_decision_evidence", `select=*&decision_id=eq.${decisionId}&limit=200`),
    rows("founder_decision_options", `select=*&decision_id=eq.${decisionId}&limit=50`),
    rows(
      "founder_data_conflicts",
      `select=id&decision_id=eq.${decisionId}&status=in.(open,investigating)&limit=50`,
    ),
  ]);

  const row = decisionRows[0];
  if (!row) return { ok: false, state: "DETECTED", gap: "UNKNOWN", error: "no such decision" };

  const decision = toDecision(row);
  const evidence = evidenceRows.map(toEvidence);
  const options = optionRows.map(toOption);
  const conflicts = conflictRows.length;

  const confidence = assessConfidence(evidence, conflicts);
  const gap = assessGap(evidence, conflicts);

  const recommended = options.find((o) => o.isRecommended) ?? null;
  const exposure = recommended?.financialImpact ?? null;

  const policy = await evaluatePolicy({
    actionClass: "RECOMMEND",
    risk: decision.riskLevel,
    impact: decision.impactLevel,
    domain: decision.domain,
    decisionType: decision.decisionType,
    financialExposure: exposure,
  });

  await update("founder_decisions", `id=eq.${decisionId}`, {
    confidence_score: confidence.score,
    confidence_level: confidence.level,
    confidence_factors: confidence.factors,
    evidence_gap: gap,
    approval_required: policy.requiresApproval,
    policy_id: policy.policyId,
    policy_version: policy.policyVersion,
    recommended_option_id: recommended?.id ?? null,
    updated_at: new Date().toISOString(),
  });

  await appendHistory({
    decisionId,
    actorKind: actor.kind,
    actorId: actor.id ?? null,
    entryType: "analysis",
    reason: `Confidence ${confidence.score} (${confidence.level}); gap ${gap}`,
    detail: { factors: confidence.factors, policy: policy.reasons },
  });

  // Missing or contradictory evidence goes to a human as an escalation, not as
  // a recommendation dressed up as one.
  const blocking = gap === "INSUFFICIENT_DATA" || gap === "CONFLICTING_DATA";
  const target: DecisionState = blocking
    ? "ESCALATED"
    : options.length === 0
      ? "ANALYZING"
      : recommended
        ? "RECOMMENDATION_READY"
        : "OPTIONS_READY";

  // Walk the lifecycle rather than jumping, so each step is recorded.
  const path: DecisionState[] = [];
  if (decision.state === "DETECTED") path.push("CONTEXT_BUILDING", "ANALYZING");
  else if (decision.state === "CONTEXT_BUILDING") path.push("ANALYZING");
  if (!blocking && target !== "ANALYZING") {
    if (decision.state !== "OPTIONS_READY") path.push("OPTIONS_READY");
    if (target === "RECOMMENDATION_READY") path.push("RECOMMENDATION_READY");
  }
  if (blocking) path.push("ESCALATED");

  for (const step of path) {
    const moved = await transition(
      decisionId,
      step,
      actor,
      blocking ? `evidence gap: ${gap}` : undefined,
    );
    if (!moved.ok) return { ok: false, state: decision.state, gap, error: moved.error };
  }

  return { ok: true, state: target, gap };
}

/** Why this was flagged, what was used, and what is still unknown. */
function explain(
  decision: DecisionRecord,
  evidence: DecisionEvidence[],
  options: DecisionOption[],
  policy: PolicyDecision | null,
): DecisionExplanation {
  const sourced = evidence.filter((e) => SOURCED_KINDS.has(e.kind));
  const soft = evidence.filter((e) => SOFT_KINDS.has(e.kind));
  const recommended = options.find((o) => o.id === decision.recommendedOptionId) ?? null;

  const unknown: string[] = [];
  if (decision.evidenceGap !== "NONE") unknown.push(`Evidence is marked ${decision.evidenceGap}.`);
  if (sourced.length === 0) unknown.push("Nothing here is measured; it rests on inference.");
  for (const note of decision.confidenceFactors.notes ?? []) {
    unknown.push(note);
  }
  if (recommended && recommended.financialImpact === null) {
    unknown.push("No financial impact could be estimated for the recommended option.");
  }

  return {
    whyFlagged: `${decision.triggerType.replace(/_/g, " ").toLowerCase()}${
      decision.triggerReference ? ` — ${decision.triggerReference}` : ""
    }`,
    whatDataWasUsed: sourced.map(
      (e) => `${e.sourceSystem}${e.sourceRecord ? ` · ${e.sourceRecord}` : ""}: ${e.statement}`,
    ),
    whatChanged: evidence.find((e) => e.kind === "OBSERVATION")?.statement ?? null,
    optionsConsidered: options.map((o) => ({
      label: o.label,
      title: o.title,
      whyNot: o.isRecommended ? null : (o.riskSummary ?? o.expectedCost ?? null),
    })),
    whyThisOption: recommended
      ? (recommended.expectedBenefit ?? `${recommended.title} — ${recommended.description}`)
      : null,
    risks: [
      ...(recommended?.riskSummary ? [recommended.riskSummary] : []),
      ...(recommended?.reversibility === "IRREVERSIBLE"
        ? ["The recommended option cannot be undone."]
        : []),
      ...soft.map((e) => `Rests partly on ${e.kind.toLowerCase()}: ${e.statement}`),
    ],
    whatIsUnknown: unknown,
    approvalRequired: policy
      ? policy.reasons.join(" ")
      : decision.approvalRequired
        ? "A human decision is required."
        : "No approval is required by policy.",
  };
}

/** One decision, with everything needed to understand and act on it. */
export async function loadDecision(decisionId: string): Promise<DecisionDetail | null> {
  const [decisionRows, optionRows, evidenceRows, approvalRows, historyRows, conflictRows] =
    await Promise.all([
      rows("founder_decisions", `select=*&id=eq.${decisionId}&limit=1`),
      rows(
        "founder_decision_options",
        `select=*&decision_id=eq.${decisionId}&order=label.asc&limit=50`,
      ),
      rows("founder_decision_evidence", `select=*&decision_id=eq.${decisionId}&limit=200`),
      rows(
        "founder_approvals",
        `select=*&decision_id=eq.${decisionId}&order=requested_at.desc&limit=1`,
      ),
      rows(
        "founder_decision_history",
        `select=*&decision_id=eq.${decisionId}&order=at.desc&limit=100`,
      ),
      rows("founder_data_conflicts", `select=*&decision_id=eq.${decisionId}&limit=50`),
    ]);

  const row = decisionRows[0];
  if (!row) return null;

  const decision = toDecision(row);
  const options = optionRows.map(toOption);
  const evidence = evidenceRows.map(toEvidence);
  const approval = approvalRows[0] ? toApproval(approvalRows[0]) : null;

  const recommended = options.find((o) => o.id === decision.recommendedOptionId) ?? null;
  const policy = await evaluatePolicy({
    actionClass: "REQUEST_APPROVAL",
    risk: decision.riskLevel,
    impact: decision.impactLevel,
    domain: decision.domain,
    decisionType: decision.decisionType,
    financialExposure: recommended?.financialImpact ?? null,
  });

  return {
    decision,
    options,
    evidence,
    approval,
    policy,
    explanation: explain(decision, evidence, options, policy),
    history: historyRows.map((h) => ({
      at: str(h, "at") ?? "",
      actorKind: str(h, "actor_kind") ?? "SYSTEM",
      entryType: str(h, "entry_type") ?? "",
      fromState: str(h, "from_state"),
      toState: str(h, "to_state"),
      reason: str(h, "reason"),
    })),
    conflicts: conflictRows.map((c) => ({
      id: String(c.id),
      subject: str(c, "subject") ?? "",
      conflictType: str(c, "conflict_type") ?? "",
      status: str(c, "status") ?? "open",
    })),
  };
}

export interface DecisionFilter {
  state?: DecisionState;
  domain?: string;
  risk?: Severity;
  limit?: number;
}

export async function listDecisions(filter: DecisionFilter = {}): Promise<DecisionRecord[]> {
  const parts = [`select=*`, `order=created_at.desc`, `limit=${filter.limit ?? 100}`];
  if (filter.state) parts.push(`state=eq.${filter.state}`);
  if (filter.domain) parts.push(`domain=eq.${encodeURIComponent(filter.domain)}`);
  if (filter.risk) parts.push(`risk_level=eq.${filter.risk}`);
  return (await rows("founder_decisions", parts.join("&"))).map(toDecision);
}

/**
 * The Approval Suggestions surface.
 *
 * Each row carries what happened, why it matters, how much of it is actually
 * evidenced, what is recommended and who has to decide — so the screen is a
 * governance surface rather than a list saying "AI recommends this".
 */
export async function approvalSuggestions(limit = 50): Promise<ApprovalSuggestion[]> {
  const decisionRows = await rows(
    "founder_decisions",
    `select=*&state=in.(RECOMMENDATION_READY,WAITING_APPROVAL,ESCALATED)&order=priority.asc,created_at.desc&limit=${limit}`,
  );
  if (decisionRows.length === 0) return [];

  const ids = decisionRows.map((d) => String(d.id));
  const inList = `(${ids.map((id) => `"${id}"`).join(",")})`;

  const [optionRows, evidenceRows, approvalRows] = await Promise.all([
    rows("founder_decision_options", `select=*&decision_id=in.${inList}&limit=500`),
    rows("founder_decision_evidence", `select=*&decision_id=in.${inList}&limit=1000`),
    rows("founder_approvals", `select=*&decision_id=in.${inList}&limit=200`),
  ]);

  return decisionRows.map((row) => {
    const decision = toDecision(row);
    const options = optionRows.filter((o) => String(o.decision_id) === decision.id).map(toOption);
    const evidence = evidenceRows
      .filter((e) => String(e.decision_id) === decision.id)
      .map(toEvidence);
    const approvalRow = approvalRows
      .filter((a) => String(a.decision_id) === decision.id)
      .sort((a, b) =>
        (str(b, "requested_at") ?? "").localeCompare(str(a, "requested_at") ?? ""),
      )[0];
    const approval = approvalRow ? toApproval(approvalRow) : null;
    const recommended = options.find((o) => o.id === decision.recommendedOptionId) ?? null;

    return {
      decisionId: decision.id,
      approvalId: approval?.id ?? null,
      title: decision.title,
      whatHappened: decision.description,
      whyItMatters:
        recommended?.expectedBenefit ??
        `${decision.riskLevel} risk, ${decision.impactLevel} impact in ${decision.domain.replace(/_/g, " ").toLowerCase()}`,
      evidenceCount: evidence.length,
      sourcedEvidenceCount: evidence.filter((e) => SOURCED_KINDS.has(e.kind)).length,
      risk: decision.riskLevel,
      impact: decision.impactLevel,
      recommendation: recommended ? `${recommended.label}. ${recommended.title}` : null,
      approvalRequired: decision.approvalRequired,
      awaitingRole: approval?.awaitingRole ?? null,
      expiresAt: approval?.expiresAt ?? null,
      isExpired: approval?.isExpired ?? false,
      state: decision.state,
      approvalState: approval?.state ?? null,
      evidenceGap: decision.evidenceGap,
      confidenceScore: decision.confidenceScore,
      createdAt: decision.createdAt,
    };
  });
}

export { appendHistory, toApproval, toDecision };
