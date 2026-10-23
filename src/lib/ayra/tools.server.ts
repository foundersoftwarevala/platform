import { recordAyraInspection } from "./audit.server";
import { withTaskTransaction } from "@/lib/tasks/db.server";

type AyraAlert = {
  id: string;
  kind: "deadline_overdue" | "promise_broken";
  taskId: string;
  taskTitle: string;
  developerId: string;
  occurredAt: string;
};

type PlatformHealth = {
  asOf: string;
  activeTasks: number;
  brokenPromises: number;
  pendingPayments: number;
  duePayments: number;
  chatSessions: number;
  chatMessages: number;
  amsEvents: number;
  amsAwards: number;
  alerts: AyraAlert[];
};

type DeveloperStatus = {
  developerId: string;
  wallet: { balanceCents: string; currency: string } | null;
  activeTasks: Array<{
    id: string;
    title: string;
    status: string;
    dueAt: string | null;
  }>;
  fines: { totalCents: string; count: number };
};

type FinancialSummary = {
  asOf: string;
  duePayments: { taskCount: number; amountCents: string | null; unpricedTaskCount: number };
  paidPayments: { taskCount: number; amountCents: string | null; unpricedTaskCount: number };
  finesCollected: { transactionCount: number; amountCents: string };
};

type TaskSearchResult = {
  query: string;
  matches: Array<{
    id: string;
    title: string;
    status: string;
    paymentStatus: string;
    developerId: string;
    dueAt: string | null;
  }>;
};

function iso(value: Date | string): string;
function iso(value: Date | string | null): string | null;
function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("The database returned an invalid timestamp.");
  return date.toISOString();
}

export async function getPlatformHealth(actorId: string): Promise<PlatformHealth> {
  await recordAyraInspection(actorId, "getPlatformHealth", {});
  return withTaskTransaction(actorId, async (tx) => {
    const [counts] = await tx<
      {
        as_of: Date | string;
        active_tasks: string;
        broken_promises: string;
        pending_payments: string;
        due_payments: string;
        chat_sessions: string;
        chat_messages: string;
        ams_events: string;
        ams_awards: string;
      }[]
    >`
      select
        now() as as_of,
        (select count(*) from public.tasks
          where status in ('assigned', 'in_progress', 'submitted'))::text as active_tasks,
        (select count(*) from public.task_promises where status = 'broken')::text as broken_promises,
        (select count(*) from public.tasks where payment_status <> 'paid')::text as pending_payments,
        (select count(*) from public.tasks where payment_status = 'due')::text as due_payments,
        (select count(*) from public.chat_sessions)::text as chat_sessions,
        (select count(*) from public.chat_messages)::text as chat_messages,
        (select count(*) from public.ams_activity_events)::text as ams_events,
        (select count(*) from public.ams_award_ledger)::text as ams_awards
    `;
    if (!counts) throw new Error("Platform health query returned no result.");

    const alerts = await tx<{
      id: string;
      kind: AyraAlert["kind"];
      task_id: string;
      task_title: string;
      developer_id: string;
      occurred_at: Date | string;
    }[]>`
      select id, kind, task_id, task_title, developer_id, occurred_at
        from (
          select t.id::text as id, 'deadline_overdue'::text as kind,
                 t.id::text as task_id, t.title as task_title,
                 t.developer_id::text as developer_id, t.due_at as occurred_at
            from public.tasks t
           where t.status = 'in_progress' and t.due_at < now()
          union all
          select p.id::text as id, 'promise_broken'::text as kind,
                 t.id::text as task_id, t.title as task_title,
                 p.developer_id::text as developer_id, p.updated_at as occurred_at
            from public.task_promises p
            join public.tasks t on t.id = p.task_id
           where p.status = 'broken'
        ) alerts
       order by occurred_at desc
       limit 20
    `;

    return {
      asOf: iso(counts.as_of),
      activeTasks: Number(counts.active_tasks),
      brokenPromises: Number(counts.broken_promises),
      pendingPayments: Number(counts.pending_payments),
      duePayments: Number(counts.due_payments),
      chatSessions: Number(counts.chat_sessions),
      chatMessages: Number(counts.chat_messages),
      amsEvents: Number(counts.ams_events),
      amsAwards: Number(counts.ams_awards),
      alerts: alerts.map((alert) => ({
        id: alert.id,
        kind: alert.kind,
        taskId: alert.task_id,
        taskTitle: alert.task_title,
        developerId: alert.developer_id,
        occurredAt: iso(alert.occurred_at),
      })),
    };
  });
}

