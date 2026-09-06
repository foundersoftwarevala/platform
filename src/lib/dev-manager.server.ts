/**
 * Server-only Developer Manager delivery logic: permission enforcement, audit
 * logging, SLA computation, auto-escalation and mutation handlers.
 * Never import this from client code — use dev-manager.functions.ts.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type {
  Availability,
  BlockedTaskDTO,
  DeliveryOverviewDTO,
  DeveloperCapacityDTO,
  DeveloperPerformanceDTO,
  EscalationDTO,
  EscalationStatus,
  InternalNoteDTO,
  RiskLevel,
  SLARiskDTO,
  TaskDTO,
  UiPriority,
  UiStatus,
  RegistryDeveloperDTO,
} from "./dev-manager.types";

export type Db = SupabaseClient<Database>;

type TaskRow = Database["public"]["Tables"]["developer_tasks"]["Row"];
type DeveloperRow = Database["public"]["Tables"]["developers"]["Row"];

const OPEN_STATUSES = [
  "pending",
  "assigned",
  "accepted",
  "working",
  "in_progress",
  "testing",
  "review",
  "blocked",
  "escalated",
];

export class ForbiddenError extends Error {}

/** Permission enforcement: only boss_owner / ceo / dev_manager may proceed. */
export async function assertDevManager(supabase: Db, userId: string): Promise<void> {
  const { data, error } = await supabase.rpc("is_dev_manager", { _user_id: userId });
  if (error) throw new Error(`Permission check failed: ${error.message}`);
  if (!data) throw new ForbiddenError("Forbidden: Developer Manager role required");
}

/** Durable audit trail. Failures are loud, never silent. */
export async function writeAudit(
  supabase: Db,
  userId: string | null,
  module: string,
  action: string,
  meta: Record<string, unknown>,
  actor?: string,
): Promise<void> {
  const { error } = await supabase.from("audit_logs").insert({
    module,
    action,
    user_id: userId,
    meta_json: { ...meta, actor: actor ?? "host_module" } as never,
  });
  if (error) throw new Error(`Audit log write failed: ${error.message}`);
}

export function taskCode(id: string): string {
  return `TSK-${id.replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}

function shortId(id: string): string {
  return `ESC-${id.replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}

function hoursUntil(iso: string | null, now: number): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  return (new Date(iso).getTime() - now) / 3_600_000;
}

function uiPriority(priority: string): UiPriority {
  if (priority === "critical" || priority === "urgent") return "critical";
  if (priority === "high") return "high";
  if (priority === "low") return "low";
  return "medium";
}

function uiStatus(status: string): UiStatus {
  if (status === "blocked" || status === "escalated") return "blocked";
  if (status === "review" || status === "testing") return "review";
  if (status === "working" || status === "in_progress") return "in_progress";
  return "pending";
}

function riskLevel(hours: number): RiskLevel | null {
  if (hours <= 2) return "critical";
  if (hours <= 4) return "high";
  if (hours <= 8) return "moderate";
  return null;
}

function label(dev: DeveloperRow | undefined): string {
  return dev?.vala_id ?? "UNASSIGNED";
}

/**
 * Automatic SLA / blocked-task escalation. Idempotent: one open escalation per
 * task. Runs server-side on every overview read so alerts never depend on a
 * browser being open.
 */
async function autoEscalate(
  supabase: Db,
  userId: string | null,
  tasks: TaskRow[],
  openEscalationTaskIds: Set<string>,
  now: number,
): Promise<number> {
  const pending: { task_id: string; reason: string; auto_escalated: boolean; escalated_to: string }[] =
    [];

  for (const task of tasks) {
    if (task.status === "completed" || task.status === "cancelled") continue;
    if (openEscalationTaskIds.has(task.id)) continue;

    const threshold = task.escalate_threshold_hours ?? 24;
    const blockedHours = task.blocked_since
      ? (now - new Date(task.blocked_since).getTime()) / 3_600_000
      : 0;
    const remaining = hoursUntil(task.deadline, now);

    if (task.status === "blocked" && blockedHours >= threshold) {
      pending.push({
        task_id: task.id,
        reason: `Auto: blocked ${Math.floor(blockedHours)}h (threshold ${threshold}h) — ${
          task.blocked_reason ?? "no reason recorded"
        }`,
        auto_escalated: true,
        escalated_to: "AREA-MANAGER",
      });
    } else if (remaining <= 0) {
      pending.push({
        task_id: task.id,
        reason: `Auto: SLA breached — deadline passed ${Math.abs(Math.floor(remaining))}h ago`,
        auto_escalated: true,
        escalated_to: "AREA-MANAGER",
      });
    }
  }

  if (pending.length === 0) return 0;

  const { data, error } = await supabase.from("developer_task_escalations").insert(pending).select("id, task_id");
  if (error) throw new Error(`Auto-escalation failed: ${error.message}`);

  for (const row of data ?? []) {
    openEscalationTaskIds.add(row.task_id ?? "");
    await writeAudit(supabase, userId, "dev_manager.escalations", "AUTO_ESCALATE", {
      escalation_id: row.id,
      task_id: row.task_id,
    });
  }
  return data?.length ?? 0;
}

