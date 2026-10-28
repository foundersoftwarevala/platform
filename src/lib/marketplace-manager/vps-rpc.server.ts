import postgres, { type Sql, type TransactionSql } from "postgres";
import { getRequestHeader } from "@tanstack/react-start/server";
import { deploymentSetting } from "@/lib/seo/seo-store.server";
import { requireJson, type Json } from "@/lib/json";
import { bearerToken, userFromBearerToken } from "@/lib/auth/bearer-user.server";

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

export async function withVpsPublicDatabase<T>(
  run: (tx: TransactionSql) => Promise<T>,
): Promise<Awaited<T>> {
  const sql = await database();
  const result = await sql.begin(async (tx) => {
    await tx`set local role service_role`;
    return { value: await run(tx) };
  });
  return result.value;
}

async function withVpsAuthenticatedUser<T>(
  userId: string,
  run: (tx: TransactionSql) => Promise<T>,
): Promise<Awaited<T>> {
  if (!UUID.test(userId)) throw new Error("A valid signed-in user is required.");
  const sql = await database();
  const result = await sql.begin(async (tx) => {
    await tx`set local role service_role`;
    const claims = JSON.stringify({ sub: userId, role: "authenticated" });
    await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
    await tx`select set_config('request.jwt.claims', ${claims}, true)`;
    return { value: await run(tx) };
  });
  return result.value;
}

async function authenticatedUserId(): Promise<string> {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = bearerToken(header);
  if (!token) throw new Error("Unauthorized: sign in required.");
  const caller = await userFromBearerToken(token);
  if (!caller) throw new Error("Unauthorized: sign in required.");
  return caller.id;
}

