import { createClient } from "@supabase/supabase-js";

import { decryptAiCredential, isEncryptedAiCredential } from "./ai-credentials.server";
import { assertManagedProviderEndpoint } from "./managed-api-endpoints.server";
/**
 * One way in and out of an AI provider.
 *
 * Ten places in this codebase each read LOVABLE_API_KEY and posted to
 * ai.gateway.lovable.dev directly. Lovable is no longer part of Software Vala
 * and that variable is not set on the server, so every one of those features
 * failed with "AI is not configured" — chat, translation, SEO copy, the FAQ
 * generator, the live-data summariser and the marketplace assistants included.
 * Each also hardcoded its own model name, so changing provider meant editing
 * ten files.
 *
 * AI API Manager is where this platform keeps providers, models and
 * credentials. Everything now resolves through it, which means an operator can
 * change provider or model without a deployment, every call is metered into
 * usage_events beside the rest, and there is exactly one place a key lives.
 *
 * Nothing here holds a credential of its own, and nothing falls back to a
 * hardcoded endpoint: with no active provider configured, these throw with that
 * reason rather than returning text nobody asked a model for.
 */

export type AiTarget = {
  serviceId: string;
  serviceName: string;
  endpoint: string;
  credential: string;
  providerSlug: string;
  modelId: string | null;
  modelRowId: string | null;
  isAnthropic: boolean;
};

function serverClient() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    "";
  if (!url || !key) throw new Error("Supabase is not configured on the server.");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * The one service a caller asked for, or the best of what is active.
 *
 * Unchanged for every caller: it is the first of the candidates below, and it
 * still throws when there is nothing usable. The list is what aiComplete needs
 * so it can try a second provider when the first cannot answer.
 */
export async function resolveAiTarget(
  selector?: string | { serviceId?: string; serviceName?: string },
): Promise<AiTarget> {
  const targets = await resolveAiTargets(selector);
  return targets[0];
}

/**
 * Every service that could answer, best first.
 *
 * The gateway used to resolve exactly one target and throw if it failed, which
 * meant a single provider's billing state took down every AI feature on the
 * platform. That is not hypothetical: the Demo Manager's investigation failed
 * with "Your credit balance is too low to access the Anthropic API" while
 * OpenAI sat beside it in AI API Manager, active, approved and holding a
 * production credential.
 *
 * So resolution returns the candidates in order. A service that cannot be used
 * at all — not approved, no credential, no chat endpoint — is left out here
 * rather than failed over to later, and the reason is kept so the final error
 * can say what was skipped and why.
 *
 * Order is deliberate: an explicitly named service first and alone, because a
 * caller that asked for a particular model meant it. Only the unselected case
 * fans out.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function resolveAiTargets(
  selector?: string | { serviceId?: string; serviceName?: string },
): Promise<AiTarget[]> {
  const db = serverClient() as ReturnType<typeof createClient>;
  const serviceName = typeof selector === "string" ? selector : selector?.serviceName;
  const serviceId = typeof selector === "string" ? undefined : selector?.serviceId;

  let row: Record<string, unknown> | null = null;
  if (serviceId) {
    const { data } = await db
      .from("api_services")
      .select("id, name, provider_id, endpoint_url, status, category, approval_status")
      .eq("id", serviceId)
      .maybeSingle();
    row = isRecord(data) ? data : null;
    if (!row) throw new Error("The selected AI service is not registered in AI API Manager.");
  }
  if (!row && serviceName) {
    const { data } = await db
      .from("api_services")
      .select("id, name, provider_id, endpoint_url, status, category, approval_status")
      .ilike("name", `%${serviceName}%`)
      .eq("status", "active")
      .limit(1);
    const candidate = data?.[0];
    row = isRecord(candidate) ? candidate : null;
  }
  const rows: Record<string, unknown>[] = [];
  if (row) {
    rows.push(row);
  } else {
    // Any active AI service will do; the operator decides which by activating it.
    const { data } = await db
      .from("api_services")
      .select("id, name, provider_id, endpoint_url, status, category, approval_status")
      .eq("status", "active")
      .in("category", ["ai", "llm"])
      .order("name")
      .limit(20);
    // Only a chat endpoint can answer a completion; an embeddings or audio
    // service is not a worse choice, it is the wrong one.
    for (const candidate of (data ?? []) as Record<string, unknown>[]) {
      if (String(candidate["endpoint_url"] ?? "").match(/chat\/completions|\/v1\/messages/)) {
        rows.push(candidate);
      }
    }
  }

  if (rows.length === 0) {
    throw new Error(
      "No active AI service is configured in AI API Manager. Add one to enable AI features.",
    );
  }

  const targets: AiTarget[] = [];
  const skipped: string[] = [];
  for (const candidate of rows) {
    try {
      targets.push(await buildTarget(db, candidate));
    } catch (problem) {
      skipped.push(problem instanceof Error ? problem.message : String(problem));
    }
  }
  if (targets.length === 0) {
    throw new Error(
      skipped.length === 1 ? skipped[0] : `No AI service could be used. ${skipped.join(" ")}`,
    );
  }
  return targets;
}

/**
 * One api_services row, turned into something the gateway can call.
 *
 * Everything that makes a service unusable is refused here by name — not
 * active, not approved, an endpoint outside the managed list, no production
 * credential — so the caller above can skip it and say why rather than
 * discovering it halfway through a request.
 */
