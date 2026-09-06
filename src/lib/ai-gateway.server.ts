import { createClient } from "@supabase/supabase-js";

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

/** Anything registered in AI API Manager that can answer a chat completion. */
export async function resolveAiTarget(serviceName?: string): Promise<AiTarget> {
  const db = serverClient() as ReturnType<typeof createClient>;

  let row: Record<string, unknown> | null = null;
  if (serviceName) {
    const { data } = await db
      .from("api_services")
      .select("id, name, provider_id, endpoint_url, status, category")
      .ilike("name", `%${serviceName}%`)
      .eq("status", "active")
      .limit(1);
    row = (data?.[0] as Record<string, unknown>) ?? null;
  }
  if (!row) {
    // Any active AI service will do; the operator decides which by activating it.
    const { data } = await db
      .from("api_services")
      .select("id, name, provider_id, endpoint_url, status, category")
      .eq("status", "active")
      .in("category", ["ai", "llm"])
      .order("name")
      .limit(20);
    // Prefer a chat/completions endpoint over an embeddings or audio one.
    row =
      ((data ?? []).find((s) =>
        String((s as { endpoint_url?: string }).endpoint_url ?? "").match(
          /chat\/completions|\/v1\/messages/,
        ),
      ) as Record<string, unknown>) ?? null;
  }

  if (!row) {
    throw new Error(
      "No active AI service is configured in AI API Manager. Add one to enable AI features.",
    );
  }

  const endpoint = String(row["endpoint_url"] ?? "");
  if (!endpoint) {
    throw new Error(`AI service ${row["name"]} has no execution endpoint configured.`);
  }
  if (/lovable/i.test(endpoint)) {
    // Retired vendor. Failing clearly beats posting to a host that no longer
    // answers for this platform.
    throw new Error(
      `AI service ${row["name"]} still points at the retired Lovable gateway. ` +
        "Repoint it in AI API Manager.",
    );
  }

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

  const envKey = providerSlug.includes("anthropic")
    ? process.env.ANTHROPIC_API_KEY
    : providerSlug.includes("google")
      ? process.env.GOOGLE_API_KEY
      : process.env.OPENAI_API_KEY;
  const stored = (keyRows?.[0] as { secret_encrypted?: string } | undefined)?.secret_encrypted;
  const credential =
    envKey ||
    (typeof stored === "string" && /^(sk-|key-|AIza|anthropic)/i.test(stored) ? stored : "");

  if (!credential) {
    throw new Error(
      `No production credential is configured for ${row["name"]}. ` +
        "Add it in AI API Manager or in the server environment.",
    );
  }

  return {
    serviceId: String(row["id"]),
    serviceName: String(row["name"]),
    endpoint,
    credential,
    providerSlug,
    modelId: (model as { model_id?: string } | null)?.model_id ?? null,
    modelRowId: (model as { id?: string } | null)?.id ?? null,
    isAnthropic: providerSlug.includes("anthropic"),
  };
}

async function meter(
  target: AiTarget,
  module: string,
  started: number,
  status: number,
  ok: boolean,
  usage?: Record<string, unknown>,
) {
  try {
    const db = serverClient();
    await db.from("usage_events").insert({
      service_id: target.serviceId,
      model_id: target.modelRowId,
      product: module,
      requests: 1,
      tokens_in: Number(usage?.["input_tokens"] ?? usage?.["prompt_tokens"] ?? 0),
      tokens_out: Number(usage?.["output_tokens"] ?? usage?.["completion_tokens"] ?? 0),
      latency_ms: Date.now() - started,
      status_code: status,
      success: ok,
      source: "ai-gateway",
    });
  } catch {
    // Metering must never be the reason a feature fails.
  }
}

export type AiMessage = { role: "system" | "user" | "assistant"; content: string };

/** A single completion. Returns the text, or throws with the provider's reason. */
export async function aiComplete(options: {
  module: string;
  messages: AiMessage[];
  serviceName?: string;
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
}): Promise<{ text: string; model: string | null; service: string }> {
  const target = await resolveAiTarget(options.serviceName);
  const started = Date.now();

  const system = options.messages.find((m) => m.role === "system")?.content;
  const rest = options.messages.filter((m) => m.role !== "system");

  const headers: Record<string, string> = { "content-type": "application/json" };
  let body: Record<string, unknown>;

  if (target.isAnthropic) {
    headers["x-api-key"] = target.credential;
    headers["anthropic-version"] = "2023-06-01";
    body = {
      model: target.modelId ?? "claude-3-5-sonnet-latest",
      max_tokens: options.maxTokens ?? 1200,
      system,
      messages: rest,
    };
  } else {
    headers.authorization = `Bearer ${target.credential}`;
    body = {
      model: target.modelId ?? "gpt-4o-mini",
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
  const result = (await response.json().catch(() => ({}))) as Record<string, any>;
  const text = target.isAnthropic
    ? result.content?.find((c: any) => c.type === "text")?.text
    : result.choices?.[0]?.message?.content;

  await meter(target, options.module, started, response.status, response.ok, result.usage);

  if (!response.ok || !text) {
    throw new Error(
      result.error?.message ??
        result.error?.[0]?.message ??
        `The AI provider returned HTTP ${response.status}.`,
    );
  }
  return { text: String(text), model: target.modelId, service: target.serviceName };
}

/**
 * A streamed chat, for the assistant route.
 *
 * The body is handed back untouched so the caller can pipe it straight to the
 * browser as server-sent events, exactly as the Lovable path did.
 */
export async function aiStream(options: {
  module: string;
  messages: AiMessage[];
  serviceName?: string;
}): Promise<Response> {
  const target = await resolveAiTarget(options.serviceName);
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
    return new Response(detail || "The AI request failed.", {
      status: upstream.status || 502,
    });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
