import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
import { userFromBearerToken } from "./auth/bearer-user.server";
import { credentialFingerprint, encryptAiCredential } from "./ai-credentials.server";
import { assertManagedProviderEndpoint } from "./managed-api-endpoints.server";
import { withVpsPublicDatabase } from "./marketplace-manager/vps-rpc.server";
import { requestVpsAiCompletion } from "./ai-manager-vps.server";

const READ_ROLES = ["admin", "boss", "boss_owner", "super_admin", "founder", "finance"];
const WRITE_ROLES = ["admin", "boss", "boss_owner", "super_admin", "founder"];
const AI_TABLES = ["ai_providers", "ai_models", "api_services", "api_keys"] as const;
type AiTable = (typeof AI_TABLES)[number];
const UUID = z.string().uuid();
type AiRegistryRow = Record<string, Json>;

function isJsonObject(value: Json): value is { [key: string]: Json | undefined } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function authorize(accessToken?: string, write = false) {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = accessToken ?? (header?.startsWith("Bearer ") ? header.slice(7) : undefined);
  if (!token) throw new Error("AI API Manager access requires a signed-in operator.");
  const user = await userFromBearerToken(token);
  if (!user) throw new Error("AI API Manager access requires a signed-in operator.");
  const roles = write ? WRITE_ROLES : READ_ROLES;
  await withVpsPublicDatabase(async (tx) => {
    const [result] = await tx<{ allowed: boolean }[]>`
      select bool_or(public.has_role(${user.id}::uuid, role_name::public.app_role)) as allowed
        from unnest(${roles}::text[]) as candidates(role_name)
    `;
    if (!result?.allowed) throw new Error("AI API Manager access is required.");
  });
  return user;
}

const listSchema = z.object({ accessToken: z.string().min(1) });
export const listVpsAiRegistry = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => listSchema.parse(input))
  .handler(async ({ data }) => {
    await authorize(data.accessToken);
    return withVpsPublicDatabase(async (tx) => {
      const readJson = async (statement: string): Promise<AiRegistryRow[]> => {
        const [row] = await tx.unsafe<{ rows: Json }[]>(statement);
        if (!Array.isArray(row?.rows) || !row.rows.every(isJsonObject)) {
          throw new Error("The VPS AI registry returned an invalid row set.");
        }
        return row.rows as AiRegistryRow[];
      };
      return Promise.all([
        readJson(
          "select coalesce(jsonb_agg(to_jsonb(item)), '[]'::jsonb) rows from (select * from public.ai_providers order by name, id limit 200) item",
        ),
        readJson(
          "select coalesce(jsonb_agg(to_jsonb(item)), '[]'::jsonb) rows from (select * from public.ai_models order by name, id limit 500) item",
        ),
        readJson(
          "select coalesce(jsonb_agg(to_jsonb(item)), '[]'::jsonb) rows from (select * from public.api_services order by name, id limit 500) item",
        ),
        readJson(
          "select coalesce(jsonb_agg(to_jsonb(item)), '[]'::jsonb) rows from (select * from public.usage_daily order by day desc, id limit 2000) item",
        ),
        readJson(
          "select coalesce(jsonb_agg(to_jsonb(item)), '[]'::jsonb) rows from (select * from public.api_service_capabilities order by capability_name, id limit 2000) item",
        ),
        readJson(
          "select coalesce(jsonb_agg(to_jsonb(item) - 'secret_encrypted' - 'key_prefix'), '[]'::jsonb) rows from (select * from public.api_keys order by created_at desc, id limit 500) item",
        ),
        readJson(
          "select coalesce(jsonb_agg(to_jsonb(item)), '[]'::jsonb) rows from (select * from public.usage_events order by occurred_at desc, id limit 2000) item",
        ),
      ]);
    });
  });

const ALLOWED_FIELDS: Record<AiTable, readonly string[]> = {
  ai_providers: ["name", "slug", "category", "base_url", "region", "docs_url", "status"],
  ai_models: [
    "name",
    "model_id",
    "provider_id",
    "modality",
    "context_window",
    "input_cost_per_1k",
    "output_cost_per_1k",
    "is_default",
    "status",
  ],
  api_services: [
    "name",
    "slug",
    "provider_id",
    "category",
    "endpoint_url",
    "status",
    "approval_status",
    "health_status",
    "uptime_pct",
  ],
  api_keys: [
    "label",
    "environment",
    "status",
    "service_id",
    "provider_id",
    "scopes",
    "secret_encrypted",
  ],
};

function parseValues(table: AiTable, input: Record<string, unknown>): Record<string, unknown> {
  const allowed = new Set(ALLOWED_FIELDS[table]);
  const values = Object.fromEntries(Object.entries(input).filter(([key]) => allowed.has(key)));
  if (!Object.keys(values).length || Object.keys(values).length !== Object.keys(input).length) {
    throw new Error("The requested AI registry fields are not supported.");
  }
  return values;
}

