import { openTaskCronDatabase, withTaskCronTransaction } from "./task-cron-db.mjs";

const sql = openTaskCronDatabase();
try {
  await withTaskCronTransaction(sql, async (tx) => {
    await tx`select public.tasks_deadline_alerts()`;
  });
  console.log("Deadline alert cron completed.");
} catch (error) {
  console.error("Deadline alert cron failed:", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
