import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

/**
 * The platform's task service.
 *
 * Every module that needs work tracked — Developer Manager, Server Manager,
 * Support, Sales, the Control Panel — calls these rather than growing a task
 * table of its own. That is the whole point of the Task Manager being a control
 * tower: one lifecycle, one Task ID, one audit trail, whoever raised the work.
 *
 * Everything runs against `tm_tasks` and its related tables, which is the
 * canonical record. `developer_tasks` is kept in step by database triggers, so
 * a task opened here through `openTask` with module "developer_manager" appears
 * in Developer Manager and the Developer Dashboard as the same task, not a copy.
 *
 * Two rules hold throughout.
 *
 * Claiming never happens here. It goes through the `tm_claim_task` function,
 * whose single conditional UPDATE is what stops two people owning one task; a
 * check-then-write in application code would reintroduce exactly the race the
 * database was made to prevent.
 *
 * Every handler resolves the caller before touching the admin client. The admin
 * client bypasses row-level security, so an unauthenticated path here would
 * undo every policy on the schema.
 */

const admin = async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
};

/** The signed-in account, or a refusal. Never optional. */
async function requireUser(): Promise<{ userId: string; isOperator: boolean }> {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Unauthorized: sign in required");

  const db = await admin();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new Error("Unauthorized: sign in required");

  const { data: roles } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);
  const operator = new Set(["admin", "boss", "founder", "super_admin", "boss_owner"]);
  return {
    userId: data.user.id,
    isOperator: (roles ?? []).some((r) => operator.has(String(r.role))),
  };
}

/** The caller's row on the task roster, if they have one. */
async function memberIdFor(userId: string): Promise<string | null> {
  const db = await admin();
  const { data } = await db.from("tm_members").select("id").eq("user_id", userId).maybeSingle();
  return data?.id ?? null;
}

/** Writes the audit row every mutation owes. */
async function record(
  taskId: string,
  action: string,
  actionType: string,
  from?: string | null,
  to?: string | null,
  details?: string,
) {
  const db = await admin();
  await db.from("tm_activity").insert({
    task_id: taskId,
    actor_name: "task_service",
    actor_role: "system",
    action,
    action_type: actionType,
    from_value: from ?? null,
    to_value: to ?? null,
    details: details ?? null,
  });
}

const STATUSES = [
  "new", "routed", "available_for_claim", "claimed", "assigned", "accepted",
  "in_progress", "on_hold", "blocked", "waiting_client", "ai_review", "testing",
  "submitted", "under_review", "approved", "rejected",
  "completed", "cancelled", "failed", "closed",
] as const;

/**
 * What may follow a given status.
 *
 * The database enforces this in a trigger, so asking it rather than keeping a
 * second copy here means the two can never drift apart. A local table looked
 * tidier right up to the moment somebody changed one of them.
 */
async function allowedFrom(status: string): Promise<string[]> {
  const db = await admin();
  const { data, error } = await db.rpc("tm_allowed_transitions", { p_from: status });
  if (error) return [];
  return (data as string[] | null) ?? [];
}

async function currentStatus(taskId: string): Promise<string | null> {
  const db = await admin();
  const { data } = await db.from("tm_tasks").select("status").eq("id", taskId).maybeSingle();
  return data?.status ?? null;
}

/** Moves a task, refusing transitions the lifecycle does not allow. */
async function transition(taskId: string, to: string, note?: string) {
  const from = await currentStatus(taskId);
  if (!from) return { ok: false as const, reason: "no_such_task" };
  if (from === to) return { ok: true as const, status: to, unchanged: true };

  const allowed = await allowedFrom(from);
  if (!allowed.includes(to)) {
    return { ok: false as const, reason: "invalid_transition", from, to, allowed };
  }

  const db = await admin();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: to, updated_at: now };
  if (to === "in_progress" ) patch.started_at = now;
  if (to === "completed") {
    patch.completed_at = now;
    patch.progress = 100;
  }

  const { error } = await db.from("tm_tasks").update(patch).eq("id", taskId);
  if (error) return { ok: false as const, reason: error.message };

  await record(taskId, `Status ${from} to ${to}`, "status", from, to, note);
  return { ok: true as const, status: to, from };
}

// ---------------------------------------------------------------------------
// The verbs other modules call
// ---------------------------------------------------------------------------

