import { createFileRoute } from "@tanstack/react-router";
import {
  hashesMatch,
  payuAmount,
  resolvePayuConfig,
  responseHash,
  verifyWithPayu,
} from "@/lib/commerce/payu";
import {
  cardAdapter,
  isCardGateway,
  providerFromHeaders,
  resolveCardConfig,
} from "@/lib/commerce/card-gateways";
import { logPaymentEvent } from "@/lib/commerce/fulfilment";
import {
  claimWebhookEvent,
  orderForReference,
  recordFailedPayment,
  recordReconciliation,
  settleVerifiedPayment,
} from "@/lib/commerce/settlement";
import { correlationId, log, since, withCorrelation } from "@/lib/commerce/observability";

/**
 * Where every payment provider tells us what happened.
 *
 * This is the one canonical webhook. PayU, Flutterwave, Paystack and Stripe all
 * arrive here; which one is speaking is decided from the signature header the
 * request carries, and only that provider's own verifier is then used. There is
 * no second webhook endpoint, because a second endpoint is a second place for
 * the idempotency rules to be got subtly wrong.
 *
 * Nothing here trusts the caller. Before an order is marked paid the callback
 * has to clear five separate checks, and every attempt — passed or failed — is
 * written to payment_logs so a disputed payment can be reconstructed later.
 *
 *   1. the provider's signature must verify against our secret
 *   2. the event must not have been seen before
 *   3. the order named by the reference must exist, and must belong to the
 *      gateway that is calling
 *   4. the amount and currency must match what that order was for
 *   5. the provider's own verify endpoint must agree the payment succeeded
 *
 * Only then does settlement run, and settlement itself is idempotent, so a
 * replay is harmless twice over.
 */

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

/** The event body as an object, for the webhook record. Never re-signed from. */
function safeJson(rawBody: string): Record<string, unknown> {
  try {
    return JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return { raw: rawBody.slice(0, 4000) };
  }
}

/** PayU posts a form; the card providers post JSON. Both need the raw body. */
function payuFields(rawBody: string, contentType: string): Record<string, string> {
  if (contentType.includes("application/json")) {
    return JSON.parse(rawBody) as Record<string, string>;
  }
  const fields: Record<string, string> = {};
  new URLSearchParams(rawBody).forEach((value, key) => {
    fields[key] = String(value);
  });
  return fields;
}

export const Route = createFileRoute("/api/payment/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!url()) {
          console.error("[payment webhook] refused: no database configured");
          return new Response("Not configured", { status: 503 });
        }

        // Read once, as text. Paystack and Stripe sign the exact bytes, so a
        // parsed-and-restringified body would never verify.
        let rawBody: string;
        try {
          rawBody = await request.text();
        } catch {
          return new Response("Unreadable callback", { status: 400 });
        }

        const queryProvider = new URL(request.url).searchParams.get("provider") ?? "";
        const provider =
          providerFromHeaders(request.headers) ??
          (isCardGateway(queryProvider.toLowerCase()) ? queryProvider.toLowerCase() : null);

        // The provider's own id for this delivery where it sends one, so a
        // retried callback and the original share a correlation id.
        const correlation = correlationId(request);
        const startedAt = Date.now();

        const response = provider
          ? await handleCardCallback(request, rawBody, provider, correlation)
          : await handlePayuCallback(request, rawBody, correlation);

        log({
          correlationId: correlation,
          component: "payment-webhook",
          action: "callback",
          status: response.status >= 400 ? "error" : "ok",
          provider: provider ?? "payu",
          httpStatus: response.status,
          durationMs: since(startedAt),
        });
        return withCorrelation(response, correlation);
      },

      // Providers probe the endpoint; answer without revealing anything.
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});

/* -------------------------------------------------------------------------- */
/* Hosted card providers                                                       */
/* -------------------------------------------------------------------------- */

