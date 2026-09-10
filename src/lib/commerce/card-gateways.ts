import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { railConfiguration } from "@/lib/commerce/payu";
import { providerFetch, type ProviderOperation } from "@/lib/commerce/provider-call";

/**
 * Global card payment, without raw card data ever reaching this server.
 *
 * Every provider here is entered the same way: we ask the provider to create a
 * checkout it hosts itself, and we hand the customer a URL. The card number,
 * the CVV and any 3-D Secure step happen on the provider's own page, inside the
 * provider's own PCI scope. What comes back to Software Vala is a reference, a
 * status and an amount — never a PAN, never a CVV, never track data. There is
 * deliberately no code path in this file that accepts a card number, because a
 * path that exists is a path that eventually gets used.
 *
 * The shape mirrors lib/commerce/payu.ts on purpose, because the two rules that
 * file was built on apply identically to every card provider:
 *
 *   1. **The browser is never believed.** Coming back to /payment/success proves
 *      nothing at all. A payment is real once the provider's own verify call
 *      says it is, for the reference we created, at the amount we asked for.
 *   2. **No credentials, no pretending.** A provider with no keys refuses. It
 *      never falls back to a mock success.
 *
 * Credentials live where every other rail's credentials live — in
 * finance_payment_rails.configuration_state.secrets, which Finance Manager
 * already shows and edits, and which the data layer strips before a row reaches
 * a browser. Nothing here reads a new table or invents a second config system.
 */

export const CARD_GATEWAYS = ["flutterwave", "paystack", "stripe"] as const;
export type CardGatewayCode = (typeof CARD_GATEWAYS)[number];

export function isCardGateway(code: string): code is CardGatewayCode {
  return (CARD_GATEWAYS as readonly string[]).includes(code);
}

export type CardGatewayConfig = {
  code: CardGatewayCode;
  displayName: string;
  secretKey: string;
  publicKey: string;
  /** The value a provider signs (or echoes) its webhooks with. */
  webhookSecret: string;
  apiBaseUrl: string;
  appBaseUrl: string;
};

/** What the server knows about a payment before the customer has paid it. */
export type PaymentIntent = {
  /** Our reference. The same txnid the order carries, so one order is one payment. */
  reference: string;
  orderId: string;
  userId: string;
  email: string;
  name: string;
  phone: string;
  description: string;
  /** The amount actually being charged, in major units of `currency`. */
  amount: number;
  currency: string;
  /** What the order is priced at in the reporting currency, kept for the record. */
  baseAmount: number;
  baseCurrency: string;
  expiresAt: string;
};

export type HostedCheckout =
  | {
      ok: true;
      redirectUrl: string;
      /** The provider's own handle for this checkout, where it issues one up front. */
      providerReference: string | null;
    }
  | { ok: false; error: string };

export type ProviderVerification = {
  verified: boolean;
  reason: string;
  status: string;
  /** Major units, as the provider reports them. */
  amount: number | null;
  currency: string | null;
  providerPaymentId: string | null;
  reference: string | null;
  /** Safe display metadata only, and only when the provider volunteers it. */
  last4: string | null;
  brand: string | null;
};

export type WebhookEnvelope = {
  /** The provider's own event id, which is what makes a replay detectable. */
  eventId: string;
  reference: string;
  providerPaymentId: string | null;
  status: string;
  amount: number | null;
  currency: string | null;
  kind: "payment" | "refund" | "other";
};

export type RefundOutcome =
  | { ok: true; providerRefundId: string; status: string }
  | { ok: false; error: string };

/**
 * Currencies a provider quotes in the smallest unit rather than the major one.
 * Getting this backwards charges a customer a hundred times too much or too
 * little, so the conversion lives in one place and every caller uses it.
 */
const ZERO_DECIMAL = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "JPY",
  "KMF",
  "KRW",
  "MGA",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);

export function toMinorUnits(amount: number, currency: string): number {
  const code = currency.trim().toUpperCase();
  if (ZERO_DECIMAL.has(code)) return Math.round(amount);
  return Math.round(amount * 100);
}

export function fromMinorUnits(amount: number, currency: string): number {
  const code = currency.trim().toUpperCase();
  if (ZERO_DECIMAL.has(code)) return amount;
  return Math.round(amount) / 100;
}

