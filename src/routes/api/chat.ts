import { createFileRoute } from "@tanstack/react-router";

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

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("AI is not configured", { status: 500 });

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3.6-flash",
            stream: true,
            messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          return new Response(text || "AI request failed", { status: upstream.status || 500 });
        }

        return new Response(upstream.body, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
          },
        });
      },
    },
  },
});
