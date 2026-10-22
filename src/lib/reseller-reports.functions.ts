import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database, Json } from "@/integrations/supabase/types";

const reportTypes = ["sales", "commissions"] as const;
const reportTypeSchema = z.enum(reportTypes);
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }, "Enter a valid calendar date.");

const reportDefinitionSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(120),
    type: reportTypeSchema,
    fromDate: dateSchema,
    toDate: dateSchema,
  })
  .refine((value) => value.fromDate <= value.toDate, {
    path: ["toDate"],
    message: "The end date must be on or after the start date.",
  });

const pageLimit = 1000;
const maxReportRows = 20_000;

type ReportRow = {
  date: string;
  reseller: string;
  resellerCode: string;
  orderId: string;
  grossAmount: number;
  commissionAmount: number;
  currency: string;
  status: string;
};

type ReportResult = {
  columns: string[];
  rows: ReportRow[];
  rowCount: number;
  totalsByCurrency: { currency: string; grossAmount: number; commissionAmount: number }[];
};

type DatabaseError = { message: string };
type DatabaseResult<T> = {
  data: T | null;
  error: DatabaseError | null;
  count?: number | null;
};
type QueryBuilder = PromiseLike<DatabaseResult<unknown>> & {
  select: (columns: string, options?: { count?: "exact"; head?: boolean }) => QueryBuilder;
  insert: (values: Record<string, unknown> | Record<string, unknown>[]) => QueryBuilder;
  update: (values: Record<string, unknown>) => QueryBuilder;
  eq: (column: string, value: string) => QueryBuilder;
  gte: (column: string, value: string) => QueryBuilder;
  lt: (column: string, value: string) => QueryBuilder;
  in: (column: string, values: string[]) => QueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilder;
  limit: (value: number) => QueryBuilder;
  range: (from: number, to: number) => QueryBuilder;
  maybeSingle: () => Promise<DatabaseResult<Record<string, unknown>>>;
};
type LooseClient = {
  from: (table: string) => QueryBuilder;
};

function database() {
  const url = process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    throw new Error("Reseller Reports storage is not configured on the server.");
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  }) as unknown as LooseClient;
}

async function requireManager() {
  const { requireMarketplaceOperator } =
    await import("@/lib/marketplace-manager/mm-operator.server");
  await requireMarketplaceOperator("Reseller Reports");
}

function dateRange(fromDate: string, toDate: string) {
  const start = new Date(`${fromDate}T00:00:00.000Z`);
  const endExclusive = new Date(`${toDate}T00:00:00.000Z`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  return { start: start.toISOString(), endExclusive: endExclusive.toISOString() };
}

function validatedResult(value: Json | null): ReportResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = value as Record<string, Json>;
  if (!Array.isArray(result.columns) || !Array.isArray(result.rows)) return null;
  return value as unknown as ReportResult;
}

export const listResellerReports = createServerFn({ method: "GET" }).handler(async () => {
  await requireManager();
  const { data, error } = await database()
    .from("reseller_manager_reports")
    .select("id, name, report_type, from_date, to_date, last_run_at, last_result, updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Could not load reseller reports: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    type: reportTypeSchema.parse(row.report_type),
    fromDate: String(row.from_date),
    toDate: String(row.to_date),
    lastRunAt: typeof row.last_run_at === "string" ? row.last_run_at : null,
    lastResult: validatedResult((row.last_result as Json | null) ?? null),
    updatedAt: String(row.updated_at),
  }));
});

export const saveResellerReport = createServerFn({ method: "POST" })
  .validator((value) => reportDefinitionSchema.parse(value ?? {}))
  .handler(async ({ data }): Promise<{ id: string }> => {
    await requireManager();
    const db = database();
    const values = {
      name: data.name,
      report_type: data.type,
      from_date: data.fromDate,
      to_date: data.toDate,
      updated_at: new Date().toISOString(),
    };
    const query = data.id
      ? db.from("reseller_manager_reports").update(values).eq("id", data.id)
      : db.from("reseller_manager_reports").insert(values);
    const { data: saved, error } = await query.select("id").maybeSingle();
    if (error) throw new Error(`Could not save reseller report: ${error.message}`);
    if (!saved?.id) throw new Error("The reseller report was not saved.");
    return { id: String(saved.id) };
  });

