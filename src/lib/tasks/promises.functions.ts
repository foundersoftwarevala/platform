import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import type { TaskTransaction } from "./db.server";
import type {
  DeveloperTaskPromisesDTO,
  ManagedTaskPromiseDTO,
  PromiseEligibleTaskDTO,
  TaskPromiseDTO,
  TaskPromiseStatus,
} from "./promises.types";

const OPERATOR_ROLES = new Set(["admin", "boss", "founder", "super_admin", "boss_owner"]);
const MANAGER_ROLES = new Set([
  ...OPERATOR_ROLES,
  "finance_manager",
  "employee",
  "sales",
  "support",
  "finance",
  "sales_support_manager",
]);

type TaskPromiseRow = {
  id: string;
  task_id: string;
  task_title: string;
  developer_id: string;
  status: TaskPromiseStatus;
  promised_at: Date | string;
  deadline_at: Date | string;
  fine_percentage: string | number | null;
  fine_amount: string | number | null;
  fine_cents: string | number;
  fine_applied_at: Date | string | null;
  note: string | null;
  break_reason: string | null;
  task_status?: string;
};

type EligibleTaskRow = {
  id: string;
  title: string;
  status: string;
};

type PromiseActor = {
  userId: string;
  run: <T>(operation: (tx: TaskTransaction) => Promise<T>) => Promise<T>;
};

function toIso(value: Date | string | null): string | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Task promise returned an invalid timestamp.");
  return date.toISOString();
}

function toPromiseDTO(row: TaskPromiseRow): TaskPromiseDTO {
  return {
    id: row.id,
    taskId: row.task_id,
    taskTitle: row.task_title,
    developerId: row.developer_id,
    status: row.status,
    promisedAt: toIso(row.promised_at)!,
    deadlineAt: toIso(row.deadline_at)!,
    finePercentage: row.fine_percentage === null ? null : String(row.fine_percentage),
    fineAmount: row.fine_amount === null ? null : String(row.fine_amount),
    fineCents: String(row.fine_cents),
    fineAppliedAt: toIso(row.fine_applied_at),
    note: row.note,
    breakReason: row.break_reason,
  };
}

async function requireActor(required: "developer" | "manager"): Promise<PromiseActor> {
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
          required === "developer"
            ? roles.some((row) => row.role === "developer")
            : roles.some((row) => MANAGER_ROLES.has(row.role));
        if (!allowed) {
          throw new Error(
            required === "developer"
              ? "This action requires a developer account."
              : "This action requires a manager or finance account.",
          );
        }
        return operation(tx);
      }),
  };
}

// PHASE6-PROMISE: canonical task promises use their own additive table and the audited wallet ledger.
export const getMyTaskPromiseData = createServerFn({ method: "GET" }).handler(async () => {
  const actor = await requireActor("developer");
  return actor.run(async (tx): Promise<DeveloperTaskPromisesDTO> => {
    const tasks = await tx<EligibleTaskRow[]>`
      select id, title, status::text as status
        from public.tasks
       where developer_id = ${actor.userId}::uuid
         and status in ('assigned', 'in_progress')
       order by created_at desc, id
    `;
    const promises = await tx<TaskPromiseRow[]>`
      select p.id, p.task_id, t.title as task_title, p.developer_id,
             p.status, p.promised_at, p.deadline_at, p.fine_percentage,
             p.fine_amount, p.fine_cents,
             p.fine_applied_at, p.note, p.break_reason
        from public.task_promises p
        join public.tasks t on t.id = p.task_id
       where p.developer_id = ${actor.userId}::uuid
       order by p.created_at desc, p.id
    `;
    return {
      tasks: tasks.map((task): PromiseEligibleTaskDTO => ({
        id: task.id,
        title: task.title,
        status: task.status,
      })),
      promises: promises.map(toPromiseDTO),
    };
  });
});

