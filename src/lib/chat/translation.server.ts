import { count, observe } from "@/lib/i18n/metrics.server";
import { resolveLanguage } from "@/lib/i18n/registry";
import {
  CANONICAL,
  TranslationFailure,
  ensureTranslation,
  mapPool,
  type Detection,
  type FinishInput,
  type TranslationDeps,
  type TranslationRow,
  type TranslationView,
  type Translated,
} from "@/lib/chat/translation.core";

/**
 * The production wiring of the Chat translation core:
 *  - rows: the chat_message_translations table through the claim/finish
 *    functions (service role), so two instances never translate a message twice;
 *  - detection: the translation engine's own /v1/detect (fastText lid.176);
 *  - translation: the platform's translation pipeline (src/lib/i18n), which owns
 *    provider failover, validation, glossary and the engine-character quota.
 *
 * Nothing here translates anything itself.
 */

/** A whole translation call may take this long before it is retried later. */
const DEADLINE_MS = Number(process.env.CHAT_TRANSLATE_DEADLINE_MS || 25_000);
const DETECT_TIMEOUT_MS = 3_000;
const CONCURRENCY = 4;

/** Per-process backpressure; the engine has its own queue behind this. */
const inflight = {
  value: 0,
  limit: Number(process.env.CHAT_TRANSLATE_MAX_INFLIGHT || 16),
};

type RpcClient = {
  rpc: (
    fn: "chat_translation_claim" | "chat_translation_finish",
    args: {
      p_message: string;
      p_target: string;
      p_retry?: boolean;
      p_status?: "completed" | "retrying" | "failed";
      p_text?: string | null;
      p_source?: string | null;
      p_confidence?: number | null;
      p_identity?: boolean;
      p_error?: string | null;
      p_provider?: string | null;
      p_model?: string | null;
      p_quality?: number | null;
      p_latency?: number | null;
      p_retry_in_seconds?: number | null;
      p_refund_attempt?: boolean;
    },
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

async function admin(): Promise<RpcClient> {
  const { withChatPlatformDatabase } = await import("@/lib/chat/manager-db.server");
  return {
    async rpc(fn, args) {
      try {
        const data = await withChatPlatformDatabase(async (tx) => {
          if (fn === "chat_translation_claim") {
            const [row] = await tx<{ data: unknown }[]>`
              select public.chat_translation_claim(
                ${args.p_message}::uuid,
                ${args.p_target},
                ${args.p_retry === true}
              ) as data
            `;
            return row?.data;
          }
          if (!args.p_status) throw new Error("Translation finish status is required.");
          const [row] = await tx<{ data: unknown }[]>`
            select public.chat_translation_finish(
              ${args.p_message}::uuid,
              ${args.p_target},
              ${args.p_status},
              ${args.p_text ?? null}::text,
              ${args.p_source ?? null}::text,
              ${args.p_confidence ?? null}::real,
              ${args.p_identity === true},
              ${args.p_error ?? null}::text,
              ${args.p_provider ?? null}::text,
              ${args.p_model ?? null}::text,
              ${args.p_quality ?? null}::real,
              ${args.p_latency ?? null}::integer,
              ${args.p_retry_in_seconds ?? null}::integer,
              ${args.p_refund_attempt === true}
            ) as data
          `;
          return row?.data;
        });
        if (data === undefined) throw new Error(`${fn} returned no result.`);
        return { data, error: null };
      } catch (error) {
        return {
          data: null,
          error: { message: error instanceof Error ? error.message : `${fn} failed.` },
        };
      }
    },
  };
}

function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TranslationFailure("retryable", "timeout")), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

async function detectWithEngine(text: string): Promise<Detection> {
  const { engineEndpoints } = await import("@/lib/i18n/service.server");
  const endpoints = engineEndpoints();
  if (endpoints.length === 0) throw new Error("no translation engine configured");
  const token = process.env.TRANSLATE_PROVIDER_TOKEN;
  let lastError: unknown = null;
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(new URL("/v1/detect", endpoint), {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(DETECT_TIMEOUT_MS),
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text, k: 1 }),
      });
      if (!response.ok) throw new Error(`detector returned HTTP ${response.status}`);
      const body = (await response.json()) as {
        candidates?: { language?: unknown; confidence?: unknown }[];
      };
      const first = Array.isArray(body.candidates) ? body.candidates[0] : undefined;
      const code = typeof first?.language === "string" ? first.language : null;
      const known = code ? resolveLanguage(code, { names: true }) : undefined;
      const confidence =
        typeof first?.confidence === "number" && first.confidence >= 0 && first.confidence <= 1
          ? first.confidence
          : null;
      return { code: known?.code ?? null, confidence: known ? confidence : null };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("language detection failed");
}

