import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";
import { runPaymentEvents } from "@/lib/commerce/payment-jobs";
import { correlationId, withCorrelation } from "@/lib/commerce/observability";

/**
 * The settlement queue.
 *
 *   GET   what is waiting, what is being retried, what has given up
 *   POST  process what is due
 *
 * Operator only, like every other endpoint under /api/internal. It is safe to
 * call repeatedly and safe to call concurrently: events are claimed inside the
 * database with FOR UPDATE SKIP LOCKED, so two callers take different work
 * rather than the same work twice, and every consumer is idempotent anyway.
 *
 * This is the endpoint a scheduler points at. There is no broker behind it
 * because there does not need to be one — the queue is a table, the claim is a
 * lock, and the depth is measured in single figures.
 */

function url(): string {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}` };
}

async function countByStatus(status: string): Promise<number | null> {
  if (!url()) return null;
  try {
    const response = await fetch(
      `${url()}/rest/v1/finance_payment_events?select=id&status=eq.${status}`,
      { headers: { ...admin(), Prefer: "count=exact", Range: "0-0" } },
    );
    if (!response.ok) return null;
    const total = Number((response.headers.get("content-range") ?? "").split("/")[1]);
    return Number.isFinite(total) ? total : null;
  } catch {
    return null;
  }
}

async function depth() {
  return {
    pending: await countByStatus("pending"),
    processing: await countByStatus("processing"),
    processed: await countByStatus("processed"),
    dead: await countByStatus("dead"),
  };
}

export const Route = createFileRoute("/api/internal/payment-jobs")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        const id = correlationId(request);
        return withCorrelation(Response.json({ queue: await depth() }), id);
      },

      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        const id = correlationId(request);

        let body: { limit?: number } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          body = {};
        }
        const limit = Math.min(Math.max(Number(body.limit) || 20, 1), 100);

        const result = await runPaymentEvents(limit);
        return withCorrelation(
          Response.json({ correlation_id: id, ...result, queue: await depth() }),
          id,
        );
      },
    },
  },
});