export const runResellerReport = createServerFn({ method: "POST" })
  .validator((value) => z.object({ id: z.string().uuid() }).parse(value ?? {}))
  .handler(async ({ data }): Promise<{ id: string; result: ReportResult; lastRunAt: string }> => {
    await requireManager();
    const db = database();
    const found = await db
      .from("reseller_manager_reports")
      .select("id, report_type, from_date, to_date")
      .eq("id", data.id)
      .maybeSingle();
    if (found.error) throw new Error(`Could not read reseller report: ${found.error.message}`);
    if (!found.data) throw new Error("The reseller report no longer exists.");

    const type = reportTypeSchema.parse(found.data.report_type);
    const fromDate = dateSchema.parse(found.data.from_date);
    const toDate = dateSchema.parse(found.data.to_date);
    if (fromDate > toDate) throw new Error("The saved report has an invalid date range.");
    const { start, endExclusive } = dateRange(fromDate, toDate);
    const counted = await db
      .from("reseller_commissions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", start)
      .lt("created_at", endExclusive);
    if (counted.error)
      throw new Error(`Could not count reseller ledger rows: ${counted.error.message}`);
    const count = counted.count ?? 0;
    if (count > maxReportRows) {
      throw new Error(
        `This report contains ${count.toLocaleString()} ledger rows, above the ${maxReportRows.toLocaleString()}-row export limit. Narrow the date range and run it again.`,
      );
    }

    const ledger: {
      id: string;
      reseller_id: string;
      order_id: string;
      gross_amount: number;
      commission_amount: number;
      currency: string;
      status: string;
      created_at: string;
    }[] = [];
    for (let offset = 0; offset < count; offset += pageLimit) {
      const page = await db
        .from("reseller_commissions")
        .select(
          "id, reseller_id, order_id, gross_amount, commission_amount, currency, status, created_at",
        )
        .gte("created_at", start)
        .lt("created_at", endExclusive)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(offset, Math.min(offset + pageLimit - 1, count - 1));
      if (page.error) throw new Error(`Could not read reseller ledger rows: ${page.error.message}`);
      if (!Array.isArray(page.data))
        throw new Error("The reseller ledger returned an incomplete page.");
      ledger.push(...page.data);
    }
    if (ledger.length !== count) {
      throw new Error(
        `The reseller ledger changed while the report ran (${ledger.length} of ${count} rows read). Run the report again.`,
      );
    }

    const resellerIds = [...new Set(ledger.map((entry) => entry.reseller_id))];
    const names = new Map<string, { name: string; code: string }>();
    for (let offset = 0; offset < resellerIds.length; offset += pageLimit) {
      const ids = resellerIds.slice(offset, offset + pageLimit);
      const page = await db.from("resellers").select("id, name, company_name, code").in("id", ids);
      if (page.error)
        throw new Error(`Could not read reseller names for the report: ${page.error.message}`);
      for (const reseller of (page.data ?? []) as {
        id: string;
        name: string | null;
        company_name: string | null;
        code: string;
      }[]) {
        names.set(reseller.id, {
          name: reseller.company_name || reseller.name || reseller.id,
          code: reseller.code,
        });
      }
    }

    const rows: ReportRow[] = ledger.map((entry) => {
      const reseller = names.get(entry.reseller_id);
      if (!reseller)
        throw new Error(`Reseller ${entry.reseller_id} could not be resolved for a ledger row.`);
      return {
        date: entry.created_at,
        reseller: reseller.name,
        resellerCode: reseller.code,
        orderId: entry.order_id,
        grossAmount: Number(entry.gross_amount),
        commissionAmount: Number(entry.commission_amount),
        currency: entry.currency,
        status: entry.status,
      };
    });
    const result: ReportResult = {
      columns:
        type === "sales"
          ? [
              "date",
              "reseller",
              "resellerCode",
              "orderId",
              "grossAmount",
              "currency",
              "commissionAmount",
              "status",
            ]
          : [
              "date",
              "reseller",
              "resellerCode",
              "orderId",
              "commissionAmount",
              "currency",
              "status",
            ],
      rows,
      rowCount: rows.length,
      totalsByCurrency: [...new Set(rows.map((row) => row.currency))].sort().map((currency) => {
        const matching = rows.filter((row) => row.currency === currency);
        return {
          currency,
          grossAmount: matching.reduce((sum, row) => sum + row.grossAmount, 0),
          commissionAmount: matching.reduce((sum, row) => sum + row.commissionAmount, 0),
        };
      }),
    };
    const lastRunAt = new Date().toISOString();
    const saved = await db
      .from("reseller_manager_reports")
      .update({
        last_result: result as unknown as Json,
        last_run_at: lastRunAt,
        updated_at: lastRunAt,
      })
      .eq("id", data.id)
      .select("id")
      .maybeSingle();
    if (saved.error)
      throw new Error(`Report ran but its results could not be stored: ${saved.error.message}`);
    if (!saved.data) throw new Error("Report ran but its results could not be stored.");
    const run = await db.from("reseller_manager_report_runs").insert({
      report_id: data.id,
      result: result as unknown as Json,
      row_count: result.rowCount,
    });
    if (run.error)
      throw new Error(
        `Report results were stored, but run history could not be saved: ${run.error.message}`,
      );
    return { id: data.id, result, lastRunAt };
  });
