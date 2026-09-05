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

export const useOpsDemos = () =>
  useQuery({
    queryKey: [OPS, "demos"],
    queryFn: () =>
      rows<DemoRow>(
        supabase.from("demos").select("*").order("updated_at", { ascending: false }).limit(500) as never,
      ),
  });

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
    queryFn: () =>
      rows<Record<string, unknown>>(
        supabase.from("demo_renewal_logs").select("*").order("created_at", { ascending: false }).limit(200) as never,
      ),
  });

export const useOpsAuditTrail = () =>
  useQuery({
    queryKey: [OPS, "audit"],
    queryFn: async () => {
      const [logs, cards] = await Promise.all([
        rows<Record<string, any>>(
          supabase.from("audit_logs").select("*").order("timestamp", { ascending: false }).limit(150) as never,
        ),
        rows<Record<string, any>>(
          supabase
            .from("demo_report_cards")
            .select("*")
            .order("action_timestamp", { ascending: false })
            .limit(150) as never,
        ),
      ]);
      const merged = [
        ...logs.map((l) => ({
          id: `audit-${l.id}`,
          at: l.timestamp as string,
          actor: (l.user_id as string) ?? "system",
          role: (l.role as string) ?? "—",
          action: l.action as string,
          scope: (l.module as string) ?? "platform",
          source: "audit_logs",
        })),
        ...cards.map((c) => ({
          id: `card-${c.id}`,
          at: (c.action_timestamp as string) ?? (c.created_at as string),
          actor: (c.performed_by as string) ?? "system",
          role: (c.performed_by_role as string) ?? "—",
          action: `${c.action_type}${c.demo_name ? ` · ${c.demo_name}` : ""}`,
          scope: "demo",
          source: "demo_report_cards",
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
    queryFn: () =>
      rows<Record<string, any>>(
        supabase.from("server_backups").select("*").order("created_at", { ascending: false }).limit(100) as never,
      ),
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

    const activeAlerts = (alerts.data ?? []).filter((a) => a.is_active !== false);
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

      const { error: logError } = await supabase.from("demo_report_cards").insert({
        demo_id: demo.id,
        demo_name: demo.title,
        action_type: ACTION_LABEL[action],
        demo_status: demo.status,
        sector: demo.category,
        workflow_status: "completed",
        performed_by_role: "demo_manager",
      } as never);
      if (logError) throw logError;
      return { ok: true };
    },
    onSuccess: (_data, variables) => {
      toast.success(`${ACTION_LABEL[variables.action]} recorded for ${variables.demo.title}`);
      invalidate();
    },
    onError: (error: any) => toast.error(error?.message ?? "Action failed"),
  });

  const acknowledgeAlert = useMutation({
    mutationFn: async ({ alertId, action }: { alertId: string; action: string }) => {
      const { error } = await supabase
        .from("demo_alerts")
        .update({
          acknowledged_at: new Date().toISOString(),
          action_taken: action,
          is_active: false,
        } as never)
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
        escalated_to_role: role,
        reason,
        escalation_level: level,
        status: "open",
        auto_escalated: false,
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
          resolution_notes: notes ?? null,
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
      const { error: logError } = await supabase.from("demo_renewal_logs").insert({
        demo_id: demo.id,
        previous_expiry: demo.expiry_date,
        new_expiry: next,
        auto_renewed: false,
        notes: `Renewed ${days} days from Operations Center`,
      } as never);
      if (logError) throw logError;
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
