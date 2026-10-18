import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { aiComplete } from "@/lib/ai-gateway.server";
import { requireAuthorizedAiCaller } from "@/lib/ai-request-auth.server";

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

/**
 * What the panel may send. The input was only cast, so a message with role
 * "developer" - which an OpenAI-compatible model obeys like a system prompt -
 * went straight through, and a non-array crashed into the error text.
 */
const chatInput = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        // Clipped, as before, rather than refused: a long paste still sends.
        content: z.string().transform((text) => text.slice(0, 4_000)),
      }),
    )
    .min(1)
    .max(20),
});
type ChatOutput = { reply: string; error?: string };

const SYSTEM_PROMPT = `You are Vala AI — the in-app assistant for the Software Vala Marketplace Homepage Manager (Boss Panel).
You help the operator run the marketplace: managing hero banners, walls, categories, cards, offers, partners, SEO, analytics, deployment, integrity and settings.
Be concise (under 8 lines unless asked), use bullet points where useful, and reference real manager sections by name (Dashboard, Top Bar, Homepage Rows, Card Manager, Hero Banner, Walls, Offers, SEO, Analytics, Deployment, Integrity, Settings).
Never invent metrics, revenue, ratings or downloads. If asked for live data you don't have, say so and suggest opening the relevant manager section.`;

export const chatWithAi = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    chatInput.parse({
      // The panel keeps its own system-role notes in history; they are not
      // sent, as before, rather than refused.
      messages: Array.isArray((d as { messages?: unknown })?.messages)
        ? ((d as { messages: { role?: unknown }[] }).messages ?? [])
            .filter((m) => m?.role !== "system")
            // The panel sends its whole history; the model gets the last twenty.
            .slice(-20)
        : [],
    }),
  )
  .handler(async ({ data }): Promise<ChatOutput> => {
    await requireAuthorizedAiCaller();
    try {
      const __ai = await aiComplete({
        module: "marketplace-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...data.messages.slice(-20).map((message) => ({ role: message.role, content: message.content })),
        ],
      });
      const reply = String(__ai.text ?? "").trim();
      return { reply: reply || "(no response)" };
    } catch (e) {
      // The friendly messages for a rate limit or exhausted credit were in
      // branches that could never run; the gateway's error is mapped here.
      const message = e instanceof Error ? e.message : "Network error.";
      if (/\b429\b|rate.?limit/i.test(message)) {
        return { reply: "", error: "Rate limit reached. Try again in a moment." };
      }
      if (/\b402\b|credit|quota|insufficient/i.test(message)) {
        return { reply: "", error: "AI credits exhausted. Top up in workspace billing." };
      }
      return { reply: "", error: message };
    }
  });
