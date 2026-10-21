import { withSystemTaskTransaction } from "./db.server";

// PHASE4-WIRED: hourly transition to due is audited and notifies through DB triggers.
export async function runPaymentDueCron(): Promise<number> {
  return withSystemTaskTransaction(async (tx) => {
    await tx`select pg_advisory_xact_lock(725202611081456::bigint)`;
    const changed = await tx<{ id: string }[]>`
      update public.tasks
         set payment_status = 'due'
       where payment_status = 'verified'
         and due_at < now()
         and paid_at is null
      returning id
    `;
    return changed.length;
  });
}
