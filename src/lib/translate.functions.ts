import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const schema = z.object({
  text: z.string().min(1).max(4000),
  target: z.string().min(2).max(64),
});

/**
 * Translate one chat message into the reader's language.
 *
 * Goes through the platform's translation pipeline (src/lib/i18n), so the
 * target is resolved against the language registry and the engine is
 * whichever provider is configured. Chat messages are private: they are never
 * written to, or read from, shared translation memory, and the source
 * language is detected rather than assumed.
 *
 * This previously checked an `apiKey` variable that no longer existed after
 * the move off the Lovable gateway, so every call threw.
 */
export const translateMessage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller, translateForCaller } = await import("@/lib/i18n/service.server");
    const { PipelineError } = await import("@/lib/i18n/pipeline");

    const caller = await resolveCaller(
      getRequestHeader("authorization") ?? getRequestHeader("Authorization") ?? null,
      getRequestHeader("cf-connecting-ip") ??
        getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
        "unknown",
    );
    if (caller.tier === "anonymous") {
      return { ok: false as const, error: "Sign in to translate messages." };
    }

    try {
      const result = await translateForCaller(
        {
          texts: [data.text],
          source: null,
          target: data.target,
          namespace: "chat",
          persist: false,
        },
        caller,
      );
      const outcome = result.outcomes[0];
      if (outcome?.translation) return { ok: true as const, text: outcome.translation };
      if (outcome?.status === "needs_review") {
        return { ok: false as const, error: "The translation did not pass validation." };
      }
      return { ok: false as const, error: "Translation service unavailable." };
    } catch (error) {
      if (error instanceof PipelineError) {
        const message =
          error.reason === "invalid_language"
            ? "That language is not supported."
            : error.reason === "quota_exceeded"
              ? "Translation limit reached. Try again later."
              : error.reason === "engine_unavailable"
                ? "Translation is unavailable right now. Try again shortly."
                : "Translation request was refused.";
        return { ok: false as const, error: message };
      }
      console.error("[translateMessage] failed", error);
      return { ok: false as const, error: "Translation service unavailable." };
    }
  });
