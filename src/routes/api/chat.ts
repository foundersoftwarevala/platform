import { createFileRoute } from "@tanstack/react-router";
import { aiStream } from "@/lib/ai-gateway.server";
import { requireAuthorizedAiCaller } from "@/lib/ai-request-auth.server";
import { SlidingWindowLimiter } from "@/lib/i18n/limits";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

const SYSTEM_PROMPT = `You are VALA, the AI Executive Assistant of the "Software Vala" enterprise platform.
You address the user as "Boss". You are warm, confident, concise and executive in tone.
You understand the platform modules: Marketplace, Finance, CRM, HR, Analytics, Franchise, Server Management, Approvals, Support, Vala AI.

Rules:
- You have NOT been given any business figures. Never state a revenue number, a
  user or franchise count, a margin, an uptime percentage, a ticket count or a
  satisfaction score. If the Boss asks for one, say you do not have it in front
  of you and name the console that does: Finance Manager for revenue and margin,
  Lead Manager for leads, Server Manager for uptime and load, Support Operations
  for tickets, AI CEO for the platform-wide view.
- If a figure appears earlier in this conversation because the Boss or the
  platform put it there, you may use that one. Nothing else.
- Reply in the language the Boss uses (Hindi, Hinglish or English).
- Keep answers short and scannable: 1-4 sentences or compact bullets. No markdown headings.
- If the Boss asks to open a module (e.g. "open finance"), confirm the action in one line.
- Never mention which model or provider powers you.`;

/**
 * Each turn is a paid provider call, so one account - or one stolen token in a
 * loop - cannot spend the budget unbounded. Well above what a person typing
 * causes.
 */
const CHAT_TURNS_PER_MINUTE = 20;
const chatLimiter = new SlidingWindowLimiter(60_000);

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let caller: { id: string };
        try {
          caller = await requireAuthorizedAiCaller();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Authentication required for AI requests.";
          return new Response(message, { status: 401 });
        }
        if (chatLimiter.hit(caller.id, CHAT_TURNS_PER_MINUTE)) {
          return new Response("Too many messages. Please wait a moment and try again.", {
            status: 429,
            headers: { "Retry-After": "30" },
          });
        }

        let body: { messages?: ChatMessage[] };
        try {
          body = (await request.json()) as { messages?: ChatMessage[] };
        } catch {
          return new Response("Invalid request", { status: 400 });
        }
        // Only the two conversational roles cross from the browser. Anything
        // else - "system", "developer", "tool" - would let a caller speak with
        // the authority of the platform's own instructions.
        const messages = (Array.isArray(body?.messages) ? body.messages.slice(-20) : [])
          .filter(
            (message) =>
              message &&
              typeof message === "object" &&
              typeof message.content === "string" &&
              (message.role === "user" || message.role === "assistant"),
          )
          .map((message) => ({ role: message.role, content: message.content.slice(0, 4_000) }));
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
