import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { CEOOpsState } from "./ops.types";
import type {
  AyraMorningDashboard,
  CEOState,
  CEOSuggestion,
  MorningBrief,
  MorningBriefCounts,
  MorningBriefTask,
} from "./types";
import { requireVpsExecutive } from "./vps-auth.server";
import {
  AYRA_ROLES,
  type AyraGrant,
  type AyraGrantAudit,
  type AyraGrantPermission,
  type AyraGrantRole,
  isAyraGrantPermission,
} from "./ayra-grants";
import { withVpsPublicDatabase } from "@/lib/marketplace-manager/vps-rpc.server";

/**
 * The AI CEO module's server API.
 *
 * This replaces the imported module's `AIRA_API_URL` client, which pointed at
 * an external Prisma service that was never stood up: every call returned
 * `configured: false` and the UI quietly fell back to in-memory seed data, so
 * nothing an operator did survived a reload. These handlers read and write the platform's VPS PostgreSQL database directly.
 *
 * Access is restricted by the VPS user_roles table to boss, admin, and super_admin.
 */

/**
 * Everything the dashboard needs, in one round trip.
 *
 * The module used to make a call for state and then generate the rest on the
 * client. Measurements belong on the server — they come from tables the browser
 * cannot read — and one request avoids six waterfalls on first paint.
 */
export const loadCeoState = createServerFn({ method: "GET" }).handler(
  async (): Promise<CEOState> => {
    await requireVpsExecutive();

    const [{ readSuggestions, readLastRefresh }, signals] = await Promise.all([
      import("./store.server"),
      import("./signals.server"),
    ]);

    const degraded: string[] = [];
    const [
      suggestions,
      lastRefresh,
      metrics,
      observations,
      activityEvents,
      companyHealth,
      decisions,
    ] = await Promise.all([
      readSuggestions(),
      readLastRefresh(),
      signals.computeMetrics(degraded),
      signals.computeObservations(degraded),
      signals.computeActivity(degraded),
      signals.computeDomainHealth(degraded),
      signals.loadDecisions(degraded),
    ]);

    return {
      persisted: true,
      suggestions,
      lastRefresh,
      metrics,
      metricSources: signals.METRIC_SOURCES,
      observations,
      activityEvents,
      companyHealth,
      decisions,
      degraded,
    };
  },
);

/** Recompute the live figures without re-reading the stored suggestion set. */
export const refreshSignals = createServerFn({ method: "POST" }).handler(async () => {
  await requireVpsExecutive();
  const signals = await import("./signals.server");
  const { writeLastRefresh } = await import("./store.server");

  const degraded: string[] = [];
  const [metrics, observations, activityEvents, companyHealth] = await Promise.all([
    signals.computeMetrics(degraded),
    signals.computeObservations(degraded),
    signals.computeActivity(degraded),
    signals.computeDomainHealth(degraded),
  ]);

  const at = new Date().toISOString();
  const persisted = await writeLastRefresh(at);

  return {
    persisted,
    lastRefresh: at,
    metrics,
    metricSources: signals.METRIC_SOURCES,
    observations,
    activityEvents,
    companyHealth,
    degraded,
  };
});

/**
 * Forward a suggestion to the Boss review queue.
 *
 * The suggestion is marked `reviewed` where it lives and a copy is appended to
 * the queue with its status reset to `pending`, so the Boss sees an open
 * decision rather than something already handled.
 */
export const sendSuggestionToBoss = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().min(1).max(120) }).parse(input))
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string }> => {
    await requireVpsExecutive();
    const store = await import("./store.server");

    const { ok, suggestion } = await store.setSuggestionStatus(data.id, "reviewed");
    if (!suggestion) return { ok: false, error: "No suggestion with that id" };
    if (!ok) return { ok: false, error: "Could not update the suggestion" };

    const queue = await store.readBossQueue();
    // Forwarding twice must not create a second decision for the Boss.
    if (!queue.some((s) => s.id === suggestion.id)) {
      queue.unshift({ ...suggestion, status: "pending" });
      const written = await store.writeBossQueue(queue);
      if (!written) return { ok: false, error: "Could not write to the Boss queue" };
    }
    return { ok: true };
  });

export const loadBossQueue = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ suggestions: CEOSuggestion[] }> => {
    await requireVpsExecutive();
    const { readBossQueue } = await import("./store.server");
    const rows = await readBossQueue();
    return {
      suggestions: rows
        .filter((s) => s.status === "pending")
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    };
  },
);