async function handleCardCallback(
  request: Request,
  rawBody: string,
  provider: string,
  correlation: string,
): Promise<Response> {
  const adapter = cardAdapter(provider);
  const config = adapter && isCardGateway(provider) ? await resolveCardConfig(provider) : null;
  if (!adapter || !config) {
    // Fail closed. A callback we cannot check is not a payment.
    console.error(`[${provider} webhook] refused: no credentials configured`);
    return new Response("Payment provider is not configured", { status: 503 });
  }

  // ---- 1. the signature ---------------------------------------------------
  const signatureValid = adapter.verifySignature(config, rawBody, request.headers);
  const envelope = adapter.parseEvent(rawBody);

  await logPaymentEvent(
    null,
    "card_callback_received",
    {
      reference: envelope?.reference ?? null,
      status: envelope?.status ?? null,
      event_id: envelope?.eventId ?? null,
    },
    { signatureValid, provider },
  );

  if (!signatureValid) {
    console.error(`[${provider} webhook] signature rejected`);
    return new Response("Signature rejected", { status: 400 });
  }
  if (!envelope) {
    return new Response("Unrecognised event", { status: 400 });
  }

  // ---- 2. the replay guard ------------------------------------------------
  const claim = await claimWebhookEvent({
    provider,
    eventId: envelope.eventId,
    signatureValid: true,
    payload: safeJson(rawBody),
  });
  if (!claim.claimed) {
    await logPaymentEvent(
      null,
      "card_callback_replay",
      { reference: envelope.reference, event_id: envelope.eventId },
      { provider },
    );
    // Acknowledged, so the provider stops retrying, and nothing is done twice.
    return new Response("Already recorded", { status: 200 });
  }

  // ---- 3. the order -------------------------------------------------------
  const order = await orderForReference(envelope.reference);
  if (!order) {
    await recordReconciliation({
      provider,
      reference: envelope.reference,
      providerPaymentId: envelope.providerPaymentId,
      orderId: null,
      outcome: "unmatched_provider_payment",
      expectedAmount: null,
      observedAmount: envelope.amount,
      expectedCurrency: null,
      observedCurrency: envelope.currency,
      detail: "The provider reported a payment for a reference this platform does not hold.",
    });
    await logPaymentEvent(
      null,
      "card_unknown_reference",
      { reference: envelope.reference },
      { provider },
    );
    return new Response("Unknown transaction", { status: 404 });
  }

  // A callback from a provider the order was never sent to is not this order's
  // payment, whatever the reference says.
  if (order.gateway && order.gateway !== provider) {
    await recordReconciliation({
      provider,
      reference: envelope.reference,
      providerPaymentId: envelope.providerPaymentId,
      orderId: order.id,
      outcome: "gateway_mismatch",
      expectedAmount: order.amountCharged,
      observedAmount: envelope.amount,
      expectedCurrency: order.currencyCharged,
      observedCurrency: envelope.currency,
      detail: `Order was started on ${order.gateway} but ${provider} called back for it.`,
    });
    await logPaymentEvent(
      order.id,
      "card_gateway_mismatch",
      { reference: envelope.reference, expected: order.gateway, observed: provider },
      { provider },
    );
    return new Response("Gateway mismatch", { status: 409 });
  }

  // A refund event is recorded against the sale, never treated as one.
  if (envelope.kind === "refund") {
    await logPaymentEvent(
      order.id,
      "provider_refund_event",
      {
        reference: envelope.reference,
        status: envelope.status,
        amount: envelope.amount,
        currency: envelope.currency,
      },
      { provider, signatureValid: true },
    );
    return new Response("Refund recorded", { status: 200 });
  }

  // ---- 4 and 5. the provider's own word -----------------------------------
  //
  // The callback body is a notification, not evidence. What settles an order is
  // what the provider says when we ask it directly, for our reference.
  const verification = await adapter.verify(config, {
    reference: envelope.reference,
    providerPaymentId: order.providerPaymentId ?? envelope.providerPaymentId,
  });

  await logPaymentEvent(
    order.id,
    "provider_verify",
    {
      reference: envelope.reference,
      reason: verification.reason,
      provider_status: verification.status,
    },
    { signatureValid: true, provider },
  );

  if (!verification.verified) {
    await recordFailedPayment({
      order,
      provider,
      reference: envelope.reference,
      providerStatus: verification.status,
      reason: verification.reason,
      providerPaymentId: verification.providerPaymentId ?? envelope.providerPaymentId,
    });
    await recordReconciliation({
      provider,
      reference: envelope.reference,
      providerPaymentId: verification.providerPaymentId ?? envelope.providerPaymentId,
      orderId: order.id,
      outcome: "missing_transaction",
      expectedAmount: order.amountCharged,
      observedAmount: verification.amount,
      expectedCurrency: order.currencyCharged,
      observedCurrency: verification.currency,
      detail: verification.reason,
    });
    return new Response("Recorded as failed", { status: 200 });
  }

  // A payment that arrives after the intent's window is still the customer's
  // money. It settles, and the lateness is noted rather than used to refuse it.
  if (order.intentExpiresAt && Date.parse(order.intentExpiresAt) < Date.now()) {
    await logPaymentEvent(
      order.id,
      "intent_expired_but_paid",
      { reference: envelope.reference, expires_at: order.intentExpiresAt },
      { provider },
    );
  }

  const settlement = await settleVerifiedPayment({
    order,
    provider,
    reference: envelope.reference,
    providerPaymentId: verification.providerPaymentId ?? envelope.providerPaymentId,
    providerStatus: verification.status,
    observedAmount: verification.amount,
    observedCurrency: verification.currency,
    last4: verification.last4,
    brand: verification.brand,
    eventKey: envelope.eventId,
    correlationId: correlation,
  });

  if (!settlement.ok) {
    return new Response(settlement.reason, { status: settlement.status });
  }
  return new Response("OK", { status: 200 });
}