async function buildTarget(
  db: ReturnType<typeof createClient>,
  row: Record<string, unknown>,
): Promise<AiTarget> {
  if (row["status"] !== "active") {
    throw new Error(`AI service ${row["name"]} is not active in AI API Manager.`);
  }
  if (row["approval_status"] !== "approved") {
    throw new Error(`AI service ${row["name"]} is not approved in AI API Manager.`);
  }

  const endpoint = String(row["endpoint_url"] ?? "");
  const managedEndpoint = assertManagedProviderEndpoint(endpoint);

  const { data: provider } = await db
    .from("ai_providers")
    .select("name, slug")
    .eq("id", row["provider_id"] as string)
    .maybeSingle();
  const providerSlug = String(
    (provider as { slug?: string; name?: string } | null)?.slug ??
      (provider as { name?: string } | null)?.name ??
      row["name"],
  ).toLowerCase();

  const { data: model } = await db
    .from("ai_models")
    .select("id, model_id")
    .eq("provider_id", row["provider_id"] as string)
    .eq("status", "active")
    .eq("is_default", true)
    .maybeSingle();

  const { data: keyRows } = await db
    .from("api_keys")
    .select("secret_encrypted, status, environment")
    .eq("service_id", row["id"] as string)
    .eq("status", "active")
    .eq("environment", "production")
    .limit(1);

  const stored = (keyRows?.[0] as { secret_encrypted?: string } | undefined)?.secret_encrypted;
  const credential = isEncryptedAiCredential(stored) ? decryptAiCredential(stored) : null;

  if (!credential) {
    throw new Error(
      `No production credential is configured for ${row["name"]}. ` +
        "Add an encrypted credential in AI API Manager.",
    );
  }

  return {
    serviceId: String(row["id"]),
    serviceName: String(row["name"]),
    endpoint: managedEndpoint.toString(),
    credential,
    providerSlug,
    modelId: (model as { model_id?: string } | null)?.model_id ?? null,
    modelRowId: (model as { id?: string } | null)?.id ?? null,
    isAnthropic: providerSlug.includes("anthropic"),
  };
}

/**
 * Minimal, honest published-list-price table (USD per 1K tokens) for the
 * exact fallback models this gateway can send a request to. Only entries we
 * can verify from the provider's own public pricing page are included; any
 * model not listed here is metered with tokens only and cost_usd left null
 * rather than guessed.
 */
const KNOWN_MODEL_PRICING_PER_1K: Record<string, { in: number; out: number }> = {
  "gpt-4o-mini": { in: 0.00015, out: 0.0006 },
  "claude-3-5-sonnet-latest": { in: 0.003, out: 0.015 },
};

function estimateCostUsd(model: string, tokensIn: number, tokensOut: number): number | null {
  const pricing = KNOWN_MODEL_PRICING_PER_1K[model];
  if (!pricing) return null;
  return (tokensIn / 1000) * pricing.in + (tokensOut / 1000) * pricing.out;
}

async function meter(
  target: AiTarget,
  module: string,
  started: number,
  status: number,
  ok: boolean,
  usage?: Record<string, unknown>,
  resolvedModel?: string,
) {
  try {
    const db = serverClient();
    const tokensIn = Number(usage?.["input_tokens"] ?? usage?.["prompt_tokens"] ?? 0);
    const tokensOut = Number(usage?.["output_tokens"] ?? usage?.["completion_tokens"] ?? 0);
    const costUsd = resolvedModel ? estimateCostUsd(resolvedModel, tokensIn, tokensOut) : null;
    await db.from("usage_events").insert({
      service_id: target.serviceId,
      model_id: target.modelRowId,
      product: module,
      requests: 1,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      latency_ms: Date.now() - started,
      status_code: status,
      success: ok,
      source: "ai-gateway",
      ...(costUsd !== null ? { cost_usd: costUsd } : {}),
    });
  } catch {
    // Metering must never be the reason a feature fails.
  }
}

