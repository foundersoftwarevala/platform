import { appendHistory, toApproval } from "./decisions.server";
import { canApprove, evaluatePolicy } from "./policy.server";
import type { ApprovalRecord } from "./decision.types";
import type { Severity } from "./state.types";

/**
 * The approval engine.
 *
 * A recommendation becomes a request, a policy decides who may answer it and
 * by when, and a human answers. Four things are refused rather than trusted to
 * a caller: approving your own request, approving after the deadline, raising a
 * second open request for one decision, and approving without the permission
 * that carries it. Three of those are also enforced by the database, so a code
 * path that forgets cannot get past them.
 *
 * Notifications go through the platform's existing `notifications` table. No
 * second notification system is created here.
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

/**
 * Tell the people who can act about it.
 *
 * This writes into the platform's own notifications table — the one the bell
 * already reads — rather than inventing a parallel channel. A failure to
 * notify never fails the request that succeeded, but it is logged, because a
 * silent approval request is one nobody answers.
 */
async function notifyApprovers(input: {
  roles: string[];
  title: string;
  body: string;
  decisionId: string;
  approvalId: string;
}): Promise<number> {
  const base = restUrl();
  if (!base) return 0;

  try {
    const holders = await rows(
      "user_roles",
      `select=user_id&role=in.(${input.roles.map((r) => `"${r}"`).join(",")})&limit=100`,
    );
    const userIds = [...new Set(holders.map((h) => String(h.user_id)).filter(Boolean))];
    if (userIds.length === 0) return 0;

    await insert(
      "notifications",
      userIds.map((userId) => ({
        user_id: userId,
        title: input.title,
        body: input.body,
        kind: "founder_approval",
        data: {
          module: "founder-ai",
          decision_id: input.decisionId,
          approval_id: input.approvalId,
          action: `/ai-ceo/approvals`,
        },
      })),
    );
    return userIds.length;
  } catch (error) {
    console.error("[founder/approvals] notification failed:", error);
    return 0;
  }
}

/**
 * Ask a human.
 *
 * The policy in force decides who may answer and how long they have, and both
 * travel with the request so the decision stays explainable against the rules
 * that applied when it was raised.
 */
