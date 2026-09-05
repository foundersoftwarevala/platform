import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

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

export function payuConfig(): PayuConfig | null {
  const merchantKey = process.env.PAYU_MERCHANT_KEY?.trim();
  const merchantSalt = process.env.PAYU_MERCHANT_SALT?.trim();
  if (!merchantKey || !merchantSalt) return null;
  return {
    merchantKey,
    merchantSalt,
    baseUrl: process.env.PAYU_BASE_URL?.trim() || "https://secure.payu.in",
    paymentEndpoint: process.env.PAYU_PAYMENT_ENDPOINT?.trim() || "/_payment",
    verifyEndpoint:
      process.env.PAYU_VERIFY_ENDPOINT?.trim() || "/merchant/postservice.php?form=2",
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
    "", "", "", "", "", "", "", "", "", "", // udf1..udf10
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
    status: string; txnid: string; amount: string; productinfo: string;
    firstname: string; email: string; additionalCharges?: string;
  },
): string {
  const core = [
    config.merchantSalt,
    fields.status,
    "", "", "", "", "", "", "", "", "", "", // udf10..udf1
    fields.email,
    fields.firstname,
    fields.productinfo,
    fields.amount,
    fields.txnid,
    config.merchantKey,
  ].join("|");
  // When PayU adds a surcharge it prefixes the string with that value.
  const payload = fields.additionalCharges
    ? `${fields.additionalCharges}|${core}`
    : core;
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
export async function verifyWithPayu(
  config: PayuConfig,
  txnid: string,
): Promise<VerifiedPayment> {
  const command = "verify_payment";
  const hash = createHash("sha512")
    .update([config.merchantKey, command, txnid, config.merchantSalt].join("|"))
    .digest("hex");

  try {
    const response = await fetch(`${config.baseUrl}${config.verifyEndpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ key: config.merchantKey, command, var1: txnid, hash }),
    });
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
export async function usdToInr(amountUsd: number): Promise<{ rate: number; amount: number } | null> {
  const template = process.env.FX_API_URL?.trim();
  if (!template) return null;
  try {
    const response = await fetch(template.replace("{AMOUNT}", String(amountUsd)));
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