function pipelineTranslate(userId: string) {
  return async (text: string, source: string | null, target: string): Promise<Translated> => {
    const { translateForCaller } = await import("@/lib/i18n/service.server");
    const { PipelineError } = await import("@/lib/i18n/pipeline");
    const caller = { tier: "user" as const, subject: `account:${userId}`, userId };
    const started = performance.now();

    const run = (from: string | null) =>
      withDeadline(
        translateForCaller(
          { texts: [text], source: from, target, namespace: "chat", persist: false },
          caller,
        ),
        DEADLINE_MS,
      );

    try {
      let result;
      try {
        result = await run(source);
      } catch (error) {
        // A detected source the registry has switched off: let the engine detect.
        if (
          source !== null &&
          error instanceof PipelineError &&
          error.reason === "invalid_language"
        ) {
          result = await run(null);
        } else {
          throw error;
        }
      }
      const outcome = result.outcomes[0];
      if (outcome?.translation) {
        count("chat.translate.ok");
        return {
          text: outcome.translation,
          provider: result.engine?.provider ?? null,
          model: result.engine?.model ?? null,
          quality: outcome.qualityScore,
        };
      }
      if (outcome?.status === "needs_review" || outcome?.status === "rejected") {
        count("chat.translate.rejected");
        throw new TranslationFailure("permanent", "validation_failed");
      }
      count("chat.translate.pending");
      throw new TranslationFailure("retryable", result.pendingReason ?? "no_translation");
    } catch (error) {
      if (error instanceof TranslationFailure) throw error;
      count("chat.translate.error");
      if (error instanceof PipelineError) {
        if (error.reason === "quota_exceeded")
          throw new TranslationFailure("quota", "quota_exceeded");
        if (error.reason === "invalid_language" || error.reason === "invalid_request")
          throw new TranslationFailure("permanent", error.reason);
        throw new TranslationFailure("retryable", error.reason);
      }
      throw new TranslationFailure(
        "retryable",
        error instanceof Error ? error.message.slice(0, 160) : "translation_failed",
      );
    } finally {
      observe("chat.translate", performance.now() - started);
    }
  };
}

function depsFor(userId: string): TranslationDeps {
  return {
    async claim(messageId, target, retry) {
      const db = await admin();
      const { data, error } = await db.rpc("chat_translation_claim", {
        p_message: messageId,
        p_target: target,
        p_retry: retry,
      });
      if (error) throw new Error(error.message);
      const value = data as { claimed: boolean; row: TranslationRow };
      return { claimed: value.claimed === true, row: value.row };
    },
    async finish(messageId, target, input: FinishInput) {
      const db = await admin();
      const { data, error } = await db.rpc("chat_translation_finish", {
        p_message: messageId,
        p_target: target,
        p_status: input.status,
        p_text: input.text ?? null,
        p_source: input.source ?? null,
        p_confidence: input.confidence ?? null,
        p_identity: input.identity ?? false,
        p_error: input.error ?? null,
        p_provider: input.provider ?? null,
        p_model: input.model ?? null,
        p_quality: input.quality ?? null,
        p_latency: input.latencyMs ?? null,
        p_retry_in_seconds: input.retryInSeconds ?? null,
        p_refund_attempt: input.refundAttempt ?? false,
      });
      if (error) throw new Error(error.message);
      return (data as { row: TranslationRow }).row;
    },
    detect: detectWithEngine,
    translate: pipelineTranslate(userId),
    now: () => Date.now(),
    random: () => Math.random(),
    inflight,
  };
}

/** The same message and language asked for twice at once is one piece of work. */
const flights = new Map<string, Promise<TranslationView>>();

export async function translateMessages(input: {
  userId: string;
  messages: { id: string; body: string }[];
  target: string;
  retry?: boolean;
}): Promise<TranslationView[]> {
  const deps = depsFor(input.userId);
  return mapPool(input.messages, CONCURRENCY, (message) => {
    const key = `${message.id}:${input.target}:${input.retry === true}`;
    const existing = flights.get(key);
    if (existing) return existing;
    const flight = ensureTranslation(deps, message, input.target, { retry: input.retry }).finally(
      () => flights.delete(key),
    );
    flights.set(key, flight);
    return flight;
  });
}

/** English canonical text for messages, for the AI. Missing entries are not ready. */
export async function canonicalViews(
  userId: string,
  messages: { id: string; body: string }[],
): Promise<Map<string, TranslationView>> {
  const views = await translateMessages({ userId, messages, target: CANONICAL });
  return new Map(views.map((view) => [view.messageId, view]));
}

/** A translation of text that is not stored (a correction Chat Manager made). */
export async function translateTransient(
  userId: string,
  text: string,
  target: string,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  try {
    const result = await pipelineTranslate(userId)(text, null, target);
    return { ok: true, text: result.text };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "translation_failed" };
  }
}

export function translationInflight() {
  return { ...inflight };
}
