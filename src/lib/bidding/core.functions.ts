import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import type { TaskTransaction } from "@/lib/tasks/db.server";

const OPERATOR_ROLES = new Set(["admin", "boss", "boss_owner", "founder", "super_admin"]);
const amountInput = z.string().regex(/^\d{1,12}(?:\.\d{1,2})?$/);

type Actor = {
  id: string;
  isManager: boolean;
  memberId: string | null;
  memberRole: string | null;
};

type TaskDTO = {
  id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  currency: string;
  referenceAmount: string;
  deadline: string | null;
  assignedRole: string | null;
};

type BidDTO = {
  id: string;
  taskId: string;
  taskCode: string;
  taskTitle: string;
  taskStatus: string;
  taskAssignedTo: string | null;
  bidderId: string;
  bidderName: string;
  amount: string;
  currency: string;
  proposal: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

async function withActor<T>(
  operation: (tx: TaskTransaction, actor: Actor) => Promise<T>,
): Promise<T> {
  const authorization = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!token) throw new Error("Unauthorized: sign in required.");

  const { userFromBearerToken } = await import("@/lib/auth/bearer-user.server");
  const caller = await userFromBearerToken(token);
  if (!caller) throw new Error("Unauthorized: sign in required.");
  const { withTaskTransaction } = await import("@/lib/tasks/db.server");

  return withTaskTransaction(caller.id, async (tx) => {
    const roles = await tx<{ role: string }[]>`
      select role::text as role
        from public.user_roles
       where user_id = ${caller.id}::uuid
    `;
    const isManager = roles.some((row) => OPERATOR_ROLES.has(row.role));
    if (!isManager && !roles.some((row) => row.role === "developer")) {
      throw new Error("Bidding requires a developer or platform manager account.");
    }

    const [member] = await tx<{ id: string; role: string; active: boolean }[]>`
      select id, role, active
        from public.tm_members
       where user_id = ${caller.id}::uuid
       limit 1
    `;
    if (!isManager && (!member || !member.active || member.role.toLowerCase() !== "developer")) {
      throw new Error("Your developer account must be linked to an active Task Manager member.");
    }

    return operation(tx, {
      id: caller.id,
      isManager,
      memberId: member?.id ?? null,
      memberRole: member?.role ?? null,
    });
  });
}

export const getBiddingWorkspace = createServerFn({ method: "GET" }).handler(async () =>
  withActor(async (tx, actor) => {
    const tasks = actor.isManager
      ? await tx<TaskDTO[]>`
          select id, code, title, description, category, priority, currency,
                 cost::text as "referenceAmount", deadline::text as deadline,
                 assigned_role as "assignedRole"
            from public.tm_tasks
           where status = 'available_for_claim'
             and assigned_to is null
           order by priority desc, created_at, id
           limit 100
        `
      : await tx<TaskDTO[]>`
          select id, code, title, description, category, priority, currency,
                 cost::text as "referenceAmount", deadline::text as deadline,
                 assigned_role as "assignedRole"
            from public.tm_tasks
           where status = 'available_for_claim'
             and assigned_to is null
             and (assigned_role is null or lower(assigned_role) = lower(${actor.memberRole!}))
           order by priority desc, created_at, id
           limit 100
        `;
    const bids = actor.isManager
      ? await tx<BidDTO[]>`
          select b.id, b.task_id as "taskId", t.code as "taskCode",
                 t.title as "taskTitle", t.status as "taskStatus",
                 t.assigned_to as "taskAssignedTo", b.bidder_id as "bidderId",
                 m.full_name as "bidderName", b.amount::text as amount,
                 b.currency, b.proposal, b.status,
                 b.created_at::text as "createdAt",
                 b.updated_at::text as "updatedAt"
            from public.tm_task_bids b
            join public.tm_tasks t on t.id = b.task_id
            join public.tm_members m on m.id = b.bidder_id
           order by b.created_at desc, b.id
           limit 500
        `
      : await tx<BidDTO[]>`
          select b.id, b.task_id as "taskId", t.code as "taskCode",
                 t.title as "taskTitle", t.status as "taskStatus",
                 t.assigned_to as "taskAssignedTo", b.bidder_id as "bidderId",
                 m.full_name as "bidderName", b.amount::text as amount,
                 b.currency, b.proposal, b.status,
                 b.created_at::text as "createdAt",
                 b.updated_at::text as "updatedAt"
            from public.tm_task_bids b
            join public.tm_tasks t on t.id = b.task_id
            join public.tm_members m on m.id = b.bidder_id
           where b.bidder_user_id = ${actor.id}::uuid
           order by b.created_at desc, b.id
           limit 200
        `;

    return {
      isManager: actor.isManager,
      memberId: actor.memberId,
      tasks,
      bids,
    };
  }),
);

