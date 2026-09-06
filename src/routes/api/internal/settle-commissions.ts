import { createFileRoute } from "@tanstack/react-router";

import { recordCommissionsForOrder, reverseCommissionsForOrder } from "@/lib/commerce/commission";
import { requireInternalOperator } from "@/lib/auth/internal-guard";

/**
 * Replay author commission for an order that has already settled, or reverse it
 * for one that has been refunded.
 *
 * Commission is normally written by the payment webhook. This exists because a
 * webhook can be missed — PayU retries give up, a deploy lands mid-callback, a
 * network blip swallows one — and a finance operator then has no way to credit
 * an author for a sale that genuinely happened. It is the same engine, so a
 * replay converges on the one commission row rather than creating a second.
 *
 * It cannot mint money: every amount is read from the stored order item, the
 * seller comes from the product record, and the rate comes from the commission
 * rules. Nothing in the request body influences what is credited except which
 * order to look at.
 *
 *   POST { orderId }                       -> record commission for that order
 *   POST { orderId, reverse: true, reason } -> reverse it after a refund
 */
export const Route = createFileRoute("/api/internal/settle-commissions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        let body: { orderId?: string; reverse?: boolean; reason?: string; refundId?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Expected a JSON body" }, { status: 400 });
        }

        const orderId = String(body.orderId ?? "").trim();
        if (!orderId) {
          return Response.json({ error: "orderId is required" }, { status: 400 });
        }

        const result = body.reverse
          ? await reverseCommissionsForOrder(
              orderId,
              body.refundId ?? null,
              String(body.reason ?? "manual reversal"),
            )
          : await recordCommissionsForOrder(orderId);

        return Response.json(
          { orderId, mode: body.reverse ? "reverse" : "record", ...result },
          { status: result.ok ? 200 : 502 },
        );
      },
    },
  },
});
