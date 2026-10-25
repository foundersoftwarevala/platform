import { randomBytes, createHash } from "node:crypto";
import { recordCommissionsForOrder } from "./commission";
import { licenceEmail, send as sendMail } from "./mailer";
import { serverTranslator } from "@/lib/i18n/server-translate.server";
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
  | {
      ok: true;
      created: boolean;
      licenceKey: string;
      licenceId: string;
      entitlementId: string | null;
    }
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
type OrderLine = {
  id: string;
  product_id: string | null;
  product_name: string | null;
  seller_id: string | null;
};

/**
 * What the customer actually bought. marketplace_order_items is the canonical
 * line record and it is populated; order.metadata is not.
 */
async function orderLines(orderId: string): Promise<OrderLine[]> {
  const response = await rest(
    `marketplace_order_items?select=id,product_id,product_name,seller_id` +
      `&order_id=eq.${encodeURIComponent(orderId)}`,
  );
  if (!response.ok) {
    throw new Error(`Could not read order lines (HTTP ${response.status})`);
  }
  return (await response.json()) as OrderLine[];
}

/**
 * Where to send the licence. Read from the buyer's profile rather than hoping
 * the checkout copied an address into the order metadata.
 */
async function buyerContact(userId: string): Promise<{ email: string; name: string }> {
  if (!userId) return { email: "", name: "" };
  const response = await rest(
    `profiles?select=email,full_name,username&id=eq.${encodeURIComponent(userId)}&limit=1`,
  );
  if (!response.ok) return { email: "", name: "" };
  const rows = (await response.json()) as {
    email: string | null;
    full_name: string | null;
    username: string | null;
  }[];
  const row = rows[0];
  if (!row) return { email: "", name: "" };
  return {
    email: String(row.email ?? "").trim(),
    name: String(row.full_name ?? row.username ?? "").trim(),
  };
}

