import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import type { TaskTransaction } from "@/lib/tasks/db.server";
import {
  creditPaidTask,
  getOrCreateDeveloperWalletForFinance,
  recordWalletTransaction,
  type DeveloperWallet,
  type DeveloperWalletTransaction,
} from "./service.server";

type Actor = {
  id: string;
  run: <T>(operation: (tx: TaskTransaction) => Promise<T>) => Promise<T>;
};

type WalletResult = Omit<DeveloperWallet, "updated_at"> & { updated_at: string };
type WalletTransactionResult = Omit<DeveloperWalletTransaction, "created_at"> & {
  created_at: string;
};

type FinanceDeveloperRow = {
  developer_id: string;
  email: string | null;
  wallet_id: string | null;
  balance_cents: string | null;
  currency: string | null;
  updated_at: Date | string | null;
};

type PaymentTaskRow = {
  id: string;
  developer_id: string;
  title: string;
  status: string;
  payment_status: string;
  amount_cents: string | null;
  due_at: Date | string | null;
  verified_at: Date | string | null;
};

type DuePaymentRow = PaymentTaskRow & { developer_email: string | null };

function dateString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function walletResult(row: DeveloperWallet): WalletResult {
  return { ...row, updated_at: dateString(row.updated_at) };
}

function transactionResult(row: DeveloperWalletTransaction): WalletTransactionResult {
  return { ...row, created_at: dateString(row.created_at) };
}

async function requireActor(): Promise<Actor> {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Unauthorized: sign in required.");

  const { userFromBearerToken } = await import("@/lib/auth/bearer-user.server");
  const user = await userFromBearerToken(token);
  if (!user) throw new Error("Unauthorized: sign in required.");
  const { withTaskTransaction } = await import("@/lib/tasks/db.server");

  return {
    id: user.id,
    run: <T>(operation: (tx: TaskTransaction) => Promise<T>) =>
      withTaskTransaction(user.id, async (tx) => {
        const roles = await tx<{ role: string }[]>`
          select role::text as role
            from public.user_roles
           where user_id = ${user.id}::uuid
        `;
        if (!roles.some((row) => row.role === "finance_manager")) {
          throw new Error("This action requires the finance_manager role.");
        }
        return operation(tx);
      }),
  };
}

async function requireSelfOrFinance(
  actorId: string,
  requestedDeveloperId: string,
  tx: TaskTransaction,
): Promise<void> {
  if (actorId === requestedDeveloperId) {
    const roles = await tx<{ role: string }[]>`
      select role::text as role
        from public.user_roles
       where user_id = ${actorId}::uuid
    `;
    if (roles.some((row) => row.role === "developer")) return;
  }
  const financeRoles = await tx<{ role: string }[]>`
    select role::text as role
      from public.user_roles
     where user_id = ${actorId}::uuid
  `;
  if (!financeRoles.some((row) => row.role === "finance_manager")) {
    throw new Error("Wallet access requires the developer account owner or finance_manager.");
  }
}

const developerId = z.string().uuid();
const positiveCents = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

// PHASE5-WALLET: account provisioning is finance-manager-only and audited by the insert trigger.
export const createWallet = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ developerId }).parse(input))
  .handler(async ({ data }) => {
    const actor = await requireActor();
    const row = await actor.run(async (tx) => {
      const roles = await tx<{ role: string }[]>`
        select role::text as role
          from public.user_roles
         where user_id = ${data.developerId}::uuid
      `;
      if (!roles.some((row) => row.role === "developer")) {
        throw new Error("A wallet can be created only for a developer account.");
      }
      return getOrCreateDeveloperWalletForFinance(tx, data.developerId);
    });
    return walletResult(row);
  });

// PHASE5-WALLET: finance can safely retry a task credit; markPaid calls the same helper in its transaction.
export const creditForTask = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ taskId: z.string().uuid(), note: z.string().trim().max(2000).optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireActor();
    return actor.run(async (tx) => {
      const [task] = await tx<PaymentTaskRow[]>`
        select id, developer_id, title, status, payment_status,
               amount_cents::text, due_at, verified_at
          from public.tasks
         where id = ${data.taskId}::uuid
         for update
      `;
      if (!task) throw new Error("Task not found.");
      if (task.status !== "paid") {
        throw new Error("A task must be marked paid before its wallet credit is recorded.");
      }
      if (!task.amount_cents) throw new Error("Set a task amount before recording its wallet credit.");
      await creditPaidTask(
        tx,
        actor.id,
        task.id,
        task.developer_id,
        task.amount_cents,
        data.taskId,
        data.note?.trim() || `Payment for task: ${task.title}`,
      );
      return { taskId: task.id, credited: true };
    });
  });

// PHASE5-WALLET: a fine is a signed ledger debit; the DB trigger blocks overdrafts and audits it.
export const debitFine = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        developerId,
        amountCents: positiveCents,
        reason: z.string().trim().min(1).max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireActor();
    const row = await actor.run((tx) =>
      recordWalletTransaction(tx, {
        developerId: data.developerId,
        actorId: actor.id,
        type: "fine",
        amountCents: data.amountCents,
        reference: null,
        note: data.reason,
      }),
    );
    return transactionResult(row);
  });

