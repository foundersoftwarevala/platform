import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

import { providerFetch } from "@/lib/commerce/provider-call";

/**
 * PayU, done the way the business specified.
 *
 * Two rules shape everything here:
 *
 *   1. **The browser is never believed.** Coming back to /payment/success proves
 *      nothing. A payment is only real once the reverse hash verifies, the
 *      amount matches what was charged, and PayU's own verify endpoint agrees.
 *   2. **No credentials, no pretending.** If the merchant key or salt is
 *      missing, every entry point refuses. It never falls back to a mock
 *      success, because a fake payment is worse than no payment.
 */

export type PayuConfig = {
  merchantKey: string;
  merchantSalt: string;
  baseUrl: string;
  paymentEndpoint: string;
  verifyEndpoint: string;
  appBaseUrl: string;
};

/**
 * The one place a payment rail's configuration is read from.
 *
 * Every rail — PayU, Wise, bank transfer, UPI, Binance — keeps its settings in
 * finance_payment_rails.configuration_state, the row Finance Manager already
 * shows and edits. Anything secret lives under a `secrets` key inside it, which
 * the data layer strips before a row is ever sent to a browser, so an operator
 * can configure a rail from the console without the key travelling back out and
 * without anyone editing an environment file or redeploying.
 *
 * Environment variables still win when they are set, so an existing deployment
 * keeps working exactly as it did.
 */
export async function railConfiguration(code: string): Promise<{
  enabled: boolean;
  config: Record<string, unknown>;
  secrets: Record<string, unknown>;
}> {
  const url = process.env.SUPABASE_URL?.trim() ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!url || !key) return { enabled: false, config: {}, secrets: {} };
  try {
    const response = await fetch(
      `${url}/rest/v1/finance_payment_rails?select=enabled,configuration_state` +
        `&code=eq.${encodeURIComponent(code)}&limit=1`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        // This read sits directly on the checkout path. Without a deadline a
        // stalled connection here holds the customer on a blank page rather
        // than telling them the rail is unavailable.
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!response.ok) return { enabled: false, config: {}, secrets: {} };
    const rows = (await response.json()) as {
      enabled?: boolean;
      configuration_state?: Record<string, unknown> | null;
    }[];
    const row = rows[0];
    const state = (row?.configuration_state ?? {}) as Record<string, unknown>;
    const secrets = (state["secrets"] ?? {}) as Record<string, unknown>;
    return { enabled: Boolean(row?.enabled), config: state, secrets };
  } catch {
    return { enabled: false, config: {}, secrets: {} };
  }
}

/**
 * PayU's credentials, from the environment if it carries them and from the
 * rail's configuration if it does not. Asking the owner to edit a server
 * environment file for every provider is what made every provider a blocker.
 */
export async function resolvePayuConfig(): Promise<PayuConfig | null> {
  const fromEnv = payuConfig();
  if (fromEnv) return fromEnv;

  const rail = await railConfiguration("payu");
  const merchantKey = String(rail.secrets["merchant_key"] ?? "").trim();
  const merchantSalt = String(rail.secrets["merchant_salt"] ?? "").trim();
  if (!rail.enabled || !merchantKey || !merchantSalt) return null;

  return {
    merchantKey,
    merchantSalt,
    baseUrl: String(rail.config["base_url"] ?? "").trim() || "https://secure.payu.in",
    paymentEndpoint: String(rail.config["payment_endpoint"] ?? "").trim() || "/_payment",
    verifyEndpoint:
      String(rail.config["verify_endpoint"] ?? "").trim() || "/merchant/postservice.php?form=2",
    appBaseUrl:
      String(rail.config["app_base_url"] ?? "").trim() ||
      process.env.APP_BASE_URL?.trim() ||
      "https://softwarevala.net",
  };
}

export function payuConfig(): PayuConfig | null {
  const merchantKey = process.env.PAYU_MERCHANT_KEY?.trim();
  const merchantSalt = process.env.PAYU_MERCHANT_SALT?.trim();
  if (!merchantKey || !merchantSalt) return null;
  return {
    merchantKey,
    merchantSalt,
    baseUrl: process.env.PAYU_BASE_URL?.trim() || "https://secure.payu.in",
    paymentEndpoint: process.env.PAYU_PAYMENT_ENDPOINT?.trim() || "/_payment",
    verifyEndpoint: process.env.PAYU_VERIFY_ENDPOINT?.trim() || "/merchant/postservice.php?form=2",
    appBaseUrl: process.env.APP_BASE_URL?.trim() || "https://softwarevala.net",
  };
}

