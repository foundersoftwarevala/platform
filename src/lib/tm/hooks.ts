import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import * as api from "./api";
import type { TMTaskWithPeople } from "./types";

export const tmKeys = {
  tasks: ["tm", "tasks"] as const,
  task: (id: string) => ["tm", "task", id] as const,
  members: ["tm", "members"] as const,
  settings: ["tm", "settings"] as const,
  automations: ["tm", "automations"] as const,
  notifications: ["tm", "notifications"] as const,
  activity: ["tm", "activity"] as const,
  dependencies: ["tm", "dependencies"] as const,
  approvals: ["tm", "approvals"] as const,
  reviews: ["tm", "reviews"] as const,
  escalations: ["tm", "escalations"] as const,
  timeLogs: ["tm", "time-logs"] as const,
  comments: ["tm", "comments"] as const,
};

/* --------------------------------- reads --------------------------------- */

export const useTasks = () => useQuery({ queryKey: tmKeys.tasks, queryFn: api.fetchTasks });
export const useTask = (id: string | null) =>
  useQuery({
    queryKey: tmKeys.task(id ?? "none"),
    queryFn: () => {
      if (!id) throw new Error("A task ID is required");
      return api.fetchTask(id);
    },
    enabled: Boolean(id),
  });
export const useMembers = () => useQuery({ queryKey: tmKeys.members, queryFn: api.fetchMembers });
export const useSettings = () => useQuery({ queryKey: tmKeys.settings, queryFn: api.fetchSettings });
export const useAutomations = () => useQuery({ queryKey: tmKeys.automations, queryFn: api.fetchAutomations });
export const useNotifications = () => useQuery({ queryKey: tmKeys.notifications, queryFn: api.fetchNotifications });
export const useActivity = () => useQuery({ queryKey: tmKeys.activity, queryFn: () => api.fetchActivity() });
export const useDependencies = () => useQuery({ queryKey: tmKeys.dependencies, queryFn: api.fetchDependencies });
export const useApprovals = () => useQuery({ queryKey: tmKeys.approvals, queryFn: api.fetchApprovals });
export const useReviews = () => useQuery({ queryKey: tmKeys.reviews, queryFn: api.fetchReviews });
export const useEscalations = () => useQuery({ queryKey: tmKeys.escalations, queryFn: api.fetchEscalations });
export const useTimeLogs = () => useQuery({ queryKey: tmKeys.timeLogs, queryFn: api.fetchTimeLogs });
export const useTaskChat = () => useQuery({ queryKey: tmKeys.comments, queryFn: api.fetchRecentComments });

/* ------------------------------- realtime -------------------------------- */

const REALTIME_TABLES: Array<{ table: string; keys: ReadonlyArray<readonly unknown[]> }> = [
  { table: "tm_tasks", keys: [tmKeys.tasks, tmKeys.activity, tmKeys.escalations] },
  { table: "tm_subtasks", keys: [tmKeys.tasks] },
  { table: "tm_comments", keys: [tmKeys.comments] },
  { table: "tm_approvals", keys: [tmKeys.approvals] },
  { table: "tm_reviews", keys: [tmKeys.reviews] },
  { table: "tm_time_logs", keys: [tmKeys.timeLogs] },
  { table: "tm_escalations", keys: [tmKeys.escalations] },
  { table: "tm_dependencies", keys: [tmKeys.dependencies] },
  { table: "tm_notifications", keys: [tmKeys.notifications] },
  { table: "tm_activity", keys: [tmKeys.activity] },
  { table: "tm_automations", keys: [tmKeys.automations] },
  { table: "tm_members", keys: [tmKeys.members] },
  { table: "tm_settings", keys: [tmKeys.settings] },
];

/** Subscribes once to every Task Manager table and invalidates the affected queries. */
export function useRealtimeTasks(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase.channel("tm-realtime");

    for (const { table, keys } of REALTIME_TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
        for (const key of keys) {
          queryClient.invalidateQueries({ queryKey: key });
        }
        const row = (payload.new ?? {}) as Record<string, unknown>;
        if (typeof row["id"] === "string") {
          queryClient.invalidateQueries({ queryKey: tmKeys.task(row["id"] as string) });
        }
        if (typeof row["task_id"] === "string") {
          queryClient.invalidateQueries({ queryKey: tmKeys.task(row["task_id"] as string) });
        }
      });
    }

    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

/** Ticks every second so running timers and SLA countdowns stay live. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/* ------------------------------- mutations ------------------------------- */

