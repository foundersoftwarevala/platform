/**
 * The AI provider adapter.
 *
 * Sections 23, 51 and 52 ask for a real provider abstraction with a real
 * request behind it, and for the module to say AI PROVIDER NOT CONFIGURED
 * rather than pretend when there is nothing to call. Both halves are here.
 *
 * Nothing in this file may reach a browser. It reads credentials from the
 * server environment and it holds the request shape for each provider; the
 * system prompt arrives from the database and leaves again in the request body
 * and nowhere else.
 *
 * What is actually configured, checked before this was written: the AI API
 * Manager registers twelve providers, three of them usable for content
 * generation, and none of them has a credential. api_keys holds fifteen rows
 * and not one carries a secret of plausible length; no provider environment
 * variable is set on the server. So `configure` returns NOT_CONFIGURED today,
 * and the moment somebody sets OPENAI_API_KEY (or the variable named by
 * whichever provider is selected) the same code path makes a real call.
 */

export type ProviderBinding = {
  ok?: boolean;
  provider_slug?: string | null;
  provider_name?: string | null;
  provider_status?: string | null;
  content_generation_enabled?: boolean;
  base_url?: string | null;
  api_kind?: string | null;
  /** The NAME of the environment variable. Never a value. */
  credential_env?: string | null;
  model_id?: string | null;
  temperature?: number;
  max_output_tokens?: number;
  timeout_ms?: number;
  stored_key_present?: boolean;
};

export type GenerationUsage = {
  tokens_in?: number;
  tokens_out?: number;
  cost_usd?: number;
  /** False whenever the provider reported no figures. Never guessed. */
  usage_available: boolean;
  cost_available: boolean;
  latency_ms: number;
};

export type GenerationOutcome =
  | { ok: true; parsed: Record<string, unknown>; raw: unknown; usage: GenerationUsage }
  | {
      ok: false;
      code: string;
      detail: string;
      http_status?: number;
      raw?: unknown;
      usage: GenerationUsage;
      /** NOT_CONFIGURED is not a failure of the request; it is the absence of one. */
      status: "FAILED" | "REJECTED_OUTPUT" | "NOT_CONFIGURED";
    };

/** The contract a provider satisfies. Adding one means adding a case here. */
export type AiProvider = {
  slug: string;
  kind: string;
  /** Whether a credential is actually present for this provider on this server. */
  configured: boolean;
  credentialEnv: string | null;
  generateContent(system: string, user: string, signal: AbortSignal): Promise<Response>;
  /** Pulls the model's text out of whatever envelope the provider uses. */
  extractText(body: unknown): string | null;
  /** Pulls usage out of the envelope, or reports that there was none. */
  extractUsage(body: unknown): { tokens_in?: number; tokens_out?: number; available: boolean };
};

function credential(name: string | null | undefined): string | null {
  if (!name) return null;
  // Only names matching this shape are read, so a bad registry row cannot make
  // the server dump an arbitrary part of its environment.
  if (!/^[A-Z][A-Z0-9_]{2,63}$/.test(name)) return null;
  const value = process.env[name];
  return value && value.trim().length >= 20 ? value.trim() : null;
}

export function buildProvider(binding: ProviderBinding): AiProvider | null {
  const slug = binding.provider_slug ?? "";
  const kind = binding.api_kind ?? "";
  const base = (binding.base_url ?? "").replace(/\/+$/, "");
  const model = binding.model_id ?? "";
  const key = credential(binding.credential_env);
  const temperature = binding.temperature ?? 0.2;
  const maxTokens = binding.max_output_tokens ?? 2400;

  if (kind === "anthropic") {
    return {
      slug, kind, configured: Boolean(key), credentialEnv: binding.credential_env ?? null,
      generateContent: (system, user, signal) =>
        fetch(`${base}/messages`, {
          method: "POST",
          signal,
          headers: {
            "content-type": "application/json",
            "x-api-key": key ?? "",
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model, max_tokens: maxTokens, temperature, system,
            messages: [{ role: "user", content: user }],
          }),
        }),
      extractText: (body) => {
        const content = (body as { content?: { type?: string; text?: string }[] })?.content;
        if (!Array.isArray(content)) return null;
        const text = content.filter((c) => c?.type === "text").map((c) => c.text ?? "").join("");
        return text || null;
      },
      extractUsage: (body) => {
        const u = (body as { usage?: { input_tokens?: number; output_tokens?: number } })?.usage;
        if (!u) return { available: false };
        return { tokens_in: u.input_tokens, tokens_out: u.output_tokens, available: true };
      },
    };
  }

  if (kind === "openai_compatible") {
    return {
      slug, kind, configured: Boolean(key), credentialEnv: binding.credential_env ?? null,
      generateContent: (system, user, signal) =>
        fetch(`${base}/chat/completions`, {
          method: "POST",
          signal,
          headers: { "content-type": "application/json", authorization: `Bearer ${key ?? ""}` },
          body: JSON.stringify({
            model, temperature, max_tokens: maxTokens,
            // 24. Structured output is requested rather than hoped for.
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
          }),
        }),
      extractText: (body) => {
        const choice = (body as { choices?: { message?: { content?: string } }[] })?.choices?.[0];
        return choice?.message?.content ?? null;
      },
      extractUsage: (body) => {
        const u = (body as { usage?: { prompt_tokens?: number; completion_tokens?: number } })?.usage;
        if (!u) return { available: false };
        return { tokens_in: u.prompt_tokens, tokens_out: u.completion_tokens, available: true };
      },
    };
  }

  return null;
}

