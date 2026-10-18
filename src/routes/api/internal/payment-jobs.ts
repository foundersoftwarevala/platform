import { createFileRoute } from "@tanstack/react-router";

import { requireInternalOperator } from "@/lib/auth/internal-guard";
import { drainPaymentOutbox } from "@/lib/commerce/payment-jobs.server";

/**
 * Drain the payment settlement outbox.
 *
 * sv-payment-jobs.sh has posted here every five minutes since it was installed
 * and received a 404 every time — 168 calls, not one 200 — so the queue that
 * turns a completed payment into a delivered licence has never been drained on
 * a schedule.
 *
 * The work itself is process_payment_success_events, which already exists and
 * already owns the rules. This route carries no payment logic of its own.
 *
 *   POST { limit?: number }     default 25, the function's own default
 */
export const Route = createFileRoute("/api/internal/payment-jobs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        let body: { limit?: number } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          // The cron always sends a body, but a missing one means "use the
          // default", not "refuse to settle anything".
          body = {};
        }

        try {
          return Response.json(await drainPaymentOutbox(body.limit));
        } catch (error) {
          console.error("[payment-jobs] drain failed", error);
          return Response.json(
            { ok: false, error: error instanceof Error ? error.message : "Drain failed." },
            { status: 502 },
          );
        }
      },
    },
  },
});
