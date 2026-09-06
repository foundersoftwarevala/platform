import { supabase } from "@/integrations/supabase/client";
import type {
  TMActivity,
  TMApproval,
  TMAutomation,
  TMComment,
  TMDependency,
  TMEscalation,
  TMMember,
  TMNotification,
  TMReview,
  TMSettings,
  TMSubtask,
  TMTask,
  TMTaskDetail,
  TMTaskInsert,
  TMTaskUpdate,
  TMTaskWithPeople,
  TMTimeLog,
} from "./types";

const TASK_SELECT = `*,
  assignee:tm_members!tm_tasks_assigned_to_fkey (id, full_name, role, email),
  creator:tm_members!tm_tasks_created_by_fkey (id, full_name, role, email)`;

function unwrap<T>(data: T | null, error: { message: string } | null, context: string): T {
  if (error) throw new Error(`${context}: ${error.message}`);
  if (data === null) throw new Error(`${context}: no data returned`);
  return data;
}

/* ------------------------------- reads ------------------------------- */

export async function fetchTasks(): Promise<TMTaskWithPeople[]> {
  const { data, error } = await supabase
    .from("tm_tasks")
    .select(TASK_SELECT)
    .order("created_at", { ascending: false });
  return unwrap(data as unknown as TMTaskWithPeople[] | null, error, "Load tasks");
}

export async function fetchTask(taskId: string): Promise<TMTaskDetail> {
  const [taskRes, subtasks, comments, attachments, approvals, reviews, timeLogs, escalations] =
    await Promise.all([
      supabase.from("tm_tasks").select(TASK_SELECT).eq("id", taskId).single(),
      supabase.from("tm_subtasks").select("*").eq("task_id", taskId).order("position"),
      supabase.from("tm_comments").select("*").eq("task_id", taskId).order("created_at"),
      supabase.from("tm_attachments").select("*").eq("task_id", taskId).order("created_at"),
      supabase.from("tm_approvals").select("*").eq("task_id", taskId).order("position"),
      supabase.from("tm_reviews").select("*").eq("task_id", taskId).order("created_at", { ascending: false }),
      supabase.from("tm_time_logs").select("*").eq("task_id", taskId).order("started_at", { ascending: false }),
      supabase.from("tm_escalations").select("*").eq("task_id", taskId).order("created_at", { ascending: false }),
    ]);

  const task = unwrap(taskRes.data as unknown as TMTaskWithPeople | null, taskRes.error, "Load task");
  return {
    ...task,
    subtasks: (subtasks.data ?? []) as TMSubtask[],
    comments: (comments.data ?? []) as TMComment[],
    attachments: (attachments.data ?? []) as TMTaskDetail["attachments"],
    approvals: (approvals.data ?? []) as TMApproval[],
    reviews: (reviews.data ?? []) as TMReview[],
    time_logs: (timeLogs.data ?? []) as TMTimeLog[],
    escalations: (escalations.data ?? []) as TMEscalation[],
  };
}

export async function fetchMembers(): Promise<TMMember[]> {
  const { data, error } = await supabase.from("tm_members").select("*").order("full_name");
  return unwrap(data, error, "Load members");
}

export async function fetchSettings(): Promise<TMSettings> {
  const { data, error } = await supabase.from("tm_settings").select("*").limit(1).single();
  return unwrap(data, error, "Load settings");
}

export async function fetchAutomations(): Promise<TMAutomation[]> {
  const { data, error } = await supabase
    .from("tm_automations")
    .select("*")
    .order("created_at");
  return unwrap(data, error, "Load automations");
}

