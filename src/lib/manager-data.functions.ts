import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { isManagerTable, MANAGER_TABLES } from "./manager-tables";
import { credentialFingerprint, encryptAiCredential } from "./ai-credentials.server";

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
  accessToken: z.string().min(1).optional(),
});

const listManySchema = z.object({
  requests: z.array(listSchema).min(1).max(24),
  accessToken: z.string().min(1),
});

const mutateSchema = z.object({
  table: z.string().refine(isManagerTable, "Unknown table"),
  id: z.string().uuid(),
  values: z.record(z.string(), z.unknown()),
  accessToken: z.string().min(1),
});

const insertSchema = z.object({
  table: z.string().refine(isManagerTable, "Unknown table"),
  values: z.record(z.string(), z.unknown()),
  accessToken: z.string().min(1),
});

const deleteSchema = z.object({
  table: z.string().refine(isManagerTable, "Unknown table"),
  id: z.string().uuid(),
  accessToken: z.string().min(1),
});

const healthCheckSchema = z.object({
  serviceId: z.string().uuid(),
  accessToken: z.string().min(1),
});

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function requireManager(accessToken?: string) {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = accessToken ?? (header?.startsWith("Bearer ") ? header.slice(7) : null);
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

type ManagerActor = { id: string; email: string | null; role: string };
type ManagerDb = Awaited<ReturnType<typeof admin>> & { managerActor: ManagerActor };

type ListInput = z.infer<typeof listSchema>;

// Rows are dynamic across 32 tables; the shape is validated at the table layer.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

const SERVER_ONLY_COLUMNS: Record<string, readonly string[]> = {
  api_keys: ["secret_encrypted"],
  payment_methods: ["details_json"],
};

function redactRows(table: string, rows: Row[]): Row[] {
  const hidden = SERVER_ONLY_COLUMNS[table];
  if (!hidden?.length) return rows;
  return rows.map((row) => {
    const safe = { ...row };
    for (const column of hidden) delete safe[column];
    return safe;
  });
}

function redactValues(table: string, values: Record<string, unknown>): Record<string, unknown> {
  const hidden = SERVER_ONLY_COLUMNS[table];
  if (!hidden?.length) return values;
  const safe = { ...values };
  for (const column of hidden) {
    if (column in safe) safe[column] = "[redacted]";
  }
  return safe;
}

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
  const actor = db.managerActor;
  await db.from("audit_logs").insert({
    actor: actor.email ?? actor.id,
    action,
    entity_type: entityType,
    entity_id: entityId,
    severity,
    metadata: {
      ...metadata,
      actor_user_id: actor.id,
      actor_role: actor.role,
    } as never,
  });
}

async function validateApiServiceActivation(
  db: ManagerDb,
  serviceId: string,
  values: Record<string, unknown>,
): Promise<void> {
  if (values["status"] !== "active") return;
  const { data: service, error: serviceError } = await db
    .from("api_services")
    .select("name, approval_status, credential_env")
    .eq("id", serviceId)
    .maybeSingle();
  if (serviceError || !service) throw new Error("API service is not registered.");
  if (service.approval_status !== "approved") {
    throw new Error("Approve this API service before enabling it.");
  }
  const { data: credentials, error: credentialError } = await db
    .from("api_keys")
    .select("secret_encrypted")
    .eq("service_id", serviceId)
    .eq("status", "active");
  if (credentialError) throw new Error(credentialError.message);
  const hasStoredCredential = (credentials ?? []).some((credential) => {
    const secret = credential.secret_encrypted;
    return typeof secret === "string" && secret.trim().length > 0;
  });
  const credentialEnv =
    typeof service.credential_env === "string" &&
    /^[A-Z][A-Z0-9_]{2,63}$/.test(service.credential_env)
      ? service.credential_env
      : null;
  if (!hasStoredCredential && !(credentialEnv && process.env[credentialEnv]?.trim())) {
    throw new Error(
      `BLOCKED / CREDENTIAL REQUIRED. Configure an active credential for ${service.name} before enabling it.`,
    );
  }
}

function apiServiceEventName(values: Record<string, unknown>): string {
  if (values["status"] === "active") return "API_SERVICE_ENABLED";
  if (values["status"] === "inactive") return "API_SERVICE_DISABLED";
  if (values["approval_status"] === "approved") return "API_SERVICE_APPROVED";
  if (values["approval_status"] === "rejected") return "API_SERVICE_REJECTED";
  return "API_SERVICE_UPDATED";
}

