import { getSettings } from "./settings.server.ts";
import { ValaError } from "./util.server.ts";

/**
 * The self-hosted model, reached over llama.cpp's OpenAI-compatible server.
 *
 * There is no external provider and no fallback: if the local server is not
 * answering, callers get MODEL_OFFLINE and the task is BLOCKED with that
 * reason. Settings only accept a loopback or private-network URL.
 */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type ModelReply = {
  text: string;
  model: string;
  tokensIn: number | null;
  tokensOut: number | null;
  durationMs: number;
};
export type ModelStatus = {
  online: boolean;
  url: string;
  model: string | null;
  error: string | null;
  checkedAt: string;
};

export class ModelOfflineError extends ValaError {
  constructor(detail: string) {
    super(503, `Local model is offline: ${detail}`);
  }
}

export async function modelStatus(): Promise<ModelStatus> {
  const url = getSettings().model_url;
  const checkedAt = new Date().toISOString();
  try {
    const health = await fetch(`${url}/health`, { signal: AbortSignal.timeout(4000) });
    if (!health.ok)
      return {
        online: false,
        url,
        model: null,
        error: `health returned HTTP ${health.status}`,
        checkedAt,
      };
    const models = await fetch(`${url}/v1/models`, { signal: AbortSignal.timeout(4000) });
    const body = (await models.json().catch(() => null)) as { data?: { id?: string }[] } | null;
    return { online: true, url, model: body?.data?.[0]?.id ?? null, error: null, checkedAt };
  } catch (e) {
    return { online: false, url, model: null, error: (e as Error).message, checkedAt };
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
  let value: unknown;
  try {
    value = JSON.parse(reply.text);
  } catch {
    throw new ValaError(502, "Local model returned malformed JSON.");
  }
  const required = (schema.required as string[] | undefined) ?? [];
  if (
    typeof value !== "object" ||
    value === null ||
    required.some((k) => !(k in (value as object)))
  )
    throw new ValaError(502, "Local model's JSON is missing required fields.");
  return { value: value as T, reply };
}