// PHASE5-WALLET: payouts are finance-only debits with mandatory traceable references.
export const payout = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        developerId,
        amountCents: positiveCents,
        ref: z.string().trim().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireActor();
    const row = await actor.run((tx) =>
      recordWalletTransaction(tx, {
        developerId: data.developerId,
        actorId: actor.id,
        type: "payout",
        amountCents: data.amountCents,
        reference: data.ref,
        note: null,
      }),
    );
    return transactionResult(row);
  });

// PHASE5-WALLET: developers can request only their own wallet; finance can inspect any wallet.
export const getWallet = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ developerId: developerId.optional() }).parse(input))
  .handler(async ({ data }) => {
    const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new Error("Unauthorized: sign in required.");
    const { userFromBearerToken } = await import("@/lib/auth/bearer-user.server");
    const user = await userFromBearerToken(token);
    if (!user) throw new Error("Unauthorized: sign in required.");
    const target = data.developerId ?? user.id;
    const { withTaskTransaction } = await import("@/lib/tasks/db.server");
    const row = await withTaskTransaction(user.id, async (tx) => {
      await requireSelfOrFinance(user.id, target, tx);
      const [wallet] = await tx<DeveloperWallet[]>`
        select * from public.developer_wallets
         where developer_id = ${target}::uuid
      `;
      return wallet ?? null;
    });
    return row ? walletResult(row) : null;
  });

// PHASE5-WALLET: transaction reads are scoped to the developer or the dedicated finance role.
export const listTransactions = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({ developerId: developerId.optional(), limit: z.number().int().min(1).max(200).default(100) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new Error("Unauthorized: sign in required.");
    const { userFromBearerToken } = await import("@/lib/auth/bearer-user.server");
    const user = await userFromBearerToken(token);
    if (!user) throw new Error("Unauthorized: sign in required.");
    const target = data.developerId ?? user.id;
    const { withTaskTransaction } = await import("@/lib/tasks/db.server");
    const rows = await withTaskTransaction(user.id, async (tx) => {
      await requireSelfOrFinance(user.id, target, tx);
      return tx<DeveloperWalletTransaction[]>`
        select wt.*
          from public.developer_wallet_transactions wt
          join public.developer_wallets w on w.id = wt.wallet_id
         where w.developer_id = ${target}::uuid
         order by wt.created_at desc, wt.id desc
         limit ${data.limit}
      `;
    });
    return rows.map(transactionResult);
  });

// PHASE5-WALLET: the finance dashboard reads all developer accounts without exposing auth data to browsers.
export const listDeveloperWallets = createServerFn({ method: "GET" }).handler(async () => {
  const actor = await requireActor();
  const rows = await actor.run((tx) =>
    tx<FinanceDeveloperRow[]>`
      select u.id::text as developer_id,
             u.email,
             w.id::text as wallet_id,
             w.balance_cents::text as balance_cents,
             w.currency,
             w.updated_at
        from public.user_roles ur
        join auth.users u on u.id = ur.user_id
        left join public.developer_wallets w on w.developer_id = u.id
       where ur.role::text = 'developer'
       order by u.email nulls last, u.id
    `,
  );
  return Array.from(rows, (row) => ({
    ...row,
    updated_at: row.updated_at === null ? null : dateString(row.updated_at),
  }));
});

// PHASE5-WALLET: the finance queue contains only verified tasks whose payment timer expired.
export const listDueTaskPayments = createServerFn({ method: "GET" }).handler(async () => {
  const actor = await requireActor();
  return actor.run((tx) =>
    tx<DuePaymentRow[]>`
      select t.id::text, t.developer_id::text, u.email as developer_email,
             t.title, t.status::text, t.payment_status::text,
             t.amount_cents::text, t.due_at, t.verified_at
        from public.tasks t
        left join auth.users u on u.id = t.developer_id
       where t.status = 'verified' AND t.payment_status = 'due' AND t.paid_at IS NULL
       order by t.due_at nulls first, t.id
       limit 500
    `,
  );
});

// PHASE5-WALLET: finance sets the approved amount before marking the verified task paid.
export const setTaskAmount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ taskId: z.string().uuid(), amountCents: positiveCents }).parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireActor();
    return actor.run(async (tx) => {
      const [task] = await tx<PaymentTaskRow[]>`
        select id, developer_id, title, status, payment_status,
               amount_cents::text, due_at, verified_at
          from public.tasks
         where id = ${data.taskId}::uuid
         for update
      `;
      if (!task) throw new Error("Task not found.");
      if (task.status !== "verified" || task.payment_status === "paid") {
        throw new Error("Only unpaid, verified tasks can have their payment amount set.");
      }
      const [existingCredit] = await tx<{ id: string }[]>`
        select id from public.developer_wallet_transactions
         where task_id = ${data.taskId}::uuid AND type = 'credit'
         limit 1
      `;
      if (existingCredit) {
        throw new Error("A task amount cannot change after its wallet credit is recorded.");
      }
      await tx`
        update public.tasks
           set amount_cents = ${data.amountCents}::bigint
         where id = ${data.taskId}::uuid
      `;
      await tx`
        insert into public.audit_logs (
          actor_id, actor, action, entity_type, entity_id, severity,
          before_state, after_state, metadata
        ) values (
          ${actor.id}::uuid, ${actor.id}, 'task.amount_set', 'task', ${data.taskId},
          'info',
          jsonb_build_object('amount_cents', ${task.amount_cents}::bigint),
          jsonb_build_object('amount_cents', ${data.amountCents}),
          '{}'::jsonb
        )
      `;
      return { taskId: data.taskId, amountCents: data.amountCents };
    });
  });
