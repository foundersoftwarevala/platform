import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { encryptAiCredential, credentialFingerprint } from "./ai-credentials.server";
import { withVpsPublicDatabase } from "./marketplace-manager/vps-rpc.server";
import { userFromBearerToken } from "./auth/bearer-user.server";
import { assertManagedProviderEndpoint } from "./managed-api-endpoints.server";

const ACCOUNT_MANAGER_ROLES = ["admin", "boss", "boss_owner", "super_admin", "founder"];
const UUID = z.string().uuid();

async function requireAccountManager(accessToken?: string) {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = accessToken ?? (header?.startsWith("Bearer ") ? header.slice(7) : undefined);
  if (!token) throw new Error("AI API account management requires operator access.");
  const caller = await userFromBearerToken(token);
  if (!caller) throw new Error("AI API account management requires operator access.");

  await withVpsPublicDatabase(async (tx) => {
    const roles = await tx<{ allowed: boolean }[]>`
      select bool_or(public.has_role(${caller.id}::uuid, role_name::public.app_role)) as allowed
        from unnest(${ACCOUNT_MANAGER_ROLES}::text[]) as roles(role_name)
    `;
    if (!roles[0]?.allowed) throw new Error("AI API account management requires operator access.");
  });
  return caller;
}

const listSchema = z.object({ accessToken: z.string().min(1) });
export const listVpsApiAccounts = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => listSchema.parse(input))
  .handler(async ({ data }) => {
    await requireAccountManager(data.accessToken);
    return withVpsPublicDatabase(async (tx) => {
      const [providers, services, accounts] = await Promise.all([
        tx<{ id: string; name: string; slug: string }[]>`
          select id::text, name, slug from public.ai_providers order by name, id
        `,
        tx<{ id: string; name: string; provider_id: string | null }[]>`
          select id::text, name, provider_id::text
            from public.api_services
           where provider_id is not null
           order by name, id
        `,
        tx<
          {
            id: string;
            label: string;
            provider_id: string | null;
            provider_name: string | null;
            service_id: string | null;
            service_name: string | null;
            environment: string;
            status: string;
            health_status: string;
            last_four: string;
            last_checked_at: string | null;
            integrity_checked_at: string | null;
            last_used_at: string | null;
            expires_at: string | null;
            failure_reason: string | null;
            cooldown_until: string | null;
            created_at: string;
          }[]
        >`
          select k.id::text, k.label, coalesce(k.provider_id, s.provider_id)::text as provider_id,
                 coalesce(p.name, service_provider.name) as provider_name,
                 k.service_id::text, s.name as service_name, k.environment, k.status,
                 case when k.expires_at <= now() then 'expired' else k.health_status end as health_status,
                 k.last_four, k.last_checked_at::text, k.last_used_at::text,
                 k.expires_at::text,
                 k.integrity_checked_at::text,
                 case when k.expires_at <= now()
                      then coalesce(k.failure_reason, 'Credential expiration time has passed.')
                      else k.failure_reason end as failure_reason,
                 k.cooldown_until::text,
                 k.created_at::text
            from public.api_keys k
            left join public.ai_providers p on p.id = k.provider_id
            left join public.api_services s on s.id = k.service_id
            left join public.ai_providers service_provider on service_provider.id = s.provider_id
           order by k.created_at desc, k.id
        `,
      ]);
      return { providers, services, accounts };
    });
  });

const addSchema = z.object({
  accessToken: z.string().min(1),
  label: z.string().trim().min(1).max(120),
  providerId: UUID,
  serviceId: UUID.nullable(),
  environment: z.enum(["production", "staging", "development"]),
  secret: z.string().trim().min(1).max(8192),
});

export const addVpsApiAccount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => addSchema.parse(input))
  .handler(async ({ data }) => {
    const caller = await requireAccountManager(data.accessToken);
    const fingerprint = credentialFingerprint(data.secret);
    return withVpsPublicDatabase(async (tx) => {
      const [provider] = await tx<{ id: string }[]>`
        select id::text from public.ai_providers where id = ${data.providerId}::uuid
      `;
      if (!provider) throw new Error("The selected provider is not registered in VPS Postgres.");
      if (data.serviceId) {
        const [service] = await tx<{ provider_id: string | null }[]>`
          select provider_id::text from public.api_services where id = ${data.serviceId}::uuid
        `;
        if (!service || service.provider_id !== data.providerId) {
          throw new Error("The selected service does not belong to this provider.");
        }
      }

      const [account] = await tx<{ id: string }[]>`
        insert into public.api_keys
          (label, provider_id, service_id, environment, last_four,
           fingerprint, secret_encrypted, status, created_by)
        values
          (${data.label}, ${data.providerId}::uuid, ${data.serviceId}::uuid,
           ${data.environment}, ${data.secret.slice(-4)}, ${fingerprint},
           ${encryptAiCredential(data.secret)},
           'active', ${caller.email ?? caller.id})
        on conflict (fingerprint) do nothing
        returning id::text
      `;
      if (!account) throw new Error("This credential is already registered.");
      await tx`
        insert into public.audit_logs (actor, action, entity_type, entity_id, severity, metadata)
        values (
          ${caller.email ?? caller.id}, 'api_key.account_created', 'api_keys',
          ${account.id}, 'info',
          ${JSON.stringify({
            actor_user_id: caller.id,
            provider_id: data.providerId,
            service_id: data.serviceId,
            environment: data.environment,
            credential_redacted: true,
          })}::jsonb
        )
      `;
      return { id: account.id };
    });
  });