export async function fulfilOrder(orderId: string): Promise<FulfilmentResult> {
  if (!supabaseUrl() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: "Fulfilment is not configured", status: 503 };
  }

  const orderResponse = await rest(
    `marketplace_orders?select=id,buyer_id,status,metadata,order_no,total,amount_inr,currency,currency_charged&id=eq.${encodeURIComponent(orderId)}&limit=1`,
  );
  if (!orderResponse.ok) {
    return { ok: false, error: "Could not read the order", status: 502 };
  }
  const orders = (await orderResponse.json()) as Record<string, unknown>[];
  const order = orders[0];
  if (!order) return { ok: false, error: "Order not found", status: 404 };

  const status = String(order.status ?? "").toLowerCase();
  if (status !== "paid") {
    return { ok: false, error: `Order is ${status || "unpaid"}, not paid`, status: 409 };
  }

  const userId = String(order.buyer_id ?? "");
  if (!userId) return { ok: false, error: "Order has no owner", status: 409 };

  // The product the order is for. The order lines are the record of what was
  // bought; metadata is honoured first only because a checkout may have set it
  // deliberately, and it is empty on every order currently in the table.
  const metadata = (order.metadata ?? {}) as Record<string, unknown>;
  const lines = await orderLines(orderId);
  const productId = String(
    metadata.product_id ??
      (metadata as { meta?: Record<string, unknown> }).meta?.product_id ??
      lines.find((line) => line.product_id)?.product_id ??
      "",
  );
  const productName = String(
    metadata.product_name ??
      lines.find((line) => line.product_name)?.product_name ??
      "Software Vala lifetime licence",
  );
  const contact = await buyerContact(userId);

  // A retry must still repair a missing entitlement for an existing license.
  const existingResponse = await rest(
    `licenses?select=id,license_key&order_id=eq.${encodeURIComponent(orderId)}&limit=1`,
  );
  if (!existingResponse.ok) {
    throw new Error(`Could not check existing licenses (HTTP ${existingResponse.status})`);
  }
  const existing = (await existingResponse.json()) as { id: string; license_key: string }[];

  // One key per purchase. When the order became paid, the database already
  // issued a marketplace licence for each line (mm_order_paid_issue), and that
  // is the key every dashboard shows. Minting a second, different key here
  // gave the buyer one key by e-mail and the dashboards another.
  let licenceKey = generateLicenceKey();
  if (lines.length) {
    const issued = await rest(
      `marketplace_licenses?select=license_key&order_item_id=in.(${lines.map((line) => line.id).join(",")})` +
        `&license_key=not.is.null&order=created_at.asc&limit=1`,
    );
    if (!issued.ok) {
      throw new Error(`Could not read the marketplace license (HTTP ${issued.status})`);
    }
    const rows = (await issued.json()) as { license_key: string }[];
    if (rows[0]?.license_key) licenceKey = rows[0].license_key;
  }
  let licence = existing[0];
  let created = false;
  if (licence) {
    licenceKey = licence.license_key;
  } else {
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
        if (!raced.ok) {
          throw new Error(
            `Could not read the license from a concurrent retry (HTTP ${raced.status})`,
          );
        }
        const rows = (await raced.json()) as { id: string; license_key: string }[];
        if (rows[0]) {
          licence = rows[0];
          licenceKey = rows[0].license_key;
        }
      }
      if (!licence) {
        console.error("[fulfilment] licence insert failed", licenceResponse.status, detail);
        await logPaymentEvent(orderId, "fulfilment_failed", {
          stage: "licence",
          detail: detail.slice(0, 500),
        });
        throw new Error("Could not issue the license; fulfillment can be retried");
      }
    } else {
      const rows = (await licenceResponse.json()) as { id: string; license_key: string }[];
      if (!rows[0]?.id || !rows[0]?.license_key) {
        throw new Error("License insert returned no license; fulfillment can be retried");
      }
      licence = rows[0];
      created = true;
    }
  }

  // The entitlement is what actually unlocks the product for this customer.
  // An order with several distinct products gets one for each of them; before,
  // a single metadata field decided, so a multi-product order unlocked at most
  // one of the things it paid for.
  const purchased = Array.from(
    new Set([productId, ...lines.map((line) => line.product_id ?? "")].filter(Boolean)),
  );
  if (!purchased.length) {
    throw new Error("The paid order contains no products to fulfill");
  }
  let entitlementId: string | null = null;
  const entitlementIds: string[] = [];
  for (const product of purchased) {
    const entitlementResponse = await rest("entitlements", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify({
        user_id: userId,
        product_id: product,
        order_id: orderId,
        license_id: licence.id,
        status: "active",
        source: "purchase",
      }),
    });
    if (!entitlementResponse.ok) {
      const detail = await entitlementResponse.text();
      console.error("[fulfilment] entitlement insert failed", entitlementResponse.status, detail);
      await logPaymentEvent(orderId, "fulfilment_failed", {
        stage: "entitlement",
        product_id: product,
        detail: detail.slice(0, 500),
      });
      throw new Error("Could not grant product access; fulfillment can be retried");
    }
    const rows = (await entitlementResponse.json()) as { id: string }[];
    if (!rows[0]?.id) {
      throw new Error("Entitlement write returned no entitlement; fulfillment can be retried");
    }
    entitlementIds.push(rows[0].id);
  }
  entitlementId = entitlementIds[0] ?? null;

  // A retry must also repair a commission that was not recorded on the first
  // fulfillment attempt. The commission writer is idempotent per order item.
  let commission: Awaited<ReturnType<typeof recordCommissionsForOrder>>;
  try {
    commission = await recordCommissionsForOrder(orderId);
  } catch (error) {
    commission = {
      ok: false,
      created: 0,
      skipped: 0,
      unattributed: 0,
      error: error instanceof Error ? error.message : "Commission processing failed",
    };
  }
  await logPaymentEvent(orderId, commission.ok ? "commission_recorded" : "commission_failed", {
    created: commission.created,
    skipped: commission.skipped,
    unattributed: commission.unattributed,
    detail: commission.error,
  });
  if (!commission.ok) {
    throw new Error(
      `Could not record author commission; fulfillment can be retried: ${commission.error ?? "unknown error"}`,
    );
  }

  const leadResponse = await rest("rpc/marketplace_capture_purchase_lead", {
    method: "POST",
    body: JSON.stringify({ p_order_id: orderId }),
  });
  if (!leadResponse.ok) {
    throw new Error(`Could not record the marketplace purchase lead (HTTP ${leadResponse.status})`);
  }
  const lead = (await leadResponse.json()) as {
    ok?: boolean;
    created?: boolean;
    reason?: string;
    lead_id?: string;
    name?: string;
    email?: string;
    phone?: string;
    product_id?: string | null;
    source_page?: string;
    cta_action?: string;
  };
  if (!lead.ok) {
    throw new Error(
      `Marketplace purchase lead was not recorded: ${lead.reason ?? "unknown error"}`,
    );
  }
  if (lead.created) {
    if (!lead.lead_id || !lead.email) {
      throw new Error("Marketplace purchase lead response was incomplete");
    }
    try {
      const { runLeadIntake } = await import("@/lib/marketplace/lead-intake");
      await runLeadIntake(supabaseUrl(), adminHeaders(), {
        id: lead.lead_id,
        name: lead.name ?? "",
        email: lead.email,
        phone: lead.phone ?? "",
        product_id: lead.product_id ?? null,
        source_page: lead.source_page ?? "/marketplace",
        cta_action: lead.cta_action ?? "purchase",
      });
    } catch {
      // Keep the durable lead even if optional scoring or routing is unavailable.
      console.error("[fulfilment] purchase lead intake failed", orderId);
    }
    await logPaymentEvent(orderId, "purchase_lead_created", { lead_id: lead.lead_id });
  } else if (lead.reason === "buyer_email_missing") {
    await logPaymentEvent(orderId, "purchase_lead_skipped", { reason: lead.reason });
  }

  const awardResponse = await rest("rpc/ams_ingest_event", {
    method: "POST",
    body: JSON.stringify({
      p_user_id: userId,
      p_event_key: "order.paid",
      p_entity_type: "marketplace_orders",
      p_entity_id: orderId,
      p_value: 1,
      p_occurred_at: new Date().toISOString(),
      p_source: "marketplace_fulfilment",
      p_payload: { order_id: orderId, ams_role: "user" },
    }),
  });
  if (!awardResponse.ok) {
    throw new Error(`Could not award marketplace purchase points (HTTP ${awardResponse.status})`);
  }
  const award = (await awardResponse.json()) as { ok?: boolean; reason?: string };
  if (!award.ok) {
    throw new Error(
      `Could not award marketplace purchase points: ${award.reason ?? "unknown error"}`,
    );
  }

  if (created) {
    await logPaymentEvent(orderId, "fulfilled", {
      licence_id: licence.id,
      fingerprint: licenceFingerprint(licenceKey),
      product_id: productId || null,
      entitlement_id: entitlementId,
      entitlements: entitlementIds.length,
      products: purchased.length,
    });
  } else {
    await logPaymentEvent(orderId, "entitlements_repaired", {
      licence_id: licence.id,
      entitlement_id: entitlementId,
      entitlements: entitlementIds.length,
      products: purchased.length,
    });
  }

  // The document for the customer and for the accounts.
  // Bill what was charged: rupees when the customer paid in rupees.
  const chargedAmount = Number(order.amount_inr ?? order.total ?? 0) || 0;
  const chargedCurrency = String(order.currency_charged ?? order.currency ?? "USD");
  const invoice = await createInvoiceForOrder({
    userId,
    orderId,
    amount: chargedAmount,
    currency: chargedCurrency,
    productName: productName,
    clientName: String(
      metadata.buyer_name ?? contact.name ?? contact.email ?? "Marketplace customer",
    ),
    status: "paid",
  });
  await logPaymentEvent(orderId, invoice.invoice ? "invoice_ready" : "invoice_failed", {
    created: invoice.created,
    invoice_no: (invoice.invoice as { invoice_no?: string } | null)?.invoice_no ?? null,
    detail: invoice.error ?? null,
  });
  if (!invoice.invoice) {
    throw new Error(
      `Could not create or read the order invoice; fulfillment can be retried: ${invoice.error ?? "invoice missing"}`,
    );
  }

  // Tell the buyer. Queued regardless of whether a provider is configured, so
  // nothing bought goes uncommunicated once credentials exist.
  const buyerEmail = String(
    metadata.email ??
      (metadata as { meta?: Record<string, unknown> }).meta?.email ??
      contact.email ??
      "",
  ).trim();
  if (buyerEmail) {
    const sentEmailResponse = await rest(
      `email_outbox?select=id&order_id=eq.${encodeURIComponent(orderId)}` +
        `&context->>licence_id=eq.${encodeURIComponent(licence.id)}&limit=1`,
    );
    if (!sentEmailResponse.ok) {
      throw new Error(`Could not check existing license email (HTTP ${sentEmailResponse.status})`);
    }
    const sentEmails: unknown = await sentEmailResponse.json();
    if (!Array.isArray(sentEmails)) {
      throw new Error("Existing license email response was not an array");
    }
    if (sentEmails.length === 0) {
      // In the language the buyer paid in (recorded by /api/payment/initiate).
      const lang = typeof metadata.language === "string" ? metadata.language : "en";
      const t = await serverTranslator(lang, ["email"]);
      const message = licenceEmail(
        {
          name: String(metadata.buyer_name ?? contact.name ?? buyerEmail.split("@")[0]),
          productName: productName,
          licenceKey,
          orderNo: (order.order_no as string | null) ?? null,
        },
        { t, lang },
      );
      const mail = await sendMail({
        ...message,
        to: buyerEmail,
        context: { kind: "licence", order_id: orderId, licence_id: licence.id, language: lang },
      });
      await logPaymentEvent(orderId, mail.sent ? "licence_email_sent" : "licence_email_queued", {
        to: buyerEmail,
        reason: mail.reason,
      });
    }
  } else {
    await logPaymentEvent(orderId, "licence_email_skipped", {
      reason: "neither the order metadata nor the buyer's profile carries an email",
    });
  }

  return { ok: true, created, licenceKey, licenceId: licence.id, entitlementId };
}

/** Take access back when a payment is reversed. The licence row is kept. */
export async function revokeOrderAccess(orderId: string, reason: string): Promise<boolean> {
  if (!supabaseUrl() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
  const response = await rest("rpc/revoke_order_access", {
    method: "POST",
    body: JSON.stringify({
      p_order_id: orderId,
      p_reason: reason.slice(0, 200),
    }),
  });
  if (!response.ok) {
    console.error(
      "[fulfilment] atomic access revocation failed",
      response.status,
      await response.text(),
    );
    return false;
  }
  const result = (await response.json()) as {
    ok?: boolean;
    licenses?: number;
    entitlements?: number;
  };
  if (!result.ok) return false;
  await logPaymentEvent(orderId, "access_revoked", {
    reason,
    licenses: result.licenses ?? 0,
    entitlements: result.entitlements ?? 0,
  });
  return true;
}
