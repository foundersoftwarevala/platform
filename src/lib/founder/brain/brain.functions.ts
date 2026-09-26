import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import type { KnowledgeDetail, KnowledgeItem } from "./knowledge.server";
import type {
  DecisionMemory,
  LearningEntry,
  LearningTotals,
  OverridePattern,
} from "./learning.server";
import type { ReportRecord, ReportTotals } from "./reports.server";

/**
 * The Company Brain's API.
 *
 * Every handler resolves the caller's roles on the server and passes them into
 * retrieval, so the permission filter is applied in the database query rather
 * than in a component. A reader who is not allowed an item does not receive it
 * and cannot tell it exists.
 *
 * The permissions reused here are the ones the migration added to
 * role_permissions — knowledge.read, knowledge.write, report.read,
 * report.generate, learning.read — alongside the decision.* set. No second
 * permission system was created.
 */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

interface Caller {
  id: string;
  roles: string[];
}

/** The signed-in caller and the roles they actually hold. */
async function resolveCaller(): Promise<Caller> {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Sign-in required");

  const url = process.env["SUPABASE_URL"]?.trim();
  const publishable =
    process.env["SUPABASE_PUBLISHABLE_KEY"]?.trim() ?? process.env["SUPABASE_ANON_KEY"]?.trim();
  const service = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();
  if (!url || !publishable || !service) throw new Error("Authentication is not configured");

  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: publishable, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Sign-in required");
  const user = (await response.json()) as { id?: string };
  if (!user?.id) throw new Error("Sign-in required");

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

/** The caller, once their roles are known to carry a named permission. */
async function requirePermission(permission: string): Promise<Caller> {
  const caller = await resolveCaller();
  if (caller.roles.length === 0) throw new Error("This account holds no role.");

  const db = await admin();
  const { data } = await db
    .from("role_permissions")
    .select("permission")
    .eq("permission", permission)
    // role is an app_role enum column, so its typed signature wants the union
    // rather than the strings the auth service hands back. The values are the
    // caller's own roles, read from user_roles a moment ago.
    .in("role", caller.roles as never[])
    .limit(1);

  if (!data || data.length === 0) {
    throw new Error(`No role held by this account carries ${permission}.`);
  }
  return caller;
}

export const searchFounderKnowledge = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z
      .object({
        search: z.string().max(300).optional(),
        kind: z.string().max(40).optional(),
        status: z.string().max(20).optional(),
        domain: z.string().max(60).optional(),
        staleOnly: z.boolean().optional(),
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      items: KnowledgeItem[];
      total: number;
      retrieval: string;
      degraded: string[];
    }> => {
      const caller = await requirePermission("knowledge.read");
      const { searchKnowledge } = await import("./knowledge.server");
      return searchKnowledge(caller.roles, {
        search: data.search,
        kind: data.kind as never,
        status: data.status,
        domain: data.domain,
        staleOnly: data.staleOnly,
        limit: data.limit,
        offset: data.offset,
      });
    },
  );

export const loadFounderKnowledgeItem = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<KnowledgeDetail | null> => {
    const caller = await requirePermission("knowledge.read");
    const { loadKnowledge } = await import("./knowledge.server");
    return loadKnowledge(caller.roles, data.id);
  });

export const ingestFounderKnowledge = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        kind: z.string().min(2).max(40),
        claim: z.enum([
          "CURRENT_FACT",
          "HISTORICAL_FACT",
          "HUMAN_DECISION",
          "AI_INFERENCE",
          "AI_RECOMMENDATION",
        ]),
        title: z.string().min(3).max(300),
        body: z.string().min(3).max(20000),
        summary: z.string().max(2000).optional(),
        domain: z.string().max(60).optional(),
        sourceSystem: z.string().min(2).max(120),
        sourceTable: z.string().max(120).optional(),
        sourceRecord: z.string().max(300).optional(),
        allowedRoles: z.array(z.string().max(40)).max(20).optional(),
        reviewDue: z.string().max(40).optional(),
      })
      .parse(input),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      ok: boolean;
      id?: string;
      duplicate?: boolean;
      error?: string;
      stage?: string;
    }> => {
      const caller = await requirePermission("knowledge.write");
      const { ingestKnowledge } = await import("./knowledge.server");
      const result = await ingestKnowledge({
        ...data,
        kind: data.kind as never,
        ownerId: caller.id,
        createdBy: caller.id,
      });
      return result.ok
        ? { ok: true, id: result.id, duplicate: result.duplicate }
        : { ok: false, error: result.reason, stage: result.stage };
    },
  );

export const archiveFounderKnowledge = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        reason: z.string().min(3).max(500),
        supersededBy: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string }> => {
    const caller = await requirePermission("knowledge.archive");
    const { archiveKnowledge } = await import("./knowledge.server");
    return archiveKnowledge(data.id, caller.id, data.reason, data.supersededBy ?? null);
  });

export const loadFounderLearning = createServerFn({ method: "GET" }).handler(
  async (): Promise<{
    entries: LearningEntry[];
    memories: DecisionMemory[];
    patterns: OverridePattern[];
    totals: LearningTotals | null;
    degraded: string[];
  }> => {
    await requirePermission("learning.read");
    const { loadLearningLog, loadDecisionMemory, findOverridePatterns, loadLearningTotals } =
      await import("./learning.server");
    const [log, memory, patterns, totals] = await Promise.all([
      loadLearningLog(100),
      loadDecisionMemory(50),
      findOverridePatterns(2),
      loadLearningTotals(),
    ]);
    return {
      entries: log.entries,
      memories: memory.memories,
      patterns: patterns.patterns,
      // Counted in SQL, so the headline figures stay right however many rows
      // the register holds. Null means the count failed, not that it is zero.
      totals: totals.totals,
      degraded: [
        ...new Set([...log.degraded, ...memory.degraded, ...patterns.degraded, ...totals.degraded]),
      ],
    };
  },
);

export const loadFounderReports = createServerFn({ method: "GET" }).handler(
  async (): Promise<{
    reports: ReportRecord[];
    totals: ReportTotals | null;
    degraded: string[];
  }> => {
    const caller = await requirePermission("report.read");
    const { listReports, loadReportTotals } = await import("./reports.server");
    const [list, totals] = await Promise.all([
      listReports(caller.roles, 50),
      loadReportTotals(caller.roles),
    ]);
    return {
      reports: list.reports,
      totals: totals.totals,
      degraded: [...new Set([...list.degraded, ...totals.degraded])],
    };
  },
);

export const generateFounderReport = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        reportType: z.enum([
          "EXECUTIVE_SUMMARY",
          "OPERATIONAL_HEALTH",
          "DECISION_REVIEW",
          "RISK_REVIEW",
          "KPI_REVIEW",
        ]),
        days: z.number().int().min(1).max(365).default(7),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; report?: ReportRecord; error?: string }> => {
    const caller = await requirePermission("report.generate");
    const { generateReport } = await import("./reports.server");
    const end = new Date();
    const start = new Date(end.getTime() - data.days * 86_400_000);
    return generateReport({
      reportType: data.reportType,
      periodStart: start,
      periodEnd: end,
      generatedBy: caller.id,
    });
  });
