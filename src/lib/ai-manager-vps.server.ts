import type { TransactionSql } from "postgres";
import type { ZodType } from "zod";

import { decryptAiCredential } from "./ai-credentials.server.ts";
import { assertManagedProviderEndpoint } from "./managed-api-endpoints.server.ts";

const MAX_CREDENTIAL_FAILOVERS = 3;

export type VpsAiTarget = {
  serviceId: string;
  serviceName: string;
  providerSlug: string;
  endpoint: string;
  credential: string | null;
  credentialId: string | null;
  modelId: string;
  modelRowId: string;
  inputCostPer1k: number | null;
  outputCostPer1k: number | null;
  isLocalOllama: boolean;
  isAnthropic: boolean;
};

type UsageEvent = {
  agentId?: string;
  product: string;
  source: string;
  statusCode: number;
  success: boolean;
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
};

export type VpsAiDatabaseRunner = <T>(run: (tx: TransactionSql) => Promise<T>) => Promise<T>;

function localOllamaEndpoint(value: unknown): string {
  if (typeof value !== "string") throw new Error("Ollama Local has no endpoint configured.");
  const endpoint = new URL(value);
  if (
    endpoint.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "::1"].includes(endpoint.hostname.replace(/^\[|\]$/g, "")) ||
    endpoint.port !== "11434" ||
    endpoint.pathname !== "/v1/chat/completions" ||
    endpoint.username ||
    endpoint.password
  ) {
    throw new Error("Ollama Local must use its registered loopback endpoint on port 11434.");
  }
  return endpoint.toString();
}

export async function resolveVpsAiTarget(
  tx: TransactionSql,
  serviceName: string,
  requestedModel?: string,
  excludedCredentialIds: string[] = [],
): Promise<VpsAiTarget> {
  const [service] = await tx<
    {
      id: string;
      name: string;
      slug: string;
      provider_id: string;
      provider_name: string;
      provider_slug: string;
      endpoint_url: string;
    }[]
  >`
    select s.id::text, s.name, s.slug, s.provider_id::text,
           p.name as provider_name, p.slug as provider_slug, s.endpoint_url
      from public.api_services s
      join public.ai_providers p on p.id = s.provider_id
     where s.status = 'active'
       and s.approval_status = 'approved'
       and (lower(s.name) = lower(${serviceName}) or s.slug = ${serviceName})
     limit 1
  `;
  if (!service) {
    throw new Error(`AI service ${serviceName} is not active and approved in the VPS registry.`);
  }

  const providerSlug = (service.provider_slug || service.slug).toLowerCase();
  const isLocalOllama = providerSlug === "ollama-local" || service.slug === "ollama-local";
  const endpoint = isLocalOllama
    ? localOllamaEndpoint(service.endpoint_url)
    : assertManagedProviderEndpoint(service.endpoint_url).toString();

  const [model] = await tx<
    {
      id: string;
      model_id: string;
      input_cost_per_1k: number | string | null;
      output_cost_per_1k: number | string | null;
    }[]
  >`
    select id::text, model_id, input_cost_per_1k, output_cost_per_1k
      from public.ai_models
     where provider_id = ${service.provider_id}::uuid
       and status = 'active'
       and (${requestedModel ?? null}::text is null or model_id = ${requestedModel ?? null}::text)
     order by is_default desc, created_at desc, id
     limit 1
  `;
  if (!model) {
    throw new Error(
      requestedModel
        ? `Model ${requestedModel} is not active for ${service.name} in the VPS registry.`
        : `No active model is registered for ${service.name}.`,
    );
  }

  let credential: string | null = null;
  let credentialId: string | null = null;
  if (!isLocalOllama) {
    const [key] = await tx<
      {
        id: string;
        secret_encrypted: string;
        health_status: string;
        cooldown_until: string | null;
        expires_at: string | null;
      }[]
    >`
      select id::text, secret_encrypted, health_status, cooldown_until::text, expires_at::text
        from public.api_keys
       where status = 'active'
         and environment = 'production'
         and health_status not in ('invalid', 'expired')
         and (expires_at is null or expires_at > now())
         and not (id::text = any(${excludedCredentialIds}::text[]))
         and (
           service_id = ${service.id}::uuid
           or (service_id is null and provider_id = ${service.provider_id}::uuid)
         )
       order by (service_id is not null) desc, created_at desc
       limit 1
    `;
    if (!key?.secret_encrypted) {
      throw new Error(`No active production credential is stored for ${service.name}.`);
    }
    if (
      key.health_status === "throttled" &&
      key.cooldown_until &&
      new Date(key.cooldown_until).getTime() > Date.now()
    ) {
      throw new Error(
        `The configured credential for ${service.name} is rate limited until ${key.cooldown_until}. ` +
          "No alternate account was selected.",
      );
    }
    credential = decryptAiCredential(key.secret_encrypted);
    credentialId = key.id;
  }

  return {
    serviceId: service.id,
    serviceName: service.name,
    providerSlug,
    endpoint,
    credential,
    credentialId,
    modelId: model.model_id,
    modelRowId: model.id,
    inputCostPer1k: model.input_cost_per_1k === null ? null : Number(model.input_cost_per_1k),
    outputCostPer1k: model.output_cost_per_1k === null ? null : Number(model.output_cost_per_1k),
    isLocalOllama,
    isAnthropic: providerSlug.includes("anthropic"),
  };
}