const statusSchema = z.object({
  accessToken: z.string().min(1),
  accountId: UUID,
  status: z.enum(["active", "inactive"]),
});

export const setVpsApiAccountStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => statusSchema.parse(input))
  .handler(async ({ data }) => {
    const caller = await requireAccountManager(data.accessToken);
    return withVpsPublicDatabase(async (tx) => {
      const [updated] = await tx<{ id: string; status: string }[]>`
        update public.api_keys
           set status = ${data.status},
               health_status = case
                 when ${data.status} <> 'active' then health_status
                 when expires_at <= now() then 'expired'
                 else 'unknown'
               end,
               failure_reason = case
                 when ${data.status} <> 'active' then failure_reason
                 when expires_at <= now() then 'Credential expiration time has passed.'
                 else null
               end,
               cooldown_until = case when ${data.status} = 'active' then null else cooldown_until end
         where id = ${data.accountId}::uuid
         returning id::text, status
      `;
      if (!updated) throw new Error("The credential account no longer exists.");
      await tx`
        insert into public.audit_logs (actor, action, entity_type, entity_id, severity, metadata)
        values (
          ${caller.email ?? caller.id}, 'api_key.account_status_changed', 'api_keys',
          ${updated.id}, 'info',
          ${JSON.stringify({ actor_user_id: caller.id, status: updated.status })}::jsonb
        )
      `;
      return updated;
    });
  });

const healthSchema = z.object({ accessToken: z.string().min(1), accountId: UUID });
export const checkVpsApiAccountEndpoint = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => healthSchema.parse(input))
  .handler(async ({ data }) => {
    const caller = await requireAccountManager(data.accessToken);
    const account = await withVpsPublicDatabase(async (tx) => {
      const [row] = await tx<
        {
          id: string;
          endpoint_url: string | null;
          health_status: string;
        }[]
      >`
        select k.id::text, coalesce(s.endpoint_url, provider_service.endpoint_url) as endpoint_url,
               case when k.expires_at <= now() then 'expired' else k.health_status end as health_status
          from public.api_keys k
          left join public.api_services s on s.id = k.service_id
          left join lateral (
            select candidate.endpoint_url
              from public.api_services candidate
             where candidate.provider_id = k.provider_id
               and candidate.endpoint_url is not null
             order by (candidate.status = 'active') desc, candidate.name, candidate.id
             limit 1
          ) provider_service on true
         where k.id = ${data.accountId}::uuid
      `;
      if (!row) throw new Error("The credential account no longer exists.");
      return row;
    });

    let healthStatus = "unknown";
    let detail =
      "Endpoint reachability checked without sending the credential; credential validity remains unverified.";
    let statusCode: number | null = null;
    const endpoint = account.endpoint_url;
    if (endpoint) {
      const url = assertManagedProviderEndpoint(endpoint);
      try {
        const response = await fetch(url, {
          method: "HEAD",
          redirect: "error",
          signal: AbortSignal.timeout(10_000),
        });
        statusCode = response.status;
        healthStatus =
          response.ok || [401, 403, 405].includes(response.status) ? "unknown" : "unreachable";
        detail = `Endpoint responded with HTTP ${response.status}; credential validity remains unverified.`;
      } catch {
        healthStatus = "unreachable";
        detail = "Endpoint could not be reached. Credential validity was not tested.";
      }
    } else {
      detail = "No service endpoint is linked; credential validity was not tested.";
    }

    await withVpsPublicDatabase(async (tx) => {
      await tx`
        update public.api_keys
           set health_status = case
             when expires_at <= now() then 'expired'
             when health_status in ('invalid', 'throttled', 'expired') then health_status
             else ${healthStatus}
               end,
               failure_reason = case
             when expires_at <= now() then 'Credential expiration time has passed.'
             when health_status in ('invalid', 'throttled', 'expired') then failure_reason
             when ${healthStatus} = 'unreachable' then ${detail}
                 else null
               end
         where id = ${data.accountId}::uuid
      `;
      await tx`
        insert into public.audit_logs (actor, action, entity_type, entity_id, severity, metadata)
        values (
          ${caller.email ?? caller.id}, 'api_key.endpoint_checked', 'api_keys',
          ${data.accountId}, ${healthStatus === "unreachable" ? "warning" : "info"},
          ${JSON.stringify({
            actor_user_id: caller.id,
            status_code: statusCode,
            health_status: healthStatus,
            credential_sent: false,
          })}::jsonb
        )
      `;
    });
    return { healthStatus, detail, statusCode };
  });
