import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  text: z.string().min(1).max(4000),
  target: z.string().min(2).max(12),
});

/** Real machine translation through the Lovable AI gateway. */
export const translateMessage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false as const, error: "Translation service is not configured." };

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-lite",
        messages: [
          {
            role: "system",
            content:
              "You are a translation engine for a business chat app. Translate the user's message into the requested language. Preserve emoji, names, numbers and formatting. Reply with the translation only.",
          },
          { role: "user", content: `Target language code: ${data.target}\n\nMessage:\n${data.text}` },
        ],
      }),
    });

    if (response.status === 429) return { ok: false as const, error: "Translation rate limit reached. Try again shortly." };
    if (response.status === 402) return { ok: false as const, error: "Translation credits exhausted." };
    if (!response.ok) return { ok: false as const, error: "Translation service unavailable." };

    const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const translated = payload.choices?.[0]?.message?.content?.trim();
    if (!translated) return { ok: false as const, error: "Translation service returned no text." };
    return { ok: true as const, text: translated };
  });