export const listRecords = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => listSchema.parse(data))
  .handler(async ({ data }) => runList(await requireManager(data.accessToken), data));

export const listManyRecords = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => listManySchema.parse(data))
  .handler(async ({ data }) => {
    const db = await requireManager(data.accessToken);
    const results = await Promise.all(data.requests.map((r) => runList(db, r)));
    return results;
  });

export const updateRecord = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => mutateSchema.parse(data))
  .handler(async ({ data }) => {
    const db = await requireManager(data.accessToken);
    if (data.table === "api_services") {
      await validateApiServiceActivation(db, data.id, data.values);
    }
    const { data: row, error } = await db
      .from(data.table)
      .update(data.values as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await writeAudit(
      db,
      data.table === "api_services" ? apiServiceEventName(data.values) : `${data.table}.updated`,
      data.table,
      data.id,
      redactValues(data.table, data.values),
    );
    return redactRows(data.table, [row as Row])[0] as Row;
  });

export const checkApiServiceHealth = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => healthCheckSchema.parse(data))
  .handler(async ({ data }) => {
    const db = await requireManager(data.accessToken);
    const { data: service, error } = await db
      .from("api_services")
      .select("id, name, endpoint_url")
      .eq("id", data.serviceId)
      .maybeSingle();
    if (error || !service) throw new Error("API service is not registered.");
    const endpoint = String(service.endpoint_url ?? "");
    let url: URL;
    try {
      url = new URL(endpoint);
    } catch {
      throw new Error("This service has no valid HTTPS endpoint to check.");
    }
    if (
      url.protocol !== "https:" ||
      /^(?:localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[0-1])\.|::1|fc|fd|fe80:)/i.test(
        url.hostname,
      )
    ) {
      throw new Error("Health checks require a public HTTPS provider endpoint.");
    }
    let response: Response;
    try {
      response = await fetch(url, {
        method: "HEAD",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : "Provider endpoint was unreachable.";
      const { error: updateError } = await db
        .from("api_services")
        .update({ health_status: "unhealthy" })
        .eq("id", data.serviceId);
      if (updateError) throw new Error(updateError.message);
      await writeAudit(
        db,
        "API_SERVICE_HEALTH_CHECK_FAILED",
        "api_services",
        data.serviceId,
        { endpoint, detail },
        "warning",
      );
      throw new Error(`Provider health check failed: ${detail}`);
    }
    const healthStatus =
      response.ok || [401, 403, 405].includes(response.status) ? "healthy" : "degraded";
    const { error: updateError } = await db
      .from("api_services")
      .update({ health_status: healthStatus })
      .eq("id", data.serviceId);
    if (updateError) throw new Error(updateError.message);
    await writeAudit(db, "API_SERVICE_HEALTH_CHECKED", "api_services", data.serviceId, {
      endpoint,
      http_status: response.status,
      health_status: healthStatus,
    });
    return {
      healthStatus,
      detail:
        response.status === 401 || response.status === 403
          ? `Provider endpoint is reachable (HTTP ${response.status}); execution remains blocked until credentials are configured.`
          : `Provider endpoint responded with HTTP ${response.status}.`,
    };
  });

export const insertRecord = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => insertSchema.parse(data))
  .handler(async ({ data }) => {
    const values =
      data.table === "api_keys" && typeof data.values["secret_encrypted"] === "string"
        ? (() => {
            const secret = data.values["secret_encrypted"].trim();
            if (!secret) return { ...data.values, secret_encrypted: null };
            return {
              ...data.values,
              secret_encrypted: encryptAiCredential(secret),
              fingerprint: credentialFingerprint(secret),
              key_prefix: secret.slice(0, Math.min(8, secret.length)),
              last_four: secret.slice(-4),
            };
          })()
        : data.values;
    const db = await requireManager(data.accessToken);
    const { data: row, error } = await db
      .from(data.table)
      .insert(values as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await writeAudit(
      db,
      `${data.table}.created`,
      data.table,
      (row as { id?: string } | null)?.id ?? null,
      redactValues(data.table, values),
    );
    return redactRows(data.table, [row as Row])[0] as Row;
  });

export const deleteRecord = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => deleteSchema.parse(data))
  .handler(async ({ data }) => {
    const db = await requireManager(data.accessToken);
    const { error } = await db.from(data.table).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(db, `${data.table}.deleted`, data.table, data.id, {}, "warning");
    return { ok: true };
  });

export const getManagerTables = createServerFn({ method: "GET" }).handler(async () => { await requireManager(); return MANAGER_TABLES; });
