import { randomBytes, createHash } from "node:crypto";
import { licenceEmail, send as sendMail } from "./mailer";
import { createInvoiceForOrder } from "./invoices";

/**
 * Turning a paid order into access.
 *
 * A payment on its own gives the buyer nothing. This is the step that issues a
 * licence, grants the entitlement that unlocks the product, and records what
 * happened — so a customer who has paid can be proven to have paid, and a
 * refund can take the access back.
 *
 * Everything here runs on the server with the service role key. It is
 * idempotent: calling it twice for the same order returns the licence that
 * already exists rather than issuing a second one, which matters because
 * payment webhooks are retried.
 */

const LICENCE_GROUPS = 5;
const LICENCE_GROUP_LEN = 5;
/** Crockford base32 without I, L, O or U, so a key can be read aloud safely. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function supabaseUrl(): string {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function adminHeaders(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

/**
 * A licence key with 125 bits of entropy, drawn from the system CSPRNG.
 * It is not derived from the order or the customer, so knowing one licence
 * tells you nothing about any other.
 */
export function generateLicenceKey(): string {
  const bytes = randomBytes(LICENCE_GROUPS * LICENCE_GROUP_LEN);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  const groups: string[] = [];
  for (let i = 0; i < LICENCE_GROUPS; i++) {
    groups.push(chars.slice(i * LICENCE_GROUP_LEN, (i + 1) * LICENCE_GROUP_LEN).join(""));
  }
  return `SV-${groups.join("-")}`;
}

/** Stored alongside the key so a lookup never has to scan plaintext. */
export function licenceFingerprint(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 32);
}

export type FulfilmentResult =
  | { ok: true; created: boolean; licenceKey: string; licenceId: string; entitlementId: string | null }
  | { ok: false; error: string; status: number };

async function rest(path: string, init?: RequestInit) {
  return fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    ...init,
    headers: { ...adminHeaders(), ...(init?.headers ?? {}) },
  });
}

export async function logPaymentEvent(
  orderId: string | null,
  eventType: string,
  payload: Record<string, unknown>,
  extra: { signatureValid?: boolean; provider?: string } = {},
): Promise<void> {
  if (!supabaseUrl()) return;
  try {
    await rest("payment_logs", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        order_id: orderId,
        event_type: eventType,
        payload,
        signature_valid: extra.signatureValid ?? null,
        provider: extra.provider ?? null,
      }),
    });
  } catch (error) {
    // A logging failure must never take down the payment path.
    console.error("[fulfilment] could not write payment log", eventType, error);
  }
}

/**
 * Issue the licence and entitlement for an order that has actually been paid.
 *
 * The order is re-read from the database rather than trusted from the caller,
 * and it must already be marked paid — this function never decides that a
 * payment succeeded, it only acts on one that did.
 */
