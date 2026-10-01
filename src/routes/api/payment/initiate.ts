import { createFileRoute } from "@tanstack/react-router";
import {
  newTxnId, payuAmount, payuConfig, requestHash, usdToInr,
} from "@/lib/commerce/payu";
import { logPaymentEvent } from "@/lib/commerce/fulfilment";
import { recordPaymentIntent, type PayuAttempt } from "@/lib/commerce/payu-settle";
import { languageOf } from "@/lib/i18n/server-translate.server";
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
            `?select=id,buyer_id,user_id,status,total,currency,txnid,amount_inr,fx_rate,payu_status,metadata` +
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
        // Only an order still waiting for its money can be paid. A paid,
        // cancelled or refunded order is never charged again.
        const orderStatus = String(order.status ?? "").toLowerCase();
        if (orderStatus === "paid") {
          return Response.json({ error: "That order is already paid" }, { status: 409 });
        }
        if (orderStatus !== "pending_payment") {
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json({ error: "That order can no longer be paid" }, { status: 409 });
        }

        const orderTotal = Number(order.total ?? 0);
        if (!(orderTotal > 0)) {
          return Response.json({ error: "That order has no amount" }, { status: 409 });
        }

        // The order total is in the currency it was priced in (order.currency).
        // currency_charged is what an earlier attempt charged - always INR - and
        // must never be read as the pricing currency: it turned a $249 order
        // into ₹249 on the second attempt.
        const orderCurrency = String(order.currency ?? "USD").trim().toUpperCase();
        if (orderCurrency !== "USD" && orderCurrency !== "INR") {
          return Response.json(
            // i18n-ignore: an API error message; this API answers in English.
            { error: "This order's currency cannot be charged online yet. Please contact support." },
            { status: 409 },
          );
        }

        // A transaction id is used once at PayU. The same attempt keeps its id
        // and the amount it was quoted, so a customer who comes back does not
        // create a second transaction or get a different price; an attempt
        // PayU already answered as failed gets a fresh id, and the old one is
        // kept so a late answer for it can still be matched to this order.
        const metadata = (order.metadata as Record<string, unknown> | null) ?? {};
        const previousTxnid = String(order.txnid ?? "");
        const previousFailed = Boolean(previousTxnid) && Boolean(order.payu_status) &&
          String(order.payu_status).toLowerCase() !== "success";
        const reuse = Boolean(previousTxnid) && !previousFailed && Number(order.amount_inr ?? 0) > 0;
        const attempts = Array.isArray(metadata.payu_attempts)
          ? (metadata.payu_attempts as PayuAttempt[])
          : [];
        if (previousFailed) {
          attempts.push({ txnid: previousTxnid, amount_inr: Number(order.amount_inr ?? 0) || null });
        }

        // PayU settles in rupees. An order already priced in rupees needs no
        // conversion at all - putting it through the lookup made it depend on
        // an exchange-rate source it has no use for.
        const converted = reuse
          ? { rate: Number(order.fx_rate ?? 1) || 1, amount: Number(order.amount_inr) }
          : orderCurrency === "INR"
            ? { rate: 1, amount: orderTotal }
            : await usdToInr(orderTotal);
        if (!converted) {
          await logPaymentEvent(orderId, "fx_lookup_failed", {
            amount_usd: orderTotal,
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

        const txnid = reuse ? previousTxnid : newTxnId();
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

        // Only while the order is still unpaid: a webhook that settled it in
        // the meantime must not be undone by a second tab starting to pay.
        const started = await fetch(
          `${url()}/rest/v1/marketplace_orders?id=eq.${encodeURIComponent(orderId)}&status=eq.pending_payment`,
          {
            method: "PATCH",
            headers: { ...admin(), Prefer: "return=representation" },
            body: JSON.stringify({
              txnid,
              amount_usd: orderCurrency === "USD" ? orderTotal : null,
              fx_rate: converted.rate,
              amount_inr: converted.amount,
              currency_charged: "INR",
              payment_gateway: "payu",
              // A fresh attempt has no answer from PayU yet.
              payu_status: reuse ? (order.payu_status ?? null) : null,
              // The language the buyer is using, for the licence e-mail: the
              // payment provider's callback carries no cookies to read it from.
              metadata: {
                ...metadata,
                language: languageOf(request),
                ...(attempts.length ? { payu_attempts: attempts } : {}),
              },
              updated_at: new Date().toISOString(),
            }),
          },
        );
        const startedRows = started.ok ? ((await started.json()) as unknown[]) : null;
        if (!startedRows) {
          await logPaymentEvent(orderId, "payment_initiate_failed", { txnid, status: started.status });
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json({ error: "The payment could not be started. Please try again." }, { status: 502 });
        }
        if (startedRows.length === 0) {
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json({ error: "That order can no longer be paid" }, { status: 409 });
        }
        await recordPaymentIntent(orderId, { status: "pending", txnid, amount: converted.amount });

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
                order_total: orderTotal,
                currency: orderCurrency,
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
          txnid, order_total: orderTotal, currency: orderCurrency, reused: reuse, fx_rate: converted.rate, amount_inr: converted.amount,
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
