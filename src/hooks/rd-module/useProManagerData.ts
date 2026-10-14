import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/rd-module/supabase/client";
import type {
  PMAlert,
  PMAssistSession,
  PMAuditLog,
  PMCommunicationLog,
  PMCompliance,
  PMConversation,
  PMDecision,
  PMEscalation,
  PMHealthMetric,
  PMIssue,
  PMLicense,
  PMManagerMetric,
  PMMessage,
  PMProduct,
  PMPromise,
  PMQualityAlert,
  PMRenewal,
  PMReport,
  PMSatisfaction,
  PMSetting,
  PMTicket,
  PMUpgrade,
  PMUsage,
  PMUser,
} from "@/lib/rd-module/pm-types";

type PMTable =
  | "pm_users"
  | "pm_products"
  | "pm_licenses"
  | "pm_tickets"
  | "pm_issues"
  | "pm_assist_sessions"
  | "pm_promises"
  | "pm_upgrades"
  | "pm_renewals"
  | "pm_usage"
  | "pm_ai_conversations"
  | "pm_communication_logs"
  | "pm_alerts"
  | "pm_satisfaction"
  | "pm_compliance"
  | "pm_audit_logs"
  | "pm_settings"
  | "pm_health_metrics"
  | "pm_escalations"
  | "pm_quality_alerts"
  | "pm_manager_metrics"
  | "pm_decisions"
  | "pm_reports";

/** Hard cap on non-paginated reads so a large table can never flood the client. */
export const PM_MAX_ROWS = 200;
/** Rows fetched per page by the paginated log hooks. */
export const PM_PAGE_SIZE = 50;

async function selectAll<T>(
  table: PMTable,
  order: string,
  ascending = false,
  limit: number = PM_MAX_ROWS,
): Promise<T[]> {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .order(order, { ascending })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

type Page<T> = { rows: T[]; page: number; total: number };

async function selectPage<T>(
  table: PMTable,
  order: string,
  ascending: boolean,
  page: number,
): Promise<Page<T>> {
  const from = page * PM_PAGE_SIZE;
  const { data, error, count } = await supabase
    .from(table)
    .select("*", { count: "exact" })
    .order(order, { ascending })
    .range(from, from + PM_PAGE_SIZE - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as T[], page, total: count ?? 0 };
}

function usePagedTable<T>(
  queryKey: readonly unknown[],
  table: PMTable,
  order: string,
  ascending = false,
) {
  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => selectPage<T>(table, order, ascending, pageParam),
    getNextPageParam: (last: Page<T>) =>
      (last.page + 1) * PM_PAGE_SIZE < last.total ? last.page + 1 : undefined,
  });

  const rows = (query.data?.pages ?? []).flatMap((entry) => entry.rows);
  const total = query.data?.pages?.[0]?.total ?? 0;

  return {
    rows,
    total,
    isLoading: query.isLoading,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: () => void query.fetchNextPage(),
  };
}

export const pmKeys = {
  users: ["pm", "users"] as const,
  products: ["pm", "products"] as const,
  licenses: ["pm", "licenses"] as const,
  tickets: ["pm", "tickets"] as const,
  issues: ["pm", "issues"] as const,
  assist: ["pm", "assist"] as const,
  promises: ["pm", "promises"] as const,
  upgrades: ["pm", "upgrades"] as const,
  renewals: ["pm", "renewals"] as const,
  usage: ["pm", "usage"] as const,
  conversations: ["pm", "conversations"] as const,
  messages: (id: string) => ["pm", "messages", id] as const,
  communications: ["pm", "communications"] as const,
  alerts: ["pm", "alerts"] as const,
  satisfaction: ["pm", "satisfaction"] as const,
  compliance: ["pm", "compliance"] as const,
  audit: ["pm", "audit"] as const,
  settings: ["pm", "settings"] as const,
  health: ["pm", "health"] as const,
  escalations: ["pm", "escalations"] as const,
  quality: ["pm", "quality"] as const,
  managers: ["pm", "managers"] as const,
  decisions: ["pm", "decisions"] as const,
  reports: ["pm", "reports"] as const,
};

export const usePMUsers = () =>
  useQuery({ queryKey: pmKeys.users, queryFn: () => selectAll<PMUser>("pm_users", "code", true) });

export const usePMProducts = () =>
  useQuery({
    queryKey: pmKeys.products,
    queryFn: () => selectAll<PMProduct>("pm_products", "user_code", true),
  });

export const usePMLicenses = () =>
  useQuery({
    queryKey: pmKeys.licenses,
    queryFn: () => selectAll<PMLicense>("pm_licenses", "user_code", true),
  });

export const usePMTickets = () =>
  useQuery({
    queryKey: pmKeys.tickets,
    queryFn: () => selectAll<PMTicket>("pm_tickets", "opened_at"),
  });