function buildPerformance(tasks: TaskRow[], devById: Map<string, DeveloperRow>, now: number) {
  const out: DeveloperPerformanceDTO[] = [];
  const windowStart = now - 30 * 86_400_000;
  const halfway = now - 15 * 86_400_000;

  for (const dev of devById.values()) {
    const completed = tasks.filter(
      (t) =>
        t.developer_id === dev.id &&
        t.status === "completed" &&
        t.completed_at !== null &&
        new Date(t.completed_at).getTime() >= windowStart,
    );
    if (completed.length === 0) continue;

    const onTime = completed.filter(
      (t) => t.deadline && t.completed_at && new Date(t.completed_at) <= new Date(t.deadline),
    );
    const durations = completed
      .filter((t) => t.started_at && t.completed_at)
      .map(
        (t) =>
          (new Date(t.completed_at as string).getTime() - new Date(t.started_at as string).getTime()) /
          3_600_000,
      );
    const quality = completed
      .map((t) => Number(t.quality_score))
      .filter((n) => Number.isFinite(n) && n > 0);

    const recent = completed.filter((t) => new Date(t.completed_at as string).getTime() >= halfway);
    const older = completed.filter((t) => new Date(t.completed_at as string).getTime() < halfway);
    const rate = (list: TaskRow[]) =>
      list.length === 0
        ? null
        : (list.filter(
            (t) => t.deadline && t.completed_at && new Date(t.completed_at) <= new Date(t.deadline),
          ).length /
            list.length) *
          100;
    const recentRate = rate(recent);
    const olderRate = rate(older);
    let trend: DeveloperPerformanceDTO["trend"] = "stable";
    if (recentRate !== null && olderRate !== null) {
      if (recentRate - olderRate > 5) trend = "up";
      else if (olderRate - recentRate > 5) trend = "down";
    }

    out.push({
      valaId: label(dev),
      completedTasks: completed.length,
      onTimeRate: Math.round((onTime.length / completed.length) * 100),
      avgCompletionTime:
        durations.length === 0
          ? 0
          : Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10,
      qualityScore:
        quality.length === 0
          ? 0
          : Math.round(quality.reduce((a, b) => a + b, 0) / quality.length),
      trend,
    });
  }

  return out.sort((a, b) => b.completedTasks - a.completedTasks);
}

