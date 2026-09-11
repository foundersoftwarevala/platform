import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { isManagerTable, MANAGER_TABLES } from "./manager-tables";

const filterSchema = z.object({
  column: z.string().min(1).max(64),
  op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "in", "is"]).default("eq"),
  value: z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())]),
});

const listSchema = z.object({
  table: z.string().refine(isManagerTable, "Unknown table"),
  select: z.string().max(600).default("*"),
  orderBy: z.string().max(64).optional(),
  ascending: z.boolean().default(false),
  limit: z.number().int().min(1).max(2000).default(200),
  filters: z.array(filterSchema).max(8).default([]),
});

const listManySchema = z.object({
  requests: z.array(listSchema).min(1).max(24),
});

const mutateSchema = z.object({
  table: z.string().refine(isManagerTable, "Unknown table"),
  id: z.string().uuid(),
  values: z.record(z.string(), z.unknown()),
});

const insertSchema = z.object({
  table: z.string().refine(isManagerTable, "Unknown table"),
  values: z.record(z.string(), z.unknown()),
});

const deleteSchema = z.object({
  table: z.string().refine(isManagerTable, "Unknown table"),
  id: z.string().uuid(),
});

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function requireManager() {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Manager authentication required");
  const db = await admin();
  const { data: user, error: userError } = await db.auth.getUser(token);
  if (userError || !user.user) throw new Error("Manager authentication required");
  // The Control Panel gates the Finance Manager on the `finance` role, so a
  // finance operator has to be able to use the data layer behind it. Without
  // this they passed the door and were refused here, and the console loaded
  // empty with nothing to explain why. Admin and boss keep what they had.
  const [{ data: isAdmin }, { data: isBoss }, { data: isFinance }] = await Promise.all([
    db.rpc("has_role", { _user_id: user.user.id, _role: "admin" }),
    db.rpc("has_role", { _user_id: user.user.id, _role: "boss" }),
    db.rpc("has_role", { _user_id: user.user.id, _role: "finance" }),
  ]);
  if (!isAdmin && !isBoss && !isFinance) throw new Error("Manager permission required");
  const role = isBoss ? "boss" : isAdmin ? "admin" : "finance";
  return Object.assign(db, {
    managerActor: { id: user.user.id, email: user.user.email ?? null, role },
  });
}

/** The signed-in operator behind the current call, for the audit trail. */
type ManagerActor = { id: string; email: string | null; role: string };
type ManagerDb = Awaited<ReturnType<typeof admin>> & { managerActor: ManagerActor };

/**
 * Columns that must never leave the server, whatever the caller asks for.
 *
 * The generic list function defaults to select="*" and runs on the service-role
 * client, so before this map a screen that asked for `api_keys` received the
 * provider secret in the JSON response and in the React Query cache — the mask
 * in the table was cosmetic. Redaction happens here, after the query, so it
 * applies to reads, to the rows returned by insert/update, and to the values
 * recorded in the audit log, no matter which screen made the call.
 *
 * A live scan of all 98 manager tables found exactly one secret-bearing column.
 * `ai_providers.credential_env` holds the NAME of an environment variable, not
 * a value, and stays visible because the console needs it.
 */
const SERVER_ONLY_COLUMNS: Record<string, readonly string[]> = {
  api_keys: ["secret_encrypted"],
  // A saved payment method's raw detail - account number, UPI id, wallet
  // address - is written from the browser but never read back to it. The list
  // shows the label and the last four characters the server stored alongside.
  payment_methods: ["details_json"],
};

function redactRows(table: string, rows: Row[]): Row[] {
  const hidden = SERVER_ONLY_COLUMNS[table];
  const nested = NESTED_SECRET_COLUMNS[table];
  if ((!hidden || hidden.length === 0) && !nested) return rows;
  return rows.map((row) => {
    const safe: Row = { ...row };
    for (const column of hidden ?? []) delete safe[column];
    if (nested) {
      for (const column of nested) {
        const value = safe[column];
        if (value && typeof value === "object" && !Array.isArray(value)) {
          const copy = { ...(value as Record<string, unknown>) };
          delete copy["secrets"];
          safe[column] = copy;
        }
      }
    }
    return safe;
  });
}

/**
 * A payment rail's settings are shown in Finance Manager — the Wise link, the
 * account name, the bank name. Its credentials live under a `secrets` key
 * inside the same column and are stripped here, so an operator can configure a
 * provider from the console without the key ever travelling back to a browser.
 */
const NESTED_SECRET_COLUMNS: Record<string, readonly string[]> = {
  finance_payment_rails: ["configuration_state"],
};

function redactValues(table: string, values: Record<string, unknown>): Record<string, unknown> {
  const hidden = SERVER_ONLY_COLUMNS[table];
  if (!hidden || hidden.length === 0) return values;
  const safe: Record<string, unknown> = { ...values };
  for (const column of hidden) {
    if (column in safe) safe[column] = "[redacted]";
  }
  return safe;
}

type ListInput = z.infer<typeof listSchema>;

