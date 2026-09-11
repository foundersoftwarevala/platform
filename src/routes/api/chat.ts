import { createFileRoute } from "@tanstack/react-router";
import { aiStream } from "@/lib/ai-gateway.server";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

const SYSTEM_PROMPT = `You are VALA, the AI Executive Assistant of the "Software Vala" enterprise platform.
You address the user as "Boss". You are warm, confident, concise and executive in tone.
You understand the platform modules: Marketplace, Finance, CRM, HR, Analytics, Franchise, Server Management, Approvals, Support, Vala AI.

Live business context you may reference:
- Total revenue ₹42.5L, growth +18% MoM, today revenue ₹2.4L
- 2,847 active users across 12 countries, 24 franchises (22 active, 2 pending)
- Uptime 99.97%, CPU 32%, RAM 58%, storage 38%
- 6 pending approvals (3 role, 2 deployment, 1 legal), 34 open support tickets, CSAT 4.7/5
- Net profit +₹12.2L, margin 50.2%

Rules:
- Reply in the language the Boss uses (Hindi, Hinglish or English).
- Keep answers short and scannable: 1-4 sentences or compact bullets. No markdown headings.
- If the Boss asks to open a module (e.g. "open finance"), confirm the action in one line.
- Never mention which model or provider powers you.`;

/**
 * This endpoint spends the platform's AI credit and answers any caller, so it
 * is bounded: a caller gets a fixed number of answers a minute, and a message
 * is clipped before it reaches the provider. It had no limit at all.
 */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;
const MAX_MESSAGE_CHARS = 4_000;
const recent = new Map<string, number[]>();

function overLimit(key: string): boolean {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  recent.set(key, hits);
  if (recent.size > 5_000) {
    for (const [k, v] of recent) if (!v.some((t) => now - t < RATE_WINDOW_MS)) recent.delete(k);
  }
  return hits.length > RATE_MAX;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const caller =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "unknown";
        if (overLimit(caller)) {
          return new Response("Too many requests. Please wait a moment.", { status: 429 });
        }
        let body: { messages?: ChatMessage[] };
        try {
          body = (await request.json()) as { messages?: ChatMessage[] };
        } catch {
          return new Response("Invalid request", { status: 400 });
        }
        const messages = (Array.isArray(body.messages) ? body.messages.slice(-20) : [])
          .filter((m) => m && typeof m.content === "string" && m.role !== "system")
          .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));
        if (messages.length === 0) {
          return new Response("Messages are required", { status: 400 });
        }

        // Streamed through AI API Manager, which owns the provider, the model
        // and the credential. The upstream body still reaches the browser
        // untouched, so the client's event parsing is unchanged.
        try {
          return await aiStream({
            module: "assistant",
            messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "The AI request failed.";
          // A missing provider is a configuration problem, not a server fault.
          return new Response(message, { status: 503 });
        }
      },
    },
  },
});
