import { createFileRoute } from "@tanstack/react-router";

import { requireInternalOperator } from "@/lib/auth/internal-guard";
import { reconcilePaymentIntents } from "@/lib/commerce/payment-jobs.server";

/**
 * Ask the providers about payment intents that never came back.
 *
 * A customer who paid and whose callback was lost is indistinguishable, from
 * our side, from one who abandoned the page. Reconciliation is what tells them
 * apart, and it is deliberately run every half hour rather than every five
 * minutes because it costs provider calls.
 *
 * The work is reconcile_payment_intents, which already exists. Like the drain
 * beside it, this route decides nothing about money.
 *
 *   POST {}
 */
export const Route = createFileRoute("/api/internal/payment-reconcile")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        try {
          return Response.json(await reconcilePaymentIntents());
        } catch (error) {
          console.error("[payment-reconcile] failed", error);
          return Response.json(
            { ok: false, error: error instanceof Error ? error.message : "Reconcile failed." },
            { status: 502 },
          );
        }
      },
    },
  },
});
