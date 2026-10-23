import { createFileRoute } from "@tanstack/react-router";
import { translateApiMessage } from "@/lib/i18n/server-translate.server";
import {
  referralAttributionForRequest,
  resellerPricingForReferral,
} from "@/lib/commerce/reseller-payment-pricing.server";

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

async function currentUser(request: Request) {
  const publishable =
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? process.env.SUPABASE_ANON_KEY?.trim();
  const authorization = request.headers.get("authorization");
  if (!url() || !publishable || !authorization) return null;
  const response = await fetch(`${url()}/auth/v1/user`, {
    headers: { apikey: publishable, Authorization: authorization },
  });
  if (!response.ok) return null;
  const user = (await response.json()) as { id?: string };
  return user?.id ? { id: user.id } : null;
}

export const Route = createFileRoute("/api/payment/quote")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const translateText = translateApiMessage.bind(null, request);
        const user = await currentUser(request);
        if (!user)
          return Response.json(
            { error: await translateText("payment.api_please_sign_in_to_view_payment_pricing_7693cbf") },
            { status: 401 },
          );

        const publishable =
          process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? process.env.SUPABASE_ANON_KEY?.trim();
        const quoteResponse = await fetch(`${url()}/rest/v1/rpc/marketplace_cart_quote`, {
          method: "POST",
          headers: {
            apikey: publishable ?? "",
            Authorization: request.headers.get("authorization") ?? "",
            "Content-Type": "application/json",
          },
          body: "{}",
        });
        if (!quoteResponse.ok) {
          return Response.json({ error: await translateText("payment.api_could_not_price_the_current_cart_fbf3faa") }, { status: 502 });
        }
        const quote = (await quoteResponse.json()) as {
          subtotal?: number;
          currency?: string | null;
          lines?: unknown[];
        };
        const subtotal = Number(quote.subtotal);
        if (!Number.isFinite(subtotal) || subtotal < 0) {
          return Response.json(
            { error: await translateText("payment.api_the_current_cart_returned_an_invalid_subto_7364cc4") },
            { status: 502 },
          );
        }

        const attribution = await referralAttributionForRequest(request);
        let pricing;
        try {
          pricing = await resellerPricingForReferral(attribution?.resellerId ?? null, user.id);
        } catch (error) {
          return Response.json(
            {
              error: error instanceof Error ? error.message : "Could not verify reseller pricing.",
            },
            { status: 503 },
          );
        }
        const discountTotal =
          Math.round(((subtotal * pricing.percent) / 100 + Number.EPSILON) * 100) / 100;
        return Response.json({
          ...quote,
          discount_percent: pricing.percent,
          discount_total: discountTotal,
          total: Math.max(0, subtotal - discountTotal),
          pricing,
        });
      },
    },
  },
});