// Rows are dynamic across 32 tables; the shape is validated at the table layer.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

async function runList(db: Awaited<ReturnType<typeof admin>>, input: ListInput) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = db.from(input.table).select(input.select).limit(input.limit);

  for (const f of input.filters) {
    if (f.op === "in" && Array.isArray(f.value)) query = query.in(f.column, f.value);
    else if (f.op === "is") query = query.is(f.column, f.value as never);
    else query = query[f.op](f.column, f.value);
  }

  if (input.orderBy) query = query.order(input.orderBy, { ascending: input.ascending });

  let { data, error } = await query;
  // Transient auth-clock skew between the sandbox and the backend can reject a
  // valid key ("JWT issued at future"). Retry once after a short delay.
  if (error && /issued at future|jwt/i.test(error.message)) {
    await new Promise((r) => setTimeout(r, 750));
    ({ data, error } = await query);
  }
  if (error) throw new Error(`${input.table}: ${error.message}`);
  return redactRows(input.table, (data ?? []) as Row[]);
}

async function writeAudit(
  db: ManagerDb,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown>,
  severity = "info",
) {
  // The actor used to be the literal string console@softwarevala.com, so every
  // privileged change in the platform was recorded against an account nobody
  // owns. requireManager() has already resolved the real signed-in operator.
  const actor = db.managerActor;
  await db.from("audit_logs").insert({
    actor: actor.email ?? actor.id,
    action,
    entity_type: entityType,
    entity_id: entityId,
    severity,
    metadata: {
      ...(metadata as Record<string, unknown>),
      actor_user_id: actor.id,
      actor_role: actor.role,
    } as never,
  });
}

/**
 * Evidence. It may be added to and never edited or erased from here.
 *
 * audit_logs, finance_audit_logs and error_events were all reachable through
 * the generic update and delete functions, which meant an operator could
 * rewrite the record of what an operator did. An audit trail that the audited
 * can edit is not an audit trail. Corrections belong in a new entry.
 */
const APPEND_ONLY_TABLES = new Set(["audit_logs", "finance_audit_logs", "error_events"]);

/**
 * Money does not move through the generic data layer.
 *
 * The AI API Manager's wallet screen credited a wallet by inserting a
 * transaction row and then writing the new balance itself, from the browser,
 * with a reference it made up — no payment, no verification, no idempotency,
 * and two separate writes that a second tab could interleave. Balance and
 * ledger movements now have to go through Finance Manager's own server
 * functions, which hold the checks. Everything else on those screens — a
 * threshold, a lock, auto top-up — still writes normally.
 */
const WALLET_BALANCE_COLUMNS = new Set(["balance", "reserved", "available", "spent"]);
const WALLET_LEDGER_TABLES = new Set(["wallet_transactions", "finance_wallet_transactions"]);

/**
 * An order is paid, and a licence exists, only because a provider or a
 * verified payment said so - never because a console row was edited.
 *
 * /api/manager/resource already refuses "paid" (resource.ts), but this generic
 * layer reaches the same tables with the service key and checked nothing, so
 * an admin, boss or finance session could mark an order paid, change what it
 * cost, or mint a licence by hand. Those writes are refused here; everything
 * else on these tables (notes, a cancellation, a revoke) still writes normally.
 */
const ORDER_SETTLEMENT_COLUMNS = new Set([
  "total",
  "subtotal",
  "tax_total",
  "discount_total",
  "amount_inr",
  "amount_usd",
  "currency_charged",
  "payu_status",
  "payu_txn_id",
  "txnid",
]);
const ISSUED_BY_PAYMENT_TABLES = new Set([
  "licenses",
  "entitlements",
  "marketplace_licenses",
  "finance_payments",
]);

function refuseSettlementWrite(
  table: string,
  values: Record<string, unknown>,
  op: "insert" | "update",
): void {
  if (table === "marketplace_orders") {
    if (String(values["status"] ?? "").toLowerCase() === "paid") {
      throw new Error(
        "An order is marked paid only by a verified payment, not from the console.",
      );
    }
    const touched = Object.keys(values).filter((k) => ORDER_SETTLEMENT_COLUMNS.has(k));
    if (touched.length) {
      throw new Error(
        `An order's amount and payment reference cannot be edited here (${touched.join(", ")}).`,
      );
    }
  }
  if (ISSUED_BY_PAYMENT_TABLES.has(table)) {
    if (op === "insert") {
      throw new Error(`${table} rows are issued by a verified payment, not created from the console.`);
    }
    const status = String(values["status"] ?? "").toLowerCase();
    if (table === "finance_payments" && ["succeeded", "paid", "captured", "settled"].includes(status)) {
      throw new Error("A payment is settled only by the provider's verified confirmation.");
    }
  }
}

