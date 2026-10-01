import { createFileRoute } from "@tanstack/react-router";
import { payuConfig } from "@/lib/commerce/payu";
import { readPayuFields, settlePayuCallback } from "@/lib/commerce/payu-settle";

/**
 * Where PayU tells us what happened, server to server.
 *
 * Nothing here trusts the caller: settlePayuCallback checks the reverse hash,
 * the order, the amount and PayU's own verify endpoint before an order is
 * marked paid, and writes every attempt to payment_logs so a disputed payment
 * can be reconstructed later.
 *
 * Replays are harmless: an order already paid is acknowledged without being
 * settled twice, because PayU retries this callback. A paid order whose access
 * could not be issued is answered with an error, so PayU's retry finishes it.
 */

export const Route = createFileRoute("/api/payment/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const config = payuConfig();
        if (!config || !process.env.SUPABASE_URL?.trim()) {
          // Fail closed. A callback we cannot check is not a payment.
          console.error("[payu webhook] refused: no credentials configured");
          return new Response("Payment provider is not configured", { status: 503 });
        }

        let fields: Record<string, string>;
        try {
          fields = await readPayuFields(request);
        } catch {
          return new Response("Unreadable callback", { status: 400 });
        }

        const outcome = await settlePayuCallback(config, fields, "webhook");
        return new Response(outcome.message, { status: outcome.httpStatus });
      },

      // PayU probes the endpoint; answer without revealing anything.
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
