import { openTaskCronDatabase, withTaskCronTransaction } from "./task-cron-db.mjs";

const sql = openTaskCronDatabase();
try {
  const updated = await withTaskCronTransaction(sql, async (tx) => {
    await tx`select pg_advisory_xact_lock(725202611081456::bigint)`;
    return tx`
      update public.tasks
         set payment_status = 'due'
       where payment_status = 'verified'
         and due_at < now()
         and paid_at is null
      returning id
    `;
  });
  console.log(`Payment due cron completed; ${updated.length} task(s) changed.`);
} catch (error) {
  console.error("Payment due cron failed:", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