function refuseFinancialWrite(table: string, values: Record<string, unknown>): void {
  if (WALLET_LEDGER_TABLES.has(table)) {
    throw new Error(
      "Wallet ledger entries are written by Finance Manager, not from the console. " +
        "Use the wallet top-up or deduction action so the balance, the entry and the audit stay together.",
    );
  }
  if (table === "wallets" || table === "finance_wallets") {
    const touched = Object.keys(values).filter((k) => WALLET_BALANCE_COLUMNS.has(k));
    if (touched.length) {
      throw new Error(
        `A wallet balance cannot be set directly (${touched.join(", ")}). ` +
          "Use Finance Manager's top-up or deduction, which records the entry and the audit with it.",
      );
    }
  }
}

/** Tables where a change is a policy decision worth diffing, not bulk data. */
const AUDIT_BEFORE_AFTER_TABLES = new Set(["product_apis", "role_api_permissions", "rate_limits"]);

/**
 * The audit event names the Product-wise API Control specification asks for.
 *
 * The generic layer used to record `product_apis.updated` for every change, so
 * enabling an API, moving it to another provider and raising a quota were
 * indistinguishable in the audit trail. The columns being written decide the
 * name; anything not covered keeps the generic form.
 */
function productApiEventName(values: Record<string, unknown>): string {
  if ("enabled" in values) {
    return values["enabled"] ? "PRODUCT_API_ENABLED" : "PRODUCT_API_DISABLED";
  }
  if ("model_id" in values) return "PRODUCT_API_MODEL_CHANGED";
  if ("fallback_service_id" in values) return "PRODUCT_API_FALLBACK_CHANGED";
  if ("service_id" in values || "provider_id" in values) return "PRODUCT_API_PROVIDER_CHANGED";
  if (
    [
      "quota_monthly",
      "quota_daily",
      "token_quota_monthly",
      "budget_monthly_usd",
      "budget_daily_usd",
      "max_concurrent",
    ].some((k) => k in values)
  ) {
    return "PRODUCT_API_LIMIT_CHANGED";
  }
  return "PRODUCT_API_POLICY_CHANGED";
}

/** The row as it stands before a write, so the audit can carry before and after. */
async function readBefore(
  db: ManagerDb,
  table: string,
  id: string,
): Promise<Record<string, unknown> | null> {
  if (!AUDIT_BEFORE_AFTER_TABLES.has(table)) return null;
  const { data } = await db.from(table).select("*").eq("id", id).maybeSingle();
  const row = (data as Record<string, unknown> | null) ?? null;
  return row ? (redactRows(table, [row])[0] as Record<string, unknown>) : null;
}

export const listRecords = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => listSchema.parse(data))
  .handler(async ({ data }) => runList(await requireManager(), data));

export const listManyRecords = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => listManySchema.parse(data))
  .handler(async ({ data }) => {
    const db = await requireManager();
    const results = await Promise.all(data.requests.map((r) => runList(db, r)));
    return results;
  });

export const updateRecord = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => mutateSchema.parse(data))
  .handler(async ({ data }) => {
    if (APPEND_ONLY_TABLES.has(data.table)) {
      throw new Error(`${data.table} is append-only. Record a correcting entry instead.`);
    }
    refuseFinancialWrite(data.table, data.values);
    refuseSettlementWrite(data.table, data.values, "update");
    const db = await requireManager();
    const before = await readBefore(db, data.table, data.id);
    const { data: row, error } = await db
      .from(data.table)
      .update(data.values as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await writeAudit(
      db,
      data.table === "product_apis" ? productApiEventName(data.values) : `${data.table}.updated`,
      data.table,
      data.id,
      {
        ...redactValues(data.table, data.values),
        ...(before ? { before, after: redactRows(data.table, [row as Row])[0] } : {}),
      },
    );
    return redactRows(data.table, [row as Row])[0] as Row;
  });

export const insertRecord = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => insertSchema.parse(data))
  .handler(async ({ data }) => {
    refuseFinancialWrite(data.table, data.values);
    refuseSettlementWrite(data.table, data.values, "insert");
    const db = await requireManager();
    const { data: row, error } = await db
      .from(data.table)
      .insert(data.values as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await writeAudit(
      db,
      data.table === "product_apis" ? "PRODUCT_API_MAPPED" : `${data.table}.created`,
      data.table,
      (row as { id?: string } | null)?.id ?? null,
      redactValues(data.table, data.values),
    );
    return redactRows(data.table, [row as Row])[0] as Row;
  });

export const deleteRecord = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => deleteSchema.parse(data))
  .handler(async ({ data }) => {
    if (APPEND_ONLY_TABLES.has(data.table)) {
      throw new Error(`${data.table} is append-only and cannot be deleted from.`);
    }
    if (WALLET_LEDGER_TABLES.has(data.table)) {
      throw new Error("A wallet ledger entry cannot be deleted. Record a reversal instead.");
    }
    const db = await requireManager();
    const { error } = await db.from(data.table).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(db, `${data.table}.deleted`, data.table, data.id, {}, "warning");
    return { ok: true };
  });

export const getManagerTables = createServerFn({ method: "GET" }).handler(async () => {
  await requireManager();
  return MANAGER_TABLES;
});