/** Approve or reject a queued suggestion. Recorded in both places. */
export const decideSuggestion = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().min(1).max(120),
        decision: z.enum(["approved", "rejected"]),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string }> => {
    await requireVpsExecutive();
    const store = await import("./store.server");

    const queue = await store.readBossQueue();
    const next = queue.map((s) => (s.id === data.id ? { ...s, status: data.decision } : s));
    const inQueue = queue.some((s) => s.id === data.id);

    const [queueWritten, { ok: statusWritten }] = await Promise.all([
      inQueue ? store.writeBossQueue(next) : Promise.resolve(true),
      store.setSuggestionStatus(data.id, data.decision),
    ]);

    if (!queueWritten || !statusWritten) {
      return { ok: false, error: "The decision could not be saved" };
    }
    return { ok: true };
  });

/**
 * Record a new suggestion.
 *
 * Nothing in the product generates these automatically yet — no model is wired
 * to the module — so this exists for the point at which one is, and for an
 * executive adding an item by hand. It is a real write either way.
 */
export const createSuggestion = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        type: z.enum(["growth", "risk", "cost", "efficiency", "product", "compliance"]),
        title: z.string().min(3).max(160),
        description: z.string().min(3).max(2000),
        confidence: z.number().int().min(0).max(100),
        impact: z.enum(["high", "medium", "low"]),
        impactArea: z.string().min(2).max(80),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; id?: string; error?: string }> => {
    await requireVpsExecutive();
    const store = await import("./store.server");

    const suggestion: CEOSuggestion = {
      ...data,
      id: `sug-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      status: "pending",
      createdAt: new Date().toISOString(),
      source: "AI-CEO",
    };

    const rows = await store.readSuggestions();
    const ok = await store.writeSuggestions([suggestion, ...rows]);
    return ok ? { ok, id: suggestion.id } : { ok, error: "Could not save the suggestion" };
  });

/**
 * Everything the operational screens need, in one round trip.
 *
 * Agents, tasks, automations, notifications, usage, security and insights are
 * each read from a table the platform already has. A list that comes back
 * empty is reported empty; the imported module filled these screens with
 * records written into the component, which is the one thing this must not do.
 */
export const loadCeoOps = createServerFn({ method: "GET" }).handler(
  async (): Promise<CEOOpsState> => {
    await requireVpsExecutive();
    const ops = await import("./ops.server");
    return ops.loadOpsState();
  },
);

export const loadAyraGrants = createServerFn({ method: "GET" }).handler(
  async (): Promise<AyraGrant[]> => {
    await requireVpsExecutive();
    const rows = await withVpsPublicDatabase(
      (tx) => tx<
        {
          role_name: AyraGrantRole;
          permission_key: AyraGrantPermission;
          is_enabled: boolean;
          updated_at: string;
        }[]
      >`
      select role_name, permission_key, is_enabled, updated_at::text
        from public.ayra_grants
       order by role_name, permission_key
    `,
    );
    return rows.map((row) => ({
      roleName: row.role_name,
      permissionKey: row.permission_key,
      isEnabled: row.is_enabled,
      updatedAt: row.updated_at,
    }));
  },
);

export const loadAyraGrantAudit = createServerFn({ method: "GET" }).handler(
  async (): Promise<AyraGrantAudit[]> => {
    await requireVpsExecutive();
    const rows = await withVpsPublicDatabase(
      (tx) => tx<
        {
          id: string;
          occurred_at: string;
          actor: string | null;
          action: string;
          entity_id: string | null;
          metadata: import("@/lib/json").Json | null;
        }[]
      >`
      select id::text, occurred_at::text, actor, action, entity_id, metadata
        from public.audit_logs
       where entity_type = 'ayra_grant'
       order by occurred_at desc
       limit 50
    `,
    );
    return rows.map((row) => ({
      id: row.id,
      occurredAt: row.occurred_at,
      actor: row.actor ?? "System",
      action: row.action,
      entityId: row.entity_id,
      metadata: row.metadata,
    }));
  },
);

export const setAyraGrant = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        roleName: z.enum(AYRA_ROLES),
        permissionKey: z.string().refine(isAyraGrantPermission),
        isEnabled: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<AyraGrant> => {
    const userId = await requireVpsExecutive();
    return withVpsPublicDatabase(async (tx) => {
      const [current] = await tx<{ is_enabled: boolean }[]>`
        select is_enabled from public.ayra_grants
         where role_name = ${data.roleName} and permission_key = ${data.permissionKey}
         for update
      `;
      if (!current) throw new Error("This AYRA grant is not configured in the VPS database.");

      const [updated] = await tx<
        {
          role_name: AyraGrantRole;
          permission_key: AyraGrantPermission;
          is_enabled: boolean;
          updated_at: string;
        }[]
      >`
        update public.ayra_grants
           set is_enabled = ${data.isEnabled}, updated_at = now()
         where role_name = ${data.roleName} and permission_key = ${data.permissionKey}
         returning role_name, permission_key, is_enabled, updated_at::text
      `;
      if (!updated) throw new Error("The AYRA grant update did not persist.");

      if (current.is_enabled !== updated.is_enabled) {
        const details = JSON.stringify({
          roleName: updated.role_name,
          permissionKey: updated.permission_key,
          wasEnabled: current.is_enabled,
          isEnabled: updated.is_enabled,
        });
        await tx`
          insert into public.audit_logs
            (id, occurred_at, actor, action, entity_type, entity_id, severity, actor_id, metadata)
          values
            (gen_random_uuid(), now(), 'AYRA Command Center',
             ${updated.is_enabled ? "ayra_grant_enabled" : "ayra_grant_disabled"},
             'ayra_grant', ${`${updated.role_name}:${updated.permission_key}`},
             'info', ${userId}::uuid, ${details}::jsonb)
        `;
      }

      return {
        roleName: updated.role_name,
        permissionKey: updated.permission_key,
        isEnabled: updated.is_enabled,
        updatedAt: updated.updated_at,
      };
    });
  });

const MORNING_BRIEF_SOURCES = [
  "ai_agent_runs",
  "audit_logs",
  "leads",
  "marketplace_orders",
  "support_tickets",
  "tm_tasks",
  "founder_decisions",
] as const;

function morningCounts(row: Record<keyof MorningBriefCounts, number | string>): MorningBriefCounts {
  const counts: MorningBriefCounts = {
    agentRuns: Number(row.agentRuns),
    failedAgentRuns: Number(row.failedAgentRuns),
    unverifiedAgentRuns: Number(row.unverifiedAgentRuns),
    auditEvents: Number(row.auditEvents),
    newLeads: Number(row.newLeads),
    newOrders: Number(row.newOrders),
    newTickets: Number(row.newTickets),
    openTickets: Number(row.openTickets),
    breachedTickets: Number(row.breachedTickets),
    overdueTasks: Number(row.overdueTasks),
    waitingDecisions: Number(row.waitingDecisions),
  };
  for (const [key, value] of Object.entries(counts)) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`Morning brief source count ${key} is invalid.`);
    }
  }
  return counts;
}

function morningSummary(counts: MorningBriefCounts, start: Date, end: Date): string {
  const lines = [
    `Overnight operations brief for ${start.toISOString()} through ${end.toISOString()} (UTC).`,
    `${counts.agentRuns} agent runs started; ${counts.failedAgentRuns} failed and ${counts.unverifiedAgentRuns} completed runs still await verification.`,
    `${counts.auditEvents} audit events, ${counts.newLeads} new leads, ${counts.newOrders} new orders and ${counts.newTickets} new support tickets were recorded.`,
    `Current support backlog: ${counts.openTickets} open tickets, including ${counts.breachedTickets} with breached SLA; ${counts.overdueTasks} tasks are overdue and ${counts.waitingDecisions} decisions await approval.`,
  ];
  if (Object.values(counts).every((count) => count === 0)) {
    lines.push(
      "No matching activity was recorded in the source tables for this window; this is a measured empty result, not a missing data source.",
    );
  }
  return lines.join("\n");
}

async function readMorningTasks(
  tx: import("postgres").TransactionSql,
): Promise<MorningBriefTask[]> {
  const rows = await tx<
    {
      id: string;
      title: string;
      module: string | null;
      status: string;
      priority: string;
      severity: string;
      deadline: string | null;
    }[]
  >`
    SELECT id::text, title, module, status, priority, severity, deadline::text
      FROM public.tm_tasks
     WHERE status NOT IN ('completed','approved','closed','cancelled')
     ORDER BY CASE priority
                WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3
              END,
              deadline ASC NULLS LAST, created_at DESC
     LIMIT 20
  `;
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    module: row.module,
    status: row.status,
    priority: row.priority,
    severity: row.severity,
    deadline: row.deadline,
  }));
}

async function persistMorningBrief(userId: string): Promise<AyraMorningDashboard> {
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - 12 * 60 * 60 * 1000);
  return withVpsPublicDatabase(async (tx) => {
    const [row] = await tx<
      {
        agent_runs: number | string;
        failed_agent_runs: number | string;
        unverified_agent_runs: number | string;
        audit_events: number | string;
        new_leads: number | string;
        new_orders: number | string;
        new_tickets: number | string;
        open_tickets: number | string;
        breached_tickets: number | string;
        overdue_tasks: number | string;
        waiting_decisions: number | string;
      }[]
    >`
      WITH bounds AS (SELECT ${windowStart}::timestamptz AS starts_at, ${windowEnd}::timestamptz AS ends_at)
      SELECT
        (SELECT count(*)::int FROM public.ai_agent_runs r, bounds b
          WHERE r.started_at >= b.starts_at AND r.started_at < b.ends_at) AS agent_runs,
        (SELECT count(*)::int FROM public.ai_agent_runs r, bounds b
          WHERE r.started_at >= b.starts_at AND r.started_at < b.ends_at AND r.state = 'FAILED') AS failed_agent_runs,
        (SELECT count(*)::int FROM public.ai_agent_runs r, bounds b
          WHERE r.finished_at >= b.starts_at AND r.finished_at < b.ends_at
            AND r.state = 'COMPLETED' AND r.verification = 'UNVERIFIED') AS unverified_agent_runs,
        (SELECT count(*)::int FROM public.audit_logs a, bounds b
          WHERE a.occurred_at >= b.starts_at AND a.occurred_at < b.ends_at) AS audit_events,
        (SELECT count(*)::int FROM public.leads l, bounds b
          WHERE l.created_at >= b.starts_at AND l.created_at < b.ends_at) AS new_leads,
        (SELECT count(*)::int FROM public.marketplace_orders o, bounds b
          WHERE o.created_at >= b.starts_at AND o.created_at < b.ends_at AND o.soft_delete_flag IS NOT TRUE) AS new_orders,
        (SELECT count(*)::int FROM public.support_tickets t, bounds b
          WHERE t.created_at >= b.starts_at AND t.created_at < b.ends_at) AS new_tickets,
        (SELECT count(*)::int FROM public.support_tickets
          WHERE status NOT IN ('resolved','closed')) AS open_tickets,
        (SELECT count(*)::int FROM public.support_tickets
          WHERE status NOT IN ('resolved','closed') AND sla_breached) AS breached_tickets,
        (SELECT count(*)::int FROM public.tm_tasks
          WHERE deadline < ${windowEnd}::timestamptz AND status NOT IN ('completed','approved','closed','cancelled')) AS overdue_tasks,
        (SELECT count(*)::int FROM public.founder_decisions WHERE state::text = 'WAITING_APPROVAL') AS waiting_decisions
    `;
    if (!row) throw new Error("VPS Postgres returned no overnight brief data.");

    const sourceCounts = morningCounts({
      agentRuns: row.agent_runs,
      failedAgentRuns: row.failed_agent_runs,
      unverifiedAgentRuns: row.unverified_agent_runs,
      auditEvents: row.audit_events,
      newLeads: row.new_leads,
      newOrders: row.new_orders,
      newTickets: row.new_tickets,
      openTickets: row.open_tickets,
      breachedTickets: row.breached_tickets,
      overdueTasks: row.overdue_tasks,
      waitingDecisions: row.waiting_decisions,
    });
    const summary = morningSummary(sourceCounts, windowStart, windowEnd);
    const [saved] = await tx<{ id: string; created_at: string }[]>`
      INSERT INTO public.ai_morning_briefs
        (window_start, window_end, generated_by, source_counts, sources, summary)
      VALUES
        (${windowStart}, ${windowEnd}, ${userId}::uuid, ${JSON.stringify(sourceCounts)}::jsonb,
         ${[...MORNING_BRIEF_SOURCES]}, ${summary})
      RETURNING id::text, created_at::text
    `;
    if (!saved) throw new Error("VPS Postgres did not persist the morning brief.");
    const brief: MorningBrief = {
      id: saved.id,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      generatedAt: saved.created_at,
      summary,
      sourceCounts,
      sources: [...MORNING_BRIEF_SOURCES],
    };
    return { brief, currentTasks: await readMorningTasks(tx) };
  });
}

export const loadAyraMorningBrief = createServerFn({ method: "GET" }).handler(
  async (): Promise<AyraMorningDashboard> => {
    await requireVpsExecutive();
    return withVpsPublicDatabase(async (tx) => {
      const [row] = await tx<
        {
          id: string;
          window_start: string;
          window_end: string;
          generated_at: string;
          summary: string;
          source_counts: Record<keyof MorningBriefCounts, number | string>;
          sources: string[];
        }[]
      >`
        SELECT id::text, window_start::text, window_end::text, created_at::text AS generated_at,
               summary, source_counts, sources
          FROM public.ai_morning_briefs
         ORDER BY created_at DESC, id DESC
         LIMIT 1
      `;
      const brief = row
        ? {
            id: row.id,
            windowStart: row.window_start,
            windowEnd: row.window_end,
            generatedAt: row.generated_at,
            summary: row.summary,
            sourceCounts: morningCounts(row.source_counts),
            sources: row.sources,
          }
        : null;
      return { brief, currentTasks: await readMorningTasks(tx) };
    });
  },
);

export const runAyraMorningBrief = createServerFn({ method: "POST" }).handler(
  async (): Promise<AyraMorningDashboard> => {
    const userId = await requireVpsExecutive();
    return persistMorningBrief(userId);
  },
);
