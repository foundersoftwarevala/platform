import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { SignalOutcome } from "./signals.server";
import { requireVpsExecutive } from "@/lib/ai-ceo/vps-auth.server";
import { withVpsPublicDatabase } from "@/lib/marketplace-manager/vps-rpc.server";

/**
 * The way into the monitoring pipeline.
 *
 * A Monitoring Agent raises a signal here and Founder AI decides what it
 * earns — nothing, the dashboard, the attention queue, an alert, or an alert
 * with an escalation and a governed decision. The caller states what it saw;
 * it does not get to say what should happen about it.
 *
 * Authorization is checked on the server, against the same auth service and
 * the same role table the rest of Founder AI uses. There is no agent-only
 * back door: a signal arriving without a session is refused like anything
 * else.
 */

async function requireExecutive(): Promise<string> {
  return requireVpsExecutive();
}

export const ingestFounderSignal = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        agentKey: z.string().min(2).max(80),
        kind: z.string().min(2).max(80),
        domain: z.string().min(2).max(60),
        title: z.string().min(3).max(300),
        reason: z.string().min(3).max(2000),
        severity: z.enum(["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]),
        sourceSystem: z.string().min(2).max(120),
        sourceRef: z.string().min(2).max(200),
        entityType: z.string().max(80).optional(),
        entityId: z.string().max(120).optional(),
        occurredAt: z.string().max(40).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<SignalOutcome> => {
    await requireExecutive();
    const { routeSignal } = await import("./signals.server");
    return routeSignal({
      agentKey: data.agentKey,
      kind: data.kind,
      domain: data.domain,
      title: data.title,
      reason: data.reason,
      severity: data.severity,
      sourceSystem: data.sourceSystem,
      sourceRef: data.sourceRef,
      entityType: data.entityType ?? null,
      entityId: data.entityId ?? null,
      occurredAt: data.occurredAt,
      // Evidence is not accepted over this boundary yet: what an agent read
      // belongs with the agent run, and inventing a shape for it here would
      // be a second place to keep it.
      evidence: {},
    });
  });

/** The ladder, so a screen can show what each severity earns. */
export const loadFounderSignalRoutes = createServerFn({ method: "GET" }).handler(async () => {
  await requireExecutive();
  const { loadRoutes } = await import("./signals.server");
  return [...(await loadRoutes()).values()];
});

export interface OperationalHealth {
  agentsRegistered: number;
  agentsOpenToWork: number;
  agentsBlocked: number;
  agentsCannotFile: number;
  runsInFlight: number;
  runsBlocked: number;
  runsFailed: number;
  /** Completed runs finished in the last 24 hours that still need verification. */
  runsAwaitingVerification: number;
  runsVerificationFailed: number;
  tasksQueued: number;
  tasksRunning: number;
  tasksBlocked: number;
  tasksFailed: number;
  tasksOverdue: number;
  decisionsWaiting: number;
  decisionsEscalated: number;
  approvalsOpen: number;
  approvalsExpired: number;
  attentionOpen: number;
  attentionCritical: number;
  signalsEscalated: number;
  aiRequests: number;
  aiRequestsFailed: number;
}

/**
 * Read the SQL-counted Founder AI health row directly from VPS Postgres.
 * Missing data or a query error remains an explicit failure, never zeroes.
 */
export const loadFounderOperationalHealth = createServerFn({ method: "GET" }).handler(
  async (): Promise<OperationalHealth> => {
    await requireExecutive();
    const [row] = await withVpsPublicDatabase((tx) => tx<Record<string, number | string>[]>`
      select * from public.founder_operational_health limit 1
    `);
    if (!row) throw new Error("Founder AI operational health returned no VPS row.");

    const n = (field: string): number => {
      const value = row[field];
      const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
      if (!Number.isFinite(parsed)) throw new Error(`Founder AI health field ${field} is missing or invalid.`);
      return parsed;
    };

    return {
      agentsRegistered: n("agents_registered"),
      agentsOpenToWork: n("agents_open_to_work"),
      agentsBlocked: n("agents_blocked"),
      agentsCannotFile: n("agents_cannot_file"),
      runsInFlight: n("runs_in_flight"),
      runsBlocked: n("runs_blocked"),
      runsFailed: n("runs_failed"),
      runsAwaitingVerification: n("runs_awaiting_verification"),
      runsVerificationFailed: n("runs_verification_failed"),
      tasksQueued: n("tasks_queued"),
      tasksRunning: n("tasks_running"),
      tasksBlocked: n("tasks_blocked"),
      tasksFailed: n("tasks_failed"),
      tasksOverdue: n("tasks_overdue"),
      decisionsWaiting: n("decisions_waiting"),
      decisionsEscalated: n("decisions_escalated"),
      approvalsOpen: n("approvals_open"),
      approvalsExpired: n("approvals_expired"),
      attentionOpen: n("attention_open"),
      attentionCritical: n("attention_critical"),
      signalsEscalated: n("signals_escalated"),
      aiRequests: n("ai_requests"),
      aiRequestsFailed: n("ai_requests_failed"),
    };
  },
);
