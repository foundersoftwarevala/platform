import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { aiComplete } from "@/lib/ai-gateway.server";
import { currentCaller } from "@/lib/auth/caller-roles";

/**
 * A per-account ceiling on translations. Connect Chat auto-translates up to 25
 * incoming messages at once, so the window is generous; what it stops is one
 * account looping on the provider. In memory, per process, like the storefront
 * limiters in src/routes/api/marketplace/lead.ts.
 */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 60;
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > RATE_MAX;
}

const schema = z.object({
  text: z.string().min(1).max(4000),
  target: z.string().min(2).max(12),
});

/** Real machine translation through the Lovable AI gateway. */
export const translateMessage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    // The only caller is Connect Chat (/chat), which sends a signed-in user to
    // /login before it renders, yet nothing here asked who was calling: any
    // script could spend the platform's AI credit on translations. The caller
    // must now hold a valid session. The refusal uses the { ok: false, error }
    // shape MessageList already shows under the message.
    //
    // The guard this replaces read `apiKey`, which was never declared, so every
    // call threw before reaching the model. Whether a provider is configured is
    // AI API Manager's question; its reason is returned below.
    const caller = await currentCaller();
    if (!caller) return { ok: false as const, error: "Sign in to translate messages." };
    if (rateLimited(caller.userId)) {
      return { ok: false as const, error: "Translation rate limit reached. Try again shortly." };
    }

    let __ai: Awaited<ReturnType<typeof aiComplete>>;
    try {
      __ai = await aiComplete({
      module: "translate",
      messages: [
          {
            role: "system",
            content:
              "You are a translation engine for a business chat app. Translate the user's message into the requested language. Preserve emoji, names, numbers and formatting. Reply with the translation only.",
          },
          { role: "user", content: `Target language code: ${data.target}\n\nMessage:\n${data.text}` },
        ],
    });
    } catch (error) {
      // No provider, a policy refusal or a provider failure: say why, in the
      // shape the chat shows, instead of rejecting a promise nobody catches.
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Translation service is not configured.",
      };
    }
    // Shaped like the gateway reply the surrounding code already parses.
    const response = {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: __ai.text } }] }),
      text: async () => __ai.text,
    };

    if (response.status === 429) return { ok: false as const, error: "Translation rate limit reached. Try again shortly." };
    if (response.status === 402) return { ok: false as const, error: "Translation credits exhausted." };
    if (!response.ok) return { ok: false as const, error: "Translation service unavailable." };

    const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const translated = payload.choices?.[0]?.message?.content?.trim();
    if (!translated) return { ok: false as const, error: "Translation service returned no text." };
    return { ok: true as const, text: translated };
  });
