import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import {
  MAX_BODY_BYTES,
  SlidingWindowLimiter,
  TIER_LIMITS,
  checkRequestShape,
  clientAddress,
} from "@/lib/i18n/limits";
import { MAX_CONTEXT_LENGTH, NAMESPACE_PATTERN, PipelineError } from "@/lib/i18n/pipeline";
import { SOURCE_LANGUAGE } from "@/lib/i18n/registry";

/**
 * Translate text.
 *
 * The public entry to the translation pipeline (src/lib/i18n/pipeline.ts):
 * every language is resolved against the registry, answers come from
 * translation memory first, and only what memory does not hold goes to the
 * platform's own translation engine (services/translation-engine). An
 * external provider is used only if TRANSLATION_ALLOW_EXTERNAL=true. Output
 * that fails validation is never returned.
 *
 * Body:
 *   { texts: string[], target: string, source?: string, namespace?: string,
 *     context?: string, memory_only?: boolean, mode?: "realtime" | "quality" }
 * `locale` is accepted in place of `target` for callers written before the
 * registry. Any spelling the registry recognises is accepted ("hi", "HI",
 * "Hindi", "pt-br"); anything else is refused with reason "invalid_language".
 *
 * Callers: visitors may translate interface text; signed-in accounts get a
 * larger allowance; admin and boss may translate any namespace. Requests are
 * rate limited per caller and engine work is metered in the database.
 *
 * Responses carry a `reason` on failure: invalid_request, invalid_language,
 * rate_limited, quota_exceeded, engine_unavailable, service_error.
 */

const limiter = new SlidingWindowLimiter(60_000);

const bodySchema = z
  .object({
    texts: z.array(z.string()).max(TIER_LIMITS.operator.maxItems),
    target: z.string().max(64).optional(),
    locale: z.string().max(64).optional(),
    source: z.string().max(64).optional(),
    namespace: z.string().regex(NAMESPACE_PATTERN).optional(),
    context: z.string().max(MAX_CONTEXT_LENGTH).optional(),
    // Answer from translation memory only; allowed in any namespace for every caller.
    memory_only: z.boolean().optional(),
    // Operators may ask for the slower, higher-quality engine mode.
    mode: z.enum(["realtime", "quality"]).optional(),
  })
  .strict();

function fail(status: number, reason: string, error: string, headers?: Record<string, string>) {
  return Response.json({ error, reason }, { status, headers });
}

export const Route = createFileRoute("/api/marketplace/translate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const declared = Number(request.headers.get("content-length") ?? "0");
        if (declared > MAX_BODY_BYTES) return fail(413, "invalid_request", "Request is too large.");

        let raw: string;
        try {
          raw = await request.text();
        } catch {
          return fail(400, "invalid_request", "Invalid request.");
        }
        if (raw.length > MAX_BODY_BYTES)
          return fail(413, "invalid_request", "Request is too large.");

        let parsed: z.infer<typeof bodySchema>;
        try {
          parsed = bodySchema.parse(JSON.parse(raw));
        } catch {
          return fail(400, "invalid_request", "Invalid request.");
        }

        const target = parsed.target ?? parsed.locale;
        if (!target) return fail(400, "invalid_language", "Which language?");
        const namespace = parsed.namespace ?? "ui";
        const texts = parsed.texts.map((t) => t.trim()).filter(Boolean);
        if (texts.length === 0) return Response.json({ translations: {}, target, results: [] });

        const { resolveCaller, translateForCaller } = await import("@/lib/i18n/service.server");
        const { ensureJobWorker } = await import("@/lib/i18n/jobs.server");
        ensureJobWorker();
        const address = clientAddress(request.headers);
        const caller = await resolveCaller(
          request.headers.get("authorization"),
          address,
          request.headers.get("x-internal-token"),
        );

        const memoryOnly = parsed.memory_only === true;
        const shape = checkRequestShape(caller.tier, { texts, namespace });
        if (shape && !(memoryOnly && shape === "namespace_not_allowed")) {
          return fail(
            shape === "namespace_not_allowed" ? 403 : 413,
            "invalid_request",
            `Request refused: ${shape}.`,
          );
        }

        if (limiter.hit(caller.subject, TIER_LIMITS[caller.tier].requestsPerMinute)) {
          return fail(429, "rate_limited", "Too many translation requests. Try again shortly.", {
            "Retry-After": "60",
          });
        }

        try {
          const result = await translateForCaller(
            {
              texts,
              source: parsed.source ?? SOURCE_LANGUAGE,
              target,
              namespace,
              context: parsed.context ?? null,
              persist: true,
              memoryOnly,
              mode: caller.tier === "operator" ? parsed.mode : "realtime",
            },
            caller,
          );

          const translations: Record<string, string> = {};
          for (const outcome of result.outcomes) {
            if (outcome.translation !== null) translations[outcome.text] = outcome.translation;
          }
          return Response.json({
            translations,
            target: result.target.code,
            // Kept for callers written before the registry.
            locale: result.target.code,
            source: result.source?.code ?? null,
            direction: result.target.direction,
            results: result.outcomes.map((o) => ({
              text: o.text,
              status: o.status,
              origin: o.origin,
              quality: o.qualityScore,
              issues: o.issues,
            })),
            pending_reason: result.pendingReason,
            engine: result.engine
              ? { provider: result.engine.provider, kind: result.engine.kind }
              : null,
            fromCache: result.stats.fromMemory,
            translated: result.stats.translated,
            needsReview: result.stats.needsReview,
          });
        } catch (error) {
          if (error instanceof PipelineError) {
            const status =
              error.reason === "invalid_language" || error.reason === "invalid_request"
                ? 400
                : error.reason === "quota_exceeded"
                  ? 429
                  : 503;
            const message =
              error.reason === "engine_unavailable"
                ? "The translation engine is unavailable right now (not configured, busy or not answering). Try again shortly."
                : error.message;
            return fail(
              status,
              error.reason,
              message,
              status === 429 ? { "Retry-After": "3600" } : undefined,
            );
          }
          console.error("[translate] failed", error);
          return fail(500, "service_error", "Translation failed.");
        }
      },
    },
  },
});
