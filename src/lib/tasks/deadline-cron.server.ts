import { withSystemTaskTransaction } from "./db.server";

// PHASE4-WIRED: deadline warnings are idempotent audit events and notifications.
export async function runDeadlineCron(): Promise<void> {
  await withSystemTaskTransaction(async (tx) => {
    await tx`select public.tasks_deadline_alerts()`;
  });
}