const mutationSchema = z.object({
  accessToken: z.string().min(1),
  table: z.enum(AI_TABLES),
  values: z.record(z.string(), z.unknown()),
});
export const insertVpsAiRegistryRecord = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => mutationSchema.parse(input))
  .handler(async ({ data }) => {
    const caller = await authorize(data.accessToken, true);
    const values = parseValues(data.table, data.values);
    if (data.table === "api_services" && "endpoint_url" in values && values["endpoint_url"]) {
      assertManagedProviderEndpoint(values["endpoint_url"]);
    }
    if (data.table === "api_keys") {
      const raw = values["secret_encrypted"];
      if (typeof raw !== "string" || !raw.trim()) {
        throw new Error("A nonempty credential is required.");
      }
      const secret = raw.trim();
      const providerId = typeof values["provider_id"] === "string" ? values["provider_id"] : null;
      const serviceId = typeof values["service_id"] === "string" ? values["service_id"] : null;
      if (!providerId && !serviceId) {
        throw new Error("Choose a provider or a service for this credential.");
      }
      if (serviceId) {
        const [service] = await withVpsPublicDatabase(
          async (tx) => tx<
            {
              provider_id: string | null;
            }[]
          >`
          select provider_id::text from public.api_services where id = ${serviceId}::uuid
        `,
        );
        if (!service) throw new Error("The selected service is not in VPS Postgres.");
        if (providerId && service.provider_id !== providerId) {
          throw new Error("The selected service does not belong to this provider.");
        }
        if (!providerId && service.provider_id) values["provider_id"] = service.provider_id;
      } else if (providerId) {
        const [provider] = await withVpsPublicDatabase(
          async (tx) => tx<{ id: string }[]>`
          select id::text from public.ai_providers where id = ${providerId}::uuid
        `,
        );
        if (!provider) throw new Error("The selected provider is not in VPS Postgres.");
      }
      values["secret_encrypted"] = encryptAiCredential(secret);
      values["fingerprint"] = credentialFingerprint(secret);
      values["last_four"] = secret.slice(-4);
      values["created_by"] = caller.email ?? caller.id;
      const existing = await withVpsPublicDatabase(
        async (tx) => tx<{ id: string }[]>`
        select id::text from public.api_keys where fingerprint = ${String(values["fingerprint"])} limit 1
      `,
      );
      if (existing.length) throw new Error("This credential is already registered.");
    }
    const columns = Object.keys(values);
    const safeColumns = columns.map((column) => `"${column}"`).join(", ");
    const projectedValues = columns
      .map((column) => `(jsonb_populate_record(null::public.${data.table}, $1::jsonb))."${column}"`)
      .join(", ");
    const returned = await withVpsPublicDatabase(async (tx) => {
      const [row] = await tx.unsafe<{ row: Json }[]>(
        `insert into public.${data.table} (${safeColumns}) select ${projectedValues} returning to_jsonb(${data.table}) as row`,
        [JSON.stringify(values)],
      );
      if (!row?.row || typeof row.row !== "object" || Array.isArray(row.row)) {
        throw new Error("The VPS registry did not return the created record.");
      }
      const safe = { ...(row.row as Record<string, Json>) };
      delete safe["secret_encrypted"];
      delete safe["key_prefix"];
      await tx`
        insert into public.audit_logs (actor, action, entity_type, entity_id, severity, metadata)
        values (
          ${caller.email ?? caller.id}, ${`${data.table}.created`}, ${data.table},
          ${String(safe["id"] ?? "")}, 'info',
          ${JSON.stringify({ actor_user_id: caller.id, credential_redacted: data.table === "api_keys" })}::jsonb
        )
      `;
      return safe;
    });
    return returned;
  });

const updateSchema = z.object({
  accessToken: z.string().min(1),
  table: z.enum(["ai_models", "api_services"]),
  id: UUID,
  values: z.record(z.string(), z.unknown()),
});
export const updateVpsAiRegistryRecord = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data }) => {
    const caller = await authorize(data.accessToken, true);
    const values = parseValues(data.table, data.values);
    if (data.table === "api_services" && values["endpoint_url"]) {
      assertManagedProviderEndpoint(values["endpoint_url"]);
    }
    if (data.table === "api_services" && values["status"] === "active") {
      const [service] = await withVpsPublicDatabase(
        async (tx) => tx<
          {
            approval_status: string;
            id: string;
            provider_id: string | null;
          }[]
        >`
        select approval_status, id::text, provider_id::text
          from public.api_services where id = ${data.id}::uuid
      `,
      );
      if (!service || service.approval_status !== "approved") {
        throw new Error("Approve this service before enabling it.");
      }
      const [key] = await withVpsPublicDatabase(
        async (tx) => tx<{ id: string }[]>`
        select id::text from public.api_keys
         where status = 'active'
           and environment = 'production'
           and health_status not in ('invalid', 'expired')
           and (expires_at is null or expires_at > now())
           and secret_encrypted like 'enc:v1:%'
           and (
             service_id = ${data.id}::uuid
             or (service_id is null and provider_id = ${service.provider_id}::uuid)
           )
         limit 1
      `,
      );
      if (!key)
        throw new Error("A production credential is required before enabling this service.");
    }
    const columns = Object.keys(values);
    const assignments = columns.map((column) => `"${column}" = projected."${column}"`).join(", ");
    return withVpsPublicDatabase(async (tx) => {
      const [row] = await tx.unsafe<{ row: Json }[]>(
        `update public.${data.table} as target set ${assignments} from jsonb_populate_record(null::public.${data.table}, $1::jsonb) as projected where target.id = $2::uuid returning to_jsonb(target) as row`,
        [JSON.stringify(values), data.id],
      );
      if (!row?.row || typeof row.row !== "object" || Array.isArray(row.row)) {
        throw new Error("The VPS registry record no longer exists.");
      }
      const safe = { ...(row.row as Record<string, Json>) };
      delete safe["secret_encrypted"];
      delete safe["key_prefix"];
      await tx`
        insert into public.audit_logs (actor, action, entity_type, entity_id, severity, metadata)
        values (
          ${caller.email ?? caller.id}, ${`${data.table}.updated`}, ${data.table},
          ${data.id}, 'info',
          ${JSON.stringify({ actor_user_id: caller.id, fields: columns })}::jsonb
        )
      `;
      return safe;
    });
  });