export async function requestApproval(input: {
  decisionId: string;
  requestedBy: string | null;
  requesterKind?: "HUMAN" | "AI" | "SYSTEM";
  reason: string;
  evidence: Record<string, unknown>;
  idempotencyKey?: string | null;
}): Promise<{ ok: boolean; approval?: ApprovalRecord; error?: string; notified?: number }> {
  const decisionRows = await rows(
    "founder_decisions",
    `select=*&id=eq.${input.decisionId}&limit=1`,
  );
  const decision = decisionRows[0];
  if (!decision) return { ok: false, error: "No such decision." };

  const gap = str(decision, "evidence_gap") ?? "NONE";
  if (gap === "INSUFFICIENT_DATA" || gap === "CONFLICTING_DATA") {
    return {
      ok: false,
      error: `This decision is marked ${gap}. Resolve the evidence or escalate it; it cannot be put to an approver as though it were complete.`,
    };
  }

  if (!str(decision, "recommended_option_id")) {
    return { ok: false, error: "There is nothing to approve: no option has been recommended." };
  }

  const risk = (str(decision, "risk_level") ?? "LOW") as Severity;
  const impact = (str(decision, "impact_level") ?? "LOW") as Severity;

  const policy = await evaluatePolicy({
    actionClass: "REQUEST_APPROVAL",
    risk,
    impact,
    domain: str(decision, "domain") ?? "EXECUTIVE",
    decisionType: str(decision, "decision_type") ?? "OPERATIONAL",
  });

  if (policy.blocked) {
    return { ok: false, error: `Policy blocks this: ${policy.reasons.join(" ")}` };
  }

  const expiresAt = new Date(Date.now() + policy.approvalTtlHours * 3_600_000).toISOString();

  let row: Row | null;
  try {
    row = await insert("founder_approvals", {
      decision_id: input.decisionId,
      approval_type: str(decision, "decision_type") ?? "OPERATIONAL",
      requested_by: input.requestedBy,
      requester_kind: input.requesterKind ?? "AI",
      awaiting_role: policy.approverRoles[0] ?? null,
      risk_level: risk,
      impact_level: impact,
      reason: input.reason,
      evidence: input.evidence,
      policy_id: policy.policyId,
      policy_version: policy.policyVersion,
      expires_at: expiresAt,
      idempotency_key: input.idempotencyKey ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // The partial unique index is the database refusing a second open request.
    if (message.includes("founder_approvals_one_open_per_decision") || message.includes("409")) {
      return { ok: false, error: "This decision already has an approval request open." };
    }
    return { ok: false, error: message.slice(0, 200) };
  }
  if (!row) return { ok: false, error: "The approval request was not created." };

  const approval = toApproval(row);

  await update("founder_decisions", `id=eq.${input.decisionId}`, {
    state: "WAITING_APPROVAL",
    approval_required: true,
    approval_due_at: expiresAt,
    policy_id: policy.policyId,
    policy_version: policy.policyVersion,
    updated_at: new Date().toISOString(),
  });

  await appendHistory({
    decisionId: input.decisionId,
    actorKind: input.requesterKind ?? "AI",
    actorId: input.requestedBy,
    entryType: "approval_requested",
    toState: "WAITING_APPROVAL",
    reason: input.reason,
    detail: { policy: policy.reasons, expiresAt, awaitingRole: approval.awaitingRole },
  });

  const notified = await notifyApprovers({
    roles: policy.approverRoles,
    title: `Approval needed: ${str(decision, "title") ?? "a decision"}`,
    body: input.reason,
    decisionId: input.decisionId,
    approvalId: approval.id,
  });

  return { ok: true, approval, notified };
}

/** Record that an approver has seen it, without deciding. */
export async function markViewed(
  approvalId: string,
  viewerId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const current = await rows("founder_approvals", `select=state&id=eq.${approvalId}&limit=1`);
    if ((str(current[0] ?? {}, "state") ?? "") !== "REQUESTED") return { ok: true };
    await update("founder_approvals", `id=eq.${approvalId}`, {
      state: "VIEWED",
      viewed_at: new Date().toISOString(),
      viewed_by: viewerId,
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "could not record the view",
    };
  }
}

export type ApprovalVerdict = "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";

/**
 * Answer an approval request.
 *
 * Every check runs on the server: who the caller is, what roles they hold,
 * whether policy lets them decide this, whether they are the one who asked,
 * and whether the deadline has passed. Nothing here trusts the browser.
 */
export async function decideApproval(input: {
  approvalId: string;
  approverId: string;
  approverRoles: string[];
  verdict: ApprovalVerdict;
  reason: string;
}): Promise<{ ok: boolean; error?: string }> {
  const approvalRows = await rows(
    "founder_approvals",
    `select=*&id=eq.${input.approvalId}&limit=1`,
  );
  const row = approvalRows[0];
  if (!row) return { ok: false, error: "No such approval request." };

  const approval = toApproval(row);

  if (approval.state !== "REQUESTED" && approval.state !== "VIEWED") {
    return { ok: false, error: `This request is already ${approval.state.toLowerCase()}.` };
  }
  if (approval.isExpired) {
    return {
      ok: false,
      error: `This request expired at ${approval.expiresAt}. It has to be raised again and re-evaluated.`,
    };
  }
  if (!input.reason.trim()) {
    return { ok: false, error: "A decision on an approval needs a reason." };
  }

  const decisionRows = await rows(
    "founder_decisions",
    `select=*&id=eq.${approval.decisionId}&limit=1`,
  );
  const decision = decisionRows[0];
  if (!decision) return { ok: false, error: "The decision behind this request is missing." };

  const policy = await evaluatePolicy({
    actionClass: "APPROVE",
    risk: approval.riskLevel,
    impact: approval.impactLevel,
    domain: str(decision, "domain") ?? "EXECUTIVE",
    decisionType: str(decision, "decision_type") ?? "OPERATIONAL",
  });

  const permitted = await canApprove({
    approverId: input.approverId,
    requestedBy: approval.requestedBy,
    policy,
    roles: input.approverRoles,
  });
  if (!permitted.allowed) return { ok: false, error: permitted.reason };

  try {
    await update("founder_approvals", `id=eq.${input.approvalId}`, {
      state: input.verdict,
      approver_id: input.approverId,
      decided_at: new Date().toISOString(),
      decision_reason: input.reason.trim(),
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message.slice(0, 200) : "refused" };
  }

  const nextState =
    input.verdict === "APPROVED"
      ? "APPROVED"
      : input.verdict === "REJECTED"
        ? "REJECTED"
        : "ESCALATED";

  try {
    await update("founder_decisions", `id=eq.${approval.decisionId}`, {
      state: nextState,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[founder/approvals] decision state not updated:", error);
  }

  await appendHistory({
    decisionId: approval.decisionId,
    actorKind: "HUMAN",
    actorId: input.approverId,
    entryType: `approval_${input.verdict.toLowerCase()}`,
    toState: nextState,
    reason: input.reason.trim(),
    detail: { policy: policy.reasons, approvalId: input.approvalId },
  });

  return { ok: true };
}

/**
 * Expire what has run out of time.
 *
 * An expired request is not a decision waiting to be made, and leaving it
 * looking open is how something gets approved a week after the situation that
 * justified it has changed. Safe to run repeatedly.
 */
export async function expireOverdueApprovals(): Promise<{ expired: number }> {
  const now = new Date().toISOString();
  const overdue = await rows(
    "founder_approvals",
    `select=id,decision_id&state=in.(REQUESTED,VIEWED)&expires_at=lt.${now}&limit=200`,
  );

  let expired = 0;
  for (const row of overdue) {
    try {
      await update("founder_approvals", `id=eq.${String(row.id)}`, { state: "EXPIRED" });
      await appendHistory({
        decisionId: String(row.decision_id),
        actorKind: "SYSTEM",
        entryType: "approval_expired",
        reason: "The approval request passed its deadline without a decision.",
      });
      expired += 1;
    } catch (error) {
      console.error("[founder/approvals] could not expire", String(row.id), error);
    }
  }
  return { expired };
}

/**
 * A human choosing something other than the recommendation.
 *
 * The recommendation is never rewritten. The override sits beside it with its
 * reason and its actor, so the pair can be read later — which is what makes
 * repeated overrides a learning signal rather than a lost argument.
 */
export async function overrideRecommendation(input: {
  decisionId: string;
  actorId: string;
  selectedOptionId: string;
  reason: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!input.reason.trim()) return { ok: false, error: "An override needs a reason." };

  const decisionRows = await rows(
    "founder_decisions",
    `select=recommended_option_id,state&id=eq.${input.decisionId}&limit=1`,
  );
  const decision = decisionRows[0];
  if (!decision) return { ok: false, error: "No such decision." };

  const recommended = str(decision, "recommended_option_id");
  if (recommended === input.selectedOptionId) {
    return { ok: false, error: "That is the recommended option; nothing is being overridden." };
  }

  try {
    await update("founder_decisions", `id=eq.${input.decisionId}`, {
      selected_option_id: input.selectedOptionId,
      override_reason: input.reason.trim(),
      overridden_by: input.actorId,
      overridden_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message.slice(0, 200) : "refused" };
  }

  await appendHistory({
    decisionId: input.decisionId,
    actorKind: "HUMAN",
    actorId: input.actorId,
    entryType: "override",
    reason: input.reason.trim(),
    detail: { recommendedOptionId: recommended, selectedOptionId: input.selectedOptionId },
  });

  return { ok: true };
}

/** What actually happened, against what was expected. */
export async function recordOutcome(input: {
  decisionId: string;
  actorId: string;
  outcome: string;
  succeeded: boolean;
  variance?: string | null;
  evidence?: Record<string, unknown>;
}): Promise<{ ok: boolean; error?: string }> {
  if (!input.outcome.trim()) return { ok: false, error: "An outcome needs to say what happened." };

  try {
    await update("founder_decisions", `id=eq.${input.decisionId}`, {
      outcome: input.outcome.trim(),
      outcome_recorded_at: new Date().toISOString(),
      verification_status: input.succeeded ? "VERIFIED" : "FAILED",
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message.slice(0, 200) : "refused" };
  }

  await appendHistory({
    decisionId: input.decisionId,
    actorKind: "HUMAN",
    actorId: input.actorId,
    entryType: "outcome",
    reason: input.outcome.trim(),
    detail: {
      succeeded: input.succeeded,
      variance: input.variance ?? null,
      evidence: input.evidence ?? {},
    },
  });

  return { ok: true };
}
