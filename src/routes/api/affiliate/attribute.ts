import { createFileRoute } from "@tanstack/react-router";

import {
  REFERRAL_COOKIE,
  attributeOrder,
  attributionForSession,
  currentUser,
  readCookie,
  rest,
} from "@/lib/affiliate/core";

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
        let body: { orderId?: string };
        try {
          body = (await request.json()) as { orderId?: string };
        } catch {
          return Response.json({ error: "Expected a JSON body" }, { status: 400 });
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
        const order = ((await orderResponse.json()) as
          { buyer_id: string | null; user_id: string | null; status: string;
            total: number | string; currency: string }[])[0];
        if (!order) return Response.json({ error: "No such order" }, { status: 404 });
        if (order.buyer_id !== user.id && order.user_id !== user.id) {
          return Response.json({ error: "That order does not belong to you" }, { status: 403 });
        }

        const attribution = await attributionForSession(sessionKey);
        if (!attribution) {
          return Response.json({ attributed: false, reason: "no attribution inside the window" });
        }

        // Self-referral: an affiliate buying through their own link. Recorded,
        // not silently credited — the flag lets a human decide.
        let selfReferral = false;
        if (attribution.affiliatePartnerId) {
          const partner = await rest(
            `marketplace_affiliate_partners?select=user_id&id=eq.${encodeURIComponent(attribution.affiliatePartnerId)}&limit=1`,
          );
          if (partner.ok) {
            const rows = (await partner.json()) as { user_id: string | null }[];
            selfReferral = rows[0]?.user_id === user.id;
          }
        }

        const result = await attributeOrder(orderId, attribution, {
          buyer_id: user.id,
          order_total: order.total,
          currency: order.currency,
          self_referral: selfReferral,
          risk: selfReferral ? "REVIEW" : "NORMAL",
          risk_reason: selfReferral ? "buyer owns the referring affiliate account" : null,
        });

        return Response.json({
          attributed: result.created,
          reason: result.reason ?? null,
          selfReferral,
          risk: selfReferral ? "REVIEW" : "NORMAL",
        });
      },
    },
  },
});
