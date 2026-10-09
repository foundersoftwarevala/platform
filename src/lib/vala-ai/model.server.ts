import { getSettings } from "./settings.server.ts";
import { ValaError } from "./util.server.ts";

/**
 * The model behind the agent, from one of two sources (Settings → model_source):
 *
 *   local           the self-hosted llama.cpp server at model_url (loopback or
 *                   private network only), schema-constrained JSON.
 *   ai-api-manager  the platform's AI API Manager gateway (`aiComplete`), which
 *                   owns providers, models and encrypted keys and meters every
 *                   call into usage_events. Vala AI stores no key or URL for it.
 *
 * There is no fallback between sources and no canned answer. A source that is
 * unavailable or misconfigured raises ModelUnavailableError and the task waits
 * as BLOCKED with the reason; a provider that answers wrongly fails the step.
 */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type ModelSource = "local" | "ai-api-manager";
export type ModelReply = {
  text: string;
  model: string;
  source: ModelSource;
  /** The AI API Manager service that answered, for the gateway source. */
  service: string | null;
  /** Null when the source does not report them; the gateway records usage in usage_events. */
  tokensIn: number | null;
  tokensOut: number | null;
  durationMs: number;
};
export type ModelStatus = {
  online: boolean;
  source: ModelSource;
  url: string;
  model: string | null;
  service: string | null;
  error: string | null;
  checkedAt: string;
};

/** The model cannot be reached or is not set up: the task should wait, not fail. */
export class ModelUnavailableError extends ValaError {
  constructor(message: string) {
    super(503, message);
  }
}

export class ModelOfflineError extends ModelUnavailableError {
  constructor(detail: string) {
    super(`Local model is offline: ${detail}`);
  }
}

type Gateway = typeof import("@/lib/ai-gateway.server");
const gateway = (): Promise<Gateway> => import("@/lib/ai-gateway.server");

/** Sorts a gateway failure into "set it up / wait" (BLOCKED) or "this answer was wrong" (FAILED). */
export function classifyGatewayError(message: string): ValaError {
  const m = message.toLowerCase();
  if (
    /no active ai service|not registered in ai api manager|no ai service could be used|not configured|encryption_key|credential|api key is missing|no key/.test(
      m,
    )
  )
    return new ModelUnavailableError(`AI API Manager is not ready: ${message}`);
  if (
    /\b401\b|\b403\b|unauthori[sz]ed|forbidden|invalid api key|incorrect api key|invalid x-api-key|authentication/.test(
      m,
    )
  )
    return new ModelUnavailableError(
      `AI API Manager's provider rejected the credentials: ${message}`,
    );
  if (/\b402\b|\b429\b|rate limit|quota|billing|credit balance|overloaded|capacity/.test(m))
    return new ModelUnavailableError(
      `AI API Manager's provider is limiting requests; resume the task later: ${message}`,
    );
  return new ValaError(502, `AI API Manager request failed: ${message}`);
}

export async function modelStatus(): Promise<ModelStatus> {
  const settings = getSettings();
  const checkedAt = new Date().toISOString();
  const source = settings.model_source as ModelSource;
  if (source === "ai-api-manager") {
    // Resolving the service reads AI API Manager's configuration and decrypts
    // the key on the server; it does not send a (paid) request to the provider.
    try {
      const { resolveAiTarget } = await gateway();
      const target = await resolveAiTarget(
        settings.gateway_service ? { serviceId: settings.gateway_service } : undefined,
      );
      return {
        online: true,
        source,
        url: "AI API Manager",
        model: target.modelId,
        service: target.serviceName,
        error: null,
        checkedAt,
      };
    } catch (e) {
      return {
        online: false,
        source,
        url: "AI API Manager",
        model: null,
        service: null,
        error: (e as Error).message,
        checkedAt,
      };
    }
  }
  const url = settings.model_url;
  try {
    const health = await fetch(`${url}/health`, { signal: AbortSignal.timeout(4000) });
    if (!health.ok)
      return {
        online: false,
        source,
        url,
        model: null,
        service: null,
        error: `health returned HTTP ${health.status}`,
        checkedAt,
      };
    const models = await fetch(`${url}/v1/models`, { signal: AbortSignal.timeout(4000) });
    const body = (await models.json().catch(() => null)) as { data?: { id?: string }[] } | null;
    return {
      online: true,
      source,
      url,
      model: body?.data?.[0]?.id ?? null,
      service: null,
      error: null,
      checkedAt,
    };
  } catch (e) {
    return {
      online: false,
      source,
      url,
      model: null,
      service: null,
      error: (e as Error).message,
      checkedAt,
    };
  }
}

/** The services AI API Manager can route a chat completion to, without their credentials. */
export async function gatewayServices(): Promise<{
  available: boolean;
  services: { id: string; name: string; provider: string; model: string | null }[];
  error: string | null;
}> {
  try {
    const { resolveAiTargets } = await gateway();
    const targets = await resolveAiTargets();
    return {
      available: true,
      services: targets.map((t) => ({
        id: t.serviceId,
        name: t.serviceName,
        provider: t.providerSlug,
        model: t.modelId,
      })),
      error: null,
    };
  } catch (e) {
    return { available: false, services: [], error: (e as Error).message };
  }
}

