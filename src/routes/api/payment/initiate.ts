import { createFileRoute } from "@tanstack/react-router";
import {
  newTxnId,
  payuAmount,
  railConfiguration,
  resolvePayuConfig,
  requestHash,
  usdToInr,
} from "@/lib/commerce/payu";
import {
  cardAdapter,
  isCardGateway,
  resolveCardConfig,
  type PaymentIntent,
} from "@/lib/commerce/card-gateways";
import { defaultCardGateway, paymentOptions } from "@/lib/commerce/payment-routing";
import { logPaymentEvent } from "@/lib/commerce/fulfilment";
import { createOrReuseIntent, intentForReference } from "@/lib/commerce/settlement";
import {
  REFERRAL_COOKIE,
  attributeOrder,
  attributionForSession,
  readCookie,
  rest,
} from "@/lib/affiliate/core";
import { mayStartPayment, requestAddress } from "@/lib/commerce/payment-guard";
import { correlationId, log, since, withCorrelation } from "@/lib/commerce/observability";

/**
 * Start a payment.
 *
 * The customer's browser tells us which order to pay for and which of the
 * offered methods they picked. It never tells us what to charge. The price is
 * read from the order in the database, converted server side where the rail
 * needs it, and either signed with a salt the browser never sees (PayU) or
 * turned into a checkout the provider hosts itself (Flutterwave, Paystack,
 * Stripe) — so a customer cannot choose what they are charged.
 *
 * For a card rail the response is a URL to send the browser to. The card
 * number, the CVV and any 3-D Secure step happen on the provider's own page.
 * Nothing on this server ever receives them, and there is no code path here
 * that could.
 *
 * For PayU the response is the exact set of fields to POST. The salt is not
 * among them. That path is unchanged.
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

/** Where the request came from, as the edge reports it. A signal, not a verdict. */
function requestCountry(request: Request): string | null {
  const country =
    request.headers.get("cf-ipcountry") ??
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("x-country-code");
  const code = String(country ?? "").trim().toUpperCase();
  return code && code !== "XX" && code.length === 2 ? code : null;
}

/**
 * How many payment attempts this order has already failed.
 *
 * A card being retried a few times is ordinary — a wrong expiry date, a bank
 * declining once. A card being retried twenty times is somebody working through
 * a list, and the limit is what stops this endpoint being the tool they use.
 * It counts attempts, never card data, because there is none to count.
 */
const MAX_FAILED_ATTEMPTS = 8;

async function failedAttempts(orderId: string): Promise<number> {
  try {
    const response = await fetch(
      `${url()}/rest/v1/payment_logs?select=id&order_id=eq.${encodeURIComponent(orderId)}` +
        `&event_type=in.(payment_failed,payu_amount_mismatch,payment_amount_mismatch,payment_currency_mismatch)` +
        `&limit=${MAX_FAILED_ATTEMPTS + 1}`,
      { headers: admin() },
    );
    if (!response.ok) return 0;
    return ((await response.json()) as unknown[]).length;
  } catch {
    return 0;
  }
}

/**
 * Credit whoever referred this sale, while their cookie is still on the request.
 *
 * The callback that confirms the payment comes from the provider and carries no
 * cookies at all, so this is the only point at which the referral can still be
 * resolved. Nothing here may block a payment: an order that cannot be
 * attributed is simply an unattributed order.
 */
