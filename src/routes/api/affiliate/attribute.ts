import { createFileRoute } from "@tanstack/react-router";
import { translateApiMessage } from "@/lib/i18n/server-translate.server";

import {
  REFERRAL_COOKIE,
  attributeOrder,
  attributionForSession,
  currentUser,
  readCookie,
  rest,
} from "@/lib/affiliate/core";
import { isAffiliateSelfReferral } from "@/lib/affiliate/core.server";

/**
 * Attach the affiliate attribution to an order.
 *
 * This runs at checkout, not at settlement, because the payment webhook comes
 * from PayU and carries none of the visitor's cookies. The attribution is
 * therefore stamped onto the order while the buyer is still in their browser,
 * and the settlement path later reads it from the order rather than trying to
 * work out who referred the sale after the fact.
 *
 * The affiliate is resolved **entirely on the server** from the HttpOnly
 * referral cookie. The request body supplies only which order to stamp. A buyer
 * cannot name an affiliate, cannot name a commission, and cannot attribute an
 * order that is not theirs.
 *
 * POST /api/affiliate/attribute  { orderId }
 */

export const Route = createFileRoute("/api/affiliate/attribute")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const translateText = translateApiMessage.bind(null, request);
        let body: { orderId?: string };
        try {
          body = (await request.json()) as { orderId?: string };
        } catch {
          return Response.json({ error: await translateText("affiliate.api_expected_a_json_body_0c4a10f") }, { status: 400 });
        }
        const orderId = String(body.orderId ?? "").trim();
        if (!orderId) return Response.json({ error: "orderId is required" }, { status: 400 });

        const sessionKey = readCookie(request, REFERRAL_COOKIE);
        if (!sessionKey) {
          // Most orders have no referral behind them. That is normal, not an error.
          return Response.json({ attributed: false, reason: "no referral session" });
        }

        const user = await currentUser(request);
        if (!user) return Response.json({ error: "Please sign in" }, { status: 401 });

        // The order must belong to the person asking.
        const orderResponse = await rest(
          `marketplace_orders?select=id,buyer_id,user_id,status,total,currency` +
            `&id=eq.${encodeURIComponent(orderId)}&limit=1`,
        );
        if (!orderResponse.ok) {
          return Response.json({ error: "Could not read the order" }, { status: 502 });
        }
        const order = (
          (await orderResponse.json()) as {
            buyer_id: string | null;
            user_id: string | null;
            status: string;
            total: number | string;
            currency: string;
          }[]
        )[0];
        if (!order) return Response.json({ error: "No such order" }, { status: 404 });
        if (order.buyer_id !== user.id && order.user_id !== user.id) {
          return Response.json({ error: "That order does not belong to you" }, { status: 403 });
        }
        // Only an order still awaiting its payment can take an attribution,
        // exactly as /api/payment/initiate stamps it. Otherwise a buyer could
        // visit a friend's link after paying and hand them commission on a sale
        // they never referred, picked up by a later backfill or replay.
        if (String(order.status ?? "").toLowerCase() !== "pending_payment") {
          return Response.json(
            { attributed: false, reason: "order is no longer awaiting payment" },
            { status: 409 },
          );
        }

        const attribution = await attributionForSession(sessionKey);
        if (!attribution) {
          return Response.json({ attributed: false, reason: "no attribution inside the window" });
        }

        if (attribution.affiliatePartnerId) {
          let selfReferral: boolean;
          try {
            selfReferral = await isAffiliateSelfReferral(attribution.affiliatePartnerId, user.id);
          } catch (error) {
            console.error("[affiliate/attribute] ownership verification failed", error);
            return Response.json({ error: "Could not verify referral ownership" }, { status: 503 });
          }
          if (selfReferral) {
            return Response.json(
              { attributed: false, selfReferral: true, reason: "self-referral is not eligible" },
              { status: 409 },
            );
          }
        }

        const result = await attributeOrder(orderId, attribution, {
          buyer_id: user.id,
          order_total: order.total,
          currency: order.currency,
        });

        return Response.json({
          attributed: result.created,
          reason: result.reason ?? null,
        });
      },
    },
  },
});
