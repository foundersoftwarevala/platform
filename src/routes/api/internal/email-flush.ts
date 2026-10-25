import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";
import { MAX_ATTEMPTS, providerConfigured, requeueFailed, sendQueued } from "@/lib/commerce/mailer";

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
  const response = await fetch(
    `${url()}/rest/v1/email_outbox?select=id&status=eq.${encodeURIComponent(status)}&limit=1`,
    { headers: { ...admin(), Prefer: "count=exact" } },
  );
  if (!response.ok) {
    throw new Error(`Could not count ${status} email messages (HTTP ${response.status})`);
  }
  const range = response.headers.get("content-range") ?? "";
  const total = range.split("/")[1];
  if (!total || total === "*" || !/^\d+$/.test(total)) {
    throw new Error(`Email count response for ${status} did not include an exact total`);
  }
  return Number(total);
}

export const Route = createFileRoute("/api/internal/email-flush")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        try {
          const [pending, sent, failed] = await Promise.all([
            countByStatus("pending"),
            countByStatus("sent"),
            countByStatus("failed"),
          ]);
          return Response.json({
            provider: providerConfigured() ?? "none configured",
            max_attempts: MAX_ATTEMPTS,
            pending,
            sent,
            failed,
          });
        } catch (error) {
          console.error("[email-flush] could not read queue counts", error);
          return Response.json({ error: "Could not read email queue status" }, { status: 500 });
        }
      },

      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        // POST {"requeue": true} puts messages that gave up back in the queue,
        // for when the reason they failed has been dealt with.
        let body: { requeue?: boolean } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          body = {};
        }
        try {
          if (body.requeue) {
            const back = await requeueFailed(200);
            const [pending, failed] = await Promise.all([
              countByStatus("pending"),
              countByStatus("failed"),
            ]);
            return Response.json({
              provider: providerConfigured() ?? "none configured",
              requeued: back.requeued,
              pending_after: pending,
              failed_after: failed,
            });
          }

          const result = await sendQueued(50);
          const pending = await countByStatus("pending");
          return Response.json({
            provider: providerConfigured() ?? "none configured",
            ...result,
            pending_after: pending,
          });
        } catch (error) {
          console.error("[email-flush] request failed", error);
          return Response.json({ error: "Could not flush email queue" }, { status: 500 });
        }
      },
    },
  },
});