/* -------------------------------------------------------------------------- */
/* PayU                                                                        */
/* -------------------------------------------------------------------------- */

async function handlePayuCallback(
  request: Request,
  rawBody: string,
  correlation: string,
): Promise<Response> {
  const config = await resolvePayuConfig();
  if (!config) {
    console.error("[payu webhook] refused: no credentials configured");
    return new Response("Payment provider is not configured", { status: 503 });
  }

  let fields: Record<string, string>;
  try {
    fields = payuFields(rawBody, request.headers.get("content-type") ?? "");
  } catch {
    return new Response("Unreadable callback", { status: 400 });
  }

  const txnid = String(fields.txnid ?? "").trim();
  const status = String(fields.status ?? "").toLowerCase();
  const amount = String(fields.amount ?? "").trim();

  // ---- 1. the reverse hash ------------------------------------------------
  const expected = responseHash(config, {
    status,
    txnid,
    amount,
    productinfo: String(fields.productinfo ?? ""),
    firstname: String(fields.firstname ?? ""),
    email: String(fields.email ?? ""),
    additionalCharges: fields.additionalCharges,
  });
  const signatureValid = hashesMatch(expected, String(fields.hash ?? ""));

  await logPaymentEvent(
    null,
    "payu_callback_received",
    { txnid, status, amount },
    { signatureValid, provider: "payu" },
  );

  if (!signatureValid) {
    console.error("[payu webhook] hash mismatch for", txnid);
    return new Response("Signature rejected", { status: 400 });
  }

  // ---- 2. the replay guard ------------------------------------------------
  //
  // PayU sends no event id, so the transaction plus its own payment id is the
  // stable key. Settlement is idempotent regardless, but stopping here saves
  // the verify call on every one of PayU's retries.
  const claim = await claimWebhookEvent({
    provider: "payu",
    eventId: `payu:${txnid}:${fields.mihpayid ?? status}`,
    signatureValid: true,
    // The hash is not stored: it is a signature over our own salt.
    payload: { txnid, status, amount, mihpayid: fields.mihpayid ?? null },
  });
  if (!claim.claimed) {
    await logPaymentEvent(null, "payu_callback_replay", { txnid }, { provider: "payu" });
    return new Response("Already recorded", { status: 200 });
  }

  // ---- 3. the order -------------------------------------------------------
  const order = await orderForReference(txnid);
  if (!order) {
    await recordReconciliation({
      provider: "payu",
      reference: txnid,
      providerPaymentId: fields.mihpayid ?? null,
      orderId: null,
      outcome: "unmatched_provider_payment",
      expectedAmount: null,
      observedAmount: Number(amount) || null,
      expectedCurrency: null,
      observedCurrency: null,
      detail: "PayU reported a payment for a transaction id this platform does not hold.",
    });
    await logPaymentEvent(null, "payu_unknown_txnid", { txnid }, { provider: "payu" });
    return new Response("Unknown transaction", { status: 404 });
  }

  // ---- 4. the amount ------------------------------------------------------
  const charged = order.amountCharged;
  if (charged > 0 && payuAmount(charged) !== payuAmount(Number(amount))) {
    await recordReconciliation({
      provider: "payu",
      reference: txnid,
      providerPaymentId: fields.mihpayid ?? null,
      orderId: order.id,
      outcome: "amount_mismatch",
      expectedAmount: charged,
      observedAmount: Number(amount) || null,
      expectedCurrency: order.currencyCharged,
      observedCurrency: null,
      detail: "PayU settled a different amount than the order was for.",
    });
    await logPaymentEvent(
      order.id,
      "payu_amount_mismatch",
      { txnid, callback_amount: amount, order_amount: payuAmount(charged) },
      { provider: "payu" },
    );
    console.error("[payu webhook] amount mismatch on", txnid);
    return new Response("Amount mismatch", { status: 409 });
  }

  // ---- 5. PayU's own word -------------------------------------------------
  const verified = await verifyWithPayu(config, txnid);
  await logPaymentEvent(
    order.id,
    "payu_verify",
    { txnid, reason: verified.reason, provider_status: verified.status },
    { signatureValid: true, provider: "payu" },
  );

  if (!(status === "success" && verified.verified)) {
    await recordFailedPayment({
      order,
      provider: "payu",
      reference: txnid,
      providerStatus: status,
      reason: verified.reason,
      providerPaymentId: verified.payuId ?? fields.mihpayid ?? null,
    });
    // Kept for the console, which still reads the PayU-specific columns.
    await fetch(
      `${url()}/rest/v1/marketplace_orders?id=eq.${encodeURIComponent(order.id)}`,
      {
        method: "PATCH",
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "",
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ""}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ payu_status: status }),
      },
    );
    return new Response("Recorded as failed", { status: 200 });
  }

  const payuId = verified.payuId ?? fields.mihpayid ?? null;

  // Only now does the customer get anything, and only now does the money reach
  // Finance Manager's ledger.
  const settlement = await settleVerifiedPayment({
    order,
    provider: "payu",
    reference: txnid,
    providerPaymentId: payuId,
    providerStatus: verified.status ?? status,
    observedAmount: Number(amount) || null,
    observedCurrency: order.currencyCharged,
    eventKey: `payu:${txnid}:${fields.mihpayid ?? status}`,
    correlationId: correlation,
  });

  if (!settlement.ok) {
    return new Response(settlement.reason, { status: settlement.status });
  }

  // The PayU-specific columns the Finance console already reads.
  await fetch(`${url()}/rest/v1/marketplace_orders?id=eq.${encodeURIComponent(order.id)}`, {
    method: "PATCH",
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "",
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ""}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ payu_status: status, payu_txn_id: payuId }),
  });

  return new Response("OK", { status: 200 });
}
