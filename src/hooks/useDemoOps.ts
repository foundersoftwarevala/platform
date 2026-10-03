/**
 * DEMO OPERATIONS — LIVE DATA
 * ===========================
 * Every query below reads a real table in the Software Vala backend. Nothing is
 * mocked: when a table is empty or blocked by RLS the calling panel renders a
 * DataStateNotice instead of placeholder numbers.
 */

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  detectFailures,
  healthStateOf,
  performanceScore,
  type AlertRow,
  type AnalyticsRow,
  type CredentialRow,
  type DemoRow,
  type DeploymentRow,
  type EscalationRow,
  type HealthState,
  type ValidationLogRow,
} from "@/lib/demo-ops";

const OPS = "demo-ops";

const rows = async <T,>(promise: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> => {
  const { data, error } = await promise;
  if (error) throw error;
  return data ?? [];
};

/**
 * Demo actions are recorded in demo_url_audit_log, the demo estate's own audit
 * table (demo_url_id is a product_demo_urls id, the same ids the overview
 * returns). Its policy lets a signed-in operator insert rows as themselves, so
 * actor_id must be the caller. Renewals and one-click actions used to go to
 * demo_renewal_logs and demo_report_cards, which were never created.
 */
const RENEW_ACTION = "demo_url.renew";
// Automated monitor pings and syncs are thousands of rows; the trail shows people's actions.
const AUTOMATED_ACTIONS = "(demo_url.monitor,demo_url.sync)";

const logDemoAction = async (demoUrlId: string | null, action: string, metadata: Record<string, unknown>) => {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Sign in to record this action");
  const { error } = await supabase.from("demo_url_audit_log").insert({
    demo_url_id: demoUrlId,
    action,
    actor_id: data.user.id,
    actor_email: data.user.email ?? null,
    metadata: metadata as never,
  });
  if (error) throw error;
};

const meta = (value: unknown): Record<string, any> =>
  value && typeof value === "object" ? (value as Record<string, any>) : {};

/**
 * The operations centre's overview, from the tables that hold the demos.
 *
 * Every panel here read `demos`, which has 0 rows, while seventeen demos run in
 * product_demo_urls with two thousand monitor checks behind them - so the whole
 * Demo Operations Center showed nothing and looked like a quiet estate.
 *
 * mm_demo_ops counts it in SQL and returns the rows, the buckets an operator
 * works through, the ones still waiting for a product, and the live demos whose
 * category does not match their product.
 */
export type OpsReviewRow = {
  id: string;
  title: string;
  url: string;
  state: string;
  reason: string | null;
  candidates: { id: string; name: string; slug: string }[] | null;
  batch_id: string | null;
  created_at: string;
};

export type OpsMismatch = {
  id: string;
  title: string;
  url: string;
  product_name: string | null;
  product_slug: string | null;
  detected_category: string | null;
  product_category: string | null;
  status: string;
};

export type OpsOverview = {
  demos: DemoRow[];
  buckets: Record<string, number>;
  review: OpsReviewRow[];
  category_mismatches: OpsMismatch[];
  window_days: number;
  generated_at: string;
};

const EMPTY_OVERVIEW: OpsOverview = {
  demos: [],
  buckets: {},
  review: [],
  category_mismatches: [],
  window_days: 30,
  generated_at: "",
};

export const useOpsOverview = () =>
  useQuery<OpsOverview>({
    queryKey: [OPS, "overview"],
    staleTime: 30_000,
    queryFn: async () => {
      /**
       * Read through the server, not the browser client.
       *
       * Calling mm_demo_ops from here went to the hosted project, where that
       * function does not exist, so the call failed and every panel fell to its
       * empty state - which on screen is indistinguishable from a quiet estate.
       */
      const { authHeaders } = await import("@/lib/auth/operator-fetch");
      const response = await fetch("/api/demo/ops?days=30", { headers: await authHeaders() });
      const body = (await response.json()) as Partial<OpsOverview> & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "The overview could not be read");
      return { ...EMPTY_OVERVIEW, ...body };
    },
  });

export const useOpsDemos = () => {
  const overview = useOpsOverview();
  return { ...overview, data: overview.data?.demos ?? [] };
};