function useTMMutation<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  successMessage: string | ((result: TResult, args: TArgs) => string),
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result, args) => {
      queryClient.invalidateQueries({ queryKey: ["tm"] });
      toast.success(typeof successMessage === "function" ? successMessage(result, args) : successMessage);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export const useCreateTask = () => useTMMutation(api.createTask, (task) => `${task.code} created`);
export const useUpdateTask = () =>
  useTMMutation((args: { taskId: string; patch: Parameters<typeof api.updateTask>[1] }) => api.updateTask(args.taskId, args.patch), "Task updated");
export const useChangeStatus = () =>
  useTMMutation((args: { task: Parameters<typeof api.changeStatus>[0]; status: Parameters<typeof api.changeStatus>[1]; note?: string }) => api.changeStatus(args.task, args.status, args.note), "Status updated");
export const useAssignTask = () =>
  useTMMutation((args: { task: Parameters<typeof api.assignTask>[0]; memberId: string; memberName: string }) => api.assignTask(args.task, args.memberId, args.memberName), (_r, args) => `Assigned to ${args.memberName}`);
export const useSetPriority = () =>
  useTMMutation((args: { task: Parameters<typeof api.setPriority>[0]; priority: Parameters<typeof api.setPriority>[1] }) => api.setPriority(args.task, args.priority), "Priority updated");
export const useSetProgress = () =>
  useTMMutation((args: { task: Parameters<typeof api.setProgress>[0]; progress: number }) => api.setProgress(args.task, args.progress), "Progress updated");
export const useTimerAction = () =>
  useTMMutation((args: { task: Parameters<typeof api.timerAction>[0]; action: api.TimerAction; note?: string }) => api.timerAction(args.task, args.action, args.note), (_r, args) => `Timer ${args.action}`);
export const useAddComment = () =>
  useTMMutation((args: { taskId: string; message: string; author: Parameters<typeof api.addComment>[2] }) => api.addComment(args.taskId, args.message, args.author), "Message sent");
export const useToggleSubtask = () => useTMMutation(api.toggleSubtask, "Checklist updated");
export const useAddSubtask = () =>
  useTMMutation((args: { taskId: string; title: string; position: number }) => api.addSubtask(args.taskId, args.title, args.position), "Checklist item added");
export const useDecideApproval = () =>
  useTMMutation((args: { approval: Parameters<typeof api.decideApproval>[0]; status: Parameters<typeof api.decideApproval>[1]; remarks: string }) => api.decideApproval(args.approval, args.status, args.remarks), "Decision recorded");
export const useSubmitReview = () => useTMMutation(api.submitReview, "Review submitted");
export const useRaiseEscalation = () => useTMMutation(api.raiseEscalation, "Escalation raised");
export const useUpdateEscalation = () =>
  useTMMutation((args: { id: string; status: Parameters<typeof api.updateEscalation>[1]["status"]; resolution?: string }) => api.updateEscalation(args.id, { status: args.status, resolution: args.resolution ?? null }), "Escalation updated");
export const useAcknowledgeBuzzer = () => useTMMutation(api.acknowledgeBuzzer, "Buzzer acknowledged");
export const useSetBuzzer = () =>
  useTMMutation((args: { taskId: string; active: boolean }) => api.setBuzzer(args.taskId, args.active), "Buzzer updated");
export const useCreateDependency = () => useTMMutation(api.createDependency, "Dependency linked");
export const useUpdateDependency = () =>
  useTMMutation((args: { id: string; status: Parameters<typeof api.updateDependency>[1] }) => api.updateDependency(args.id, args.status), "Dependency updated");
export const useDeleteDependency = () => useTMMutation(api.deleteDependency, "Dependency removed");
export const useToggleAutomation = () => useTMMutation(api.toggleAutomation, "Rule updated");
export const useCreateAutomation = () => useTMMutation(api.createAutomation, "Rule created");
export const useMarkNotificationRead = () => useTMMutation(api.markNotificationRead, "Marked as read");
export const useMarkAllNotificationsRead = () => useTMMutation(() => api.markAllNotificationsRead(), "All notifications read");
export const useSaveSettings = () =>
  useTMMutation((args: { id: string; patch: Parameters<typeof api.saveSettings>[1] }) => api.saveSettings(args.id, args.patch), "Settings saved");

/* ------------------------------- selectors ------------------------------- */

export function useTaskLookup(tasks: TMTaskWithPeople[] | undefined) {
  return useMemo(() => {
    const map = new Map<string, TMTaskWithPeople>();
    for (const task of tasks ?? []) map.set(task.id, task);
    return map;
  }, [tasks]);
}

/**
 * Claim an unassigned task.
 *
 * A refusal is a real outcome, not an error: the second user in a race did
 * nothing wrong, they simply lost. The caller gets the typed result so it can
 * say "already claimed" and stop its own buzzer rather than showing a failure.
 */
export function useClaimTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => api.claimTask(taskId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["tm"] });
      if (result.ok) {
        toast.success("Task claimed", { description: "It is yours now." });
      } else if (result.reason === "already_claimed") {
        toast.info("Task already claimed", {
          description: "Someone else took it first. Your buzzer has stopped.",
        });
      } else if (result.reason === "not_a_member") {
        toast.error("You are not on the task roster", {
          description: "Ask an operator to add you before claiming work.",
        });
      } else {
        toast.info("This task is no longer claimable");
      }
    },
    onError: (error: unknown) => {
      toast.error("Could not claim the task", {
        description: error instanceof Error ? error.message : "The server refused the request.",
      });
    },
  });
}