export const submitBid = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        taskId: z.string().uuid(),
        amount: amountInput,
        proposal: z.string().trim().min(1).max(5000),
      })
      .parse(input),
  )
  .handler(async ({ data }) =>
    withActor(async (tx, actor) => {
      if (actor.isManager || !actor.memberId) {
        throw new Error("Only an active developer can submit a bid.");
      }
      if (!Number.isFinite(Number(data.amount)) || Number(data.amount) <= 0) {
        throw new Error("Bid amount must be greater than zero.");
      }
      const [task] = await tx<
        { id: string; status: string; assigned_to: string | null; assigned_role: string | null; currency: string }[]
      >`
        select id, status, assigned_to, assigned_role, currency
          from public.tm_tasks
         where id = ${data.taskId}::uuid
         for update
      `;
      if (
        !task ||
        task.status !== "available_for_claim" ||
        task.assigned_to !== null
      ) {
        throw new Error("This task is no longer open for bids.");
      }
      if (task.assigned_role && task.assigned_role.toLowerCase() !== actor.memberRole?.toLowerCase()) {
        throw new Error("This task is routed to a different role.");
      }

      const [existing] = await tx<{ id: string }[]>`
        select id
          from public.tm_task_bids
         where task_id = ${task.id}::uuid
           and bidder_id = ${actor.memberId}::uuid
           and status = 'submitted'
         for update
      `;
      if (existing) {
        const [updated] = await tx<{ id: string; status: string }[]>`
          update public.tm_task_bids
               set amount = ${data.amount}::numeric,
                 proposal = ${data.proposal.trim()},
                 updated_at = now()
           where id = ${existing.id}::uuid
          returning id, status
        `;
        if (!updated) throw new Error("Bid update returned no row.");
        return updated;
      }

      const [created] = await tx<{ id: string; status: string }[]>`
        insert into public.tm_task_bids (
          task_id, bidder_id, bidder_user_id, amount, currency, proposal
        ) values (
          ${task.id}::uuid, ${actor.memberId}::uuid, ${actor.id}::uuid,
          ${data.amount}::numeric, ${task.currency}, ${data.proposal.trim()}
        )
        returning id, status
      `;
      if (!created) throw new Error("Bid submission returned no row.");
      return created;
    }),
  );