/** Compare two signatures without leaking their contents through timing. */
function signaturesMatch(a: string, b: string): boolean {
  const left = Buffer.from(String(a ?? "").trim().toLowerCase(), "utf8");
  const right = Buffer.from(String(b ?? "").trim().toLowerCase(), "utf8");
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

/* -------------------------------------------------------------------------- */
/* Reaching a provider                                                         */
/* -------------------------------------------------------------------------- */

/**
 * A provider call that never produced an answer.
 *
 * The distinction this carries is the one that matters after a payment: a
 * provider that *replied* — even to refuse — leaves us knowing what happened,
 * while a timeout, a dropped connection or an open circuit leaves us knowing
 * nothing at all. The adapters below already catch and turn failures into their
 * own return shapes; this simply lets them say which of the two it was.
 */
class ProviderCallError extends Error {
  constructor(
    message: string,
    readonly kind: "circuit_open" | "timeout" | "network" | "upstream",
  ) {
    super(message);
    this.name = "ProviderCallError";
  }
}

/** True when we genuinely cannot tell whether the provider acted on the call. */
function isUnknownOutcome(error: unknown): error is ProviderCallError {
  return (
    error instanceof ProviderCallError &&
    (error.kind === "timeout" || error.kind === "circuit_open")
  );
}

/**
 * What to report when a refund call did not come back with an answer.
 *
 * This is the one place where "we could not reach them" must never be written
 * down as "it did not happen". A refund request that timed out may well have
 * been accepted; the provider simply did not get the acknowledgement back to us
 * in time. An operator who reads "failed" will issue another one, and the
 * customer receives the money twice. So the message says plainly that the
 * outcome is unknown and that the provider is the only place to settle the
 * question. Nothing automatic retries a refund — that rule lives in
 * provider-call.ts and this is its human-facing half.
 */
function refundFailure(displayName: string, error: unknown): RefundOutcome {
  if (isUnknownOutcome(error)) {
    return {
      ok: false,
      error:
        `${error.message} The refund may still have gone through — check it in the ` +
        `${displayName} dashboard before issuing another, because a second one would ` +
        `send the money twice.`,
    };
  }
  return {
    ok: false,
    error:
      error instanceof ProviderCallError
        ? error.message
        : `Could not reach ${displayName} to refund.`,
  };
}

/**
 * Every outbound provider request in this file goes through here, so each one
 * gets a deadline, a circuit breaker and — for reads only — a bounded retry.
 * The `Response` comes back untouched, so the parsing below is unchanged.
 */
async function call(
  provider: CardGatewayCode,
  operation: ProviderOperation,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const result = await providerFetch({ provider, operation, url, init });
  if (result.ok) return result.response;
  throw new ProviderCallError(result.error, result.kind);
}

export type CardGatewayAdapter = {
  code: CardGatewayCode;
  displayName: string;
  /** What a trust badge is allowed to say once this provider is really in use. */
  trustLabel: string;
  defaultApiBaseUrl: string;
  /** The header that identifies a callback as this provider's, for dispatch. */
  signatureHeader: string;
  createCheckout(config: CardGatewayConfig, intent: PaymentIntent): Promise<HostedCheckout>;
  /**
   * Ask the provider directly. This is the only thing that establishes payment
   * success — not the redirect, not the callback body, not a webhook arriving.
   */
  verify(
    config: CardGatewayConfig,
    lookup: { reference: string; providerPaymentId: string | null },
  ): Promise<ProviderVerification>;
  verifySignature(config: CardGatewayConfig, rawBody: string, headers: Headers): boolean;
  parseEvent(rawBody: string): WebhookEnvelope | null;
  refund(
    config: CardGatewayConfig,
    input: { providerPaymentId: string; reference: string; amount: number; currency: string },
  ): Promise<RefundOutcome>;
};

/* -------------------------------------------------------------------------- */
/* Flutterwave                                                                 */
/* -------------------------------------------------------------------------- */

const flutterwave: CardGatewayAdapter = {
  code: "flutterwave",
  displayName: "Flutterwave",
  trustLabel: "Secure Payment by Flutterwave",
  defaultApiBaseUrl: "https://api.flutterwave.com",
  signatureHeader: "verif-hash",

  async createCheckout(config, intent) {
    try {
      const response = await call("flutterwave", "checkout_create", `${config.apiBaseUrl}/v3/payments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tx_ref: intent.reference,
          amount: intent.amount,
          currency: intent.currency,
          redirect_url: `${config.appBaseUrl}/payment/success`,
          customer: {
            email: intent.email,
            name: intent.name,
            phonenumber: intent.phone || undefined,
          },
          customizations: { title: "Software Vala", description: intent.description },
          // The card page is Flutterwave's. We never see what is typed on it.
          payment_options: "card",
        }),
      });
      const data = (await response.json()) as {
        status?: string;
        message?: string;
        data?: { link?: string };
      };
      if (!response.ok || data.status !== "success" || !data.data?.link) {
        return { ok: false, error: data.message ?? `Flutterwave returned ${response.status}` };
      }
      return { ok: true, redirectUrl: data.data.link, providerReference: null };
    } catch (error) {
      console.error("[flutterwave] checkout create failed", error);
      return {
        ok: false,
        error:
          error instanceof ProviderCallError
            ? error.message
            : "Could not reach Flutterwave to start the payment.",
      };
    }
  },

  async verify(config, lookup) {
    const miss = (reason: string): ProviderVerification => ({
      verified: false,
      reason,
      status: "unknown",
      amount: null,
      currency: null,
      providerPaymentId: null,
      reference: lookup.reference,
      last4: null,
      brand: null,
    });
    try {
      const response = await call(
        "flutterwave",
        "verify",
        `${config.apiBaseUrl}/v3/transactions/verify_by_reference` +
          `?tx_ref=${encodeURIComponent(lookup.reference)}`,
        { headers: { Authorization: `Bearer ${config.secretKey}` } },
      );
      const data = (await response.json()) as {
        status?: string;
        message?: string;
        data?: {
          id?: number;
          status?: string;
          amount?: number;
          currency?: string;
          tx_ref?: string;
          card?: { last_4digits?: string; type?: string };
        };
      };
      if (!response.ok || !data.data) {
        return miss(data.message ?? `Flutterwave verify returned ${response.status}`);
      }
      const detail = data.data;
      const status = String(detail.status ?? "").toLowerCase();
      return {
        verified: status === "successful",
        reason: `Flutterwave reports ${status || "unknown"}`,
        status,
        amount: typeof detail.amount === "number" ? detail.amount : null,
        currency: detail.currency ? String(detail.currency).toUpperCase() : null,
        providerPaymentId: detail.id != null ? String(detail.id) : null,
        reference: detail.tx_ref ?? lookup.reference,
        last4: detail.card?.last_4digits ?? null,
        brand: detail.card?.type ?? null,
      };
    } catch (error) {
      console.error("[flutterwave] verify failed", error);
      // `verified: false` with status "unknown" is what `miss` produces, which
      // is exactly right here: not reaching the provider is never evidence that
      // the payment failed, and nothing downstream may treat it as such.
      return miss(
        error instanceof ProviderCallError
          ? error.message
          : "Could not reach Flutterwave to verify.",
      );
    }
  },

  verifySignature(config, _rawBody, headers) {
    // Flutterwave echoes the secret hash the merchant set, rather than signing
    // the body. Comparing it in constant time is still the right habit.
    return signaturesMatch(config.webhookSecret, headers.get("verif-hash") ?? "");
  },

  parseEvent(rawBody) {
    try {
      const body = JSON.parse(rawBody) as {
        event?: string;
        "event.type"?: string;
        data?: {
          id?: number;
          tx_ref?: string;
          flw_ref?: string;
          status?: string;
          amount?: number;
          currency?: string;
        };
      };
      const detail = body.data;
      if (!detail?.tx_ref) return null;
      const event = String(body.event ?? body["event.type"] ?? "").toLowerCase();
      return {
        // Flutterwave sends no event id, so its transaction id plus the event
        // name is the most stable replay key it offers.
        eventId: `flutterwave:${detail.id ?? detail.tx_ref}:${event || "charge"}`,
        reference: String(detail.tx_ref),
        providerPaymentId: detail.id != null ? String(detail.id) : (detail.flw_ref ?? null),
        status: String(detail.status ?? "").toLowerCase(),
        amount: typeof detail.amount === "number" ? detail.amount : null,
        currency: detail.currency ? String(detail.currency).toUpperCase() : null,
        kind: event.includes("refund") ? "refund" : "payment",
      };
    } catch {
      return null;
    }
  },

  async refund(config, input) {
    try {
      const response = await call(
        "flutterwave",
        "refund",
        `${config.apiBaseUrl}/v3/transactions/${encodeURIComponent(input.providerPaymentId)}/refund`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.secretKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ amount: input.amount }),
        },
      );
      const data = (await response.json()) as {
        status?: string;
        message?: string;
        data?: { id?: number; status?: string };
      };
      if (!response.ok || data.status !== "success" || !data.data) {
        return {
          ok: false,
          error: data.message ?? `Flutterwave refund returned ${response.status}`,
        };
      }
      return {
        ok: true,
        providerRefundId: String(data.data.id ?? ""),
        status: String(data.data.status ?? "pending"),
      };
    } catch (error) {
      console.error("[flutterwave] refund failed", error);
      return refundFailure("Flutterwave", error);
    }
  },
};

/* -------------------------------------------------------------------------- */
/* Paystack                                                                    */
/* -------------------------------------------------------------------------- */

const paystack: CardGatewayAdapter = {
  code: "paystack",
  displayName: "Paystack",
  trustLabel: "Secure Payment by Paystack",
  defaultApiBaseUrl: "https://api.paystack.co",
  signatureHeader: "x-paystack-signature",

  async createCheckout(config, intent) {
    try {
      const response = await call(
        "paystack",
        "checkout_create",
        `${config.apiBaseUrl}/transaction/initialize`,
        {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: intent.email,
          amount: toMinorUnits(intent.amount, intent.currency),
          currency: intent.currency,
          reference: intent.reference,
          callback_url: `${config.appBaseUrl}/payment/success`,
          channels: ["card"],
          metadata: { order_id: intent.orderId, description: intent.description },
        }),
      });
      const data = (await response.json()) as {
        status?: boolean;
        message?: string;
        data?: { authorization_url?: string; access_code?: string; reference?: string };
      };
      if (!response.ok || !data.status || !data.data?.authorization_url) {
        return { ok: false, error: data.message ?? `Paystack returned ${response.status}` };
      }
      return {
        ok: true,
        redirectUrl: data.data.authorization_url,
        providerReference: data.data.access_code ?? null,
      };
    } catch (error) {
      console.error("[paystack] checkout create failed", error);
      return {
        ok: false,
        error:
          error instanceof ProviderCallError
            ? error.message
            : "Could not reach Paystack to start the payment.",
      };
    }
  },

  async verify(config, lookup) {
    const miss = (reason: string): ProviderVerification => ({
      verified: false,
      reason,
      status: "unknown",
      amount: null,
      currency: null,
      providerPaymentId: null,
      reference: lookup.reference,
      last4: null,
      brand: null,
    });
    try {
      const response = await call(
        "paystack",
        "verify",
        `${config.apiBaseUrl}/transaction/verify/${encodeURIComponent(lookup.reference)}`,
        { headers: { Authorization: `Bearer ${config.secretKey}` } },
      );
      const data = (await response.json()) as {
        status?: boolean;
        message?: string;
        data?: {
          id?: number;
          status?: string;
          amount?: number;
          currency?: string;
          reference?: string;
          authorization?: { last4?: string; brand?: string; card_type?: string };
        };
      };
      if (!response.ok || !data.status || !data.data) {
        return miss(data.message ?? `Paystack verify returned ${response.status}`);
      }
      const detail = data.data;
      const status = String(detail.status ?? "").toLowerCase();
      const currency = detail.currency ? String(detail.currency).toUpperCase() : null;
      return {
        verified: status === "success",
        reason: `Paystack reports ${status || "unknown"}`,
        status,
        amount:
          typeof detail.amount === "number" && currency
            ? fromMinorUnits(detail.amount, currency)
            : null,
        currency,
        providerPaymentId: detail.id != null ? String(detail.id) : null,
        reference: detail.reference ?? lookup.reference,
        last4: detail.authorization?.last4 ?? null,
        brand: detail.authorization?.brand ?? detail.authorization?.card_type ?? null,
      };
    } catch (error) {
      console.error("[paystack] verify failed", error);
      return miss(
        error instanceof ProviderCallError
          ? error.message
          : "Could not reach Paystack to verify.",
      );
    }
  },

  verifySignature(config, rawBody, headers) {
    const expected = createHmac("sha512", config.webhookSecret || config.secretKey)
      .update(rawBody, "utf8")
      .digest("hex");
    return signaturesMatch(expected, headers.get("x-paystack-signature") ?? "");
  },

  parseEvent(rawBody) {
    try {
      const body = JSON.parse(rawBody) as {
        event?: string;
        id?: number | string;
        data?: {
          id?: number;
          reference?: string;
          status?: string;
          amount?: number;
          currency?: string;
        };
      };
      const detail = body.data;
      if (!detail?.reference) return null;
      const event = String(body.event ?? "").toLowerCase();
      const currency = detail.currency ? String(detail.currency).toUpperCase() : null;
      return {
        eventId: `paystack:${body.id ?? detail.id ?? detail.reference}:${event || "charge"}`,
        reference: String(detail.reference),
        providerPaymentId: detail.id != null ? String(detail.id) : null,
        status: String(detail.status ?? "").toLowerCase(),
        amount:
          typeof detail.amount === "number" && currency
            ? fromMinorUnits(detail.amount, currency)
            : null,
        currency,
        kind: event.startsWith("refund") ? "refund" : "payment",
      };
    } catch {
      return null;
    }
  },

  async refund(config, input) {
    try {
      const response = await call("paystack", "refund", `${config.apiBaseUrl}/refund`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transaction: input.providerPaymentId || input.reference,
          amount: toMinorUnits(input.amount, input.currency),
        }),
      });
      const data = (await response.json()) as {
        status?: boolean;
        message?: string;
        data?: { id?: number; status?: string };
      };
      if (!response.ok || !data.status || !data.data) {
        return { ok: false, error: data.message ?? `Paystack refund returned ${response.status}` };
      }
      return {
        ok: true,
        providerRefundId: String(data.data.id ?? ""),
        status: String(data.data.status ?? "pending"),
      };
    } catch (error) {
      console.error("[paystack] refund failed", error);
      return refundFailure("Paystack", error);
    }
  },
};

/* -------------------------------------------------------------------------- */
/* Stripe                                                                      */
/* -------------------------------------------------------------------------- */

/** Stripe's API is form-encoded, including its nested structures. */
function stripeForm(fields: Record<string, string | number | undefined>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    params.set(key, String(value));
  }
  return params;
}

const stripe: CardGatewayAdapter = {
  code: "stripe",
  displayName: "Stripe",
  trustLabel: "Secure Payment by Stripe",
  defaultApiBaseUrl: "https://api.stripe.com",
  signatureHeader: "stripe-signature",

  async createCheckout(config, intent) {
    try {
      const response = await call(
        "stripe",
        "checkout_create",
        `${config.apiBaseUrl}/v1/checkout/sessions`,
        {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
          // Stripe deduplicates on this, so a customer's double click does not
          // create a second session for one order.
          "Idempotency-Key": `checkout:${intent.reference}`,
        },
        body: stripeForm({
          mode: "payment",
          client_reference_id: intent.reference,
          customer_email: intent.email || undefined,
          success_url: `${config.appBaseUrl}/payment/success?txnid=${encodeURIComponent(intent.reference)}`,
          cancel_url: `${config.appBaseUrl}/payment/fail?txnid=${encodeURIComponent(intent.reference)}`,
          "payment_method_types[0]": "card",
          "line_items[0][quantity]": 1,
          "line_items[0][price_data][currency]": intent.currency.toLowerCase(),
          "line_items[0][price_data][product_data][name]": intent.description,
          "line_items[0][price_data][unit_amount]": toMinorUnits(intent.amount, intent.currency),
          "metadata[order_id]": intent.orderId,
          "metadata[reference]": intent.reference,
        }),
      });
      const data = (await response.json()) as {
        id?: string;
        url?: string;
        error?: { message?: string };
      };
      if (!response.ok || !data.url || !data.id) {
        return { ok: false, error: data.error?.message ?? `Stripe returned ${response.status}` };
      }
      return { ok: true, redirectUrl: data.url, providerReference: data.id };
    } catch (error) {
      console.error("[stripe] checkout create failed", error);
      return {
        ok: false,
        error:
          error instanceof ProviderCallError
            ? error.message
            : "Could not reach Stripe to start the payment.",
      };
    }
  },

  async verify(config, lookup) {
    const miss = (reason: string): ProviderVerification => ({
      verified: false,
      reason,
      status: "unknown",
      amount: null,
      currency: null,
      providerPaymentId: null,
      reference: lookup.reference,
      last4: null,
      brand: null,
    });
    // Stripe cannot look a session up by our own reference, so the session id
    // recorded when the checkout was created is what we verify against.
    const sessionId = lookup.providerPaymentId;
    if (!sessionId) return miss("No Stripe session was recorded for this payment.");
    try {
      const response = await call(
        "stripe",
        "verify",
        `${config.apiBaseUrl}/v1/checkout/sessions/${encodeURIComponent(sessionId)}` +
          `?expand[]=payment_intent&expand[]=payment_intent.latest_charge`,
        { headers: { Authorization: `Bearer ${config.secretKey}` } },
      );
      const data = (await response.json()) as {
        id?: string;
        client_reference_id?: string;
        payment_status?: string;
        status?: string;
        amount_total?: number;
        currency?: string;
        payment_intent?: {
          id?: string;
          latest_charge?: {
            payment_method_details?: { card?: { last4?: string; brand?: string } };
          };
        };
        error?: { message?: string };
      };
      if (!response.ok || !data.id) {
        return miss(data.error?.message ?? `Stripe verify returned ${response.status}`);
      }
      const paymentStatus = String(data.payment_status ?? "").toLowerCase();
      const currency = data.currency ? String(data.currency).toUpperCase() : null;
      const card = data.payment_intent?.latest_charge?.payment_method_details?.card;
      return {
        verified: paymentStatus === "paid",
        reason: `Stripe reports ${paymentStatus || data.status || "unknown"}`,
        status: paymentStatus,
        amount:
          typeof data.amount_total === "number" && currency
            ? fromMinorUnits(data.amount_total, currency)
            : null,
        currency,
        // The payment intent is what a refund is issued against.
        providerPaymentId: data.payment_intent?.id ?? data.id,
        reference: data.client_reference_id ?? lookup.reference,
        last4: card?.last4 ?? null,
        brand: card?.brand ?? null,
      };
    } catch (error) {
      console.error("[stripe] verify failed", error);
      return miss(
        error instanceof ProviderCallError
          ? error.message
          : "Could not reach Stripe to verify.",
      );
    }
  },

  verifySignature(config, rawBody, headers) {
    const header = headers.get("stripe-signature") ?? "";
    const parts = new Map(
      header
        .split(",")
        .map((piece) => piece.split("=", 2))
        .filter((pair): pair is [string, string] => pair.length === 2)
        .map(([key, value]) => [key.trim(), value.trim()] as [string, string]),
    );
    const timestamp = parts.get("t");
    const signature = parts.get("v1");
    if (!timestamp || !signature) return false;

    // Reject a signature old enough to be a replay of a captured request.
    const age = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(age) || age > 300) return false;

    const expected = createHmac("sha256", config.webhookSecret)
      .update(`${timestamp}.${rawBody}`, "utf8")
      .digest("hex");
    return signaturesMatch(expected, signature);
  },

  parseEvent(rawBody) {
    try {
      const body = JSON.parse(rawBody) as {
        id?: string;
        type?: string;
        data?: {
          object?: {
            id?: string;
            object?: string;
            client_reference_id?: string;
            payment_intent?: string;
            payment_status?: string;
            status?: string;
            amount_total?: number;
            amount?: number;
            currency?: string;
            metadata?: { reference?: string };
          };
        };
      };
      const object = body.data?.object;
      if (!object) return null;
      const reference = object.client_reference_id ?? object.metadata?.reference;
      if (!reference) return null;
      const type = String(body.type ?? "").toLowerCase();
      const currency = object.currency ? String(object.currency).toUpperCase() : null;
      const minor = object.amount_total ?? object.amount;
      return {
        eventId: `stripe:${body.id ?? object.id ?? reference}`,
        reference: String(reference),
        providerPaymentId: object.payment_intent ?? object.id ?? null,
        status: String(object.payment_status ?? object.status ?? "").toLowerCase(),
        amount: typeof minor === "number" && currency ? fromMinorUnits(minor, currency) : null,
        currency,
        kind:
          type.startsWith("charge.refund") || type.startsWith("refund.") ? "refund" : "payment",
      };
    } catch {
      return null;
    }
  },

  async refund(config, input) {
    try {
      const response = await call("stripe", "refund", `${config.apiBaseUrl}/v1/refunds`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": `refund:${input.reference}:${input.amount}`,
        },
        body: stripeForm({
          payment_intent: input.providerPaymentId,
          amount: toMinorUnits(input.amount, input.currency),
        }),
      });
      const data = (await response.json()) as {
        id?: string;
        status?: string;
        error?: { message?: string };
      };
      if (!response.ok || !data.id) {
        return {
          ok: false,
          error: data.error?.message ?? `Stripe refund returned ${response.status}`,
        };
      }
      return { ok: true, providerRefundId: data.id, status: String(data.status ?? "pending") };
    } catch (error) {
      console.error("[stripe] refund failed", error);
      return refundFailure("Stripe", error);
    }
  },
};

/* -------------------------------------------------------------------------- */
/* Registry and configuration                                                  */
/* -------------------------------------------------------------------------- */

export const CARD_ADAPTERS: Record<CardGatewayCode, CardGatewayAdapter> = {
  flutterwave,
  paystack,
  stripe,
};

export function cardAdapter(code: string): CardGatewayAdapter | null {
  return isCardGateway(code) ? CARD_ADAPTERS[code] : null;
}

/**
 * A card provider's credentials, from its rail in Finance Manager.
 *
 * Environment variables win where a deployment already sets them, exactly as
 * PayU does, so nothing that works today stops working. Otherwise the operator
 * configures the provider from the console and no redeploy is needed.
 */
export async function resolveCardConfig(code: CardGatewayCode): Promise<CardGatewayConfig | null> {
  const adapter = CARD_ADAPTERS[code];
  const upper = code.toUpperCase();
  const envSecret = process.env[`${upper}_SECRET_KEY`]?.trim() ?? "";
  const appBaseUrl = process.env.APP_BASE_URL?.trim() || "https://softwarevala.net";

  if (envSecret) {
    return {
      code,
      displayName: adapter.displayName,
      secretKey: envSecret,
      publicKey: process.env[`${upper}_PUBLIC_KEY`]?.trim() ?? "",
      webhookSecret: process.env[`${upper}_WEBHOOK_SECRET`]?.trim() ?? "",
      apiBaseUrl: process.env[`${upper}_API_BASE_URL`]?.trim() || adapter.defaultApiBaseUrl,
      appBaseUrl,
    };
  }

  const rail = await railConfiguration(code);
  const secretKey = String(rail.secrets["secret_key"] ?? "").trim();
  if (!rail.enabled || !secretKey) return null;

  return {
    code,
    displayName: adapter.displayName,
    secretKey,
    publicKey: String(rail.secrets["public_key"] ?? "").trim(),
    webhookSecret: String(rail.secrets["webhook_secret"] ?? "").trim(),
    apiBaseUrl: String(rail.config["api_base_url"] ?? "").trim() || adapter.defaultApiBaseUrl,
    appBaseUrl: String(rail.config["app_base_url"] ?? "").trim() || appBaseUrl,
  };
}

/**
 * Which provider a callback belongs to, decided from the signature header it
 * carries. A callback naming no provider is PayU's, which is how the existing
 * endpoint has always been reached.
 */
export function providerFromHeaders(headers: Headers): CardGatewayCode | null {
  for (const code of CARD_GATEWAYS) {
    if (headers.get(CARD_ADAPTERS[code].signatureHeader)) return code;
  }
  return null;
}

/**
 * The digest of a raw webhook body, so a replay can still be recognised from a
 * provider that sends no event id of its own.
 */
export function bodyDigest(rawBody: string): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex");
}
