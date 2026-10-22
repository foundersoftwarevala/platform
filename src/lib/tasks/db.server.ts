import postgres, { type Sql, type TransactionSql } from "postgres";
import { deploymentSetting } from "@/lib/seo/seo-store.server";

let pool: Sql | undefined;

function databaseUrl(): string {
  const explicit =
    deploymentSetting("SV_PLATFORM_DATABASE_URL") || deploymentSetting("I18N_DATABASE_URL");
  const configured = explicit || deploymentSetting("VPS_DATABASE_URL");
  if (!configured) throw new Error("The task database is not configured.");

  const url = new URL(configured);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("The task database URL must use PostgreSQL.");
  }
  if (explicit && decodeURIComponent(url.pathname.slice(1)) !== "sv_platform") {
    throw new Error("The canonical task database must be sv_platform.");
  }
  if (!explicit) url.pathname = "/sv_platform";
  return url.toString();
}

async function database(): Promise<Sql> {
  if (pool) return pool;
  pool = postgres(databaseUrl(), {
    max: 4,
    idle_timeout: 30,
    connect_timeout: 10,
    connection: { statement_timeout: 30_000, application_name: "sv-canonical-tasks" },
    onnotice: () => {},
  });
  return pool;
}

export type TaskTransaction = TransactionSql;

export async function withTaskTransaction<T>(
  actorId: string,
  run: (tx: TaskTransaction) => Promise<T>,
): Promise<Awaited<T>> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actorId)) {
    throw new Error("A valid signed-in user is required.");
  }

  const sql = await database();
  const result = await sql.begin(async (tx) => {
    await tx`set local role service_role`;
    await tx`select set_config('request.jwt.claim.sub', ${actorId}, true)`;
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: actorId })}, true)`;
    return { value: await run(tx) };
  });
  return result.value;
}
