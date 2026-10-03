/**
 * Client data layer for the Developer Manager delivery-governor surfaces:
 * TanStack Query reads through authenticated server functions, live realtime
 * notifications, and audited mutations.
 */
import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "@/hooks/use-toast";
import { hostActor } from "@/components/dev-manager/HostConnectButton";
import { supabase } from "@/integrations/supabase/client";

import {
  addInternalNote,
  completeDeveloperOnboarding,
  escalateTask,
  getAuditTrail,
  getDeliveryOverview,
  getDeveloperRegistry,
  setDeveloperStatus,
  reassignTask,
  updateEscalation,
} from "@/lib/dev-manager.functions";
import type {
  AuditTrailDTO,
  DeliveryOverviewDTO,
  EscalationStatus,
  RegistryDeveloperDTO,
} from "@/lib/dev-manager.types";

export const DELIVERY_QUERY_KEY = ["dev-manager", "delivery-overview"] as const;

export function useDeliveryOverview() {
  const fetchOverview = useServerFn(getDeliveryOverview);
  const queryClient = useQueryClient();
  const seenEscalations = useRef<Set<string>>(new Set());

  const query = useQuery<DeliveryOverviewDTO>({
    queryKey: DELIVERY_QUERY_KEY,
    queryFn: () => fetchOverview(),
    retry: (count, error) =>
      !/Unauthorized|Forbidden/.test(error instanceof Error ? error.message : "") && count < 2,
    refetchInterval: 60_000,
    staleTime: 15_000,
  });


  // Realtime notifications: task + escalation + note changes push a refresh.
  useEffect(() => {
    const channel = supabase
      .channel(`dev-manager-delivery-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "developer_tasks" }, () => {
        void queryClient.invalidateQueries({ queryKey: DELIVERY_QUERY_KEY });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "developer_task_internal_notes" }, () => {
        void queryClient.invalidateQueries({ queryKey: DELIVERY_QUERY_KEY });
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "developer_task_escalations" },
        (payload) => {
          const row = payload.new as { id?: string; reason?: string };
          if (row.id && !seenEscalations.current.has(row.id)) {
            seenEscalations.current.add(row.id);
            toast({
              title: "New escalation",
              description: row.reason ?? "An escalation was raised",
              variant: "destructive",
            });
          }
          void queryClient.invalidateQueries({ queryKey: DELIVERY_QUERY_KEY });
        },
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "developer_task_escalations" }, () => {
        void queryClient.invalidateQueries({ queryKey: DELIVERY_QUERY_KEY });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("Forbidden")) return "You do not have permission for this action.";
  if (message.includes("Unauthorized")) return "The host project rejected this request.";
  return message;
}

function useAuditedMutation<TInput, TResult>(
  fn: (input: { data: TInput }) => Promise<TResult>,
  successTitle: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) =>
      fn({ data: { ...(input as object), actor: hostActor() } as TInput }),
    onSuccess: () => {
      toast({ title: successTitle, variant: "success" });
      void queryClient.invalidateQueries({ queryKey: DELIVERY_QUERY_KEY });
    },
    onError: (error) => {
      toast({ title: "Action failed", description: describeError(error), variant: "destructive" });
    },
  });
}

export function useReassignTask() {
  const fn = useServerFn(reassignTask);
  return useAuditedMutation<{ taskId: string; newDeveloperId: string; reason: string }, unknown>(
    fn as never,
    "Task reassigned",
  );
}

export function useEscalateTask() {
  const fn = useServerFn(escalateTask);
  return useAuditedMutation<{ taskId: string; reason: string }, unknown>(
    fn as never,
    "Escalation recorded",
  );
}

export function useUpdateEscalation() {
  const fn = useServerFn(updateEscalation);
  return useAuditedMutation<
    { escalationId: string; status: EscalationStatus; resolution: string | null },
    unknown
  >(fn as never, "Escalation updated");
}

export function useAddInternalNote() {
  const fn = useServerFn(addInternalNote);
  return useAuditedMutation<{ taskId: string; content: string }, unknown>(
    fn as never,
    "Internal note added",
  );
}

export const AUDIT_QUERY_KEY = ["dev-manager", "audit-trail"] as const;

export function useAuditTrail(params: {
  page: number;
  pageSize: number;
  search: string;
  module: string;
}) {
  const fetchAudit = useServerFn(getAuditTrail);

  return useQuery<AuditTrailDTO>({
    queryKey: [...AUDIT_QUERY_KEY, params],
    queryFn: () => fetchAudit({ data: params }),
    retry: (count, error) =>
      !/Unauthorized|Forbidden/.test(error instanceof Error ? error.message : "") && count < 2,
    staleTime: 10_000,
    placeholderData: (prev) => prev,
  });
}

/**
 * Every audit entry matching the screen's search and module filter, for the
 * CSV export: read page by page through the same operator-only server
 * function, so the file holds the whole filtered trail, not the visible page.
 */
export function useAuditTrailExport() {
  const fetchAudit = useServerFn(getAuditTrail);
  return async (params: { search: string; module: string }): Promise<AuditTrailDTO["entries"]> => {
    const pageSize = 200;
    const all: AuditTrailDTO["entries"] = [];
    for (let page = 1; ; page++) {
      const result = await fetchAudit({ data: { ...params, page, pageSize } });
      all.push(...result.entries);
      if (result.entries.length < pageSize || all.length >= result.total) return all;
    }
  };
}

export const REGISTRY_QUERY_KEY = ["dev-manager", "registry"] as const;

/** Live developer registry (real rows from the backend). */
export function useDeveloperRegistry() {
  const fetchRegistry = useServerFn(getDeveloperRegistry);
  return useQuery<RegistryDeveloperDTO[]>({
    queryKey: REGISTRY_QUERY_KEY,
    queryFn: () => fetchRegistry(),
    staleTime: 15_000,
  });
}

/** Audited suspend / reactivate / exit for a developer. */
export function useSetDeveloperStatus() {
  const mutate = useServerFn(setDeveloperStatus);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      developerId: string;
      status: "active" | "suspended" | "probation" | "exited";
      reason: string;
    }) => mutate({ data: { ...input, actor: hostActor() } }),
    onSuccess: (_r, vars) => {
      toast({ title: `Developer ${vars.status}`, description: "Change recorded in the audit trail." });
      void queryClient.invalidateQueries({ queryKey: REGISTRY_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: DELIVERY_QUERY_KEY });
    },
    onError: (error) =>
      toast({ title: "Status change failed", description: describeError(error), variant: "destructive" }),
  });
}

export interface CodeSubmissionRow {
  id: string;
  taskId: string;
  taskTitle: string;
  developer: string;
  type: string;
  commitMessage: string;
  notes: string;
  files: number;
  status: string;
  reviewNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export const SUBMISSIONS_QUERY_KEY = ["dev-manager", "code-submissions"] as const;

/**
 * Code submissions (developer_code_submissions), newest first. Operators read
 * them through the table's own dev_manager_is_operator() policy.
 */
export function useCodeSubmissions() {
  return useQuery<CodeSubmissionRow[]>({
    queryKey: SUBMISSIONS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("developer_code_submissions" as never)
        .select(
          "id, task_id, submission_type, commit_message, notes, file_urls, review_status, review_notes, reviewed_at, created_at, developer_tasks(title), developers(vala_id, full_name)",
        )
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw new Error(error.message);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        taskId: r.task_id,
        taskTitle: r.developer_tasks?.title ?? "—",
        developer: r.developers?.vala_id || r.developers?.full_name || "—",
        type: r.submission_type ?? "",
        commitMessage: r.commit_message ?? "",
        notes: r.notes ?? "",
        files: Array.isArray(r.file_urls) ? r.file_urls.length : 0,
        status: r.review_status ?? "submitted",
        reviewNotes: r.review_notes,
        reviewedAt: r.reviewed_at,
        createdAt: r.created_at,
      }));
    },
    staleTime: 15_000,
  });
}

/**
 * Approve a submission or send it back, through review_developer_submission:
 * the database checks the reviewer's role, moves the task on and records the
 * decision in the developer's activity log, in one transaction.
 */
export function useReviewSubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; decision: "approved" | "changes_requested"; notes: string }) => {
      const { error } = await supabase.rpc("review_developer_submission" as never, {
        _submission_id: input.id,
        _decision: input.decision,
        _notes: input.notes,
      } as never);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_r, vars) => {
      toast({ title: vars.decision === "approved" ? "Submission approved" : "Changes requested", variant: "success" });
      void queryClient.invalidateQueries({ queryKey: SUBMISSIONS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: DELIVERY_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: DEV_TASKS_QUERY_KEY });
    },
    onError: (error) =>
      toast({ title: "Review failed", description: describeError(error), variant: "destructive" }),
  });
}

export interface DevTaskRow {
  id: string;
  title: string;
  category: string;
  status: string;
  developerId: string | null;
  estimatedHours: number;
  amount: number;
  completedAt: string | null;
  deadline: string | null;
  techStack: string[];
  priority: string;
}

export const DEV_TASKS_QUERY_KEY = ["dev-manager", "all-tasks"] as const;

/** Every developer task, including completed ones the delivery view leaves out. */
export function useAllDeveloperTasks() {
  return useQuery<DevTaskRow[]>({
    queryKey: DEV_TASKS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("developer_tasks" as never)
        .select("id, title, category, status, developer_id, estimated_hours, task_amount, completed_at, deadline, tech_stack, priority")
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw new Error(error.message);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        title: r.title ?? "",
        category: r.category ?? "",
        status: r.status ?? "",
        developerId: r.developer_id,
        estimatedHours: Number(r.estimated_hours ?? 0),
        amount: Number(r.task_amount ?? 0),
        completedAt: r.completed_at,
        deadline: r.deadline,
        techStack: Array.isArray(r.tech_stack) ? r.tech_stack.map(String) : [],
        priority: r.priority ?? "medium",
      }));
    },
    staleTime: 15_000,
  });
}

export interface DevActivityRow {
  id: string;
  developerId: string;
  ip: string | null;
  device: string | null;
  developer: string;
  type: string;
  description: string;
  createdAt: string;
}

/** The latest entries of developer_activity_logs. */
export function useDeveloperActivity(limit = 10) {
  return useQuery<DevActivityRow[]>({
    queryKey: ["dev-manager", "activity", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("developer_activity_logs" as never)
        .select("id, developer_id, ip_address, device_info, activity_type, description, created_at, developers(vala_id, full_name)")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        developerId: r.developer_id,
        ip: r.ip_address == null ? null : String(r.ip_address),
        device: r.device_info == null ? null : typeof r.device_info === "string" ? r.device_info : JSON.stringify(r.device_info),
        developer: r.developers?.vala_id || r.developers?.full_name || "—",
        type: r.activity_type ?? "",
        description: r.description ?? "",
        createdAt: r.created_at,
      }));
    },
    staleTime: 15_000,
  });
}

/** Approve a developer's onboarding (audited on the server). */
export function useCompleteOnboarding() {
  const mutate = useServerFn(completeDeveloperOnboarding);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { developerId: string; note: string }) =>
      mutate({ data: { ...input, actor: hostActor() } }),
    onSuccess: () => {
      toast({ title: "Onboarding approved", description: "Recorded in the audit trail.", variant: "success" });
      void queryClient.invalidateQueries({ queryKey: REGISTRY_QUERY_KEY });
    },
    onError: (error) =>
      toast({ title: "Approval failed", description: describeError(error), variant: "destructive" }),
  });
}
