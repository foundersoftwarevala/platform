import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import type { Json } from "@/lib/json";
import type { TaskTransaction } from "./db.server";

const OPERATOR_ROLES = new Set(["admin", "boss", "founder", "super_admin", "boss_owner"]);
const DEVELOPER_ROLE = "developer";

type TaskStatus =
  | "assigned"
  | "in_progress"
  | "submitted"
  | "rejected"
  | "verified"
  | "paid"
  | "cancelled";

type TaskPaymentStatus = "pending" | "verified" | "due" | "paid";

type TaskRow = {
  id: string;
  developer_id: string;
  assigned_by: string | null;
  created_by: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  payment_status: TaskPaymentStatus;
  verified_at: Date | string | null;
  paid_at: Date | string | null;
  due_at: Date | string | null;
  priority: string | null;
  artifacts: Json | null;
  submission_notes: string | null;
  manager_notes: string | null;
  payment_reference: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type TaskResult = Omit<
  TaskRow,
  "created_at" | "updated_at" | "verified_at" | "paid_at" | "due_at"
> & {
  created_at: string;
  updated_at: string;
  verified_at: string | null;
  paid_at: string | null;
  due_at: string | null;
};

type TaskActor = {
  userId: string;
  run: <T>(operation: (tx: TaskTransaction) => Promise<T>) => Promise<T>;
};

function asIso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toTaskResult(row: TaskRow): TaskResult {
  return {
    ...row,
    created_at: asIso(row.created_at)!,
    updated_at: asIso(row.updated_at)!,
    verified_at: asIso(row.verified_at),
    paid_at: asIso(row.paid_at),
    due_at: asIso(row.due_at),
  };
}

async function requireActor(required: "developer" | "manager"): Promise<TaskActor> {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Unauthorized: sign in required.");

  const { userFromBearerToken } = await import("@/lib/auth/bearer-user.server");
  const caller = await userFromBearerToken(token);
  if (!caller) throw new Error("Unauthorized: sign in required.");
  const { withTaskTransaction } = await import("@/lib/tasks/db.server");

  return {
    userId: caller.id,
    run: <T>(operation: (tx: TaskTransaction) => Promise<T>) =>
      withTaskTransaction(caller.id, async (tx) => {
        const roles = await tx<{ role: string }[]>`
          select role::text as role
            from public.user_roles
           where user_id = ${caller.id}::uuid
        `;
        const allowed =
          required === "manager"
            ? roles.some((row) => OPERATOR_ROLES.has(row.role))
            : roles.some((row) => row.role === DEVELOPER_ROLE);
        if (!allowed) {
          throw new Error(
            required === "manager"
              ? "This action requires an operator account."
              : "This action requires a developer account.",
          );
        }
        return operation(tx);
      }),
  };
}

async function getTaskForUpdate(
  tx: TaskTransaction,
  taskId: string,
): Promise<TaskRow> {
  const [task] = await tx<TaskRow[]>`
    select *
      from public.tasks
     where id = ${taskId}::uuid
     for update
  `;
  if (!task) throw new Error("Task not found.");
  return task;
}

// PHASE3: canonical tasks is the sole write target; its trigger adds audit_logs in this transaction.
export const createTask = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        developerId: z.string().uuid(),
        title: z.string().trim().min(1).max(500),
        desc: z.string().nullable().optional(),
        assignedBy: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireActor("manager");
    if (data.assignedBy !== actor.userId) {
      throw new Error("assignedBy must match the authenticated operator.");
    }
    const row = await actor.run(async (tx) => {
      const developerRoles = await tx<{ role: string }[]>`
        select role::text as role
          from public.user_roles
         where user_id = ${data.developerId}::uuid
      `;
      if (!developerRoles.some((role) => role.role === DEVELOPER_ROLE)) {
        throw new Error("The selected account does not have a developer role.");
      }
      const [task] = await tx<TaskRow[]>`
        insert into public.tasks (
          developer_id, assigned_by, created_by, title, description
        ) values (
          ${data.developerId}::uuid, ${actor.userId}::uuid, ${actor.userId}::uuid,
          ${data.title}, ${data.desc ?? null}
        )
        returning *
      `;
      if (!task) throw new Error("Task creation returned no row.");
      return task;
    });
    return toTaskResult(row);
  });

