import { createServerFn } from "@tanstack/react-start";
import { aiComplete } from "@/lib/ai-gateway.server";

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

type ChatInput = { messages: ChatMessage[] };
type ChatOutput = { reply: string; error?: string };

const SYSTEM_PROMPT = `You are Vala AI — the in-app assistant for the Software Vala Marketplace Homepage Manager (Boss Panel).
You help the operator run the marketplace: managing hero banners, walls, categories, cards, offers, partners, SEO, analytics, deployment, integrity and settings.
Be concise (under 8 lines unless asked), use bullet points where useful, and reference real manager sections by name (Dashboard, Top Bar, Homepage Rows, Card Manager, Hero Banner, Walls, Offers, SEO, Analytics, Deployment, Integrity, Settings).
Never invent metrics, revenue, ratings or downloads. If asked for live data you don't have, say so and suggest opening the relevant manager section.`;

export const chatWithAi = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as ChatInput)
  .handler(async ({ data }): Promise<ChatOutput> => {
        if (!key) {
      return {
        reply: "",
        error: "AI is not configured. Configure an AI provider in AI API Manager to enable Vala AI Chat.",
      };
    }
    try {
      const __ai = await aiComplete({
      module: "chat",
      messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...data.messages.slice(-20),
          ],
    });
    // Shaped like the gateway reply the surrounding code already parses.
    const res = {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: __ai.text } }] }),
      text: async () => __ai.text,
    };
      if (res.status === 429) return { reply: "", error: "Rate limit reached. Try again in a moment." };
      if (res.status === 402) return { reply: "", error: "AI credits exhausted. Top up in workspace billing." };
      if (!res.ok) return { reply: "", error: `AI gateway error (${res.status}).` };
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const reply = json.choices?.[0]?.message?.content?.trim() ?? "";
      return { reply: reply || "(no response)" };
    } catch (e) {
      return { reply: "", error: e instanceof Error ? e.message : "Network error." };
    }
  });