export const useOpsValidationLogs = () =>
  useQuery({
    queryKey: [OPS, "validation-logs"],
    queryFn: () =>
      rows<ValidationLogRow>(
        supabase
          .from("demo_validation_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(300) as never,
      ),
  });

export const useOpsAlerts = () =>
  useQuery({
    queryKey: [OPS, "alerts"],
    queryFn: () =>
      rows<AlertRow>(
        supabase.from("demo_alerts").select("*").order("created_at", { ascending: false }).limit(200) as never,
      ),
  });

export const useOpsAnalytics = () =>
  useQuery({
    queryKey: [OPS, "analytics"],
    queryFn: () =>
      rows<AnalyticsRow>(
        supabase.from("demo_analytics").select("*").order("date", { ascending: false }).limit(400) as never,
      ),
  });

export const useOpsEscalations = () =>
  useQuery({
    queryKey: [OPS, "escalations"],
    queryFn: () =>
      rows<EscalationRow>(
        supabase.from("demo_escalations").select("*").order("created_at", { ascending: false }).limit(200) as never,
      ),
  });

export const useOpsCredentials = () =>
  useQuery({
    queryKey: [OPS, "credentials"],
    queryFn: () =>
      rows<CredentialRow>(supabase.from("demo_login_credentials").select("*").limit(500) as never),
  });

export const useOpsDeployments = () =>
  useQuery({
    queryKey: [OPS, "deployments"],
    queryFn: () =>
      rows<DeploymentRow>(
        supabase.from("demo_deployments").select("*").order("created_at", { ascending: false }).limit(300) as never,
      ),
  });

export const useOpsRenewals = () =>
  useQuery({
    queryKey: [OPS, "renewals"],
    queryFn: async () => {
      const logs = await rows<Record<string, any>>(
        supabase
          .from("demo_url_audit_log")
          .select("id, demo_url_id, metadata, created_at")
          .eq("action", RENEW_ACTION)
          .order("created_at", { ascending: false })
          .limit(200) as never,
      );
      return logs.map((l) => ({
        id: l.id as string,
        demo_id: l.demo_url_id as string | null,
        previous_expiry: (meta(l.metadata).previous_expiry as string | null) ?? null,
        new_expiry: (meta(l.metadata).new_expiry as string | null) ?? null,
        auto_renewed: meta(l.metadata).auto_renewed === true,
        notes: (meta(l.metadata).notes as string | null) ?? null,
        created_at: l.created_at as string,
      }));
    },
  });

export const useOpsAuditTrail = () =>
  useQuery({
    queryKey: [OPS, "audit"],
    queryFn: async () => {
      const [logs, cards] = await Promise.all([
        rows<Record<string, any>>(
          supabase
            .from("audit_logs")
            .select("id, occurred_at, actor, action, entity_type")
            .order("occurred_at", { ascending: false })
            .limit(150) as never,
        ),
        rows<Record<string, any>>(
          supabase
            .from("demo_url_audit_log")
            .select("id, demo_url_id, action, actor_id, actor_email, metadata, created_at")
            .not("action", "in", AUTOMATED_ACTIONS)
            .order("created_at", { ascending: false })
            .limit(150) as never,
        ),
      ]);
      const merged = [
        ...logs.map((l) => ({
          id: `audit-${l.id}`,
          at: l.occurred_at as string,
          actor: (l.actor as string) ?? "system",
          // audit_logs has no role column.
          role: "—",
          action: l.action as string,
          scope: (l.entity_type as string) ?? "platform",
          source: "audit_logs",
        })),
        ...cards.map((c) => ({
          id: `card-${c.id}`,
          at: c.created_at as string,
          actor: (c.actor_email as string) ?? (c.actor_id as string) ?? "system",
          role: (meta(c.metadata).performed_by_role as string) ?? "—",
          action: `${meta(c.metadata).action_type ?? c.action}${meta(c.metadata).demo_name ? ` · ${meta(c.metadata).demo_name}` : ""}`,
          scope: "demo",
          source: "demo_url_audit_log",
        })),
      ];
      return merged.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    },
  });

export const useOpsAccessibility = () =>
  useQuery({
    queryKey: [OPS, "accessibility"],
    queryFn: () =>
      rows<Record<string, any>>(
        supabase.from("accessibility_compliance").select("*").limit(300) as never,
      ),
  });

export const useOpsBackups = () =>
  useQuery({
    queryKey: [OPS, "backups"],
    queryFn: async () => {
      // Backup runs live in server_backup_jobs; server_backups was never created.
      const jobs = await rows<Record<string, any>>(
        supabase
          .from("server_backup_jobs")
          .select("id, job_name, backup_type, schedule, status, size_gb, created_at")
          .order("created_at", { ascending: false })
          .limit(100) as never,
      );
      return jobs.map((j) => ({
        ...j,
        backup_name: j.job_name,
        // A job with a schedule was started by its schedule, not by hand.
        is_auto_backup: Boolean(j.schedule),
      }));
    },
  });

/* ------------------------------------------------------------------ */
/* Derived KPI roll-up                                                 */
/* ------------------------------------------------------------------ */

export interface OpsKpis {
  total: number;
  live: number;
  offline: number;
  failed: number;
  pendingFixes: number;
  expiringSoon: number;
  insecureUrls: number;
  brandingIssues: number;
  performanceIssues: number;
  securityIssues: number;
  autoFixedToday: number;
  manualFixRequired: number;
  byHealth: Record<HealthState, number>;
}

export const useOpsKpis = () => {
  const demos = useOpsDemos();
  const alerts = useOpsAlerts();
  const escalations = useOpsEscalations();
  const credentials = useOpsCredentials();
  const logs = useOpsValidationLogs();

  const kpis = useMemo<OpsKpis>(() => {
    const list = demos.data ?? [];
    const byHealth: Record<HealthState, number> = {
      live: 0,
      slow: 0,
      error: 0,
      offline: 0,
      maintenance: 0,
    };
    let expiringSoon = 0;
    let insecureUrls = 0;
    let brandingIssues = 0;
    let performanceIssues = 0;

    for (const demo of list) {
      byHealth[healthStateOf(demo)] += 1;
      const days = demo.expiry_date
        ? Math.ceil((new Date(demo.expiry_date).getTime() - Date.now()) / 86_400_000)
        : null;
      if (days !== null && days >= 0 && days <= 7) expiringSoon += 1;
      if (!demo.url?.startsWith("https://")) insecureUrls += 1;
      if (!demo.title?.trim() || !demo.demo_banner_text?.trim() || !demo.masked_url?.trim()) brandingIssues += 1;
      const score = performanceScore(demo);
      if (score !== null && score < 70) performanceIssues += 1;
    }

    const activeAlerts = (alerts.data ?? []).filter((a) => a.is_resolved !== true);
    const openEscalations = (escalations.data ?? []).filter((e) => e.status !== "resolved");
    const weakCredentials = (credentials.data ?? []).filter((c) =>
      ["admin", "admin123", "password", "password123", "123456", "demo", "demo123"].includes(
        (c.password ?? "").trim().toLowerCase(),
      ),
    );

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const autoFixedToday = (logs.data ?? []).filter(
      (l) =>
        l.status === "healthy" &&
        new Date(l.validated_at ?? l.created_at ?? 0).getTime() >= startOfDay.getTime() &&
        (l.validated_by === null || l.validated_by === "system"),
    ).length;

    return {
      total: list.length,
      live: byHealth.live,
      offline: byHealth.offline,
      failed: byHealth.error,
      pendingFixes: openEscalations.length,
      expiringSoon,
      insecureUrls,
      brandingIssues,
      performanceIssues,
      securityIssues: insecureUrls + weakCredentials.length,
      autoFixedToday,
      manualFixRequired: activeAlerts.filter((a) => a.requires_action === true).length,
      byHealth,
    };
  }, [demos.data, alerts.data, escalations.data, credentials.data, logs.data]);

  return {
    kpis,
    isLoading:
      demos.isLoading || alerts.isLoading || escalations.isLoading || credentials.isLoading || logs.isLoading,
    error: demos.error ?? alerts.error ?? escalations.error,
    refetch: () => {
      void demos.refetch();
      void alerts.refetch();
      void escalations.refetch();
      void credentials.refetch();
      void logs.refetch();
    },
  };
};

export const useOpsDetections = () => {
  const demos = useOpsDemos();
  const logs = useOpsValidationLogs();
  const hits = useMemo(() => detectFailures(demos.data ?? [], logs.data ?? []), [demos.data, logs.data]);
  return {
    hits,
    isLoading: demos.isLoading || logs.isLoading,
    error: demos.error ?? logs.error,
    refetch: () => {
      void demos.refetch();
      void logs.refetch();
    },
  };
};

/* ------------------------------------------------------------------ */
/* Real write actions                                                  */
/* ------------------------------------------------------------------ */

export type OneClickAction =
  | "restart"
  | "rebuild"
  | "clear-cache"
  | "regenerate-branding"
  | "reconnect-database"
  | "sync-marketplace"
  | "recheck";

const ACTION_LABEL: Record<OneClickAction, string> = {
  restart: "Restart demo",
  rebuild: "Rebuild demo",
  "clear-cache": "Clear cache",
  "regenerate-branding": "Regenerate branding",
  "reconnect-database": "Reconnect database",
  "sync-marketplace": "Sync marketplace",
  recheck: "Re-run health check",
};

export const useOpsActions = () => {
  const queryClient = useQueryClient();
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: [OPS] });

  const runAction = useMutation({
    mutationFn: async ({ demo, action }: { demo: DemoRow; action: OneClickAction }) => {
      if (action === "recheck") {
        const { data, error } = await supabase.functions.invoke("health-check", {
          body: { demo_ids: [demo.id], batch_size: 1 },
        });
        if (error) throw error;
        return data;
      }

      const statusPatch: Partial<DemoRow> =
        action === "restart"
          ? { status: "active", last_health_check: new Date().toISOString() }
          : action === "rebuild"
            ? { status: "maintenance" }
            : {};

      if (Object.keys(statusPatch).length > 0) {
        const { error } = await supabase
          .from("demos")
          .update({ ...statusPatch, updated_at: new Date().toISOString() } as never)
          .eq("id", demo.id);
        if (error) throw error;
      }

      await logDemoAction(demo.id, `demo_url.ops.${action}`, {
        demo_name: demo.title,
        action_type: ACTION_LABEL[action],
        demo_status: demo.status,
        sector: demo.category,
        workflow_status: "completed",
        performed_by_role: "demo_manager",
      });
      return { ok: true };
    },
    onSuccess: (_data, variables) => {
      toast.success(`${ACTION_LABEL[variables.action]} recorded for ${variables.demo.title}`);
      invalidate();
    },
    onError: (error: any) => toast.error(error?.message ?? "Action failed"),
  });

  const acknowledgeAlert = useMutation({
    mutationFn: async ({ alertId }: { alertId: string; action: string }) => {
      const { error } = await supabase
        .from("demo_alerts")
        // demo_alerts records acknowledgement as resolution; it has no column for the action note.
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Alert acknowledged");
      invalidate();
    },
    onError: (error: any) => toast.error(error?.message ?? "Could not acknowledge alert"),
  });

  const assignIssue = useMutation({
    mutationFn: async ({
      demoId,
      role,
      reason,
      level,
    }: {
      demoId: string;
      role: string;
      reason: string;
      level: number;
    }) => {
      const { error } = await supabase.from("demo_escalations").insert({
        demo_id: demoId,
        role,
        reason,
        level,
        status: "open",
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ticket created and assigned");
      invalidate();
    },
    onError: (error: any) => toast.error(error?.message ?? "Could not create ticket"),
  });

  const updateIssueStatus = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const { error } = await supabase
        .from("demo_escalations")
        .update({
          status,
          resolution: notes ?? null,
          resolved_at: status === "resolved" ? new Date().toISOString() : null,
        } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ticket updated");
      invalidate();
    },
    onError: (error: any) => toast.error(error?.message ?? "Could not update ticket"),
  });

  const renewDemo = useMutation({
    mutationFn: async ({ demo, days }: { demo: DemoRow; days: number }) => {
      const base = demo.expiry_date ? new Date(demo.expiry_date) : new Date();
      const next = new Date(Math.max(base.getTime(), Date.now()) + days * 86_400_000).toISOString();
      const { error } = await supabase
        .from("demos")
        .update({ expiry_date: next, status: "active", lifecycle_status: "active" } as never)
        .eq("id", demo.id);
      if (error) throw error;
      await logDemoAction(demo.id, RENEW_ACTION, {
        previous_expiry: demo.expiry_date,
        new_expiry: next,
        auto_renewed: false,
        notes: `Renewed ${days} days from Operations Center`,
      });
      return next;
    },
    onSuccess: () => {
      toast.success("Demo renewed");
      invalidate();
    },
    onError: (error: any) => toast.error(error?.message ?? "Renewal failed"),
  });

  const setLifecycle = useMutation({
    mutationFn: async ({ demo, lifecycle }: { demo: DemoRow; lifecycle: "archived" | "active" | "retired" }) => {
      const { error } = await supabase
        .from("demos")
        .update({
          lifecycle_status: lifecycle,
          status: lifecycle === "active" ? "active" : "inactive",
        } as never)
        .eq("id", demo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lifecycle updated");
      invalidate();
    },
    onError: (error: any) => toast.error(error?.message ?? "Lifecycle update failed"),
  });

  return { runAction, acknowledgeAlert, assignIssue, updateIssueStatus, renewDemo, setLifecycle };
};
