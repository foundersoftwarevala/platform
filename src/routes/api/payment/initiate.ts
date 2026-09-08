import { createFileRoute } from "@tanstack/react-router";
import {
  newTxnId, payuAmount, payuConfig, requestHash, usdToInr,
} from "@/lib/commerce/payu";
import { logPaymentEvent } from "@/lib/commerce/fulfilment";
import {
  REFERRAL_COOKIE, attributeOrder, attributionForSession, readCookie, rest,
} from "@/lib/affiliate/core";

/**
 * Start a payment.
 *
 * The customer's browser tells us which order to pay for and nothing else. The
 * price is read from the order in the database, converted server side, and the
 * hash is computed with a salt the browser never sees — so a customer cannot
 * choose what they are charged.
 *
 * The response is the exact set of fields to POST to PayU. The salt is not
 * among them.
 */

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function currentUser(request: Request) {
  const publishable =
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? process.env.SUPABASE_ANON_KEY?.trim();
  const authorization = request.headers.get("authorization");
  if (!url() || !publishable || !authorization) return null;
  try {
    const response = await fetch(`${url()}/auth/v1/user`, {
      headers: { apikey: publishable, Authorization: authorization },
    });
    if (!response.ok) return null;
    const user = (await response.json()) as { id?: string; email?: string };
    return user?.id ? { id: user.id, email: user.email ?? "" } : null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/payment/initiate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const config = payuConfig();
        if (!config) {
          return Response.json(
            { error: "Online payment is not configured yet. Please contact support." },
            { status: 503 },
          );
        }

        const user = await currentUser(request);
        if (!user) {
          return Response.json({ error: "Please sign in to pay." }, { status: 401 });
        }

        let body: { orderId?: string; firstname?: string; phone?: string };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }
        const orderId = String(body.orderId ?? "").trim();
        if (!orderId) return Response.json({ error: "An order is required" }, { status: 400 });

        // The order, and its owner, come from the database — not the request.
        const orderResponse = await fetch(
          `${url()}/rest/v1/marketplace_orders` +
            `?select=id,buyer_id,user_id,status,total,currency,currency_charged,txnid,metadata` +
            `&id=eq.${encodeURIComponent(orderId)}&limit=1`,
          { headers: admin() },
        );
        const orders = orderResponse.ok
          ? ((await orderResponse.json()) as Record<string, unknown>[])
          : [];
        const order = orders[0];
        if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

        const owner = String(order.user_id ?? order.buyer_id ?? "");
        if (owner !== user.id) {
          return Response.json({ error: "That order is not yours" }, { status: 403 });
        }
        if (String(order.status).toLowerCase() === "paid") {
          return Response.json({ error: "That order is already paid" }, { status: 409 });
        }

        const amountUsd = Number(order.total ?? 0);
        if (!(amountUsd > 0)) {
          return Response.json({ error: "That order has no amount" }, { status: 409 });
        }

        // PayU settles in rupees. An order already priced in rupees needs no
        // conversion at all - putting it through the lookup made it depend on
        // an exchange-rate source it has no use for.
        const orderCurrency = String(order.currency_charged ?? order.currency ?? "USD")
          .trim()
          .toUpperCase();
        const converted =
          orderCurrency === "INR"
            ? { rate: 1, amount: amountUsd }
            : await usdToInr(amountUsd);
        if (!converted) {
          await logPaymentEvent(orderId, "fx_lookup_failed", {
            amount_usd: amountUsd,
            currency: orderCurrency,
            configured: Boolean(process.env.FX_API_URL?.trim()),
          });
          return Response.json(
            {
              error: "We could not work out today's exchange rate, so this payment was not started.",
              // Named so an operator reading the response knows what to set,
              // rather than being told to try again against a wall.
              detail: process.env.FX_API_URL?.trim()
                ? "The exchange-rate service did not answer."
                : "No exchange-rate source is configured (FX_API_URL).",
            },
            { status: 503 },
          );
        }

        // Reuse the transaction id if this order already has one, so a customer
        // who retries does not create a second transaction for one order.
        const txnid = String(order.txnid ?? "") || newTxnId();
        const amount = payuAmount(converted.amount);
        // The description the customer sees on the PayU page, and one of the
        // fields hashed into the request. It comes from the order line, because
        // order.metadata is empty on every order this table holds.
        let lineName: string | null = null;
        try {
          const lineResponse = await fetch(
            `${url()}/rest/v1/marketplace_order_items?select=product_name` +
              `&order_id=eq.${encodeURIComponent(orderId)}&limit=1`,
            { headers: admin() },
          );
          if (lineResponse.ok) {
            const rows = (await lineResponse.json()) as { product_name: string | null }[];
            lineName = rows[0]?.product_name ?? null;
          }
        } catch {
          lineName = null;
        }
        const productinfo = String(
          (order.metadata as { product_name?: string })?.product_name ??
            lineName ??
            "Software Vala licence",
        ).slice(0, 100);
        const firstname = String(body.firstname ?? user.email.split("@")[0] ?? "Customer").slice(0, 60);

        await fetch(`${url()}/rest/v1/marketplace_orders?id=eq.${encodeURIComponent(orderId)}`, {
          method: "PATCH",
          headers: { ...admin(), Prefer: "return=minimal" },
          body: JSON.stringify({
            txnid,
            amount_usd: amountUsd,
            fx_rate: converted.rate,
            amount_inr: converted.amount,
            currency_charged: "INR",
            payment_gateway: "payu",
            status: "pending_payment",
            updated_at: new Date().toISOString(),
          }),
        });

        // Credit whoever referred this sale, while their cookie is still on the
        // request. The webhook that confirms the payment comes from PayU and
        // carries no cookies at all, so this is the only point at which the
        // referral can still be resolved.
        //
        // Nothing here may block a payment. An order that cannot be attributed
        // is simply an unattributed order, which is what every order is today.
        try {
          const sessionKey = readCookie(request, REFERRAL_COOKIE);
          if (sessionKey) {
            const attribution = await attributionForSession(sessionKey);
            if (attribution) {
              // An affiliate buying through their own link is recorded and
              // flagged rather than quietly credited, so a person can decide.
              let selfReferral = false;
              if (attribution.affiliatePartnerId) {
                const partner = await rest(
                  `marketplace_affiliate_partners?select=user_id` +
                    `&id=eq.${encodeURIComponent(attribution.affiliatePartnerId)}&limit=1`,
                );
                if (partner.ok) {
                  const rows = (await partner.json()) as { user_id: string | null }[];
                  selfReferral = rows[0]?.user_id === user.id;
                }
              }
              const attributed = await attributeOrder(orderId, attribution, {
                buyer_id: user.id,
                order_total: amountUsd,
                currency: "USD",
                self_referral: selfReferral,
                risk: selfReferral ? "REVIEW" : "NORMAL",
                risk_reason: selfReferral
                  ? "buyer owns the referring affiliate account"
                  : null,
                stamped_at: "payment_initiate",
              });
              await logPaymentEvent(orderId, "referral_attributed", {
                created: attributed.created,
                reason: attributed.reason ?? null,
                affiliate_partner_id: attribution.affiliatePartnerId ?? null,
                influencer_profile_id: attribution.influencerProfileId ?? null,
                reseller_id: attribution.resellerId ?? null,
                self_referral: selfReferral,
              });
            }
          }
        } catch (error) {
          // Logged, never raised — a referral problem is not a payment problem.
          await logPaymentEvent(orderId, "referral_attribution_failed", {
            message: error instanceof Error ? error.message : String(error),
          });
        }

        const hash = requestHash(config, { txnid, amount, productinfo, firstname, email: user.email });

        await logPaymentEvent(orderId, "payment_initiated", {
          txnid, amount_usd: amountUsd, fx_rate: converted.rate, amount_inr: converted.amount,
        }, { provider: "payu" });

        return Response.json({
          action: `${config.baseUrl}${config.paymentEndpoint}`,
          method: "POST",
          fields: {
            key: config.merchantKey,
            txnid,
            amount,
            productinfo,
            firstname,
            email: user.email,
            phone: String(body.phone ?? "").slice(0, 20),
            surl: `${config.appBaseUrl}/payment/success`,
            furl: `${config.appBaseUrl}/payment/fail`,
            hash,
          },
        });
      },
    },
  },
});