export async function fetchNotifications(): Promise<TMNotification[]> {
  const { data, error } = await supabase
    .from("tm_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  return unwrap(data, error, "Load notifications");
}

export async function fetchActivity(limit = 200): Promise<TMActivity[]> {
  const { data, error } = await supabase
    .from("tm_activity")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return unwrap(data, error, "Load activity");
}

export type DependencyRow = TMDependency & {
  task: Pick<TMTask, "id" | "code" | "title" | "status"> | null;
  depends_on: Pick<TMTask, "id" | "code" | "title" | "status"> | null;
};

export async function fetchDependencies(): Promise<DependencyRow[]> {
  const { data, error } = await supabase
    .from("tm_dependencies")
    .select(
      `*,
       task:tm_tasks!tm_dependencies_task_id_fkey (id, code, title, status),
       depends_on:tm_tasks!tm_dependencies_depends_on_task_id_fkey (id, code, title, status)`,
    )
    .order("created_at");
  return unwrap(data as unknown as DependencyRow[] | null, error, "Load dependencies");
}

export type ApprovalRow = TMApproval & { task: Pick<TMTask, "id" | "code" | "title" | "priority" | "status" | "client_name"> | null };

export async function fetchApprovals(): Promise<ApprovalRow[]> {
  const { data, error } = await supabase
    .from("tm_approvals")
    .select(`*, task:tm_tasks (id, code, title, priority, status, client_name)`)
    .order("created_at", { ascending: false });
  return unwrap(data as unknown as ApprovalRow[] | null, error, "Load approvals");
}

export type ReviewRow = TMReview & { task: Pick<TMTask, "id" | "code" | "title" | "status" | "client_name"> | null };

export async function fetchReviews(): Promise<ReviewRow[]> {
  const { data, error } = await supabase
    .from("tm_reviews")
    .select(`*, task:tm_tasks (id, code, title, status, client_name)`)
    .order("created_at", { ascending: false });
  return unwrap(data as unknown as ReviewRow[] | null, error, "Load reviews");
}

export type EscalationRow = TMEscalation & { task: Pick<TMTask, "id" | "code" | "title" | "priority" | "status" | "client_name"> | null };

export async function fetchEscalations(): Promise<EscalationRow[]> {
  const { data, error } = await supabase
    .from("tm_escalations")
    .select(`*, task:tm_tasks (id, code, title, priority, status, client_name)`)
    .order("created_at", { ascending: false });
  return unwrap(data as unknown as EscalationRow[] | null, error, "Load escalations");
}

export type TimeLogRow = TMTimeLog & {
  task: Pick<TMTask, "id" | "code" | "title"> | null;
  member: Pick<TMMember, "id" | "full_name"> | null;
};

export async function fetchTimeLogs(): Promise<TimeLogRow[]> {
  const { data, error } = await supabase
    .from("tm_time_logs")
    .select(`*, task:tm_tasks (id, code, title), member:tm_members (id, full_name)`)
    .order("started_at", { ascending: false })
    .limit(200);
  return unwrap(data as unknown as TimeLogRow[] | null, error, "Load time logs");
}

export type CommentRow = TMComment & { task: Pick<TMTask, "id" | "code" | "title"> | null };

export async function fetchRecentComments(): Promise<CommentRow[]> {
  const { data, error } = await supabase
    .from("tm_comments")
    .select(`*, task:tm_tasks (id, code, title)`)
    .order("created_at", { ascending: false })
    .limit(200);
  return unwrap(data as unknown as CommentRow[] | null, error, "Load task chat");
}

/* ------------------------------ writes ------------------------------ */

export async function logActivity(entry: {
  task_id?: string | null;
  actor_name?: string;
  actor_role?: string;
  action: string;
  action_type?: string;
  from_value?: string | null;
  to_value?: string | null;
  details?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("tm_activity").insert({
    task_id: entry.task_id ?? null,
    actor_name: entry.actor_name ?? "Task Manager",
    actor_role: entry.actor_role ?? "task_manager",
    action: entry.action,
    action_type: entry.action_type ?? "update",
    from_value: entry.from_value ?? null,
    to_value: entry.to_value ?? null,
    details: entry.details ?? null,
  });
  if (error) throw new Error(`Write audit log: ${error.message}`);
}

export async function notify(entry: {
  task_id?: string | null;
  title: string;
  message: string;
  level?: TMNotification["level"];
}): Promise<void> {
  const { error } = await supabase.from("tm_notifications").insert({
    task_id: entry.task_id ?? null,
    title: entry.title,
    message: entry.message,
    level: entry.level ?? "info",
  });
  if (error) throw new Error(`Create notification: ${error.message}`);
}

async function nextTaskCode(): Promise<string> {
  const { data, error } = await supabase
    .from("tm_tasks")
    .select("code")
    .order("code", { ascending: false })
    .limit(1);
  if (error) throw new Error(`Generate task code: ${error.message}`);
  const last = data?.[0]?.code ?? "TSK-1000";
  const n = Number.parseInt(last.replace(/\D/g, ""), 10);
  return `TSK-${Number.isFinite(n) ? n + 1 : 1001}`;
}

export const TM_ATTACHMENT_BUCKET = "tm-attachments";

function attachmentKind(file: File): string {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.includes("pdf")) return "pdf";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.includes("zip") || file.type.includes("compressed")) return "archive";
  return "document";
}