// PHASE3: developers need a server-side transition into in_progress before submission.
export const startTask = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ taskId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const actor = await requireActor("developer");
    const row = await actor.run(async (tx) => {
      const task = await getTaskForUpdate(tx, data.taskId);
      if (task.developer_id !== actor.userId) {
        throw new Error("Developers may start only their own tasks.");
      }
      if (task.status !== "assigned" && task.status !== "rejected") {
        throw new Error("Only assigned or rejected tasks can be started.");
      }
      const [updated] = await tx<TaskRow[]>`
        update public.tasks
           set status = 'in_progress'
         where id = ${data.taskId}::uuid
        returning *
      `;
      if (!updated) throw new Error("Task start returned no row.");
      return updated;
    });
    return toTaskResult(row);
  });

// PHASE3: developer submission updates the canonical row; status and audit are atomic.
export const submitTask = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        taskId: z.string().uuid(),
        artifacts: z.unknown(),
        notes: z.string().max(20_000).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireActor("developer");
    const { requireJson } = await import("@/lib/json");
    const artifacts = requireJson(data.artifacts, "Task artifacts");
    const row = await actor.run(async (tx) => {
      const task = await getTaskForUpdate(tx, data.taskId);
      if (task.developer_id !== actor.userId) {
        throw new Error("Developers may submit only their own tasks.");
      }
      if (task.status !== "in_progress") {
        throw new Error("Only in-progress tasks can be submitted.");
      }
      const [updated] = await tx<TaskRow[]>`
        update public.tasks
           set status = 'submitted',
               artifacts = ${tx.json(artifacts)},
               submission_notes = ${data.notes ?? null}
         where id = ${data.taskId}::uuid
        returning *
      `;
      if (!updated) throw new Error("Task submission returned no row.");
      return updated;
    });
    return toTaskResult(row);
  });

// PHASE3: manager rejection updates the canonical row; status and audit are atomic.
export const rejectTask = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ taskId: z.string().uuid(), reason: z.string().trim().min(1).max(20_000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireActor("manager");
    const row = await actor.run(async (tx) => {
      const task = await getTaskForUpdate(tx, data.taskId);
      if (task.status !== "submitted") {
        throw new Error("Only submitted tasks can be rejected.");
      }
      const [updated] = await tx<TaskRow[]>`
        update public.tasks
           set status = 'rejected',
               manager_notes = ${data.reason}
         where id = ${data.taskId}::uuid
        returning *
      `;
      if (!updated) throw new Error("Task rejection returned no row.");
      return updated;
    });
    return toTaskResult(row);
  });

// PHASE3: manager verification starts the database-calculated seven-day payment window.
export const verifyTask = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        taskId: z.string().uuid(),
        notes: z.string().max(20_000).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireActor("manager");
    const row = await actor.run(async (tx) => {
      const task = await getTaskForUpdate(tx, data.taskId);
      if (task.status !== "submitted") {
        throw new Error("Only submitted tasks can be verified.");
      }
      const [updated] = await tx<TaskRow[]>`
        update public.tasks
           set status = 'verified',
               manager_notes = ${data.notes ?? null}
         where id = ${data.taskId}::uuid
        returning *
      `;
      if (!updated) throw new Error("Task verification returned no row.");
      return updated;
    });
    return toTaskResult(row);
  });

// PHASE3: payment completion writes only the canonical row; its trigger stamps and audits payment.
export const markPaid = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        taskId: z.string().uuid(),
        ref: z.string().trim().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireActor("manager");
    const row = await actor.run(async (tx) => {
      const task = await getTaskForUpdate(tx, data.taskId);
      if (task.status !== "verified") {
        throw new Error("Only verified tasks can be marked paid.");
      }
      const [updated] = await tx<TaskRow[]>`
        update public.tasks
           set status = 'paid',
               payment_reference = ${data.ref}
         where id = ${data.taskId}::uuid
        returning *
      `;
      if (!updated) throw new Error("Task payment returned no row.");
      return updated;
    });
    return toTaskResult(row);
  });

// PHASE3: manager cancellation updates the canonical row; status and audit are atomic.
export const cancelTask = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ taskId: z.string().uuid(), reason: z.string().trim().min(1).max(20_000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireActor("manager");
    const row = await actor.run(async (tx) => {
      const task = await getTaskForUpdate(tx, data.taskId);
      if (task.status !== "assigned" && task.status !== "in_progress") {
        throw new Error("Only assigned or in-progress tasks can be cancelled.");
      }
      const [updated] = await tx<TaskRow[]>`
        update public.tasks
           set status = 'cancelled',
               manager_notes = ${data.reason}
         where id = ${data.taskId}::uuid
        returning *
      `;
      if (!updated) throw new Error("Task cancellation returned no row.");
      return updated;
    });
    return toTaskResult(row);
  });
