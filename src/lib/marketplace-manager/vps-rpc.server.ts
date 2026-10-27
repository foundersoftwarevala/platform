import postgres, { type Sql, type TransactionSql } from "postgres";
import { deploymentSetting } from "@/lib/seo/seo-store.server";
import { requireJson, requireJsonObject, type Json } from "@/lib/json";

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

type MarketplaceManagerFunction =
  | "mm_filters"
  | "mm_filter_set"
  | "mm_license_overview"
  | "mm_orders_list"
  | "mm_order_detail"
  | "mm_order_docs"
  | "mm_refund_request"
  | "mm_dispute_open"
  | "mm_dispute_resolve"
  | "mm_order_partners";

function stringArgument(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`The ${key} argument is required.`);
  }
  return value;
}

function numberArgument(args: Record<string, unknown>, key: string): number {
  const value = args[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`The ${key} argument must be a finite number.`);
  }
  return value;
}

function jsonArgument(args: Record<string, unknown>, key: string): string {
  return JSON.stringify(requireJsonObject(args[key], `The ${key} argument`));
}

/**
 * Run the audited Marketplace Manager functions inside the guarded VPS
 * transaction. Function names and SQL signatures stay static; no PostgREST or
 * hosted Supabase data path is involved.
 */
export async function callMarketplaceManagerFunction<T extends Json = Json>(
  name: MarketplaceManagerFunction,
  args: Record<string, unknown>,
  userId: string,
): Promise<T> {
  return withMarketplaceManagerDatabase(userId, async (tx) => {
    let rows: { result: unknown }[];
    switch (name) {
      case "mm_filters":
        rows = await tx<{ result: unknown }[]>`select public.mm_filters() as result`;
        break;
      case "mm_filter_set":
        rows = await tx<{ result: unknown }[]>`
          select public.mm_filter_set(
            ${stringArgument(args, "p_key")},
            ${jsonArgument(args, "p_patch")}::jsonb
          ) as result
        `;
        break;
      case "mm_license_overview":
        rows = await tx<{ result: unknown }[]>`
          select public.mm_license_overview(${stringArgument(args, "p_window")}) as result
        `;
        break;
      case "mm_orders_list":
        rows = await tx<{ result: unknown }[]>`
          select public.mm_orders_list(${jsonArgument(args, "p_query")}::jsonb) as result
        `;
        break;
      case "mm_order_detail":
        rows = await tx<{ result: unknown }[]>`
          select public.mm_order_detail(${stringArgument(args, "p_order_id")}::uuid) as result
        `;
        break;
      case "mm_order_docs":
        rows = await tx<{ result: unknown }[]>`
          select public.mm_order_docs(
            ${stringArgument(args, "p_tab")},
            ${numberArgument(args, "p_limit")}
          ) as result
        `;
        break;
      case "mm_refund_request":
        rows = await tx<{ result: unknown }[]>`
          select public.mm_refund_request(
            ${stringArgument(args, "p_order_id")}::uuid,
            ${numberArgument(args, "p_amount")},
            ${stringArgument(args, "p_reason")}
          ) as result
        `;
        break;
      case "mm_dispute_open": {
        const amount = args.p_amount;
        if (amount !== null && (typeof amount !== "number" || !Number.isFinite(amount))) {
          throw new Error("The p_amount argument must be null or a finite number.");
        }
        rows = await tx<{ result: unknown }[]>`
          select public.mm_dispute_open(
            ${stringArgument(args, "p_order_id")}::uuid,
            ${stringArgument(args, "p_reason")},
            ${amount ?? null}
          ) as result
        `;
        break;
      }
      case "mm_dispute_resolve":
        rows = await tx<{ result: unknown }[]>`
          select public.mm_dispute_resolve(
            ${stringArgument(args, "p_dispute_id")}::uuid,
            ${stringArgument(args, "p_status")},
            ${typeof args.p_resolution === "string" ? args.p_resolution : null}
          ) as result
        `;
        break;
      case "mm_order_partners":
        rows = await tx<{ result: unknown }[]>`
          select public.mm_order_partners(${stringArgument(args, "p_order_id")}::uuid) as result
        `;
        break;
    }

    if (!rows[0]) throw new Error(`The VPS function ${name} returned no row.`);
    return requireJson(rows[0].result, `VPS function ${name} response`) as T;
  });
}