export const usePMIssues = () =>
  useQuery({
    queryKey: pmKeys.issues,
    queryFn: () => selectAll<PMIssue>("pm_issues", "created_at"),
  });

export const usePMAssistSessions = () =>
  useQuery({
    queryKey: pmKeys.assist,
    queryFn: () => selectAll<PMAssistSession>("pm_assist_sessions", "created_at"),
  });

export const usePMPromises = () =>
  useQuery({
    queryKey: pmKeys.promises,
    queryFn: () => selectAll<PMPromise>("pm_promises", "deadline", true),
  });

export const usePMUpgrades = () =>
  useQuery({
    queryKey: pmKeys.upgrades,
    queryFn: () => selectAll<PMUpgrade>("pm_upgrades", "created_at"),
  });

export const usePMRenewals = () =>
  useQuery({
    queryKey: pmKeys.renewals,
    queryFn: () => selectAll<PMRenewal>("pm_renewals", "expiry", true),
  });

export const usePMUsage = () =>
  useQuery({
    queryKey: pmKeys.usage,
    queryFn: () => selectAll<PMUsage>("pm_usage", "user_code", true),
  });

export const usePMConversations = () =>
  useQuery({
    queryKey: pmKeys.conversations,
    queryFn: () => selectAll<PMConversation>("pm_ai_conversations", "created_at"),
  });

export const usePMMessages = (conversationId: string | null) =>
  useQuery({
    queryKey: pmKeys.messages(conversationId ?? "none"),
    enabled: Boolean(conversationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pm_ai_messages")
        .select("*")
        .eq("conversation_id", conversationId as string)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as PMMessage[];
    },
  });

export const usePMCommunications = () =>
  useQuery({
    queryKey: pmKeys.communications,
    queryFn: () => selectAll<PMCommunicationLog>("pm_communication_logs", "created_at"),
  });

export const usePMAlerts = () =>
  useQuery({
    queryKey: pmKeys.alerts,
    queryFn: () => selectAll<PMAlert>("pm_alerts", "created_at"),
  });

export const usePMSatisfaction = () =>
  useQuery({
    queryKey: pmKeys.satisfaction,
    queryFn: () => selectAll<PMSatisfaction>("pm_satisfaction", "csat"),
  });

export const usePMCompliance = () =>
  useQuery({
    queryKey: pmKeys.compliance,
    queryFn: () => selectAll<PMCompliance>("pm_compliance", "user_code", true),
  });

export const usePMAuditLogs = () =>
  useQuery({
    queryKey: pmKeys.audit,
    queryFn: () => selectAll<PMAuditLog>("pm_audit_logs", "created_at"),
  });

/** Paginated audit trail for the dedicated Audit Logs screen. */
export const usePMAuditLogsPaged = () =>
  usePagedTable<PMAuditLog>([...pmKeys.audit, "paged"], "pm_audit_logs", "created_at");

/** Paginated communication trail for the Communication Log screen. */
export const usePMCommunicationsPaged = () =>
  usePagedTable<PMCommunicationLog>(
    [...pmKeys.communications, "paged"],
    "pm_communication_logs",
    "created_at",
  );

export const usePMSettings = () =>
  useQuery({
    queryKey: pmKeys.settings,
    queryFn: () => selectAll<PMSetting>("pm_settings", "section", true),
  });

export const usePMHealthMetrics = () =>
  useQuery({
    queryKey: pmKeys.health,
    queryFn: () => selectAll<PMHealthMetric>("pm_health_metrics", "code", true),
  });

export const usePMEscalations = () =>
  useQuery({
    queryKey: pmKeys.escalations,
    queryFn: () => selectAll<PMEscalation>("pm_escalations", "created_at"),
  });

export const usePMQualityAlerts = () =>
  useQuery({
    queryKey: pmKeys.quality,
    queryFn: () => selectAll<PMQualityAlert>("pm_quality_alerts", "detected_at"),
  });

export const usePMManagerMetrics = () =>
  useQuery({
    queryKey: pmKeys.managers,
    queryFn: () => selectAll<PMManagerMetric>("pm_manager_metrics", "manager_code", true),
  });

export const usePMDecisions = () =>
  useQuery({
    queryKey: pmKeys.decisions,
    queryFn: () => selectAll<PMDecision>("pm_decisions", "requested_at"),
  });

export const usePMReports = () =>
  useQuery({
    queryKey: pmKeys.reports,
    queryFn: () => selectAll<PMReport>("pm_reports", "generated_at"),
  });

export const useInvalidatePM = () => {
  const queryClient = useQueryClient();
  return (...keys: readonly unknown[][]) => {
    keys.forEach((queryKey) => void queryClient.invalidateQueries({ queryKey }));
  };
};
