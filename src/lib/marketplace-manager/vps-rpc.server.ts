import postgres, { type Sql, type TransactionSql } from "postgres";
import { deploymentSetting } from "@/lib/seo/seo-store.server";
import type { Json } from "@/integrations/supabase/types";

const PLATFORM_DATABASE = "sv_platform";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let pool: Sql | undefined;

function platformDatabaseUrl(): string {
  const explicit =
    deploymentSetting("SV_PLATFORM_DATABASE_URL") || deploymentSetting("I18N_DATABASE_URL");
  const configured = explicit || deploymentSetting("VPS_DATABASE_URL");
  if (!configured) throw new Error("The canonical platform database is not configured.");

  const url = new URL(configured);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("The canonical platform database must use PostgreSQL.");
  }
  if (explicit && decodeURIComponent(url.pathname.slice(1)) !== PLATFORM_DATABASE) {
    throw new Error("The Marketplace Manager database must be sv_platform.");
  }
  if (!explicit) url.pathname = `/${PLATFORM_DATABASE}`;
  return url.toString();
}

async function database(): Promise<Sql> {
  if (pool) return pool;
  pool = postgres(platformDatabaseUrl(), {
    max: 4,
    idle_timeout: 30,
    connect_timeout: 10,
    connection: { statement_timeout: 30_000, application_name: "sv-marketplace-manager" },
    onnotice: () => {},
  });
  return pool;
}

export async function withMarketplaceManagerDatabase<T>(
  userId: string,
  run: (tx: TransactionSql) => Promise<T>,
): Promise<Awaited<T>> {
  const sql = await database();
  const result = await sql.begin(async (tx) => {
    await tx`set local role service_role`;
    // The trusted connection bypasses RLS, so every transaction must pass this user-scoped gate.
    await requireMarketplaceManagerOperator(tx, userId);
    return { value: await run(tx) };
  });
  return result.value;
}

export async function requireMarketplaceManagerOperator(
  tx: TransactionSql,
  userId: string,
): Promise<void> {
  if (!UUID.test(userId)) throw new Error("A valid signed-in user is required.");
  const claims = JSON.stringify({ sub: userId, role: "authenticated" });
  await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
  await tx`select set_config('request.jwt.claims', ${claims}, true)`;
  const [access] = await tx<{ allowed: boolean }[]>`
    select public.mm_is_operator() as allowed
  `;
  if (!access?.allowed) throw new Error("This action needs marketplace operator rights.");
}

export async function callMarketplaceManagerRpc(
  name: "mm_layout_history" | "mm_layout_restore",
  args: { p_limit?: number; p_audit_id?: string },
  userId: string,
): Promise<Json> {
  return withMarketplaceManagerDatabase(userId, async (tx) => {
    if (name === "mm_layout_history") {
      const [row] = await tx<{ result: Json }[]>`
        select public.mm_layout_history(${args.p_limit ?? 20}) as result
      `;
      if (!row) throw new Error("The homepage layout history could not be loaded.");
      return row.result;
    }

    if (!args.p_audit_id || !UUID.test(args.p_audit_id)) {
      throw new Error("A valid homepage layout audit ID is required.");
    }
    const [row] = await tx<{ result: Json }[]>`
      select public.mm_layout_restore(${args.p_audit_id}::uuid) as result
    `;
    if (!row) throw new Error("The homepage layout could not be restored.");
    return row.result;
  });
}
