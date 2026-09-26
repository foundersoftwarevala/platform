import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import type { ApprovalSuggestion, DecisionDetail, DecisionRecord } from "./decision.types";

/**
 * The Decision Engine's API.
 *
 * Every handler resolves the caller on the server and then resolves the roles
 * they actually hold, because an approval is the one action where trusting the
 * browser would be indefensible. The roles come from user_roles, the permission
 * from role_permissions, and the policy decides the rest.
 *
 * Nothing here executes an operational action. The API stops at recommending,
 * asking, approving, overriding and recording what happened.
 */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/**
 * The caller, their id and the roles they hold.
 *
 * The token is checked against the auth service with the publishable key. The
 * service-role key is refused by that endpoint — the mistake that once left
 * the whole AI CEO console rendering empty — so it is deliberately not used.
 */
async function requireCaller(): Promise<{ id: string; roles: string[] }> {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Executive authentication required");

  const url = process.env["SUPABASE_URL"]?.trim();
  const publishable =
    process.env["SUPABASE_PUBLISHABLE_KEY"]?.trim() ?? process.env["SUPABASE_ANON_KEY"]?.trim();
  const service = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();
  if (!url || !publishable || !service)
    throw new Error("Executive authentication is not configured");

  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: publishable, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Executive authentication required");
  const user = (await response.json()) as { id?: string };
  if (!user?.id) throw new Error("Executive authentication required");

  const rolesResponse = await fetch(
    `${url}/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(user.id)}`,
    { headers: { apikey: service, Authorization: `Bearer ${service}` } },
  );
  const roles = rolesResponse.ok
    ? ((await rolesResponse.json()) as { role?: string }[])
        .map((r) =>
          String(r.role ?? "")
            .toLowerCase()
            .trim(),
        )
        .filter(Boolean)
    : [];

  return { id: user.id, roles };
}

/** Reading the decision record is for executives and the reviewer roles. */
async function requireRead(): Promise<{ id: string; roles: string[] }> {
  const caller = await requireCaller();
  const db = await admin();
  const [{ data: isBoss }, { data: isAdmin }] = await Promise.all([
    db.rpc("has_role", { _user_id: caller.id, _role: "boss" }),
    db.rpc("has_role", { _user_id: caller.id, _role: "admin" }),
  ]);
  const reviewer = caller.roles.some((r) =>
    [
      "super_admin",
      "boss_owner",
      "founder",
      "developer",
      "finance",
      "support",
      "marketing",
      "seo",
      "legal",
    ].includes(r),
  );
  if (!isBoss && !isAdmin && !reviewer) throw new Error("Executive permission required");
  return caller;
}

export const listFounderDecisions = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z
      .object({
        state: z.string().optional(),
        domain: z.string().optional(),
        limit: z.number().int().min(1).max(200).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<DecisionRecord[]> => {
    await requireRead();
    const { listDecisions } = await import("./decisions.server");
    return listDecisions({
      state: data.state as never,
      domain: data.domain,
      limit: data.limit ?? 100,
    });
  });

export const loadFounderDecision = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<DecisionDetail | null> => {
    await requireRead();
    const { loadDecision } = await import("./decisions.server");
    return loadDecision(data.id);
  });

/** The Approval Suggestions surface, with evidence counts and policy. */
export const loadApprovalSuggestions = createServerFn({ method: "GET" }).handler(
  async (): Promise<ApprovalSuggestion[]> => {
    await requireRead();
    const { approvalSuggestions } = await import("./decisions.server");
    return approvalSuggestions(50);
  },
);

export const createFounderDecision = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        title: z.string().min(3).max(200),
        description: z.string().min(3).max(4000),
        decisionType: z.string().min(2).max(60),
        domain: z.string().min(2).max(60),
        triggerType: z.string().min(2).max(60),
        triggerReference: z.string().max(300).optional(),
        priority: z.number().int().min(1).max(5).optional(),
        riskLevel: z.enum(["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
        impactLevel: z.enum(["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
        idempotencyKey: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(
    async ({ data }): Promise<{ ok: boolean; id?: string; created?: boolean; error?: string }> => {
      const caller = await requireRead();
      try {
        const { createDecision } = await import("./decisions.server");
        const result = await createDecision({
          ...data,
          triggerReference: data.triggerReference ?? null,
          idempotencyKey: data.idempotencyKey ?? null,
          actorKind: "HUMAN",
          createdBy: caller.id,
        });
        return { ok: true, id: result.decision.id, created: result.created };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message.slice(0, 300) : "failed",
        };
      }
    },
  );

/** Build context, derive confidence and settle on a recommendation. */
export const analyseFounderDecision = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(
    async ({ data }): Promise<{ ok: boolean; state?: string; gap?: string; error?: string }> => {
      const caller = await requireRead();
      const { analyseDecision } = await import("./decisions.server");
      const result = await analyseDecision(data.id, { kind: "HUMAN", id: caller.id });
      return result.ok
        ? { ok: true, state: result.state, gap: result.gap }
        : { ok: false, error: result.error };
    },
  );

export const requestFounderApproval = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        decisionId: z.string().uuid(),
        reason: z.string().min(3).max(1000),
        evidence: z.record(z.unknown()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; notified?: number; error?: string }> => {
    const caller = await requireRead();
    const { requestApproval } = await import("./approvals.server");
    const result = await requestApproval({
      decisionId: data.decisionId,
      requestedBy: caller.id,
      requesterKind: "HUMAN",
      reason: data.reason,
      evidence: data.evidence ?? { raisedBy: "founder-ai" },
    });
    return result.ok ? { ok: true, notified: result.notified } : { ok: false, error: result.error };
  });

/**
 * Answer an approval request.
 *
 * The caller's roles are resolved here, on the server, and handed to the
 * policy; the browser has no say in who is allowed to approve.
 */
export const decideFounderApproval = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        approvalId: z.string().uuid(),
        verdict: z.enum(["APPROVED", "REJECTED", "CHANGES_REQUESTED"]),
        reason: z.string().min(3).max(1000),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string }> => {
    const caller = await requireCaller();
    const { decideApproval } = await import("./approvals.server");
    return decideApproval({
      approvalId: data.approvalId,
      approverId: caller.id,
      approverRoles: caller.roles,
      verdict: data.verdict,
      reason: data.reason,
    });
  });

export const markFounderApprovalViewed = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ approvalId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string }> => {
    const caller = await requireCaller();
    const { markViewed } = await import("./approvals.server");
    return markViewed(data.approvalId, caller.id);
  });

export const overrideFounderRecommendation = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        decisionId: z.string().uuid(),
        selectedOptionId: z.string().uuid(),
        reason: z.string().min(3).max(1000),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string }> => {
    const caller = await requireCaller();
    const { overrideRecommendation } = await import("./approvals.server");
    return overrideRecommendation({ ...data, actorId: caller.id });
  });

export const recordFounderOutcome = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        decisionId: z.string().uuid(),
        outcome: z.string().min(3).max(2000),
        succeeded: z.boolean(),
        variance: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string }> => {
    const caller = await requireCaller();
    const { recordOutcome } = await import("./approvals.server");
    return recordOutcome({
      decisionId: data.decisionId,
      actorId: caller.id,
      outcome: data.outcome,
      succeeded: data.succeeded,
      variance: data.variance ?? null,
    });
  });

/** Sweep requests that ran out of time. Safe to call repeatedly. */
export const expireFounderApprovals = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: boolean; expired: number }> => {
    await requireRead();
    const { expireOverdueApprovals } = await import("./approvals.server");
    const result = await expireOverdueApprovals();
    return { ok: true, expired: result.expired };
  },
);