export async function recordVpsAiUsage(
  tx: TransactionSql,
  target: VpsAiTarget,
  event: UsageEvent,
): Promise<void> {
  const hasRegisteredPrice =
    target.inputCostPer1k !== null &&
    target.outputCostPer1k !== null &&
    Number.isFinite(target.inputCostPer1k) &&
    Number.isFinite(target.outputCostPer1k);
  const costUsd = target.isLocalOllama
    ? 0
    : hasRegisteredPrice
      ? (event.tokensIn * (target.inputCostPer1k ?? 0) +
          event.tokensOut * (target.outputCostPer1k ?? 0)) /
        1000
      : 0;
  const source =
    !target.isLocalOllama && !hasRegisteredPrice ? `${event.source}:cost-unpriced` : event.source;

  await tx`
    insert into public.usage_events
      (service_id, model_id, product, requests, tokens_in, tokens_out, cost_usd,
       latency_ms, status_code, success, source, ai_agent_id)
    values
      (${target.serviceId}::uuid, ${target.modelRowId}::uuid, ${event.product}, 1,
       ${event.tokensIn}, ${event.tokensOut}, ${costUsd}, ${event.latencyMs},
       ${event.statusCode}, ${event.success}, ${source}, ${event.agentId ?? null}::uuid)
  `;
}