/**
 * 24/30. The model's answer, parsed and checked before it is allowed anywhere
 * near the database. A fenced block is unwrapped because providers add one even
 * when asked not to; anything else that is not an object is rejected outright
 * rather than coerced into looking like a success.
 */
export function parseStructured(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const unfenced = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim()
    : trimmed;

  const attempt = (candidate: string): Record<string, unknown> | null => {
    try {
      const value: unknown = JSON.parse(candidate);
      return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  };

  const direct = attempt(unfenced);
  if (direct) return direct;

  // Some providers wrap the object in a sentence. Take the outermost braces.
  const first = unfenced.indexOf("{");
  const last = unfenced.lastIndexOf("}");
  if (first >= 0 && last > first) return attempt(unfenced.slice(first, last + 1));
  return null;
}

/**
 * One real generation. Every branch out of this function is honest about what
 * happened: a missing credential, a refused request, a rate limit, a timeout, a
 * response that was not JSON. None of them returns content.
 */
export async function generate(
  binding: ProviderBinding,
  system: string,
  user: string,
): Promise<GenerationOutcome> {
  const started = Date.now();
  const none: GenerationUsage = {
    usage_available: false, cost_available: false, latency_ms: 0,
  };

  if (!binding?.ok || !binding.provider_slug) {
    return {
      ok: false, status: "NOT_CONFIGURED", code: "AI_PROVIDER_NOT_CONFIGURED",
      detail: "No AI provider is selected for content generation.",
      usage: { ...none, latency_ms: Date.now() - started },
    };
  }
  if (!binding.content_generation_enabled) {
    return {
      ok: false, status: "NOT_CONFIGURED", code: "AI_PROVIDER_NOT_ENABLED",
      detail: `${binding.provider_name ?? binding.provider_slug} is registered but is not enabled for content generation.`,
      usage: { ...none, latency_ms: Date.now() - started },
    };
  }

  const provider = buildProvider(binding);
  if (!provider) {
    return {
      ok: false, status: "NOT_CONFIGURED", code: "AI_PROVIDER_NOT_CONFIGURED",
      detail: `No adapter exists for the API kind "${binding.api_kind ?? "unset"}". Set it in the AI API Manager.`,
      usage: { ...none, latency_ms: Date.now() - started },
    };
  }
  if (!provider.configured) {
    return {
      ok: false, status: "NOT_CONFIGURED", code: "AI_PROVIDER_NOT_CONFIGURED",
      // The variable's name is useful and safe to say. Its value is not read here.
      detail: `AI PROVIDER NOT CONFIGURED — ${binding.provider_name ?? provider.slug} has no credential on this server. Set ${binding.credential_env ?? "the provider's credential environment variable"} and restart the application.`,
      usage: { ...none, latency_ms: Date.now() - started },
    };
  }
  if (!binding.model_id) {
    return {
      ok: false, status: "NOT_CONFIGURED", code: "AI_MODEL_NOT_SELECTED",
      detail: "No model is selected. Choose one in the generator settings.",
      usage: { ...none, latency_ms: Date.now() - started },
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), binding.timeout_ms ?? 60000);

  let response: Response;
  try {
    response = await provider.generateContent(system, user, controller.signal);
  } catch (error) {
    clearTimeout(timer);
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ok: false, status: "FAILED",
      code: aborted ? "AI_TIMEOUT" : "AI_REQUEST_FAILED",
      detail: aborted
        ? `The provider did not answer within ${binding.timeout_ms ?? 60000}ms.`
        : `The request to ${provider.slug} could not be made: ${error instanceof Error ? error.message : String(error)}`,
      usage: { ...none, latency_ms: Date.now() - started },
    };
  }
  clearTimeout(timer);

  const latency = Date.now() - started;
  const text = await response.text();
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }

  if (!response.ok) {
    // A provider error message can quote the request, so only the provider's
    // own error text is kept and it is truncated.
    const message =
      (body as { error?: { message?: string } })?.error?.message ??
      (body as { message?: string })?.message ??
      text.slice(0, 300);
    return {
      ok: false, status: "FAILED",
      code:
        response.status === 429 ? "AI_RATE_LIMITED"
        : response.status === 401 || response.status === 403 ? "AI_CREDENTIAL_REJECTED"
        : response.status >= 500 ? "AI_PROVIDER_UNAVAILABLE"
        : "AI_REQUEST_REJECTED",
      detail: message,
      http_status: response.status,
      usage: { ...none, latency_ms: latency },
    };
  }

  const usageRaw = provider.extractUsage(body);
  const usage: GenerationUsage = {
    tokens_in: usageRaw.tokens_in,
    tokens_out: usageRaw.tokens_out,
    usage_available: usageRaw.available,
    // 27. No cost is calculated from a price list here. If the provider does
    // not bill in the response, the console says UNAVAILABLE.
    cost_available: false,
    latency_ms: latency,
  };

  const content = provider.extractText(body);
  if (!content) {
    return {
      ok: false, status: "REJECTED_OUTPUT", code: "AI_EMPTY_RESPONSE",
      detail: "The provider returned no content.",
      http_status: response.status, usage,
    };
  }

  const parsed = parseStructured(content);
  if (!parsed) {
    return {
      ok: false, status: "REJECTED_OUTPUT", code: "AI_MALFORMED_RESPONSE",
      detail: "The provider's answer was not the JSON object the prompt requires.",
      http_status: response.status, usage,
      raw: { text: content.slice(0, 2000) },
    };
  }

  return { ok: true, parsed, raw: { text: content.slice(0, 8000) }, usage };
}