export const openTask = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      title: z.string().trim().min(3).max(300),
      description: z.string().trim().max(5000).default(""),
      module: z.string().trim().max(60).default("platform"),
      priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
      category: z.string().trim().max(60).default("development"),
      deadline: z.string().datetime().optional(),
      slaHours: z.number().min(0).max(2000).optional(),
      billable: z.boolean().default(false),
      amount: z.number().min(0).optional(),
      /** Leave unset to route the task to whoever claims it first. */
      assignToMemberId: z.string().uuid().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { isOperator } = await requireUser();
    if (!isOperator) return { ok: false as const, reason: "forbidden" };

    const db = await admin();
    const code = `${data.module.slice(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const { data: row, error } = await db
      .from("tm_tasks")
      .insert({
        code,
        title: data.title,
        description: data.description,
        module: data.module,
        category: data.category,
        priority: data.priority,
        status: data.assignToMemberId ? "assigned" : "new",
        assigned_to: data.assignToMemberId ?? null,
        deadline: data.deadline ?? null,
        sla_hours: data.slaHours ?? 24,
        billable: data.billable,
        cost: data.amount ?? 0,
        // An unassigned task is what the buzzer exists to announce.
        buzzer_active: !data.assignToMemberId,
      })
      .select()
      .single();

    if (error || !row) return { ok: false as const, reason: error?.message ?? "insert failed" };
    await record(row.id, "Task opened", "create", null, row.status,
                 `Raised by ${data.module}`);
    return { ok: true as const, taskId: row.id, code: row.code, status: row.status };
  });

export const assignTask = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      taskId: z.string().uuid(),
      memberId: z.string().uuid(),
      reason: z.string().trim().max(500).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { isOperator } = await requireUser();
    if (!isOperator) return { ok: false as const, reason: "forbidden" };

    const db = await admin();
    const { data: before } = await db
      .from("tm_tasks").select("assigned_to,status").eq("id", data.taskId).maybeSingle();
    if (!before) return { ok: false as const, reason: "no_such_task" };

    const { error } = await db
      .from("tm_tasks")
      .update({
        assigned_to: data.memberId,
        status: before.status === "new" ? "assigned" : before.status,
        buzzer_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.taskId);
    if (error) return { ok: false as const, reason: error.message };

    await record(data.taskId, before.assigned_to ? "Task reassigned" : "Task assigned",
                 "assignment", before.assigned_to, data.memberId, data.reason);
    return { ok: true as const };
  });

/**
 * Claiming is the one verb this service does not implement itself.
 *
 * It defers to `tm_claim_task`, where a single conditional UPDATE decides the
 * race under a row lock. Doing it here — read the task, check it is free, then
 * write — is exactly the pattern that lets two people both win.
 */
export const claimTask = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ taskId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireUser();
    const db = await admin();
    const { data: result, error } = await db.rpc("tm_claim_task", { p_task_id: data.taskId });
    if (error) return { ok: false as const, reason: error.message };
    return (result ?? { ok: false, reason: "not_claimable" }) as
      { ok: boolean; reason?: string; claimed_by?: string };
  });

const taskOnly = (input: unknown) =>
  z.object({ taskId: z.string().uuid(), note: z.string().trim().max(500).optional() }).parse(input);

export const acceptTask = createServerFn({ method: "POST" })
  .inputValidator(taskOnly)
  .handler(async ({ data }) => {
    await requireUser();
    return transition(data.taskId, "accepted", data.note);
  });

export const startTask = createServerFn({ method: "POST" })
  .inputValidator(taskOnly)
  .handler(async ({ data }) => {
    await requireUser();
    return transition(data.taskId, "in_progress", data.note);
  });

export const pauseTask = createServerFn({ method: "POST" })
  .inputValidator(taskOnly)
  .handler(async ({ data }) => {
    await requireUser();
    return transition(data.taskId, "on_hold", data.note);
  });

export const resumeTask = createServerFn({ method: "POST" })
  .inputValidator(taskOnly)
  .handler(async ({ data }) => {
    await requireUser();
    return transition(data.taskId, "in_progress", data.note);
  });

export const blockTask = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      taskId: z.string().uuid(),
      reason: z.string().trim().min(3).max(500),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireUser();
    const db = await admin();
    await db.from("tm_tasks").update({ blocked_reason: data.reason }).eq("id", data.taskId);
    return transition(data.taskId, "blocked", data.reason);
  });

export const submitTask = createServerFn({ method: "POST" })
  .inputValidator(taskOnly)
  .handler(async ({ data }) => {
    await requireUser();
    const db = await admin();
    await db.from("tm_tasks")
      .update({ approval_status: "pending", progress: 100 })
      .eq("id", data.taskId);
    // Submission is its own state now. An AI pass is a separate step that may
    // or may not happen, and conflating the two hid which one a task was in.
    return transition(data.taskId, "submitted", data.note);
  });

export const reviewTask = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      taskId: z.string().uuid(),
      decision: z.enum(["approved", "rejected", "changes_requested"]),
      comment: z.string().trim().max(2000).optional(),
      qualityScore: z.number().int().min(0).max(100).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { isOperator } = await requireUser();
    if (!isOperator) return { ok: false as const, reason: "forbidden" };

    const db = await admin();
    const patch: Record<string, unknown> = { approval_status: data.decision };
    if (data.qualityScore !== undefined) patch.quality_score = data.qualityScore;
    const { error } = await db.from("tm_tasks").update(patch).eq("id", data.taskId);
    if (error) return { ok: false as const, reason: error.message };

    await record(data.taskId, `Review ${data.decision}`, "review", null, data.decision,
                 data.comment);

    // The lifecycle moves with the decision, not only the approval flag: a
    // reviewed task that still reads "submitted" tells the next person nothing.
    if (data.decision === "approved") {
      await transition(data.taskId, "approved", data.comment);
    } else if (data.decision === "rejected") {
      await transition(data.taskId, "rejected", data.comment);
    } else {
      // Changes requested sends the work back to the person doing it, rather
      // than leaving it in a review queue nobody owns.
      await transition(data.taskId, "in_progress", data.comment);
    }
    return { ok: true as const, decision: data.decision };
  });

export const completeTask = createServerFn({ method: "POST" })
  .inputValidator(taskOnly)
  .handler(async ({ data }) => {
    const { isOperator } = await requireUser();
    if (!isOperator) return { ok: false as const, reason: "forbidden" };
    return transition(data.taskId, "completed", data.note);
  });

export const cancelTask = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      taskId: z.string().uuid(),
      reason: z.string().trim().min(3).max(500),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { isOperator } = await requireUser();
    if (!isOperator) return { ok: false as const, reason: "forbidden" };
    return transition(data.taskId, "cancelled", data.reason);
  });

export const escalateTask = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      taskId: z.string().uuid(),
      level: z.number().int().min(1).max(4).default(1),
      reason: z.string().trim().min(3).max(1000),
      raisedTo: z.string().trim().max(120).default("task_manager"),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireUser();
    const db = await admin();
    const { error } = await db.from("tm_escalations").insert({
      task_id: data.taskId,
      level: data.level,
      reason: data.reason,
      raised_to: data.raisedTo,
      status: "open",
    });
    if (error) return { ok: false as const, reason: error.message };

    await db.from("tm_tasks")
      .update({ escalation_level: data.level, buzzer_active: data.level >= 2 })
      .eq("id", data.taskId);
    await record(data.taskId, `Escalated to level ${data.level}`, "escalation",
                 null, String(data.level), data.reason);
    return { ok: true as const, level: data.level };
  });

// --- reads ------------------------------------------------------------------

export const getTask = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ taskId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireUser();
    const db = await admin();
    const { data: row } = await db.from("tm_tasks").select("*").eq("id", data.taskId).maybeSingle();
    return { ok: Boolean(row), task: row ?? null };
  });

export const getTaskAudit = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ taskId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireUser();
    const db = await admin();
    const { data: rows } = await db
      .from("tm_activity").select("*")
      .eq("task_id", data.taskId)
      .order("created_at", { ascending: false });
    return { entries: rows ?? [] };
  });

export const getTaskSLA = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ taskId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireUser();
    const db = await admin();
    const { data: row } = await db.rpc("tm_sla_state", { p_task_id: data.taskId });
    return (row ?? { state: "unknown" }) as Record<string, unknown>;
  });

/** Tasks raised by one module, so a caller can show its own work. */
export const listModuleTasks = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({
      module: z.string().trim().max(60),
      limit: z.number().int().min(1).max(200).default(50),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireUser();
    const db = await admin();
    const { data: rows } = await db
      .from("tm_tasks").select("*")
      .eq("module", data.module)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    return { tasks: rows ?? [] };
  });

export const approveTask = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      taskId: z.string().uuid(),
      comment: z.string().trim().max(2000).optional(),
      qualityScore: z.number().int().min(0).max(100).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { isOperator } = await requireUser();
    if (!isOperator) return { ok: false as const, reason: "forbidden" };
    const db = await admin();
    const patch: Record<string, unknown> = { approval_status: "approved" };
    if (data.qualityScore !== undefined) patch.quality_score = data.qualityScore;
    await db.from("tm_tasks").update(patch).eq("id", data.taskId);
    await record(data.taskId, "Approved", "approval", null, "approved", data.comment);
    return transition(data.taskId, "approved", data.comment);
  });

export const rejectTask = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      taskId: z.string().uuid(),
      reason: z.string().trim().min(3).max(2000),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { isOperator } = await requireUser();
    if (!isOperator) return { ok: false as const, reason: "forbidden" };
    const db = await admin();
    await db.from("tm_tasks").update({ approval_status: "rejected" }).eq("id", data.taskId);
    await record(data.taskId, "Rejected", "approval", null, "rejected", data.reason);
    return transition(data.taskId, "rejected", data.reason);
  });

/** Routes work to a role before any individual is chosen. */
export const routeTask = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      taskId: z.string().uuid(),
      role: z.string().trim().min(2).max(60),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireUser();
    const db = await admin();
    const { data: result, error } = await db.rpc("tm_route_task", {
      p_task_id: data.taskId,
      p_role: data.role,
    });
    if (error) return { ok: false as const, reason: error.message };
    return result as Record<string, unknown>;
  });

/**
 * Hold: quiet the buzzer without taking the work on.
 *
 * Section 5 treats this as distinct from claiming - the person is saying "not
 * now", so the reason and the person are recorded and the task stays available.
 */
export const holdTask = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      taskId: z.string().uuid(),
      reason: z.string().trim().min(3).max(500),
      minutes: z.number().int().min(1).max(24 * 60).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { userId } = await requireUser();
    const memberId = await memberIdFor(userId);
    const db = await admin();
    const until = new Date(Date.now() + (data.minutes ?? 30) * 60_000).toISOString();

    const { error } = await db.from("tm_tasks").update({
      buzzer_active: false,
      buzzer_acknowledged_at: new Date().toISOString(),
      acknowledged_by: memberId,
      hold_reason: data.reason,
      hold_until: until,
    }).eq("id", data.taskId);
    if (error) return { ok: false as const, reason: error.message };

    await record(data.taskId, "Buzzer held", "buzzer", "ringing", "held", data.reason);
    return { ok: true as const, until };
  });

/** The whole lifecycle of a task, for the history screen and for other modules. */
export const getTaskHistory = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ taskId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireUser();
    const db = await admin();
    const [task, activity, reviews, escalations, timeLogs] = await Promise.all([
      db.from("tm_tasks").select("*").eq("id", data.taskId).maybeSingle(),
      db.from("tm_activity").select("*").eq("task_id", data.taskId).order("created_at"),
      db.from("tm_reviews").select("*").eq("task_id", data.taskId).order("created_at"),
      db.from("tm_escalations").select("*").eq("task_id", data.taskId).order("created_at"),
      db.from("tm_time_logs").select("*").eq("task_id", data.taskId).order("created_at"),
    ]);
    if (!task.data) return { ok: false as const, reason: "no_such_task" };
    return {
      ok: true as const,
      task: task.data,
      activity: activity.data ?? [],
      reviews: reviews.data ?? [],
      escalations: escalations.data ?? [],
      timeLogs: timeLogs.data ?? [],
    };
  });

/**
 * The billing position of one task.
 *
 * Every figure is read from the row; nothing is inferred and nothing is
 * defaulted to a plausible-looking number. A task with no cost recorded
 * reports no cost, which is the honest answer.
 */
export const getTaskWallet = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ taskId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireUser();
    const db = await admin();
    const { data: task } = await db
      .from("tm_tasks")
      .select("id, code, title, billable, cost, currency, billing_status, invoice_reference, payment_reference, settled_at, actual_minutes, estimated_hours, client_name, project_name")
      .eq("id", data.taskId)
      .maybeSingle();
    if (!task) return { ok: false as const, reason: "no_such_task" };

    const { data: logs } = await db
      .from("tm_time_logs").select("minutes").eq("task_id", data.taskId);
    const loggedMinutes = (logs ?? []).reduce(
      (sum, l) => sum + (Number((l as { minutes?: number }).minutes) || 0), 0);

    return { ok: true as const, wallet: { ...task, logged_minutes: loggedMinutes } };
  });

/** Section 22 names this createTask; openTask is the same call. */
export const createTask = openTask;