export type AiMessage = { role: "system" | "user" | "assistant"; content: string };

/** A single completion. Returns the text, or throws with the provider's reason. */
/**
 * Is this a failure another provider could answer?
 *
 * The distinction matters, because failing over on the wrong thing is worse
 * than not failing over at all: a malformed request fails identically
 * everywhere, so retrying it only spends a second provider's credit and
 * doubles the latency before reporting the same error.
 *
 * What another provider can answer: this account is out of credit, over its
 * quota, rate limited, or the provider is overloaded or down. What it cannot:
 * a prompt this gateway built wrongly, or a model name that does not exist.
 *
 * Anthropic reports an exhausted balance as HTTP 400, not 402, so the status
 * alone cannot decide it and the message has to be read.
 */
function providerCouldBeSwapped(status: number, message: string): boolean {
  if (status === 402 || status === 408 || status === 429) return true;
  if (status >= 500) return true;
  const m = message.toLowerCase();
  return (
    m.includes("credit balance") ||
    m.includes("insufficient_quota") ||
    m.includes("insufficient quota") ||
    m.includes("quota") ||
    m.includes("billing") ||
    m.includes("rate limit") ||
    m.includes("overloaded") ||
    m.includes("capacity")
  );
}

export async function aiComplete(options: {
  module: string;
  messages: AiMessage[];
  serviceId?: string;
  serviceName?: string;
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
}): Promise<{ text: string; model: string | null; service: string }> {
  // `serviceId` is an exact match against api_services.id; `serviceName` is a
  // fuzzy ilike("name", ...) fallback. Passing an id as `serviceName` would
  // silently miss the row and fall through to "any active AI service".
  const targets = await resolveAiTargets(
    options.serviceId
      ? { serviceId: options.serviceId, serviceName: options.serviceName }
      : options.serviceName,
  );

  // Every attempt is metered, including the ones that fail, because a request
  // that was sent and refused still happened and the usage screen should say
  // so. The failures are collected so the final error names each provider
  // rather than reporting only the last one.
  const attempts: string[] = [];
  for (let i = 0; i < targets.length; i += 1) {
    const target = targets[i];
    const isLast = i === targets.length - 1;
    try {
      return await callTarget(target, options);
    } catch (problem) {
      const status = problem instanceof AiProviderError ? problem.status : 0;
      const message = problem instanceof Error ? problem.message : String(problem);
      attempts.push(`${target.serviceName}: ${message}`);
      if (isLast || !providerCouldBeSwapped(status, message)) {
        throw new Error(
          attempts.length === 1 ? attempts[0] : `Every AI service refused. ${attempts.join(" | ")}`,
        );
      }
    }
  }
  // resolveAiTargets never returns an empty list; it throws instead.
  throw new Error("No AI service was available.");
}

/** Carries the provider's HTTP status so the caller can tell why it failed. */
class AiProviderError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AiProviderError";
    this.status = status;
  }
}