export async function loadDeliveryOverview(
  supabase: Db,
  userId: string | null,
): Promise<DeliveryOverviewDTO> {
  const now = Date.now();

  const [devRes, taskRes, escRes, noteRes] = await Promise.all([
    supabase.from("developers").select("*").order("vala_id", { ascending: true }),
    supabase.from("developer_tasks").select("*").order("created_at", { ascending: false }),
    supabase.from("developer_task_escalations").select("*").order("created_at", { ascending: false }),
    supabase
      .from("developer_task_internal_notes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const firstError = devRes.error ?? taskRes.error ?? escRes.error ?? noteRes.error;
  if (firstError) throw new Error(`Delivery data read failed: ${firstError.message}`);

  const developers = devRes.data ?? [];
  const tasks = taskRes.data ?? [];
  let escalations = escRes.data ?? [];
  const notes = noteRes.data ?? [];

  const devById = new Map(developers.map((d) => [d.id, d]));
  const openEscalationTaskIds = new Set(
    escalations
      .filter((e) => e.status === "pending" || e.status === "acknowledged")
      .map((e) => e.task_id ?? ""),
  );

  const autoEscalated = await autoEscalate(supabase, userId, tasks, openEscalationTaskIds, now);
  if (autoEscalated > 0) {
    const refreshed = await supabase
      .from("developer_task_escalations")
      .select("*")
      .order("created_at", { ascending: false });
    if (refreshed.error) throw new Error(`Escalation read failed: ${refreshed.error.message}`);
    escalations = refreshed.data ?? [];
  }

  const openTasks = tasks.filter((t) => OPEN_STATUSES.includes(t.status));

  const capacity: DeveloperCapacityDTO[] = developers.map((dev) => {
    const mine = openTasks.filter((t) => t.developer_id === dev.id);
    return {
      id: dev.id,
      valaId: label(dev),
      fullName: dev.full_name,
      availability: (dev.availability_status ?? "offline") as Availability,
      activeTasks: mine.length,
      maxCapacity: dev.max_capacity ?? 5,
      overdueCount: mine.filter((t) => hoursUntil(t.deadline, now) <= 0).length,
      skillTags: dev.skill_tags ?? [],
    };
  });

  const taskDtos: TaskDTO[] = openTasks.map((t) => {
    const remaining = hoursUntil(t.deadline, now);
    return {
      id: t.id,
      code: taskCode(t.id),
      title: t.title,
      developerId: t.developer_id,
      assignedTo: label(t.developer_id ? devById.get(t.developer_id) : undefined),
      priority: uiPriority(t.priority),
      status: uiStatus(t.status),
      dueDate: t.deadline,
      slaHoursRemaining: Number.isFinite(remaining) ? Math.round(remaining) : 999,
      promiseId: t.promise_id,
    };
  });

  const escalatedAtByTask = new Map<string, string>();
  for (const e of escalations) {
    if (e.task_id && !escalatedAtByTask.has(e.task_id)) escalatedAtByTask.set(e.task_id, e.created_at);
  }

  const risks: SLARiskDTO[] = openTasks
    .map((t) => {
      const remaining = hoursUntil(t.deadline, now);
      const level = riskLevel(remaining);
      if (!level) return null;
      return {
        taskId: t.id,
        code: taskCode(t.id),
        title: t.title,
        assignee: label(t.developer_id ? devById.get(t.developer_id) : undefined),
        promiseId: t.promise_id,
        hoursRemaining: Math.round(remaining),
        riskLevel: level,
        escalatedAt: escalatedAtByTask.get(t.id) ?? null,
      } satisfies SLARiskDTO;
    })
    .filter((r): r is SLARiskDTO => r !== null)
    .sort((a, b) => a.hoursRemaining - b.hoursRemaining);

  const blocked: BlockedTaskDTO[] = tasks
    .filter((t) => t.status === "blocked" && t.blocked_since)
    .map((t) => ({
      taskId: t.id,
      code: taskCode(t.id),
      title: t.title,
      assignee: label(t.developer_id ? devById.get(t.developer_id) : undefined),
      blockedReason: t.blocked_reason ?? "No reason recorded",
      blockedSince: t.blocked_since as string,
      blockedHours: Math.floor((now - new Date(t.blocked_since as string).getTime()) / 3_600_000),
      autoEscalateThreshold: t.escalate_threshold_hours ?? 24,
      escalated: openEscalationTaskIds.has(t.id),
    }))
    .sort((a, b) => b.blockedHours - a.blockedHours);

  const escalationDtos: EscalationDTO[] = escalations.map((e) => ({
    id: e.id,
    shortId: shortId(e.id),
    taskId: e.task_id ?? "",
    taskCode: e.task_id ? taskCode(e.task_id) : "—",
    reason: e.reason,
    escalatedTo: e.escalated_to ?? "AREA-MANAGER",
    escalatedAt: e.created_at,
    autoEscalated: e.auto_escalated ?? false,
    status: e.status as EscalationStatus,
    resolvedAt: e.resolved_at,
    resolution: e.resolution,
  }));

  const noteDtos: InternalNoteDTO[] = notes.map((n) => ({
    id: n.id,
    taskId: n.task_id ?? "",
    taskCode: n.task_id ? taskCode(n.task_id) : "—",
    author: n.author_label ?? "DEV-MGR",
    content: n.content,
    timestamp: n.created_at,
  }));

  return {
    generatedAt: new Date(now).toISOString(),
    developers: capacity,
    tasks: taskDtos,
    risks,
    blocked,
    escalations: escalationDtos,
    notes: noteDtos,
    performance: buildPerformance(tasks, devById, now),
    taskOptions: openTasks.map((t) => ({ id: t.id, code: taskCode(t.id), title: t.title })),
    stats: {
      developers: developers.length,
      activeTasks: openTasks.length,
      atRisk: risks.length,
      blocked: blocked.length,
      escalations: escalationDtos.filter(
        (e) => e.status === "pending" || e.status === "acknowledged",
      ).length,
    },
    autoEscalated,
  };
}

export async function reassignTaskInDb(
  supabase: Db,
  userId: string | null,
  taskId: string,
  newDeveloperId: string,
  reason: string,
  actor?: string,
) {
  const { data: task, error: taskError } = await supabase
    .from("developer_tasks")
    .select("id, developer_id, title")
    .eq("id", taskId)
    .maybeSingle();
  if (taskError) throw new Error(`Task read failed: ${taskError.message}`);
  if (!task) throw new Error("Task not found");

  const { error } = await supabase
    .from("developer_tasks")
    .update({
      developer_id: newDeveloperId,
      assigned_by: userId,
      accepted_at: null,
      status: "assigned",
    })
    .eq("id", taskId);
  if (error) throw new Error(`Reassignment failed: ${error.message}`);

  const { error: noteError } = await supabase.from("developer_task_internal_notes").insert({
    task_id: taskId,
    author_id: userId,
    author_label: "DEV-MGR",
    content: `Reassigned: ${reason}`,
  });
  if (noteError) throw new Error(`Reassignment note failed: ${noteError.message}`);

  await writeAudit(supabase, userId, "dev_manager.tasks", "REASSIGN_TASK", {
    task_id: taskId,
    from_developer_id: task.developer_id,
    to_developer_id: newDeveloperId,
    reason,
  }, actor);

  return { ok: true as const };
}

export async function escalateTaskInDb(
  supabase: Db,
  userId: string | null,
  taskId: string,
  reason: string,
  actor?: string,
) {
  const { data: existing, error: readError } = await supabase
    .from("developer_task_escalations")
    .select("id")
    .eq("task_id", taskId)
    .in("status", ["pending", "acknowledged"])
    .maybeSingle();
  if (readError) throw new Error(`Escalation read failed: ${readError.message}`);
  if (existing) return { ok: true as const, alreadyOpen: true };

  const { data, error } = await supabase
    .from("developer_task_escalations")
    .insert({
      task_id: taskId,
      reason,
      escalated_by: userId,
      escalated_to: "AREA-MANAGER",
      auto_escalated: false,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw new Error(`Escalation failed: ${error.message}`);

  const { error: statusError } = await supabase
    .from("developer_tasks")
    .update({ status: "escalated" })
    .eq("id", taskId)
    .in("status", ["blocked", "in_progress", "working", "pending", "assigned", "accepted"]);
  if (statusError) throw new Error(`Task status update failed: ${statusError.message}`);

  await writeAudit(supabase, userId, "dev_manager.escalations", "MANUAL_ESCALATE", {
    escalation_id: data.id,
    task_id: taskId,
    reason,
  }, actor);

  return { ok: true as const, alreadyOpen: false };
}

export async function updateEscalationInDb(
  supabase: Db,
  userId: string | null,
  escalationId: string,
  status: EscalationStatus,
  resolution: string | null,
  actor?: string,
) {
  const patch: Database["public"]["Tables"]["escalations"]["Update"] = { status };
  if (status === "resolved" || status === "rejected") {
    patch.resolved_at = new Date().toISOString();
    patch.resolution = resolution;
  }

  const { error } = await supabase.from("developer_task_escalations").update(patch).eq("id", escalationId);
  if (error) throw new Error(`Escalation update failed: ${error.message}`);

  await writeAudit(supabase, userId, "dev_manager.escalations", `ESCALATION_${status.toUpperCase()}`, {
    escalation_id: escalationId,
    resolution,
  }, actor);

  return { ok: true as const };
}

export async function addInternalNoteInDb(
  supabase: Db,
  userId: string | null,
  taskId: string,
  content: string,
  actor?: string,
) {
  const { data, error } = await supabase
    .from("developer_task_internal_notes")
    .insert({ task_id: taskId, author_id: userId, author_label: "DEV-MGR", content })
    .select("id")
    .single();
  if (error) throw new Error(`Note insert failed: ${error.message}`);

  await writeAudit(supabase, userId, "dev_manager.notes", "ADD_INTERNAL_NOTE", {
    note_id: data.id,
    task_id: taskId,
  }, actor);

  return { ok: true as const };
}

/** Enterprise audit trail: paginated, filterable, read-only. */
export async function loadAuditTrail(
  supabase: Db,
  page: number,
  pageSize: number,
  search: string,
  moduleFilter: string,
): Promise<import("./dev-manager.types").AuditTrailDTO> {
  const from = (page - 1) * pageSize;
  let query = supabase
    .from("audit_logs")
    .select("id, module, action, user_id, role, meta_json, timestamp", { count: "exact" })
    .order("timestamp", { ascending: false });

  if (moduleFilter && moduleFilter !== "all") query = query.eq("module", moduleFilter);
  if (search.trim()) query = query.ilike("action", `%${search.trim()}%`);

  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throw new Error(`Audit trail unavailable: ${error.message}`);

  const entries = (data ?? []).map((row) => {
    const meta = (row.meta_json ?? null) as Record<string, unknown> | null;
    const target =
      (meta?.["taskCode"] as string | undefined) ??
      (meta?.["taskId"] as string | undefined) ??
      (meta?.["escalationId"] as string | undefined) ??
      "—";
    return {
      id: row.id,
      shortId: `LOG-${row.id.slice(0, 8).toUpperCase()}`,
      module: row.module,
      action: row.action,
      actor: row.role ? `${row.role}` : (row.user_id ?? "system").slice(0, 8),
      target,
      timestamp: row.timestamp,
      meta: meta ? JSON.stringify(meta) : null,
    };
  });

  return { entries, total: count ?? entries.length, page, pageSize };
}


/** Live Developer Registry: real developers plus their open task load. */
export async function loadDeveloperRegistry(supabase: Db): Promise<RegistryDeveloperDTO[]> {
  const [{ data: devs, error: devErr }, { data: tasks, error: taskErr }] = await Promise.all([
    supabase
      .from("developers")
      .select(
        "id, vala_id, full_name, email, status, availability_status, skill_tags, max_capacity, onboarding_completed, joined_at",
      )
      .order("created_at", { ascending: true }),
    supabase.from("developer_tasks").select("developer_id, status").in("status", OPEN_STATUSES),
  ]);
  if (devErr) throw new Error(`Registry unavailable: ${devErr.message}`);
  if (taskErr) throw new Error(`Registry task load failed: ${taskErr.message}`);

  const load = new Map<string, number>();
  for (const t of tasks ?? []) {
    if (!t.developer_id) continue;
    load.set(t.developer_id, (load.get(t.developer_id) ?? 0) + 1);
  }

  return (devs ?? []).map((d) => ({
    id: d.id,
    valaId: d.vala_id ?? `DEV-${d.id.slice(0, 4).toUpperCase()}`,
    fullName: d.full_name,
    email: d.email,
    status: d.status,
    availability: (d.availability_status as Availability) ?? "available",
    skillTags: d.skill_tags ?? [],
    maxCapacity: d.max_capacity ?? 0,
    activeTasks: load.get(d.id) ?? 0,
    onboardingCompleted: d.onboarding_completed,
    joinedAt: d.joined_at,
  }));
}

/** Registry lifecycle: suspend / reactivate / exit — always audited. */
export async function setDeveloperStatusInDb(
  supabase: Db,
  developerId: string,
  status: "active" | "suspended" | "probation" | "exited",
  reason: string,
  actor?: string,
) {
  const { data: before, error: readErr } = await supabase
    .from("developers")
    .select("status, vala_id")
    .eq("id", developerId)
    .single();
  if (readErr) throw new Error(`Developer not found: ${readErr.message}`);

  const { error } = await supabase
    .from("developers")
    .update({ status, availability_status: status === "active" ? "available" : "unavailable" })
    .eq("id", developerId);
  if (error) throw new Error(`Status update failed: ${error.message}`);

  await writeAudit(
    supabase,
    null,
    "dev_manager.registry",
    `DEVELOPER_${status.toUpperCase()}`,
    { developer_id: developerId, vala_id: before.vala_id, from: before.status, to: status, reason },
    actor,
  );

  return { ok: true as const };
}