export async function getDeveloperStatus(
  actorId: string,
  developerId: string,
): Promise<DeveloperStatus> {
  await recordAyraInspection(actorId, "getDeveloperStatus", { developerId });
  return withTaskTransaction(actorId, async (tx) => {
    const [wallet] = await tx<{ balance_cents: string; currency: string }[]>`
      select balance_cents::text, currency
        from public.developer_wallets
       where developer_id = ${developerId}::uuid
    `;
    const activeTasks = await tx<{
      id: string;
      title: string;
      status: string;
      due_at: Date | string | null;
    }[]>`
      select id::text, title, status::text, due_at
        from public.tasks
       where developer_id = ${developerId}::uuid
         and status in ('assigned', 'in_progress', 'submitted')
       order by due_at asc nulls last, created_at desc
       limit 20
    `;
    const [fines] = await tx<{ total_cents: string; count: string }[]>`
      select coalesce(sum(t.amount_cents), 0)::text as total_cents,
             count(t.id)::text as count
        from public.developer_wallet_transactions t
        join public.developer_wallets w on w.id = t.wallet_id
       where w.developer_id = ${developerId}::uuid
         and t.type = 'fine'
    `;
    if (!fines) throw new Error("Developer fine query returned no result.");

    return {
      developerId,
      wallet: wallet
        ? { balanceCents: wallet.balance_cents, currency: wallet.currency }
        : null,
      activeTasks: activeTasks.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        dueAt: iso(task.due_at),
      })),
      fines: {
        totalCents: fines.total_cents,
        count: Number(fines.count),
      },
    };
  });
}

export async function getFinancialSummary(actorId: string): Promise<FinancialSummary> {
  await recordAyraInspection(actorId, "getFinancialSummary", {});
  return withTaskTransaction(actorId, async (tx) => {
    const [payments] = await tx<{
      as_of: Date | string;
      due_count: string;
      due_amount_cents: string | null;
      due_unpriced_count: string;
      paid_count: string;
      paid_amount_cents: string | null;
      paid_unpriced_count: string;
    }[]>`
      select
        now() as as_of,
        count(*) filter (where payment_status = 'due')::text as due_count,
        sum(amount_cents) filter (where payment_status = 'due')::text as due_amount_cents,
        count(*) filter (where payment_status = 'due' and amount_cents is null)::text
          as due_unpriced_count,
        count(*) filter (where payment_status = 'paid')::text as paid_count,
        sum(amount_cents) filter (where payment_status = 'paid')::text as paid_amount_cents,
        count(*) filter (where payment_status = 'paid' and amount_cents is null)::text
          as paid_unpriced_count
      from public.tasks
    `;
    const [fines] = await tx<{ transaction_count: string; amount_cents: string }[]>`
      select count(*)::text as transaction_count,
             coalesce(sum(amount_cents), 0)::text as amount_cents
        from public.developer_wallet_transactions
       where type = 'fine'
    `;
    if (!payments || !fines) throw new Error("Financial summary query returned no result.");

    return {
      asOf: iso(payments.as_of),
      duePayments: {
        taskCount: Number(payments.due_count),
        amountCents:
          Number(payments.due_count) === 0
            ? "0"
            : payments.due_amount_cents,
        unpricedTaskCount: Number(payments.due_unpriced_count),
      },
      paidPayments: {
        taskCount: Number(payments.paid_count),
        amountCents:
          Number(payments.paid_count) === 0
            ? "0"
            : payments.paid_amount_cents,
        unpricedTaskCount: Number(payments.paid_unpriced_count),
      },
      finesCollected: {
        transactionCount: Number(fines.transaction_count),
        amountCents: fines.amount_cents,
      },
    };
  });
}

export async function searchTask(
  actorId: string,
  query: string,
): Promise<TaskSearchResult> {
  await recordAyraInspection(actorId, "searchTask", { query });
  return withTaskTransaction(actorId, async (tx) => {
    const matches = await tx<{
      id: string;
      title: string;
      status: string;
      payment_status: string;
      developer_id: string;
      due_at: Date | string | null;
    }[]>`
      select id::text, title, status::text, payment_status::text,
             developer_id::text, due_at
        from public.tasks
       where id::text = ${query}
          or position(lower(${query}) in lower(title)) > 0
       order by created_at desc
       limit 10
    `;

    return {
      query,
      matches: matches.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        paymentStatus: task.payment_status,
        developerId: task.developer_id,
        dueAt: iso(task.due_at),
      })),
    };
  });
}
