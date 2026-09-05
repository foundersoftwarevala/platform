import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";
import { providerConfigured, sendQueued } from "@/lib/commerce/mailer";

/**
 * The outbound mail queue.
 *
 *   GET   how many messages are waiting, and whether anything can send them
 *   POST  try to send what is waiting
 *
 * Operator only. Nothing here invents a delivery: if no provider is configured
 * it says so and leaves every message queued, which is why a backlog built up
 * before credentials exist is not lost.
 */

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}` };
}

async function countByStatus(status: string): Promise<number> {
  try {
    const response = await fetch(
      `${url()}/rest/v1/email_outbox?select=id&status=eq.${status}&limit=1`,
      { headers: { ...admin(), Prefer: "count=exact" } },
    );
    const range = response.headers.get("content-range") ?? "";
    return Number(range.split("/")[1]) || 0;
  } catch {
    return 0;
  }
}

export const Route = createFileRoute("/api/internal/email-flush")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        return Response.json({
          provider: providerConfigured() ?? "none configured",
          pending: await countByStatus("pending"),
          sent: await countByStatus("sent"),
          failed: await countByStatus("failed"),
        });
      },

      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        const result = await sendQueued(50);
        return Response.json({
          provider: providerConfigured() ?? "none configured",
          ...result,
          pending_after: await countByStatus("pending"),
        });
      },
    },
  },
});
