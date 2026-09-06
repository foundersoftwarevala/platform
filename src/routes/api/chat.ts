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

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { messages?: ChatMessage[] };
        const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
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