export async function fulfilOrder(orderId: string): Promise<FulfilmentResult> {
  if (!supabaseUrl() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: "Fulfilment is not configured", status: 503 };
  }

  const orderResponse = await rest(
    `marketplace_orders?select=id,buyer_id,user_id,status,metadata,order_no,total,amount_inr,currency,currency_charged&id=eq.${encodeURIComponent(orderId)}&limit=1`,
  );
  const orders = orderResponse.ok ? ((await orderResponse.json()) as Record<string, unknown>[]) : [];
  const order = orders[0];
  if (!order) return { ok: false, error: "Order not found", status: 404 };

  const status = String(order.status ?? "").toLowerCase();
  if (status !== "paid") {
    return { ok: false, error: `Order is ${status || "unpaid"}, not paid`, status: 409 };
  }

  const userId = String(order.user_id ?? order.buyer_id ?? "");
  if (!userId) return { ok: false, error: "Order has no owner", status: 409 };

  // The product the order is for. Orders carry it in their metadata payload.
  const metadata = (order.metadata ?? {}) as Record<string, unknown>;
  const productId = String(
    metadata.product_id ?? (metadata as { meta?: Record<string, unknown> }).meta?.product_id ?? "",
  );

  // Already fulfilled? Return what exists — webhooks are retried.
  const existingResponse = await rest(
    `licenses?select=id,license_key&order_id=eq.${encodeURIComponent(orderId)}&limit=1`,
  );
  const existing = existingResponse.ok
    ? ((await existingResponse.json()) as { id: string; license_key: string }[])
    : [];
  if (existing[0]) {
    return {
      ok: true,
      created: false,
      licenceKey: existing[0].license_key,
      licenceId: existing[0].id,
      entitlementId: null,
    };
  }

  const licenceKey = generateLicenceKey();
  const licenceResponse = await rest("licenses", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      license_key: licenceKey,
      order_id: orderId,
      user_id: userId,
      product_id: productId || null,
      status: "active",
    }),
  });

  if (!licenceResponse.ok) {
    const detail = await licenceResponse.text();
    // A unique-violation means another retry won the race; read its licence.
    if (licenceResponse.status === 409) {
      const raced = await rest(
        `licenses?select=id,license_key&order_id=eq.${encodeURIComponent(orderId)}&limit=1`,
      );
      const rows = raced.ok ? ((await raced.json()) as { id: string; license_key: string }[]) : [];
      if (rows[0]) {
        return {
          ok: true, created: false,
          licenceKey: rows[0].license_key, licenceId: rows[0].id, entitlementId: null,
        };
      }
    }
    console.error("[fulfilment] licence insert failed", licenceResponse.status, detail);
    await logPaymentEvent(orderId, "fulfilment_failed", { stage: "licence", detail: detail.slice(0, 500) });
    return { ok: false, error: "Could not issue the licence", status: 502 };
  }

  const licence = ((await licenceResponse.json()) as { id: string }[])[0];

  // The entitlement is what actually unlocks the product for this customer.
  let entitlementId: string | null = null;
  if (productId) {
    const entitlementResponse = await rest("entitlements", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify({
        user_id: userId,
        product_id: productId,
        order_id: orderId,
        license_id: licence.id,
        status: "active",
        source: "purchase",
      }),
    });
    if (entitlementResponse.ok) {
      const rows = (await entitlementResponse.json()) as { id: string }[];
      entitlementId = rows[0]?.id ?? null;
    } else {
      console.error("[fulfilment] entitlement insert failed", await entitlementResponse.text());
    }
  }

  await logPaymentEvent(orderId, "fulfilled", {
    licence_id: licence.id,
    fingerprint: licenceFingerprint(licenceKey),
    product_id: productId || null,
    entitlement_id: entitlementId,
  });

  // The document for the customer and for the accounts.
  // Bill what was charged: rupees when the customer paid in rupees.
  const chargedAmount = Number(order.amount_inr ?? order.total ?? 0) || 0;
  const chargedCurrency = String(order.currency_charged ?? order.currency ?? "USD");
  const invoice = await createInvoiceForOrder({
    userId,
    orderId,
    amount: chargedAmount,
    currency: chargedCurrency,
    productName: String(metadata.product_name ?? "Software Vala lifetime licence"),
    clientName: String(metadata.buyer_name ?? metadata.email ?? "Marketplace customer"),
    status: "paid",
  });
  await logPaymentEvent(orderId, invoice.invoice ? "invoice_ready" : "invoice_failed", {
    created: invoice.created,
    invoice_no: (invoice.invoice as { invoice_no?: string } | null)?.invoice_no ?? null,
    detail: invoice.error ?? null,
  });

  // Tell the buyer. Queued regardless of whether a provider is configured, so
  // nothing bought goes uncommunicated once credentials exist.
  const buyerEmail = String(
    metadata.email ?? (metadata as { meta?: Record<string, unknown> }).meta?.email ?? "",
  ).trim();
  if (buyerEmail) {
    const message = licenceEmail({
      name: String(metadata.buyer_name ?? buyerEmail.split("@")[0]),
      productName: String(metadata.product_name ?? "your Software Vala licence"),
      licenceKey,
      orderNo: (order.order_no as string | null) ?? null,
    });
    const mail = await sendMail({ ...message, to: buyerEmail, context: { order_id: orderId, licence_id: licence.id } });
    await logPaymentEvent(orderId, mail.sent ? "licence_email_sent" : "licence_email_queued", {
      to: buyerEmail, reason: mail.reason,
    });
  } else {
    await logPaymentEvent(orderId, "licence_email_skipped", {
      reason: "the order carries no buyer email",
    });
  }

  return { ok: true, created: true, licenceKey, licenceId: licence.id, entitlementId };
}

/** Take access back when a payment is reversed. The licence row is kept. */
export async function revokeOrderAccess(orderId: string, reason: string): Promise<boolean> {
  if (!supabaseUrl()) return false;
  const now = new Date().toISOString();
  const licence = await rest(`licenses?order_id=eq.${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: "revoked", revoked_at: now, revoked_reason: reason }),
  });
  const entitlement = await rest(`entitlements?order_id=eq.${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: "revoked", revoked_at: now }),
  });
  await logPaymentEvent(orderId, "access_revoked", { reason });
  return licence.ok && entitlement.ok;
}
