import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { aiComplete } from "@/lib/ai-gateway.server";

const schema = z.object({
  text: z.string().min(1).max(4000),
  target: z.string().min(2).max(12),
});

/** Real machine translation through the Lovable AI gateway. */
export const translateMessage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
        if (!apiKey) return { ok: false as const, error: "Translation service is not configured." };

    const __ai = await aiComplete({
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