/**
 * 2/25. The user half of the request: the verified product record, the blocks
 * being asked for, the brand voice and the template's structure. Every fact in
 * here came out of marketplace_products, and the fields the product does not
 * carry are listed by name so the model is told to say so rather than fill in.
 */
export function buildUserMessage(input: {
  context: Record<string, unknown>;
  types: string[];
  language: string;
  brandVoice: Record<string, unknown>;
  limits: Record<string, unknown>;
}): string {
  const ctx = input.context as {
    product_name?: string;
    facts?: Record<string, unknown>;
    missing_fields?: string[];
    template_label?: string;
    template_structure?: { long_sections?: string[] };
    template_guidance?: string;
  };

  const keyFor: Record<string, string> = {
    summary: "summary",
    short_description: "shortDescription",
    long_description: "longDescription",
    seo_description: "seoDescription",
    meta_keywords: "keywords",
    faq: "faq",
    features: "features",
    benefits: "benefits",
    use_cases: "useCases",
  };

  const limits = input.limits as Record<string, { min?: number; max?: number }>;
  const requested = input.types
    .map((t) => {
      const limit = limits?.[t];
      const bound =
        t === "meta_keywords" || t === "faq" || t === "features" || t === "benefits" || t === "use_cases"
          ? `${limit?.min ?? 3} to ${limit?.max ?? 12} entries`
          : `${limit?.min ?? 60} to ${limit?.max ?? 600} characters`;
      return `- ${keyFor[t]} (${bound})`;
    })
    .join("\n");

  const sections = ctx.template_structure?.long_sections?.length
    ? `\nSTRUCTURE FOR longDescription (${ctx.template_label ?? "general"})\n${ctx.template_structure.long_sections
        .map((s) => `- ${s}`)
        .join("\n")}\n${ctx.template_guidance ? `\n${ctx.template_guidance}\n` : ""}`
    : "";

  const missing = ctx.missing_fields?.length
    ? `\nFIELDS THE PRODUCT RECORD DOES NOT CARRY\n${ctx.missing_fields
        .map((f) => `- ${f}`)
        .join("\n")}\nWhere the copy would need one of these, write exactly: Information not available in verified product data.\n`
    : "";

  return [
    `LANGUAGE\nWrite in ${input.language === "hi" ? "Hindi" : "English"}.`,
    `\nVERIFIED PRODUCT DATA\n${JSON.stringify(ctx.facts ?? {}, null, 2)}`,
    missing,
    `\nBRAND VOICE (tone only, never a fact)\n${JSON.stringify(input.brandVoice ?? {}, null, 2)}`,
    sections,
    `\nREQUESTED BLOCKS\n${requested}`,
    `\nReturn one JSON object containing exactly these keys and nothing else.`,
  ].join("\n");
}
