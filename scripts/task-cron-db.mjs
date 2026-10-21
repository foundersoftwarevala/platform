import postgres from "postgres";

export function openTaskCronDatabase() {
  const configured = process.env.VPS_DATABASE_URL;
  if (!configured) throw new Error("VPS_DATABASE_URL must be set for task cron jobs.");
  const url = new URL(configured);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("VPS_DATABASE_URL must use PostgreSQL.");
  }
  url.pathname = "/sv_platform";
  return postgres(url.toString(), {
    max: 1,
    connect_timeout: 10,
    connection: { statement_timeout: 30_000, application_name: "sv-task-cron" },
  });
}

export async function withTaskCronTransaction(sql, run) {
  return sql.begin(async (tx) => {
    await tx`set local role service_role`;
    return run(tx);
  });
}