export const makePromise = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      taskId: z.string().uuid(),
      deadlineAt: z.string().datetime({ offset: true }),
      note: z.string().trim().max(2000).nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireActor("developer");
    const deadline = new Date(data.deadlineAt);
    if (!Number.isFinite(deadline.getTime()) || deadline.getTime() <= Date.now()) {
      throw new Error("Promise deadline must be in the future.");
    }
    return actor.run(async (tx) => {
      const [task] = await tx<{ status: string }[]>`
        select status::text as status
          from public.tasks
         where id = ${data.taskId}::uuid
           and developer_id = ${actor.userId}::uuid
         for update
      `;
      if (!task) throw new Error("Task not found for this developer.");
      if (task.status !== "assigned" && task.status !== "in_progress") {
        throw new Error("A promise can be made only for an assigned or in-progress task.");
      }
      const [row] = await tx<TaskPromiseRow[]>`
        insert into public.task_promises (task_id, developer_id, deadline_at, note)
        values (
          ${data.taskId}::uuid, ${actor.userId}::uuid,
          ${deadline.toISOString()}::timestamptz, ${data.note?.trim() || null}
        )
        returning id, task_id, ''::text as task_title, developer_id, status,
                  promised_at, deadline_at, fine_percentage, fine_amount,
                  fine_cents, fine_applied_at, note,
                  break_reason
      `;
      if (!row) throw new Error("Task promise creation returned no row.");
      return toPromiseDTO(row);
    });
  });

export const fulfillPromise = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ promiseId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const actor = await requireActor("developer");
    return actor.run(async (tx) => {
      const [promise] = await tx<TaskPromiseRow[]>`
        select p.id, p.task_id, t.title as task_title, p.developer_id,
               p.status, p.promised_at, p.deadline_at, p.fine_percentage,
               p.fine_amount, p.fine_cents,
               p.fine_applied_at, p.note, p.break_reason
          from public.task_promises p
          join public.tasks t on t.id = p.task_id
         where p.id = ${data.promiseId}::uuid
           and p.developer_id = ${actor.userId}::uuid
         for update of p
      `;
      if (!promise) throw new Error("Task promise not found for this developer.");
      if (promise.status === "fulfilled") return toPromiseDTO(promise);
      if (promise.status !== "pending") throw new Error("Only a pending promise can be fulfilled.");

      const [task] = await tx<{ status: string }[]>`
        select status::text as status
          from public.tasks
         where id = ${promise.task_id}::uuid
      `;
      if (!task || (task.status !== "submitted" && task.status !== "verified")) {
        throw new Error("A promise is fulfilled only after its task is submitted.");
      }
      const [updated] = await tx<TaskPromiseRow[]>`
        update public.task_promises
           set status = 'fulfilled'
         where id = ${promise.id}::uuid
           and status = 'pending'
        returning id, task_id, ''::text as task_title, developer_id, status,
                  promised_at, deadline_at, fine_percentage, fine_amount,
                  fine_cents, fine_applied_at, note,
                  break_reason
      `;
      if (!updated) throw new Error("Task promise fulfillment returned no row.");
      return { ...toPromiseDTO(updated), taskTitle: promise.task_title };
    });
  });

export const getManagedTaskPromises = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ status: z.enum(["pending", "broken"]).default("pending") }).parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireActor("manager");
    return actor.run(async (tx): Promise<ManagedTaskPromiseDTO[]> => {
      const rows = await tx<TaskPromiseRow[]>`
        select p.id, p.task_id, t.title as task_title, p.developer_id,
               p.status, p.promised_at, p.deadline_at, p.fine_percentage,
               p.fine_amount, p.fine_cents,
               p.fine_applied_at, p.note, p.break_reason,
               t.status::text as task_status
          from public.task_promises p
          join public.tasks t on t.id = p.task_id
         where p.status = ${data.status}
         order by p.deadline_at asc, p.id
      `;
      return rows.map((row) => ({
        ...toPromiseDTO(row),
        taskStatus: row.task_status ?? "unknown",
      }));
    });
  });

export const breakPromise = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      promiseId: z.string().uuid(),
      reason: z.string().trim().min(5).max(2000),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireActor("manager");
    return actor.run(async (tx) => {
      const [row] = await tx<TaskPromiseRow[]>`
        select *
          from public.break_task_promise(
            ${data.promiseId}::uuid,
            ${data.reason.trim()}
          )
      `;
      if (!row) throw new Error("Breaking the task promise returned no row.");
      const [task] = await tx<{ title: string }[]>`
        select title from public.tasks where id = ${row.task_id}::uuid
      `;
      if (!task) throw new Error("Task promise refers to a missing canonical task.");
      return toPromiseDTO({ ...row, task_title: task.title });
    });
  });