/** PayU wants the amount as a plain two-decimal string. */
export function payuAmount(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

export function newTxnId(): string {
  return `SV${Date.now().toString(36).toUpperCase()}${randomUUID().slice(0, 8).toUpperCase()}`;
}

/**
 * The request hash PayU expects, in its documented field order:
 * key|txnid|amount|productinfo|firstname|email|udf1..udf10 (empty)|salt
 */
export function requestHash(
  config: PayuConfig,
  fields: { txnid: string; amount: string; productinfo: string; firstname: string; email: string },
): string {
  const parts = [
    config.merchantKey,
    fields.txnid,
    fields.amount,
    fields.productinfo,
    fields.firstname,
    fields.email,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "", // udf1..udf10
    config.merchantSalt,
  ];
  return createHash("sha512").update(parts.join("|")).digest("hex");
}

/**
 * The reverse hash PayU sends back. Its field order is the request order
 * reversed, with the transaction status inserted before the email.
 */
export function responseHash(
  config: PayuConfig,
  fields: {
    status: string;
    txnid: string;
    amount: string;
    productinfo: string;
    firstname: string;
    email: string;
    additionalCharges?: string;
  },
): string {
  const core = [
    config.merchantSalt,
    fields.status,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "", // udf10..udf1
    fields.email,
    fields.firstname,
    fields.productinfo,
    fields.amount,
    fields.txnid,
    config.merchantKey,
  ].join("|");
  // When PayU adds a surcharge it prefixes the string with that value.
  const payload = fields.additionalCharges ? `${fields.additionalCharges}|${core}` : core;
  return createHash("sha512").update(payload).digest("hex");
}

/** Compare two hex digests without leaking timing information. */
export function hashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(String(a ?? "").toLowerCase(), "utf8");
  const right = Buffer.from(String(b ?? "").toLowerCase(), "utf8");
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

export type VerifiedPayment = {
  verified: boolean;
  reason: string;
  status?: string;
  amount?: string;
  payuId?: string;
};

/**
 * Ask PayU directly what it thinks of a transaction.
 *
 * This is the authority, not the redirect and not the callback body. A callback
 * whose hash checks out can still be a replay of an older attempt, so the
 * provider gets the final word.
 */
export async function verifyWithPayu(config: PayuConfig, txnid: string): Promise<VerifiedPayment> {
  const command = "verify_payment";
  const hash = createHash("sha512")
    .update([config.merchantKey, command, txnid, config.merchantSalt].join("|"))
    .digest("hex");

  try {
    // A verify is a question, not an instruction, so provider-call is allowed
    // to ask it again on a timeout. Nothing here can move money.
    const call = await providerFetch({
      provider: "payu",
      operation: "verify",
      url: `${config.baseUrl}${config.verifyEndpoint}`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ key: config.merchantKey, command, var1: txnid, hash }),
      },
    });
    if (!call.ok) {
      // Unreached is not the same as unpaid: `verified: false` here means we do
      // not know, and the consistency sweep will ask again later.
      return { verified: false, reason: call.error };
    }
    const response = call.response;
    if (!response.ok) {
      return { verified: false, reason: `PayU verify returned ${response.status}` };
    }
    const data = (await response.json()) as {
      status?: number;
      transaction_details?: Record<string, { status?: string; amt?: string; mihpayid?: string }>;
    };
    const detail = data.transaction_details?.[txnid];
    if (!detail) return { verified: false, reason: "PayU has no record of that transaction" };

    const status = String(detail.status ?? "").toLowerCase();
    return {
      verified: status === "success" || status === "captured",
      reason: `PayU reports ${status || "unknown"}`,
      status,
      amount: detail.amt,
      payuId: detail.mihpayid,
    };
  } catch (error) {
    console.error("[payu] verify call failed", error);
    return { verified: false, reason: "Could not reach PayU to verify" };
  }
}

/**
 * Convert the fixed USD price into the currency actually charged.
 * A failed lookup is reported, never silently guessed at.
 */
export async function usdToInr(
  amountUsd: number,
): Promise<{ rate: number; amount: number } | null> {
  const template = process.env.FX_API_URL?.trim();
  if (!template) return null;
  try {
    const call = await providerFetch({
      provider: "fx",
      operation: "rate_lookup",
      url: template.replace("{AMOUNT}", String(amountUsd)),
    });
    if (!call.ok) return null;
    const response = call.response;
    if (!response.ok) return null;
    const data = (await response.json()) as { result?: number; info?: { rate?: number } };
    const rate = Number(data.info?.rate ?? 0);
    const converted = Number(data.result ?? 0);
    if (!rate || !converted) return null;
    return { rate, amount: Math.round(converted * 100) / 100 };
  } catch (error) {
    console.error("[payu] fx lookup failed", error);
    return null;
  }
}