export async function requestVpsAiCompletion(options: {
  withDatabase: VpsAiDatabaseRunner;
  serviceName: string;
  modelId?: string;
  agentId?: string;
  product: string;
  source: string;
  system: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  json?: boolean;
  excludedCredentialIds?: string[];
}): Promise<{
  text: string;
  model: string;
  service: string;
  tokensIn: number;
  tokensOut: number;
}> {
  const target = await options.withDatabase((tx) =>
    resolveVpsAiTarget(tx, options.serviceName, options.modelId, options.excludedCredentialIds),
  );
  const startedAt = Date.now();
  let statusCode = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  let usageWritten = false;
  let result: Record<string, unknown> = {};

  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    let body: Record<string, unknown>;
    if (target.isAnthropic) {
      if (!target.credential)
        throw new Error(`No active production credential is stored for ${target.serviceName}.`);
      headers["x-api-key"] = target.credential;
      headers["anthropic-version"] = "2023-06-01";
      body = {
        model: target.modelId,
        max_tokens: options.maxTokens ?? 1024,
        system: options.system,
        messages: [{ role: "user", content: options.prompt }],
      };
    } else {
      if (target.credential) headers.authorization = `Bearer ${target.credential}`;
      body = {
        model: target.modelId,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 1024,
        messages: [
          { role: "system", content: options.system },
          { role: "user", content: options.prompt },
        ],
        ...(options.json ? { response_format: { type: "json_object" } } : {}),
      };
    }

    const response = await fetch(target.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(90_000),
    });
    statusCode = response.status;
    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      if (response.ok) throw new Error("AI provider returned an invalid JSON response.");
      parsed = {};
    }
    result =
      typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    const usage =
      typeof result["usage"] === "object" && result["usage"] !== null
        ? (result["usage"] as Record<string, unknown>)
        : {};
    tokensIn = Number(usage["prompt_tokens"] ?? usage["input_tokens"] ?? 0);
    tokensOut = Number(usage["completion_tokens"] ?? usage["output_tokens"] ?? 0);
    if (!Number.isSafeInteger(tokensIn) || tokensIn < 0) tokensIn = 0;
    if (!Number.isSafeInteger(tokensOut) || tokensOut < 0) tokensOut = 0;

    await options.withDatabase((tx) =>
      recordVpsAiUsage(tx, target, {
        agentId: options.agentId,
        product: options.product,
        source: options.source,
        statusCode,
        success: response.ok,
        latencyMs: Date.now() - startedAt,
        tokensIn,
        tokensOut,
      }),
    );
    usageWritten = true;

    if (target.credentialId && response.status === 401) {
      await options.withDatabase(
        (tx) => tx`
        update public.api_keys
           set health_status = 'invalid',
               last_checked_at = now(),
               failure_reason = 'Provider rejected this credential (HTTP 401).',
               cooldown_until = null
         where id = ${target.credentialId}::uuid
      `,
      );
      const excludedCredentialIds = options.excludedCredentialIds ?? [];
      if (excludedCredentialIds.length < MAX_CREDENTIAL_FAILOVERS) {
        try {
          return await requestVpsAiCompletion({
            ...options,
            excludedCredentialIds: [...excludedCredentialIds, target.credentialId],
          });
        } catch (fallbackError) {
          if (
            !(fallbackError instanceof Error) ||
            fallbackError.message !==
              `No active production credential is stored for ${target.serviceName}.`
          ) {
            throw fallbackError;
          }
        }
      }
    } else if (target.credentialId && response.status === 429) {
      const retryAfter = response.headers.get("retry-after");
      const retryAt = retryAfter
        ? /^\d+$/.test(retryAfter)
          ? new Date(Date.now() + Math.min(Number(retryAfter), 86_400) * 1000)
          : new Date(retryAfter)
        : null;
      const cooldownUntil = retryAt && Number.isFinite(retryAt.getTime()) ? retryAt : null;
      const reason = cooldownUntil
        ? `Provider rate limited this credential (HTTP 429); retry after ${cooldownUntil.toISOString()}. No account failover was attempted.`
        : "Provider rate limited this credential (HTTP 429). No account failover was attempted.";
      await options.withDatabase(
        (tx) => tx`
        update public.api_keys
           set health_status = 'throttled',
               last_checked_at = now(),
               failure_reason = ${reason},
               cooldown_until = ${cooldownUntil}
         where id = ${target.credentialId}::uuid
      `,
      );
    } else if (target.credentialId && response.ok) {
      await options.withDatabase(
        (tx) => tx`
        update public.api_keys
           set health_status = 'healthy',
               last_checked_at = now(),
               last_used_at = now(),
               failure_reason = null,
               cooldown_until = null
         where id = ${target.credentialId}::uuid
      `,
      );
    }

    const text = target.isAnthropic
      ? Array.isArray(result["content"])
        ? (result["content"] as { type?: string; text?: string }[]).find(
            (item) => item.type === "text",
          )?.text
        : undefined
      : (result["choices"] as { message?: { content?: string } }[] | undefined)?.[0]?.message
          ?.content;
    if (!response.ok || typeof text !== "string" || !text.trim()) {
      const error = result["error"];
      const detail =
        typeof error === "object" && error !== null && "message" in error
          ? String((error as { message?: unknown }).message ?? "")
          : `AI provider returned HTTP ${response.status}.`;
      throw new Error(detail || `AI provider returned HTTP ${response.status}.`);
    }
    return {
      text,
      model: target.modelId,
      service: target.serviceName,
      tokensIn,
      tokensOut,
    };
  } catch (error) {
    if (!usageWritten) {
      await options.withDatabase((tx) =>
        recordVpsAiUsage(tx, target, {
          agentId: options.agentId,
          product: options.product,
          source: options.source,
          statusCode,
          success: false,
          latencyMs: Date.now() - startedAt,
          tokensIn,
          tokensOut,
        }),
      );
    }
    throw error;
  }
}

export async function requestVpsAiJson<T>(options: {
  withDatabase: VpsAiDatabaseRunner;
  serviceName: string;
  modelId?: string;
  product: string;
  source: string;
  system: string;
  prompt: string;
  schema: ZodType<T>;
  maxTokens?: number;
}): Promise<{ model: string; value: T }> {
  const completion = await requestVpsAiCompletion({
    withDatabase: options.withDatabase,
    serviceName: options.serviceName,
    modelId: options.modelId,
    product: options.product,
    source: options.source,
    system: options.system,
    prompt: options.prompt,
    maxTokens: options.maxTokens ?? 1024,
    json: true,
  });
  let parsed: unknown;
  try {
    parsed = JSON.parse(completion.text);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "invalid JSON";
    throw new Error(`AI Manager returned malformed JSON: ${detail}`);
  }
  const validated = options.schema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `AI Manager response did not match the required contract: ${validated.error.message}`,
    );
  }
  return { model: completion.model, value: validated.data };
}