/** One request to one provider. Unchanged from what the gateway always sent. */
async function callTarget(
  target: AiTarget,
  options: {
    module: string;
    messages: AiMessage[];
    temperature?: number;
    maxTokens?: number;
    json?: boolean;
  },
): Promise<{ text: string; model: string | null; service: string }> {
  const started = Date.now();

  const system = options.messages.find((m) => m.role === "system")?.content;
  const rest = options.messages.filter((m) => m.role !== "system");

  const headers: Record<string, string> = { "content-type": "application/json" };
  let body: Record<string, unknown>;
  let resolvedModel: string;

  if (target.isAnthropic) {
    resolvedModel = target.modelId ?? "claude-3-5-sonnet-latest";
    headers["x-api-key"] = target.credential;
    headers["anthropic-version"] = "2023-06-01";
    body = {
      model: resolvedModel,
      max_tokens: options.maxTokens ?? 1200,
      system,
      messages: rest,
    };
  } else {
    resolvedModel = target.modelId ?? "gpt-4o-mini";
    headers.authorization = `Bearer ${target.credential}`;
    body = {
      model: resolvedModel,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 1200,
      messages: options.messages,
    };
    if (options.json) body.response_format = { type: "json_object" };
  }

  const response = await fetch(target.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  type ProviderError = { message?: string };
  type ProviderResponse = {
    content?: { type?: string; text?: string }[];
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    stop_reason?: string;
    usage?: Record<string, unknown>;
    model?: string;
    error?: ProviderError | ProviderError[];
  };
  const result = (await response.json().catch(() => ({}))) as ProviderResponse;
  const text = target.isAnthropic
    ? result.content?.find((item) => item.type === "text")?.text
    : result.choices?.[0]?.message?.content;

  // A model that runs out of room stops mid-sentence, and the caller then
  // reports whatever it could not parse — "the answer was not valid JSON" for
  // a JSON request. That hides the real cause, which is a token limit, so the
  // gateway names it. Anthropic calls it stop_reason, OpenAI finish_reason.
  const cutOff =
    result.stop_reason === "max_tokens" || result.choices?.[0]?.finish_reason === "length";

  await meter(
    target,
    options.module,
    started,
    response.status,
    response.ok,
    result.usage,
    resolvedModel,
  );

  if (response.ok && text && cutOff) {
    throw new AiProviderError(
      "The AI provider ran out of room and stopped mid-answer. Ask for fewer " +
        "fields or raise maxTokens for this call.",
      response.status,
    );
  }

  if (!response.ok || !text) {
    const providerError = Array.isArray(result.error)
      ? result.error[0]?.message
      : result.error?.message;
    throw new AiProviderError(
      providerError ?? `The AI provider returned HTTP ${response.status}.`,
      response.status,
    );
  }
  const reportedModel =
    typeof result.model === "string" && result.model ? result.model : resolvedModel;
  return { text: String(text), model: reportedModel, service: target.serviceName };
}

/**
 * A streamed chat, for the assistant route.
 *
 * The body is handed back untouched so the caller can pipe it straight to the
 * browser as server-sent events, exactly as the Lovable path did.
 */
/**
 * A streamed answer, from the first AI service that can actually give one.
 *
 * This used to take resolveAiTarget() - the single best service - and return
 * whatever it said, including its refusal. aiComplete has tried every active
 * service since it was written, and the difference showed the day it mattered:
 * Anthropic answered "Your credit balance is too low", and because Anthropic
 * sorts first by name, VALA and every other streamed assistant was dead while
 * an active, approved, credentialled OpenAI service sat next to it unused.
 *
 * The rule for when to move on is providerCouldBeSwapped, unchanged and shared
 * with aiComplete: billing, quota, rate limit, overload and server faults are
 * worth trying elsewhere; a malformed prompt is not, and is returned as it is.
 * Every attempt is metered, including the refusals, because a request that was
 * sent and refused still happened.
 */
export async function aiStream(options: {
  module: string;
  messages: AiMessage[];
  serviceName?: string;
}): Promise<Response> {
  const targets = await resolveAiTargets(options.serviceName);
  const attempts: string[] = [];

  for (let i = 0; i < targets.length; i += 1) {
    const target = targets[i];
    const isLast = i === targets.length - 1;
    const response = await streamFromTarget(target, options);
    if (response.ok) return response.stream;

    attempts.push(`${target.serviceName}: ${response.detail}`);
    if (isLast || !providerCouldBeSwapped(response.status, response.detail)) {
      return new Response(
        attempts.length === 1
          ? response.detail
          : `Every AI service refused. ${attempts.join(" | ")}`,
        { status: response.status || 502 },
      );
    }
  }
  // resolveAiTargets never returns an empty list; it throws instead.
  return new Response("No AI service was available.", { status: 503 });
}

/** One provider's attempt at a streamed answer. */
async function streamFromTarget(
  target: AiTarget,
  options: { module: string; messages: AiMessage[] },
): Promise<{ ok: true; stream: Response } | { ok: false; status: number; detail: string }> {
  const started = Date.now();

  const headers: Record<string, string> = { "content-type": "application/json" };
  let body: Record<string, unknown>;

  if (target.isAnthropic) {
    headers["x-api-key"] = target.credential;
    headers["anthropic-version"] = "2023-06-01";
    const system = options.messages.find((m) => m.role === "system")?.content;
    body = {
      model: target.modelId ?? "claude-3-5-sonnet-latest",
      max_tokens: 1200,
      system,
      stream: true,
      messages: options.messages.filter((m) => m.role !== "system"),
    };
  } else {
    headers.authorization = `Bearer ${target.credential}`;
    body = {
      model: target.modelId ?? "gpt-4o-mini",
      stream: true,
      messages: options.messages,
    };
  }

  const upstream = await fetch(target.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  void meter(target, options.module, started, upstream.status, upstream.ok);

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return {
      ok: false,
      status: upstream.status || 502,
      detail: detail || "The AI request failed.",
    };
  }

  return {
    ok: true,
    stream: new Response(upstream.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    }),
  };
}
