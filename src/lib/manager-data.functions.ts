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
  const [{ data: isAdmin }, { data: isBoss }] = await Promise.all([
    db.rpc("has_role", { _user_id: user.user.id, _role: "admin" }),
    db.rpc("has_role", { _user_id: user.user.id, _role: "boss" }),
  ]);
  if (!isAdmin && !isBoss) throw new Error("Manager permission required");
  return db;
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
  return (data ?? []) as Row[];
}

async function writeAudit(
  db: Awaited<ReturnType<typeof admin>>,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown>,
  severity = "info",
) {
  await db.from("audit_logs").insert({
    actor: "console@softwarevala.com",
    action,
    entity_type: entityType,
    entity_id: entityId,
    severity,
    metadata: metadata as never,
  });
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
    const db = await requireManager();
    const { data: row, error } = await db
      .from(data.table)
      .update(data.values as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await writeAudit(db, `${data.table}.updated`, data.table, data.id, data.values);
    return row as Row;
  });

export const insertRecord = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => insertSchema.parse(data))
  .handler(async ({ data }) => {
    const db = await requireManager();
    const { data: row, error } = await db
      .from(data.table)
      .insert(data.values as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await writeAudit(
      db,
      `${data.table}.created`,
      data.table,
      (row as { id?: string } | null)?.id ?? null,
      data.values,
    );
    return row as Row;
  });

export const deleteRecord = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => deleteSchema.parse(data))
  .handler(async ({ data }) => {
    const db = await requireManager();
    const { error } = await db.from(data.table).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(db, `${data.table}.deleted`, data.table, data.id, {}, "warning");
    return { ok: true };
  });

export const getManagerTables = createServerFn({ method: "GET" }).handler(async () => { await requireManager(); return MANAGER_TABLES; });