export async function withMarketplaceManagerDatabaseFromRequest<T>(
  run: (tx: TransactionSql) => Promise<T>,
): Promise<Awaited<T>> {
  return withMarketplaceManagerDatabase(await authenticatedUserId(), run);
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

export async function callVpsUserFunctionFromRequest<T = Json>(
  name: "mm_notifications" | "mm_notification_read",
  args: Record<string, unknown>,
): Promise<T> {
  if (!USER_VPS_FUNCTIONS.has(name)) {
    throw new Error(`The VPS user function ${name} is not allowlisted.`);
  }
  const token = bearerToken(
    getRequestHeader("authorization") ?? getRequestHeader("Authorization"),
  );
  if (!token) throw new Error("Unauthorized: sign in required.");
  const caller = await userFromBearerToken(token);
  if (!caller) throw new Error("Unauthorized: sign in required.");
  return withVpsAuthenticatedUser(caller.id, (tx) =>
    invokeJsonVpsFunction(tx, name, args),
  ) as Promise<T>;
}

export type MarketplaceManagerFunction =
  | "mm_topbar_configure"
  | "mm_topbar_items_set"
  | "mm_topbar_reorder"
  | "mm_rows_list"
  | "mm_row_products"
  | "mm_slot_assign"
  | "mm_slot_remove"
  | "mm_slot_move"
  | "mm_slot_pin"
  | "mm_row_configure"
  | "mm_rows_reorder"
  | "mm_row_analytics"
  | "mm_row_create"
  | "mm_hero_reorder"
  | "mm_homepage_sections"
  | "mm_dashboard"
  | "mm_revenue_series"
  | "mm_recommendation_engines"
  | "mm_recommendation_configure"
  | "mm_search_trends"
  | "mm_marketing_summary"
  | "mm_reviews"
  | "mm_review_moderate"
  | "mm_review_reply"
  | "mm_review_report_resolve"
  | "mm_review_analytics"
  | "mm_trust_badges"
  | "mm_trust_badge_set"
  | "mm_faqs"
  | "mm_faq_save"
  | "mm_faq_transition"
  | "mm_faq_rollback"
  | "mm_faq_facts"
  | "mm_faq_save"
  | "mm_influencers"
  | "mm_influencer_code_create"
  | "mm_influencer_status"
  | "mm_sellers"
  | "mm_seller_detail"
  | "mm_seller_status"
  | "mm_seller_kind"
  | "mm_seller_commission_set"
  | "mm_seller_schedule_set"
  | "mm_seller_earnings_release"
  | "mm_seller_payout_create"
  | "mm_seller_payout_status"
  | "mm_resellers"
  | "mm_reseller_detail"
  | "mm_reseller_status"
  | "mm_reseller_plan"
  | "mm_reseller_code_create"
  | "mm_reseller_schedule_set"
  | "mm_reseller_earnings_release"
  | "mm_reseller_payout_create"
  | "mm_reseller_payout_status"
  | "mm_reseller_attention"
  | "mm_notification_channels"
  | "sf_config_draft"
  | "sf_validate"
  | "sf_publish"
  | "sf_rollback"
  | "sf_versions"
  | "sf_footer_link_save"
  | "sf_footer_link_remove"
  | "sf_footer_links_reorder"
  | "sf_social_save"
  | "sf_trust_save"
  | "sf_footer_settings_save"
  | "sf_floating_save"
  | "sf_floating_create"
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

type VpsFunctionArgument = { name: string; type: string };
type VpsFunctionMetadata = {
  arguments: VpsFunctionArgument[];
  defaults: number;
  resultType: string;
};

const ARGUMENT_CASTS: Readonly<Record<string, string>> = {
  boolean: "boolean",
  date: "date",
  "double precision": "double precision",
  integer: "integer",
  bigint: "bigint",
  json: "json",
  jsonb: "jsonb",
  numeric: "numeric",
  smallint: "smallint",
  text: "text",
  "text[]": "text[]",
  "timestamp with time zone": "timestamptz",
  "timestamp without time zone": "timestamp",
  "uuid": "uuid",
  "uuid[]": "uuid[]",
};

const UUID_ARRAY_ITEM = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PUBLIC_VPS_FUNCTIONS = new Set([
  "mm_homepage_sections",
  "mm_topbar_modules",
  "sf_catalogue_headline",
  "sf_active_offers",
  "sf_config_live",
  "sf_faq_schema",
  "sf_faqs",
  "sf_vala_tv",
]);
const USER_VPS_FUNCTIONS = new Set(["mm_notifications", "mm_notification_read"]);

async function functionMetadata(
  tx: TransactionSql,
  name: string,
): Promise<VpsFunctionMetadata> {
  const [metadata] = await tx<VpsFunctionMetadata[]>`
    select p.pronargdefaults as defaults,
           pg_get_function_result(p.oid) as "resultType",
           coalesce((
             select jsonb_agg(jsonb_build_object(
               'name', p.proargnames[argument.ordinality],
               'type', format_type(argument.type_oid, null)
             ) order by argument.ordinality)
             from unnest(p.proargtypes::oid[]) with ordinality
               as argument(type_oid, ordinality)
           ), '[]'::jsonb) as arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = ${name}
      and p.prokind = 'f'
  `;
  if (!metadata) throw new Error(`The VPS function ${name} is not installed.`);
  if (metadata.resultType !== "jsonb") {
    throw new Error(`The VPS function ${name} has an unsupported response type.`);
  }
  for (const argument of metadata.arguments) {
    if (!argument.name || !ARGUMENT_CASTS[argument.type]) {
      throw new Error(`The VPS function ${name} has an unsupported argument contract.`);
    }
  }
  return metadata;
}

function encodeFunctionArgument(value: unknown, type: string, name: string): unknown {
  if (value === null) return null;
  switch (type) {
    case "boolean":
      if (typeof value !== "boolean") break;
      return value;
    case "date":
    case "text":
    case "timestamp with time zone":
    case "timestamp without time zone":
      if (typeof value !== "string") break;
      return value;
    case "uuid":
      if (typeof value === "string" && UUID.test(value)) return value;
      break;
    case "integer":
    case "smallint":
    case "bigint":
      if (typeof value === "number" && Number.isSafeInteger(value)) return value;
      break;
    case "double precision":
    case "numeric":
      if (typeof value === "number" && Number.isFinite(value)) return value;
      break;
    case "json":
    case "jsonb":
      return JSON.stringify(requireJson(value, `The ${name} argument`));
    case "text[]":
      if (Array.isArray(value) && value.every((item) => typeof item === "string")) return value;
      break;
    case "uuid[]":
      if (Array.isArray(value) && value.every((item) => typeof item === "string" && UUID_ARRAY_ITEM.test(item))) {
        return value;
      }
      break;
  }
  throw new Error(`The ${name} argument is invalid for the VPS function.`);
}

async function invokeJsonVpsFunction(
  tx: TransactionSql,
  name: string,
  args: Record<string, unknown>,
): Promise<Json> {
  const metadata = await functionMetadata(tx, name);
  const supplied = Object.keys(args);
  const known = new Set(metadata.arguments.map((argument) => argument.name));
  const unexpected = supplied.find((key) => !known.has(key));
  if (unexpected) throw new Error(`The ${unexpected} argument is not accepted by ${name}.`);

  const requiredCount = metadata.arguments.length - metadata.defaults;
  for (const [index, argument] of metadata.arguments.entries()) {
    if (index < requiredCount && !Object.hasOwn(args, argument.name)) {
      throw new Error(`The ${argument.name} argument is required.`);
    }
  }

  const parameters: unknown[] = [];
  const namedArguments: string[] = [];
  for (const argument of metadata.arguments) {
    if (!Object.hasOwn(args, argument.name)) continue;
    const cast = ARGUMENT_CASTS[argument.type];
    parameters.push(encodeFunctionArgument(args[argument.name], argument.type, argument.name));
    namedArguments.push(`${argument.name} => $${parameters.length}::${cast}`);
  }

  const rows = await tx.unsafe(
    `select public.${name}(${namedArguments.join(", ")}) as result`,
    parameters as never[],
  ) as { result: unknown }[];
  if (!rows[0]) throw new Error(`The VPS function ${name} returned no row.`);
  return requireJson(rows[0].result, `VPS function ${name} response`);
}

function managerFunctionName(name: string): asserts name is MarketplaceManagerFunction {
  if (!MANAGER_VPS_FUNCTIONS.has(name)) {
    throw new Error(`The VPS manager function ${name} is not allowlisted.`);
  }
}

const MANAGER_VPS_FUNCTIONS: ReadonlySet<string> = new Set<MarketplaceManagerFunction>([
  "mm_topbar_configure", "mm_topbar_items_set", "mm_topbar_reorder",
  "mm_rows_list", "mm_row_products", "mm_slot_assign", "mm_slot_remove",
  "mm_slot_move", "mm_slot_pin", "mm_row_configure", "mm_rows_reorder",
  "mm_row_analytics", "mm_row_create", "mm_homepage_sections",
  "mm_hero_reorder", "mm_dashboard", "mm_revenue_series",
  "mm_recommendation_engines", "mm_recommendation_configure", "mm_search_trends",
  "mm_marketing_summary", "mm_reviews", "mm_review_moderate", "mm_review_reply",
  "mm_review_report_resolve", "mm_review_analytics", "mm_trust_badges",
  "mm_trust_badge_set", "mm_faqs", "mm_faq_save", "mm_faq_transition",
  "mm_faq_rollback", "mm_faq_facts", "mm_faq_save", "mm_influencers", "mm_influencer_code_create",
  "mm_influencer_status", "mm_sellers", "mm_seller_detail", "mm_seller_status",
  "mm_seller_kind", "mm_seller_commission_set", "mm_seller_schedule_set",
  "mm_seller_earnings_release", "mm_seller_payout_create",
  "mm_seller_payout_status", "mm_resellers", "mm_reseller_detail",
  "mm_reseller_status", "mm_reseller_plan", "mm_reseller_code_create",
  "mm_reseller_schedule_set", "mm_reseller_earnings_release",
  "mm_reseller_payout_create", "mm_reseller_payout_status",
  "mm_reseller_attention", "mm_notification_channels",
  "sf_config_draft", "sf_validate", "sf_publish",
  "sf_rollback", "sf_versions", "sf_footer_link_save", "sf_footer_link_remove",
  "sf_footer_links_reorder", "sf_social_save", "sf_trust_save",
  "sf_footer_settings_save", "sf_floating_save", "sf_floating_create",
  "mm_filters", "mm_filter_set", "mm_license_overview",
  "mm_orders_list", "mm_order_detail", "mm_order_docs", "mm_refund_request",
  "mm_dispute_open", "mm_dispute_resolve", "mm_order_partners",
]);

/**
 * Run the audited Marketplace Manager functions inside the guarded VPS
 * transaction. Only allowlisted names and catalog-verified argument types
 * enter the SQL statement; all values are bound parameters.
 */
export async function callMarketplaceManagerFunction<T = Json>(
  name: MarketplaceManagerFunction,
  args: Record<string, unknown>,
  userId: string,
): Promise<T> {
  managerFunctionName(name);
  return withMarketplaceManagerDatabase(userId, (tx) =>
    invokeJsonVpsFunction(tx, name, args),
  ) as Promise<T>;
}

/** Call a manager RPC after verifying the signed-in bearer and VPS operator role. */
export async function callMarketplaceManagerFunctionFromRequest<T = Json>(
  name: MarketplaceManagerFunction,
  args: Record<string, unknown>,
): Promise<T> {
  managerFunctionName(name);
  return callMarketplaceManagerFunction<T>(name, args, await authenticatedUserId());
}

/** Server-side reads for explicitly public VPS snapshots only. */
export async function callVpsPublicFunction<T extends Json = Json>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  if (!PUBLIC_VPS_FUNCTIONS.has(name)) {
    throw new Error(`The VPS public function ${name} is not allowlisted.`);
  }
  const sql = await database();
  const result = await sql.begin(async (tx) => {
    await tx`set local role service_role`;
    return { value: await invokeJsonVpsFunction(tx, name, args) };
  });
  return result.value as T;
}
