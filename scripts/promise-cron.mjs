import { openTaskCronDatabase, withTaskCronTransaction } from "./task-cron-db.mjs";

const actorId = process.env.PROMISE_CRON_ACTOR_ID;
if (!actorId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actorId)) {
  throw new Error("PROMISE_CRON_ACTOR_ID must be a provisioned manager or finance user UUID.");
}

const sql = openTaskCronDatabase();
let failures = 0;
let broken = 0;
let alreadyResolved = 0;

try {
  const duePromises = await withTaskCronTransaction(sql, (tx) => tx`
    select id
      from public.task_promises
     where status = 'pending'
       and deadline_at < now()
     order by deadline_at, id
  `);

  for (const promise of duePromises) {
    try {
      const status = await withTaskCronTransaction(sql, async (tx) => {
        await tx`select set_config('request.jwt.claim.sub', ${actorId}, true)`;
        await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: actorId })}, true)`;
        const [result] = await tx`
          select status::text
            from public.break_task_promise(
              ${promise.id}::uuid,
              'deadline_missed'
            )
        `;
        if (!result) throw new Error("Promise break returned no status.");
        return result.status;
      });
      if (status === "broken") broken += 1;
      else alreadyResolved += 1;
      console.log(`Task promise ${promise.id}: ${status}.`);
    } catch (error) {
      failures += 1;
      console.error(`Task promise ${promise.id} could not be processed:`, error);
    }
  }

  console.log(`Promise cron completed; ${broken} broken, ${alreadyResolved} already resolved, ${failures} failed.`);
  if (failures) process.exitCode = 1;
} catch (error) {
  console.error("Promise cron failed:", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
