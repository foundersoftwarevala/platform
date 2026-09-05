/**
 * Sales & Support data layer — real Lovable Cloud (Postgres) reads/writes.
 * No mock data: every hook here talks to the live database.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type SalesSupportRow = {
  [column: string]: any;
  id: string;
  created_at: string;
  updated_at?: string | null;
};

export type TeamMember = SalesSupportRow & { full_name: string; department: string | null; status: string | null };
export type CrmCustomer = SalesSupportRow;
export type SalesLead = SalesSupportRow & { assigned_to: string | null; stage: string | null; company: string | null };
export type SalesDeal = SalesSupportRow;
export type CrmTask = SalesSupportRow;
export type SalesCommission = SalesSupportRow;
export type SupportTicket = SalesSupportRow & { assigned_to: string | null; status: string | null; reference: string; subject: string; resolved_at: string | null };
export type SupportEscalation = SalesSupportRow & { reference: string | null; reason: string | null };
export type CallLog = SalesSupportRow & { status: string | null; caller_name: string | null; started_at: string };
export type EmailQueueItem = SalesSupportRow;
export type ChatSession = SalesSupportRow & { started_at: string };
export type ChatMessage = SalesSupportRow & { session_id: string };
export type Chatbot = SalesSupportRow;
export type BotTrainingDocument = SalesSupportRow;
export type AutomationRule = SalesSupportRow;
export type BotConversationLog = SalesSupportRow;
export type BotLanguage = SalesSupportRow;
export type CannedResponse = SalesSupportRow;
export type WikiArticle = SalesSupportRow;
export type AuditLog = SalesSupportRow & {
  occurred_at: string;
  action: string;
  actor: string | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata: unknown;
};

type SalesSupportTable = string;

const STALE = 30_000;

/** Generic list reader for the Sales & Support tables. */
function useTable<T>(
  table: SalesSupportTable,
  options?: { orderBy?: string; ascending?: boolean; limit?: number; retry?: boolean },
) {
  const orderBy = options?.orderBy ?? "created_at";
  const ascending = options?.ascending ?? false;
  const limit = options?.limit ?? 500;

  return useQuery({
    queryKey: [table, orderBy, ascending, limit],
    staleTime: STALE,
    retry: options?.retry ?? 3,
    queryFn: async (): Promise<T[]> => {
      const { data, error } = await db
        .from(table)
        .select("*")
        .order(orderBy, { ascending })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}

export const useTeamMembers = (department?: string) => {
  const query = useTable<TeamMember>("team_members", { orderBy: "full_name", ascending: true });
  return {
    ...query,
    data: department ? (query.data ?? []).filter((m) => m.department === department) : query.data,
  };
};

export const useCustomers = () => useTable<CrmCustomer>("crm_customers");
export const useLeads = () => useTable<SalesLead>("sales_leads");
export const useDeals = () => useTable<SalesDeal>("sales_deals");
export const useTasks = () => useTable<CrmTask>("crm_tasks", { orderBy: "due_at", ascending: true });
export const useCommissions = () => useTable<SalesCommission>("sales_commissions");
export const useTickets = () => useTable<SupportTicket>("support_tickets");
export const useEscalations = () => useTable<SupportEscalation>("support_escalations");
export const useCallLogs = () => useTable<CallLog>("call_logs", { orderBy: "started_at" });
export const useEmailQueue = () => useTable<EmailQueueItem>("email_queue", { orderBy: "received_at" });
export const useChatSessions = () => useTable<ChatSession>("chat_sessions", { orderBy: "started_at" });
export const useChatbots = () => useTable<Chatbot>("chatbots", { orderBy: "name", ascending: true });
export const useBotTrainingDocuments = () => useTable<BotTrainingDocument>("bot_training_documents");
export const useAutomationRules = () => useTable<AutomationRule>("automation_rules", { orderBy: "name", ascending: true });
export const useBotConversationLogs = () => useTable<BotConversationLog>("bot_conversation_logs");
export const useBotLanguages = () => useTable<BotLanguage>("bot_languages", { orderBy: "name", ascending: true });
export const useCannedResponses = () => useTable<CannedResponse>("canned_responses", { orderBy: "title", ascending: true });
export const useWikiArticles = () => useTable<WikiArticle>("wiki_articles");
export const useAuditLogs = () => useTable<AuditLog>("audit_logs", { orderBy: "occurred_at", retry: false });

export const useChatMessages = (sessionId: string | null) =>
  useQuery({
    queryKey: ["chat_messages", sessionId],
    enabled: Boolean(sessionId),
    staleTime: 10_000,
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await db
        .from("chat_messages")
        .select("*")
        .eq("session_id", sessionId as string)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

// Generic table access needs a loosened client: the generated types cannot
// narrow column names when the table name is a type parameter.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Generic row updater — used by every action button so changes persist. */
export function useUpdateRow<T extends SalesSupportTable>(table: T) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Record<string, unknown> }) => {
      const { error } = await db.from(table).update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [table] }),
  });
}

/** Generic row inserter. */
export function useInsertRow<T extends SalesSupportTable>(table: T) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const { data, error } = await db.from(table).insert(values).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [table] }),
  });
}

/** Generic row deleter. */
export function useDeleteRow<T extends SalesSupportTable>(table: T) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [table] }),
  });
}

/** Relative time formatting shared by the ported screens. */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function memberName(members: TeamMember[] | undefined, id: string | null): string | null {
  if (!id) return null;
  return members?.find((m) => m.id === id)?.full_name ?? null;
}

export function currency(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return `$${Math.round(n).toLocaleString()}`;
}