const serviceActionSchema = z.object({ accessToken: z.string().min(1), serviceId: UUID });
export const checkVpsAiServiceHealth = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => serviceActionSchema.parse(input))
  .handler(async ({ data }) => {
    const caller = await authorize(data.accessToken, true);
    const [service] = await withVpsPublicDatabase(
      async (tx) => tx<
        {
          name: string;
          endpoint_url: string | null;
        }[]
      >`
      select name, endpoint_url from public.api_services where id = ${data.serviceId}::uuid
    `,
    );
    if (!service) throw new Error("The VPS API service was not found.");
    const endpoint = assertManagedProviderEndpoint(service.endpoint_url);
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "HEAD",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      await withVpsPublicDatabase(
        (tx) => tx`
        update public.api_services
           set health_status = 'unhealthy', last_checked_at = now()
         where id = ${data.serviceId}::uuid
      `,
      );
      const detail = error instanceof Error ? error.message : "The endpoint was unreachable.";
      throw new Error(`Endpoint health check failed: ${detail}`);
    }
    const health =
      response.ok || [401, 403, 405].includes(response.status) ? "healthy" : "degraded";
    await withVpsPublicDatabase(async (tx) => {
      await tx`
        update public.api_services
           set health_status = ${health}, last_checked_at = now()
         where id = ${data.serviceId}::uuid
      `;
      await tx`
        insert into public.audit_logs (actor, action, entity_type, entity_id, severity, metadata)
        values (
          ${caller.email ?? caller.id}, 'API_SERVICE_HEALTH_CHECKED', 'api_services',
          ${data.serviceId}, 'info',
          ${JSON.stringify({ actor_user_id: caller.id, http_status: response.status, credential_sent: false })}::jsonb
        )
      `;
    });
    return {
      healthStatus: health,
      detail: `Endpoint responded with HTTP ${response.status}; this reachability check does not validate credentials.`,
    };
  });

export const testVpsAiService = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => serviceActionSchema.parse(input))
  .handler(async ({ data }) => {
    const caller = await authorize(data.accessToken, true);
    const [service] = await withVpsPublicDatabase(
      async (tx) => tx<
        {
          id: string;
          name: string;
          category: string;
          status: string;
          approval_status: string;
        }[]
      >`
      select id::text, name, category, status, approval_status
        from public.api_services where id = ${data.serviceId}::uuid
    `,
    );
    if (!service || service.status !== "active" || service.approval_status !== "approved") {
      throw new Error("The service must be active and approved before a live test.");
    }
    if (service.category !== "ai") throw new Error("Only AI completion services can be tested.");
    const started = Date.now();
    try {
      const result = await requestVpsAiCompletion({
        withDatabase: withVpsPublicDatabase,
        serviceName: service.name,
        product: "manager-test",
        source: "ai-api-manager",
        system: "Reply only with the word OK.",
        prompt: "Reply with exactly: OK",
        maxTokens: 8,
      });
      await withVpsPublicDatabase(
        (tx) => tx`
        insert into public.audit_logs (actor, action, entity_type, entity_id, severity, metadata)
        values (
          ${caller.email ?? caller.id}, 'API_SERVICE_TEST_SUCCEEDED', 'api_services',
          ${service.id}, 'info',
          ${JSON.stringify({ actor_user_id: caller.id, model: result.model, latency_ms: Date.now() - started })}::jsonb
        )
      `,
      );
      return {
        ok: true as const,
        model: result.model,
        service: result.service,
        responsePreview: result.text.slice(0, 200),
        latencyMs: Date.now() - started,
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Provider test failed.";
      await withVpsPublicDatabase(
        (tx) => tx`
        insert into public.audit_logs (actor, action, entity_type, entity_id, severity, metadata)
        values (
          ${caller.email ?? caller.id}, 'API_SERVICE_TEST_FAILED', 'api_services',
          ${service.id}, 'warning',
          ${JSON.stringify({ actor_user_id: caller.id, detail, latency_ms: Date.now() - started })}::jsonb
        )
      `,
      );
      throw new Error(detail);
    }
  });