/** Uploads real files to storage and records them against the task. */
export async function uploadTaskAttachments(taskId: string, files: File[], uploadedBy = "Task Manager") {
  for (const file of files) {
    const path = `${taskId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
    const { error: uploadError } = await supabase.storage.from(TM_ATTACHMENT_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadError) throw new Error(`Upload ${file.name}: ${uploadError.message}`);
    const { error: rowError } = await supabase.from("tm_attachments").insert({
      task_id: taskId,
      name: file.name,
      file_type: attachmentKind(file),
      url: path,
      size_kb: Math.max(1, Math.round(file.size / 1024)),
      uploaded_by: uploadedBy,
    });
    if (rowError) throw new Error(`Record ${file.name}: ${rowError.message}`);
  }
}

/** Signs a stored attachment path for temporary download access. */
export async function getAttachmentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(TM_ATTACHMENT_BUCKET).createSignedUrl(path, 300);
  if (error || !data) throw new Error(`Attachment link: ${error?.message ?? "unavailable"}`);
  return data.signedUrl;
}

export type TMApproverDraft = { approver_id: string | null; approver_name: string; stage: string };

export async function createTask(
  input: Omit<TMTaskInsert, "code"> & {
    subtasks?: string[] | undefined;
    approvers?: TMApproverDraft[] | undefined;
    files?: File[] | undefined;
  },
): Promise<TMTask> {
  const { subtasks, approvers, files, ...task } = input;
  const code = await nextTaskCode();
  const { data, error } = await supabase
    .from("tm_tasks")
    .insert({ ...task, code })
    .select("*")
    .single();
  const created = unwrap(data, error, "Create task");

  if (subtasks?.length) {
    const rows = subtasks
      .map((title, index) => ({ task_id: created.id, title: title.trim(), position: index + 1 }))
      .filter((row) => row.title.length > 0);
    if (rows.length) {
      const { error: subError } = await supabase.from("tm_subtasks").insert(rows);
      if (subError) throw new Error(`Create checklist: ${subError.message}`);
    }
  }

  if (created.approval_status === "pending") {
    const rows = (approvers?.length ? approvers : [{ approver_id: null, approver_name: "Task Manager", stage: "manager" }]).map(
      (approver, index) => ({
        task_id: created.id,
        stage: approver.stage,
        approver_id: approver.approver_id,
        approver_name: approver.approver_name,
        status: "pending",
        position: index + 1,
      }),
    );
    const { error: approvalError } = await supabase.from("tm_approvals").insert(rows);
    if (approvalError) throw new Error(`Create approval workflow: ${approvalError.message}`);
  }

  if (files?.length) await uploadTaskAttachments(created.id, files);

  await logActivity({
    task_id: created.id,
    action: "Task created",
    action_type: "create",
    to_value: created.status,
    details: `${created.code} — ${created.title}`,
  });
  await notify({
    task_id: created.id,
    title: "Task created",
    message: `${created.code} — ${created.title}`,
    level: created.priority === "critical" ? "critical" : "info",
  });
  return created;
}

export async function updateTask(taskId: string, patch: TMTaskUpdate): Promise<TMTask> {
  const { data, error } = await supabase
    .from("tm_tasks")
    .update(patch)
    .eq("id", taskId)
    .select("*")
    .single();
  return unwrap(data, error, "Update task");
}

export async function changeStatus(task: TMTask, status: TMTask["status"], note?: string): Promise<TMTask> {
  const patch: TMTaskUpdate = { status };
  const now = new Date().toISOString();

  if (status === "accepted" && !task.accepted_at) patch.accepted_at = now;
  if (status === "in_progress") {
    patch.started_at = task.started_at ?? now;
    patch.timer_running = true;
    patch.paused_at = null;
  }
  if (status === "on_hold" || status === "blocked" || status === "waiting_client") {
    patch.timer_running = false;
    patch.paused_at = now;
    if (status === "blocked" && note) patch.blocked_reason = note;
  }
  if (status === "completed") {
    patch.completed_at = now;
    patch.timer_running = false;
    patch.progress = 100;
  }
  if (status === "cancelled") {
    patch.timer_running = false;
  }

  const updated = await updateTask(task.id, patch);
  await logActivity({
    task_id: task.id,
    action: "Status changed",
    action_type: "status",
    from_value: task.status,
    to_value: status,
    details: note ?? null,
  });
  return updated;
}

export async function assignTask(task: TMTask, memberId: string, memberName: string): Promise<TMTask> {
  const updated = await updateTask(task.id, {
    assigned_to: memberId,
    status: task.status === "new" ? "assigned" : task.status,
  });
  await logActivity({
    task_id: task.id,
    action: "Assigned task",
    action_type: "assign",
    to_value: memberName,
  });
  await notify({
    task_id: task.id,
    title: "Task assigned",
    message: `${task.code} assigned to ${memberName}`,
  });
  return updated;
}

export async function setPriority(task: TMTask, priority: TMTask["priority"]): Promise<TMTask> {
  const updated = await updateTask(task.id, { priority });
  await logActivity({
    task_id: task.id,
    action: "Priority changed",
    action_type: "priority",
    from_value: task.priority,
    to_value: priority,
  });
  return updated;
}

export async function setProgress(task: TMTask, progress: number): Promise<TMTask> {
  const updated = await updateTask(task.id, { progress });
  await logActivity({
    task_id: task.id,
    action: "Progress updated",
    action_type: "progress",
    from_value: `${task.progress}%`,
    to_value: `${progress}%`,
  });
  return updated;
}

export type TimerAction = "start" | "pause" | "resume" | "stop";

export async function timerAction(task: TMTask, action: TimerAction, note?: string): Promise<TMTask> {
  const now = new Date();
  const nowIso = now.toISOString();
  const patch: TMTaskUpdate = {};
  let addedMinutes = 0;

  if ((action === "start" || action === "resume") && task.timer_running) {
    throw new Error("The timer is already running");
  }
  if ((action === "pause" || action === "stop") && !task.timer_running) {
    throw new Error("The timer is not running");
  }

  if (action === "start" || action === "resume") {
    patch.timer_running = true;
    patch.started_at = task.started_at ?? nowIso;
    patch.paused_at = nowIso;
    if (task.status === "new" || task.status === "assigned" || task.status === "accepted") {
      patch.status = "in_progress";
    }
  } else {
    const anchor = task.paused_at ?? task.started_at;
    if (task.timer_running && anchor) {
      addedMinutes = Math.max(0, Math.floor((now.getTime() - new Date(anchor).getTime()) / 60000));
    }
    patch.timer_running = false;
    patch.paused_at = action === "pause" ? nowIso : null;
    patch.actual_minutes = task.actual_minutes + addedMinutes;
    if (action === "pause") {
      patch.total_paused_minutes = task.total_paused_minutes;
    }
  }

  const updated = await updateTask(task.id, patch);

  const { error } = await supabase.from("tm_time_logs").insert({
    task_id: task.id,
    member_id: task.assigned_to,
    action,
    started_at: action === "start" || action === "resume" ? nowIso : (task.paused_at ?? task.started_at ?? nowIso),
    ended_at: action === "start" || action === "resume" ? null : nowIso,
    seconds: addedMinutes * 60,
    note: note ?? null,
  });
  if (error) throw new Error(`Write time log: ${error.message}`);

  await logActivity({
    task_id: task.id,
    action: `Timer ${action}`,
    action_type: "timer",
    to_value: action,
    details: addedMinutes ? `${addedMinutes} minutes logged` : null,
  });
  return updated;
}

export async function addComment(taskId: string, message: string, author: { name: string; role: string; id?: string | null }): Promise<TMComment> {
  const { data, error } = await supabase
    .from("tm_comments")
    .insert({
      task_id: taskId,
      author_id: author.id ?? null,
      author_name: author.name,
      author_role: author.role,
      message,
    })
    .select("*")
    .single();
  return unwrap(data, error, "Post message");
}

export async function toggleSubtask(subtask: TMSubtask): Promise<void> {
  const { error } = await supabase
    .from("tm_subtasks")
    .update({ completed: !subtask.completed })
    .eq("id", subtask.id);
  if (error) throw new Error(`Update checklist item: ${error.message}`);
}

export async function addSubtask(taskId: string, title: string, position: number): Promise<void> {
  const { error } = await supabase.from("tm_subtasks").insert({ task_id: taskId, title, position });
  if (error) throw new Error(`Add checklist item: ${error.message}`);
}

export async function decideApproval(
  approval: TMApproval,
  status: "approved" | "rejected" | "changes_requested",
  remarks: string,
): Promise<void> {
  const { error } = await supabase
    .from("tm_approvals")
    .update({ status, remarks: remarks || null, decided_at: new Date().toISOString() })
    .eq("id", approval.id);
  if (error) throw new Error(`Record decision: ${error.message}`);

  const { error: taskError } = await supabase
    .from("tm_tasks")
    .update({ approval_status: status === "approved" ? "approved" : status })
    .eq("id", approval.task_id);
  if (taskError) throw new Error(`Update task approval state: ${taskError.message}`);

  await logActivity({
    task_id: approval.task_id,
    action: "Approval decision",
    action_type: "approval",
    from_value: approval.status,
    to_value: status,
    details: remarks || null,
  });
}

export async function submitReview(input: {
  task_id: string;
  reviewer_id?: string | null;
  reviewer_name: string;
  quality_score: number;
  timeliness_score: number;
  verdict: "passed" | "failed" | "rework";
  remarks?: string;
}): Promise<void> {
  const { error } = await supabase.from("tm_reviews").insert({
    task_id: input.task_id,
    reviewer_id: input.reviewer_id ?? null,
    reviewer_name: input.reviewer_name,
    quality_score: input.quality_score,
    timeliness_score: input.timeliness_score,
    verdict: input.verdict,
    remarks: input.remarks ?? null,
  });
  if (error) throw new Error(`Submit review: ${error.message}`);

  const { error: taskError } = await supabase
    .from("tm_tasks")
    .update({ quality_score: input.quality_score })
    .eq("id", input.task_id);
  if (taskError) throw new Error(`Store quality score: ${taskError.message}`);

  await logActivity({
    task_id: input.task_id,
    action: "Review completed",
    action_type: "review",
    to_value: input.verdict,
    details: `Quality ${input.quality_score}, timeliness ${input.timeliness_score}`,
  });
}

export async function raiseEscalation(input: {
  task_id: string;
  level: number;
  reason: string;
  raised_by: string;
  raised_to: string;
}): Promise<void> {
  const { error } = await supabase.from("tm_escalations").insert(input);
  if (error) throw new Error(`Raise escalation: ${error.message}`);

  const { error: taskError } = await supabase
    .from("tm_tasks")
    .update({ escalation_level: input.level, buzzer_active: input.level >= 2 })
    .eq("id", input.task_id);
  if (taskError) throw new Error(`Update escalation level: ${taskError.message}`);

  await logActivity({
    task_id: input.task_id,
    action: "Escalated",
    action_type: "escalate",
    to_value: `L${input.level}`,
    details: input.reason,
  });
  await notify({
    task_id: input.task_id,
    title: `Escalated to level ${input.level}`,
    message: input.reason,
    level: "critical",
  });
}

export async function updateEscalation(
  id: string,
  patch: { status: TMEscalation["status"]; resolution?: string | null },
): Promise<void> {
  const { error } = await supabase
    .from("tm_escalations")
    .update({
      status: patch.status,
      resolution: patch.resolution ?? null,
      resolved_at: patch.status === "resolved" || patch.status === "closed" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) throw new Error(`Update escalation: ${error.message}`);
}

export async function acknowledgeBuzzer(taskId: string): Promise<void> {
  const { error } = await supabase
    .from("tm_tasks")
    .update({ buzzer_active: false, buzzer_acknowledged_at: new Date().toISOString() })
    .eq("id", taskId);
  if (error) throw new Error(`Acknowledge buzzer: ${error.message}`);
  await logActivity({ task_id: taskId, action: "Buzzer acknowledged", action_type: "buzzer" });
}

export async function setBuzzer(taskId: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("tm_tasks").update({ buzzer_active: active }).eq("id", taskId);
  if (error) throw new Error(`Update buzzer: ${error.message}`);
}

export async function createDependency(input: {
  task_id: string;
  depends_on_task_id: string;
  dependency_type: TMDependency["dependency_type"];
}): Promise<void> {
  const { error } = await supabase.from("tm_dependencies").insert(input);
  if (error) throw new Error(`Link dependency: ${error.message}`);
  await logActivity({ task_id: input.task_id, action: "Dependency added", action_type: "dependency" });
}

export async function updateDependency(id: string, status: TMDependency["status"]): Promise<void> {
  const { error } = await supabase.from("tm_dependencies").update({ status }).eq("id", id);
  if (error) throw new Error(`Update dependency: ${error.message}`);
}

export async function deleteDependency(id: string): Promise<void> {
  const { error } = await supabase.from("tm_dependencies").delete().eq("id", id);
  if (error) throw new Error(`Remove dependency: ${error.message}`);
}

export async function toggleAutomation(automation: TMAutomation): Promise<void> {
  const { error } = await supabase
    .from("tm_automations")
    .update({ enabled: !automation.enabled })
    .eq("id", automation.id);
  if (error) throw new Error(`Toggle rule: ${error.message}`);
}

export async function createAutomation(input: {
  name: string;
  description: string;
  trigger_type: TMAutomation["trigger_type"];
  action_type: TMAutomation["action_type"];
  enabled: boolean;
}): Promise<void> {
  const { error } = await supabase.from("tm_automations").insert(input);
  if (error) throw new Error(`Create rule: ${error.message}`);
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.from("tm_notifications").update({ read: true }).eq("id", id);
  if (error) throw new Error(`Update notification: ${error.message}`);
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase.from("tm_notifications").update({ read: true }).eq("read", false);
  if (error) throw new Error(`Update notifications: ${error.message}`);
}

export async function saveSettings(id: string, patch: Partial<TMSettings>): Promise<void> {
  const { error } = await supabase
    .from("tm_settings")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Save settings: ${error.message}`);
}