async function chatViaGateway(
  messages: ChatMessage[],
  opts: {
    schema?: Record<string, unknown>;
    maxTokens?: number;
    temperature?: number;
    signal?: AbortSignal;
  },
): Promise<ModelReply> {
  const settings = getSettings();
  const started = Date.now();
  // The provider's JSON mode does not enforce a schema, so the schema is stated
  // in the instructions and the reply is still validated by chatJson().
  const withSchema = opts.schema
    ? messages.map((m, i) =>
        i === 0 && m.role === "system"
          ? {
              ...m,
              content: `${m.content}\n\nReply with one JSON object that matches this JSON Schema exactly:\n${JSON.stringify(opts.schema)}`,
            }
          : m,
      )
    : messages;
  const { aiComplete } = await gateway();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new ValaError(504, `AI API Manager did not answer within ${settings.model_timeout_s}s.`),
        ),
      settings.model_timeout_s * 1000,
    );
  });
  const cancelled = new Promise<never>((_, reject) => {
    if (opts.signal?.aborted) reject(new ValaError(499, "Cancelled."));
    opts.signal?.addEventListener("abort", () => reject(new ValaError(499, "Cancelled.")), {
      once: true,
    });
  });
  // Whichever loses the race must not surface later as an unhandled rejection.
  timeout.catch(() => {});
  cancelled.catch(() => {});
  try {
    const r = await Promise.race([
      aiComplete({
        module: "vala-ai",
        messages: withSchema,
        json: Boolean(opts.schema),
        maxTokens: opts.maxTokens ?? settings.model_max_tokens,
        temperature: opts.temperature ?? 0.2,
        ...(settings.gateway_service ? { serviceId: settings.gateway_service } : {}),
      }),
      timeout,
      cancelled,
    ]);
    if (typeof r?.text !== "string" || !r.text)
      throw new ValaError(502, "AI API Manager returned no text.");
    return {
      text: r.text,
      model: r.model ?? "unknown",
      source: "ai-api-manager",
      service: r.service ?? null,
      tokensIn: null,
      tokensOut: null,
      durationMs: Date.now() - started,
    };
  } catch (e) {
    if (e instanceof ValaError) throw e;
    throw classifyGatewayError((e as Error).message ?? String(e));
  } finally {
    clearTimeout(timer);
  }
}

export async function chat(
  messages: ChatMessage[],
  opts: {
    schema?: Record<string, unknown>;
    maxTokens?: number;
    temperature?: number;
    signal?: AbortSignal;
  } = {},
): Promise<ModelReply> {
  const settings = getSettings();
  if (settings.model_source === "ai-api-manager") return chatViaGateway(messages, opts);
  const started = Date.now();
  const signals = [AbortSignal.timeout(settings.model_timeout_s * 1000)];
  if (opts.signal) signals.push(opts.signal);
  let res: Response;
  try {
    res = await fetch(`${settings.model_url}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.any(signals),
      body: JSON.stringify({
        messages,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? settings.model_max_tokens,
        ...(opts.schema ? { response_format: { type: "json_object", schema: opts.schema } } : {}),
      }),
    });
  } catch (e) {
    if (opts.signal?.aborted) throw new ValaError(499, "Cancelled.");
    const err = e as Error;
    if (err.name === "TimeoutError")
      throw new ValaError(504, `Local model did not answer within ${settings.model_timeout_s}s.`);
    throw new ModelOfflineError(err.message);
  }
  const body = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
    model?: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    error?: { message?: string };
  } | null;
  if (!res.ok)
    throw new ValaError(
      502,
      `Local model error (HTTP ${res.status}): ${body?.error?.message ?? "no detail"}`,
    );
  const text = body?.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new ValaError(502, "Local model returned no text.");
  return {
    text,
    model: body?.model ?? "unknown",
    source: "local",
    service: null,
    tokensIn: body?.usage?.prompt_tokens ?? null,
    tokensOut: body?.usage?.completion_tokens ?? null,
    durationMs: Date.now() - started,
  };
}

/** A schema-constrained call whose result is parsed and shape-checked. */
export async function chatJson<T>(
  messages: ChatMessage[],
  schema: Record<string, unknown>,
  opts: { maxTokens?: number; signal?: AbortSignal } = {},
): Promise<{ value: T; reply: ModelReply }> {
  const reply = await chat(messages, { ...opts, schema });
  const who = reply.source === "local" ? "Local model" : "AI API Manager";
  let value: unknown;
  try {
    value = JSON.parse(reply.text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new ValaError(502, `${who} returned malformed JSON.`);
  }
  const required = (schema.required as string[] | undefined) ?? [];
  if (
    typeof value !== "object" ||
    value === null ||
    required.some((k) => !(k in (value as object)))
  )
    throw new ValaError(502, `${who}'s JSON is missing required fields.`);
  return { value: value as T, reply };
}