export const withdrawBid = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ bidId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) =>
    withActor(async (tx, actor) => {
      if (actor.isManager) throw new Error("Only the bidding developer can withdraw this bid.");
      const [candidate] = await tx<{ id: string; task_id: string }[]>`
        select b.id, b.task_id
          from public.tm_task_bids b
         where b.id = ${data.bidId}::uuid
           and b.bidder_user_id = ${actor.id}::uuid
      `;
      if (!candidate) throw new Error("Bid not found.");
      const [task] = await tx<{ status: string; assigned_to: string | null }[]>`
        select status, assigned_to
          from public.tm_tasks
         where id = ${candidate.task_id}::uuid
         for update
      `;
      if (!task || task.status !== "available_for_claim" || task.assigned_to !== null) {
        throw new Error("The task is no longer open; this bid cannot be withdrawn.");
      }
      const [bid] = await tx<{ id: string; status: string }[]>`
        select id, status
          from public.tm_task_bids
         where id = ${candidate.id}::uuid
           and task_id = ${candidate.task_id}::uuid
           and bidder_user_id = ${actor.id}::uuid
         for update
      `;
      if (!bid) throw new Error("Bid not found.");
      if (bid.status !== "submitted") throw new Error("Only submitted bids can be withdrawn.");
      const [updated] = await tx<{ id: string; status: string }[]>`
        update public.tm_task_bids
           set status = 'withdrawn', updated_at = now()
         where id = ${bid.id}::uuid
        returning id, status
      `;
      if (!updated) throw new Error("Bid withdrawal returned no row.");
      return updated;
    }),
  );

export const acceptBid = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ bidId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) =>
    withActor(async (tx, actor) => {
      if (!actor.isManager) throw new Error("Only a platform manager can accept a bid.");
      const [bid] = await tx<
        { id: string; task_id: string }[]
      >`
        select id, task_id
          from public.tm_task_bids
         where id = ${data.bidId}::uuid
      `;
      if (!bid) throw new Error("Bid not found.");

      const [task] = await tx<
        { id: string; status: string; assigned_to: string | null; assigned_role: string | null; currency: string }[]
      >`
        select id, status, assigned_to, assigned_role, currency
          from public.tm_tasks
         where id = ${bid.task_id}::uuid
         for update
      `;
      if (!task || task.status !== "available_for_claim" || task.assigned_to !== null) {
        throw new Error("The task is no longer open for bid acceptance.");
      }
      const [lockedBid] = await tx<
        { id: string; task_id: string; bidder_id: string; status: string }[]
      >`
        select id, task_id, bidder_id, status
          from public.tm_task_bids
         where id = ${bid.id}::uuid
           and task_id = ${task.id}::uuid
         for update
      `;
      if (!lockedBid) throw new Error("Bid not found.");
      if (lockedBid.status !== "submitted") {
        throw new Error("Only submitted bids can be accepted.");
      }
      const [member] = await tx<{ id: string; active: boolean; role: string }[]>`
        select id, active, role
          from public.tm_members
         where id = ${lockedBid.bidder_id}::uuid
           and user_id = (
             select bidder_user_id from public.tm_task_bids where id = ${lockedBid.id}::uuid
           )
         for update
      `;
      if (!member || !member.active || member.role.toLowerCase() !== "developer") {
        throw new Error("The selected developer is no longer eligible for this task.");
      }
      if (task.assigned_role && task.assigned_role.toLowerCase() !== member.role.toLowerCase()) {
        throw new Error("The task is routed to a different role than the bidder.");
      }

      const [accepted] = await tx<{ id: string; status: string }[]>`
        update public.tm_task_bids
           set status = 'accepted', updated_at = now(), accepted_at = now()
         where id = ${lockedBid.id}::uuid
           and status = 'submitted'
        returning id, status
      `;
      if (!accepted) throw new Error("Bid acceptance lost a concurrent update.");

      await tx`
        update public.tm_task_bids
           set status = 'rejected', updated_at = now()
         where task_id = ${task.id}::uuid
           and id <> ${lockedBid.id}::uuid
           and status = 'submitted'
      `;
      const [assigned] = await tx<{ id: string; status: string }[]>`
        update public.tm_tasks
           set assigned_to = ${member.id}::uuid,
               status = 'claimed',
               claimed_at = now(),
               buzzer_active = false,
               updated_by = ${actor.id}::uuid,
               updated_at = now()
         where id = ${task.id}::uuid
           and status = 'available_for_claim'
           and assigned_to is null
        returning id, status
      `;
      if (!assigned) throw new Error("Task assignment lost a concurrent update.");
      return { bidId: accepted.id, taskId: assigned.id, status: assigned.status };
    }),
  );