/** Why a claim was refused, so the UI can say something true. */
export type ClaimResult =
  | { ok: true; taskId: string; memberId: string }
  | { ok: false; reason: "already_claimed" | "not_claimable" | "not_a_member"; claimedBy?: string };

/**
 * Take ownership of an unassigned task.
 *
 * The decision happens inside `tm_claim_task`: one conditional UPDATE whose
 * WHERE clause includes `assigned_to IS NULL`. Postgres holds a row lock while
 * that is evaluated, so of two simultaneous callers exactly one can match and
 * the other is told the task is already claimed. Never decide this on the
 * client — a second user's buzzer stopping is not the same as them losing the
 * race.
 */
export async function claimTask(taskId: string): Promise<ClaimResult> {
  const { data, error } = await supabase.rpc("tm_claim_task", { p_task_id: taskId });
  if (error) throw new Error(`Claim task: ${error.message}`);

  const result = data as {
    ok: boolean;
    reason?: ClaimResult extends { ok: false } ? never : string;
    task_id?: string;
    member_id?: string;
    claimed_by?: string;
  } | null;

  if (result?.ok) {
    return { ok: true, taskId: result.task_id ?? taskId, memberId: result.member_id ?? "" };
  }
  return {
    ok: false,
    reason: (result?.reason as "already_claimed" | "not_claimable" | "not_a_member")
      ?? "not_claimable",
    ...(result?.claimed_by ? { claimedBy: result.claimed_by } : {}),
  };
}