async function attributeReferral(
  request: Request,
  orderId: string,
  userId: string,
  amountUsd: number,
): Promise<void> {
  try {
    const sessionKey = readCookie(request, REFERRAL_COOKIE);
    if (!sessionKey) return;
    const attribution = await attributionForSession(sessionKey);
    if (!attribution) return;

    // An affiliate buying through their own link is recorded and flagged
    // rather than quietly credited, so a person can decide.
    let selfReferral = false;
    if (attribution.affiliatePartnerId) {
      const partner = await rest(
        `marketplace_affiliate_partners?select=user_id` +
          `&id=eq.${encodeURIComponent(attribution.affiliatePartnerId)}&limit=1`,
      );
      if (partner.ok) {
        const rows = (await partner.json()) as { user_id: string | null }[];
        selfReferral = rows[0]?.user_id === userId;
      }
    }
    const attributed = await attributeOrder(orderId, attribution, {
      buyer_id: userId,
      order_total: amountUsd,
      currency: "USD",
      self_referral: selfReferral,
      risk: selfReferral ? "REVIEW" : "NORMAL",
      risk_reason: selfReferral ? "buyer owns the referring affiliate account" : null,
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
  } catch (error) {
    // Logged, never raised — a referral problem is not a payment problem.
    await logPaymentEvent(orderId, "referral_attribution_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function patchOrder(orderId: string, patch: Record<string, unknown>): Promise<void> {
  await fetch(`${url()}/rest/v1/marketplace_orders?id=eq.${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    headers: { ...admin(), Prefer: "return=minimal" },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
}

/** A payment intent is good for an hour. After that the customer starts again. */
const INTENT_TTL_MS = 60 * 60 * 1000;

export const Route = createFileRoute("/api/payment/initiate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // One id from here to the licence: echoed to the caller, carried into
        // payment_logs, committed onto the settlement's outbox event, and
        // picked up again by whichever worker finishes the job.
        const correlation = correlationId(request);
        const startedAt = Date.now();

        const user = await currentUser(request);
        if (!user) {
          return withCorrelation(
            Response.json({ error: "Please sign in to pay." }, { status: 401 }),
            correlation,
          );
        }

        let body: { orderId?: string; gateway?: string; firstname?: string; phone?: string };
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

        // Retrying is allowed. Retrying without limit is how a stolen card list
        // gets tested, so the attempt count is a wall rather than a warning.
        if ((await failedAttempts(orderId)) > MAX_FAILED_ATTEMPTS) {
          await logPaymentEvent(
            orderId,
            "payment_blocked_velocity",
            { attempts: MAX_FAILED_ATTEMPTS },
            {},
          );
          return Response.json(
            {
              error:
                "Too many failed attempts on this order. Please contact support so we can help " +
                "you complete it.",
            },
            { status: 429 },
          );
        }

        const orderCurrency = String(order.currency_charged ?? order.currency ?? "USD")
          .trim()
          .toUpperCase();
        const country = requestCountry(request);

        // Which rail. What the browser asked for, if it is genuinely available
        // to this buyer; otherwise whichever card rail is.
        const requested = String(body.gateway ?? "").trim().toLowerCase();
        const available = await paymentOptions({ currency: orderCurrency, country });
        const chosen = requested
          ? available.find((option) => option.code === requested)
          : undefined;

        if (requested && (!chosen || !chosen.ready)) {
          return Response.json(
            {
              error: chosen
                ? `${chosen.displayName} is not available for this order: ${chosen.reason}`
                : "That payment method is not available for this order.",
              options: available.filter((option) => option.ready).map((option) => option.code),
            },
            { status: 409 },
          );
        }

        const gateway =
          chosen?.code ?? (await defaultCardGateway({ currency: orderCurrency, country })) ?? "payu";

        // ---- may this payment start at all? --------------------------------
        //
        // The rail's own switch, the country policy, the emergency board, the
        // blacklist and the rate limits, all asked before a provider is
        // contacted — so a switched-off rail costs nothing and an automated
        // caller is stopped before it reaches anybody's gateway.
        const permitted = await mayStartPayment({
          userId: user.id,
          address: requestAddress(request),
          country,
          method: gateway,
          correlationId: correlation,
        });
        if (!permitted.ok) {
          await logPaymentEvent(
            orderId,
            "payment_refused_by_control",
            { reason: permitted.error, gateway, country, correlation_id: correlation },
            { provider: gateway },
          );
          return withCorrelation(
            Response.json(
              { error: permitted.error },
              {
                status: permitted.status,
                headers: permitted.retryAfter
                  ? { "Retry-After": String(permitted.retryAfter) }
                  : undefined,
              },
            ),
            correlation,
          );
        }

        // Reuse the transaction id if this order already has one, so a customer
        // who retries does not create a second transaction for one order.
        const txnid = String(order.txnid ?? "") || newTxnId();

        // An intent that has already produced a payment is finished. Nothing
        // may reopen it, which is what stops a settled reference being paid a
        // second time by a stale tab or a replayed request.
        const priorIntent = await intentForReference(txnid);
        if (priorIntent && ["succeeded", "processing"].includes(priorIntent.status)) {
          return Response.json(
            {
              error:
                priorIntent.status === "succeeded"
                  ? "That order has already been paid."
                  : "That payment is already being processed. Give it a moment.",
            },
            { status: 409 },
          );
        }

        // The intent's window is reused while it is still open, so a retry does
        // not quietly extend how long a quoted price stays valid.
        const expiresAt =
          priorIntent?.expires_at && Date.parse(priorIntent.expires_at) > Date.now()
            ? priorIntent.expires_at
            : new Date(Date.now() + INTENT_TTL_MS).toISOString();

        // The description the customer sees on the provider's page. It comes
        // from the order line, because order.metadata is empty on every order
        // this table holds.
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
        const firstname = String(body.firstname ?? user.email.split("@")[0] ?? "Customer").slice(
          0,
          60,
        );

        /* ---------------- card rails: a checkout the provider hosts --------- */

        if (isCardGateway(gateway)) {
          const adapter = cardAdapter(gateway);
          const config = await resolveCardConfig(gateway);
          if (!adapter || !config) {
            return Response.json(
              { error: "That payment method is not configured yet. Please contact support." },
              { status: 503 },
            );
          }

          // The card rail charges the order's own currency. There is no
          // conversion, so there is no rate to snapshot and no historical value
          // that a later rate could rewrite.
          const intent: PaymentIntent = {
            reference: txnid,
            orderId,
            userId: user.id,
            email: user.email,
            name: firstname,
            phone: String(body.phone ?? "").slice(0, 20),
            description: productinfo,
            amount: amountUsd,
            currency: orderCurrency,
            baseAmount: amountUsd,
            baseCurrency: String(order.currency ?? "USD").toUpperCase(),
            expiresAt,
          };

          // Written before the customer leaves, so a callback that arrives
          // before this request finishes still finds an order to match.
          await patchOrder(orderId, {
            txnid,
            amount_usd: amountUsd,
            amount_charged: amountUsd,
            currency_charged: orderCurrency,
            fx_rate: 1,
            payment_gateway: gateway,
            provider_status: null,
            intent_expires_at: expiresAt,
            status: "pending_payment",
          });

          // The canonical payment intent. Created once and reused after that,
          // so the amount and the currency the customer is about to be shown
          // are fixed on the server and cannot be moved by a later request.
          const record = await createOrReuseIntent({
            reference: txnid,
            orderId,
            userId: user.id,
            gatewayCode: gateway,
            amount: amountUsd,
            currency: orderCurrency,
            baseAmount: amountUsd,
            baseCurrency: String(order.currency ?? "USD").toUpperCase(),
            fxRate: 1,
            expiresAt,
          });
          if (!record) {
            return Response.json(
              { error: "The payment could not be started. Nothing was charged." },
              { status: 503 },
            );
          }

          await attributeReferral(request, orderId, user.id, amountUsd);

          const checkout = await adapter.createCheckout(config, intent);
          if (!checkout.ok) {
            await logPaymentEvent(
              orderId,
              "checkout_create_failed",
              { reference: txnid, detail: checkout.error },
              { provider: gateway },
            );
            return Response.json(
              {
                error:
                  "The payment could not be started. The order is saved and nothing was charged.",
                detail: checkout.error,
              },
              { status: 502 },
            );
          }

          // Stripe cannot look a session up by our reference, so its session id
          // is recorded now — without it the payment could not be verified.
          if (checkout.providerReference) {
            await patchOrder(orderId, { provider_payment_id: checkout.providerReference });
          }

          await logPaymentEvent(
            orderId,
            "payment_initiated",
            {
              reference: txnid,
              amount: amountUsd,
              currency: orderCurrency,
              country: country ?? null,
              expires_at: expiresAt,
              correlation_id: correlation,
            },
            { provider: gateway },
          );

          log({
            correlationId: correlation,
            component: "payment-initiate",
            action: "checkout_created",
            status: "ok",
            userId: user.id,
            orderId,
            reference: txnid,
            provider: gateway,
            durationMs: since(startedAt),
          });

          return withCorrelation(
            Response.json({
              mode: "redirect",
              gateway,
            // Named so the checkout can say who is taking the payment, and only
            // ever the provider that actually is.
              trustLabel: adapter.trustLabel,
              redirectUrl: checkout.redirectUrl,
              reference: txnid,
              amount: amountUsd,
              currency: orderCurrency,
              expiresAt,
            }),
            correlation,
          );
        }

        /* ---------------- manual rails: Wise, bank, UPI, Binance ------------ */
        //
        // These are settled by a person, not by an API. The customer is given
        // the route and the reference; the order stays pending until somebody
        // in Finance confirms the money arrived. Returning from Wise is not
        // proof of payment, so nothing here activates anything.

        if (gateway !== "payu") {
          const rail = await railConfiguration(gateway);
          if (!rail.enabled) {
            return Response.json(
              { error: "That payment method is not available right now." },
              { status: 503 },
            );
          }

          await patchOrder(orderId, {
            txnid,
            amount_usd: amountUsd,
            amount_charged: amountUsd,
            currency_charged: orderCurrency,
            fx_rate: 1,
            payment_gateway: gateway,
            intent_expires_at: expiresAt,
            status: "pending_payment",
          });

          await createOrReuseIntent({
            reference: txnid,
            orderId,
            userId: user.id,
            gatewayCode: gateway,
            amount: amountUsd,
            currency: orderCurrency,
            baseAmount: amountUsd,
            baseCurrency: String(order.currency ?? "USD").toUpperCase(),
            fxRate: 1,
            expiresAt,
          });

          await attributeReferral(request, orderId, user.id, amountUsd);

          await logPaymentEvent(
            orderId,
            "payment_initiated",
            {
              reference: txnid,
              amount: amountUsd,
              currency: orderCurrency,
              country: country ?? null,
              manual: true,
              correlation_id: correlation,
            },
            { provider: gateway },
          );

          // Only what a customer needs in order to pay. Software Vala's own
          // bank details are never sent in full — the masked view lives in
          // Finance Manager, and support gives the rest directly.
          const payLink = String(rail.config["pay_link"] ?? "").trim();
          return Response.json({
            mode: "manual",
            gateway,
            displayName: chosen?.displayName ?? gateway,
            reference: txnid,
            amount: amountUsd,
            currency: orderCurrency,
            expiresAt,
            payLink: payLink || null,
            instructions:
              String(rail.config["instructions"] ?? "").trim() ||
              "Use the reference above when you pay. Your order stays reserved and is activated " +
                "once our team confirms the payment has arrived.",
          });
        }

        /* ---------------- PayU: unchanged ----------------------------------- */

        const config = await resolvePayuConfig();
        if (!config) {
          return Response.json(
            { error: "Online payment is not configured yet. Please contact support." },
            { status: 503 },
          );
        }

        // PayU settles in rupees. An order already priced in rupees needs no
        // conversion at all — putting it through the lookup made it depend on
        // an exchange-rate source it has no use for.
        const converted =
          orderCurrency === "INR" ? { rate: 1, amount: amountUsd } : await usdToInr(amountUsd);
        if (!converted) {
          await logPaymentEvent(orderId, "fx_lookup_failed", {
            amount_usd: amountUsd,
            currency: orderCurrency,
            configured: Boolean(process.env.FX_API_URL?.trim()),
          });
          return Response.json(
            {
              error:
                "We could not work out today's exchange rate, so this payment was not started.",
              // Named so an operator reading the response knows what to set,
              // rather than being told to try again against a wall.
              detail: process.env.FX_API_URL?.trim()
                ? "The exchange-rate service did not answer."
                : "No exchange-rate source is configured (FX_API_URL).",
            },
            { status: 503 },
          );
        }

        const amount = payuAmount(converted.amount);

        await patchOrder(orderId, {
          txnid,
          amount_usd: amountUsd,
          fx_rate: converted.rate,
          amount_inr: converted.amount,
          amount_charged: converted.amount,
          currency_charged: "INR",
          payment_gateway: "payu",
          intent_expires_at: expiresAt,
          status: "pending_payment",
        });

        await createOrReuseIntent({
          reference: txnid,
          orderId,
          userId: user.id,
          gatewayCode: "payu",
          amount: converted.amount,
          currency: "INR",
          baseAmount: amountUsd,
          baseCurrency: String(order.currency ?? "USD").toUpperCase(),
          // The rate snapshot lives on the intent and is never recalculated.
          fxRate: converted.rate,
          expiresAt,
        });

        await attributeReferral(request, orderId, user.id, amountUsd);

        const hash = requestHash(config, {
          txnid,
          amount,
          productinfo,
          firstname,
          email: user.email,
        });

        await logPaymentEvent(
          orderId,
          "payment_initiated",
          {
            txnid,
            amount_usd: amountUsd,
            fx_rate: converted.rate,
            amount_inr: converted.amount,
            expires_at: expiresAt,
          },
          { provider: "payu" },
        );

        return Response.json({
          mode: "form",
          gateway: "payu",
          action: `${config.baseUrl}${config.paymentEndpoint}`,
          method: "POST",
          reference: txnid,
          expiresAt,
          fields: {
            key: config.merchantKey,
            txnid,
            amount,
            productinfo,
            firstname,
            email: user.email,
            phone: String(body.phone ?? "").slice(0, 20),
            // The reference travels on the return URL, the way the card
            // gateways already do it.
            //
            // Without it the return page had nothing to identify the payment
            // by. PayU sends the customer back by POSTing its result as form
            // fields, and a browser POST puts nothing in `location.search` —
            // so the page read an empty query string, found no reference, and
            // told the customer "We could not identify that payment" for a
            // payment that had gone through perfectly. Naming it here means the
            // page can ask our own server which order this was.
            //
            // The reference is an order reference and not a secret: it is
            // printed on the page, quoted to support, and the status endpoint
            // still requires the buyer's own session before it will return a
            // licence key or recover a missed callback. Safe to put in a URL,
            // and outside the request hash — which covers
            // key|txnid|amount|productinfo|firstname|email|udf1..udf10|salt and
            // never surl or furl — so signing is unaffected.
            surl: `${config.appBaseUrl}/payment/success?txnid=${encodeURIComponent(txnid)}`,
            furl: `${config.appBaseUrl}/payment/fail?txnid=${encodeURIComponent(txnid)}`,
            hash,
          },
        });
      },
    },
  },
});
