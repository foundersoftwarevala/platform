import { createFileRoute } from "@tanstack/react-router";
import { cardAdapter, isCardGateway, resolveCardConfig } from "@/lib/commerce/card-gateways";
import { resolvePayuConfig, verifyWithPayu } from "@/lib/commerce/payu";
import { logPaymentEvent } from "@/lib/commerce/fulfilment";
import {
  orderForReference,
  recordReconciliation,
  settleVerifiedPayment,
} from "@/lib/commerce/settlement";
import { requestAddress, takeRateSlot } from "@/lib/commerce/payment-guard";
import { correlationId, log, since, withCorrelation } from "@/lib/commerce/observability";
import { selectTolerant } from "@/lib/commerce/schema-tolerance";

/**
 * What actually happened to a payment.
 *
 * The status page asks this rather than reading the query string it was sent,
 * because the query string is whatever the browser was handed. The answer comes
 * from the order row, which only a verified provider response is allowed to
 * move to "paid".
 *
 * It is also where a missed webhook is recovered. Providers drop callbacks —
 * a deploy, a timeout, a DNS blip — and a customer who has paid should not be
 * left with a pending order because of it. So when the customer returns to a
 * still-pending order, the server asks the provider directly. That recovery is:
 *
 *   - bounded: only for an order that is pending, only for its own buyer, and
 *     only while the intent is inside its recovery window;
 *   - rate limited: one attempt every few seconds per order, counted in
 *     payment_logs rather than in memory, so it holds across processes;
 *   - idempotent: it settles through exactly the same function the webhook
 *     does, so a webhook that arrives late finds the work already done and
 *     posts nothing a second time;
 *   - auditable: every attempt and its result is written down.
 *
 * It never invents a result. A provider that cannot be reached leaves the order
 * pending and says so.
 *
 * The licence key is returned only to the customer who owns the order, and only
 * when they are signed in. Everyone else gets the status and nothing more.
 */

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}` };
}

async function currentUserId(request: Request): Promise<string | null> {
  const publishable =
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? process.env.SUPABASE_ANON_KEY?.trim();
  const authorization = request.headers.get("authorization");
  if (!url() || !publishable || !authorization) return null;
  try {
    const response = await fetch(`${url()}/auth/v1/user`, {
      headers: { apikey: publishable, Authorization: authorization },
    });
    if (!response.ok) return null;
    const user = (await response.json()) as { id?: string };
    return user?.id ?? null;
  } catch {
    return null;
  }
}

const PORTAL_STATUS: Record<string, "paid" | "pending" | "failed"> = {
  paid: "paid",
  pending_payment: "pending",
  pending: "pending",
  payment_failed: "failed",
  failed: "failed",
  cancelled: "failed",
};

/** No more than one recovery attempt per order in this many milliseconds. */
const RECOVERY_INTERVAL_MS = 5_000;
/** How long after an intent expires recovery keeps trying. */
const RECOVERY_WINDOW_MS = 24 * 60 * 60 * 1000;

async function recentlyAttempted(orderId: string): Promise<boolean> {
  try {
    const since = new Date(Date.now() - RECOVERY_INTERVAL_MS).toISOString();
    const response = await fetch(
      `${url()}/rest/v1/payment_logs?select=id&order_id=eq.${encodeURIComponent(orderId)}` +
        `&event_type=eq.recovery_verify&created_at=gte.${encodeURIComponent(since)}&limit=1`,
      { headers: admin() },
    );
    if (!response.ok) return false;
    return ((await response.json()) as unknown[]).length > 0;
  } catch {
    return false;
  }
}

/**
 * Ask the provider what became of a payment nobody told us about, and settle it
 * if it succeeded. Returns true when the order moved to paid.
 */
async function recoverPayment(
  reference: string,
  viewerId: string | null,
  correlation: string,
): Promise<boolean> {
  const order = await orderForReference(reference);
  if (!order || order.status === "paid") return false;
  // Only the buyer's own visit drives recovery, so this cannot be used by a
  // stranger to probe the state of somebody else's payments.
  if (!viewerId || viewerId !== order.buyerId) return false;

  const expiry = order.intentExpiresAt ? Date.parse(order.intentExpiresAt) : Date.now();
  if (Number.isFinite(expiry) && Date.now() > expiry + RECOVERY_WINDOW_MS) return false;
  if (await recentlyAttempted(order.id)) return false;
  // The per-order interval above is the fast guard; this one holds across
  // processes and across a restart, so a poll loop cannot become a way to make
  // this server call a provider without limit.
  if (!(await takeRateSlot("recovery_order", order.id, correlation)).allowed) return false;

  const gateway = order.gateway;

  if (isCardGateway(gateway)) {
    const adapter = cardAdapter(gateway);
    const config = await resolveCardConfig(gateway);
    if (!adapter || !config) return false;

    const verification = await adapter.verify(config, {
      reference,
      providerPaymentId: order.providerPaymentId,
    });
    await logPaymentEvent(
      order.id,
      "recovery_verify",
      { reference, reason: verification.reason, provider_status: verification.status },
      { provider: gateway },
    );
    if (!verification.verified) {
      if (verification.status === "unknown") {
        await recordReconciliation({
          provider: gateway,
          reference,
          providerPaymentId: order.providerPaymentId,
          orderId: order.id,
          outcome: "missing_transaction",
          expectedAmount: order.amountCharged,
          observedAmount: null,
          expectedCurrency: order.currencyCharged,
          observedCurrency: null,
          detail: verification.reason,
        });
      }
      return false;
    }

    const settlement = await settleVerifiedPayment({
      order,
      provider: gateway,
      reference,
      providerPaymentId: verification.providerPaymentId,
      providerStatus: verification.status,
      observedAmount: verification.amount,
      observedCurrency: verification.currency,
      last4: verification.last4,
      brand: verification.brand,
      correlationId: correlation,
    });
    return settlement.ok;
  }

  if (gateway === "payu") {
    const config = await resolvePayuConfig();
    if (!config) return false;
    const verified = await verifyWithPayu(config, reference);
    await logPaymentEvent(
      order.id,
      "recovery_verify",
      { reference, reason: verified.reason, provider_status: verified.status },
      { provider: "payu" },
    );
    if (!verified.verified) return false;

    const settlement = await settleVerifiedPayment({
      order,
      provider: "payu",
      reference,
      providerPaymentId: verified.payuId ?? null,
      providerStatus: verified.status ?? "success",
      observedAmount: verified.amount ? Number(verified.amount) : null,
      observedCurrency: order.currencyCharged,
      correlationId: correlation,
    });
    return settlement.ok;
  }

  return false;
}

export const Route = createFileRoute("/api/payment/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const correlation = correlationId(request);
        const startedAt = Date.now();

        if (!url() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
          return withCorrelation(
            Response.json({ status: "unknown" }, { status: 503 }),
            correlation,
          );
        }

        const params = new URL(request.url).searchParams;
        const txnid = (params.get("txnid") ?? "").trim().slice(0, 80);
        if (!txnid) return withCorrelation(Response.json({ status: "unknown" }), correlation);

        // A status poll is cheap, but a poll loop should not become a way to
        // walk references. The limit is far above what a customer waiting for
        // one payment produces.
        const polling = await takeRateSlot("status_address", requestAddress(request), correlation);
        if (!polling.allowed) {
          return withCorrelation(
            Response.json(
              { status: "unknown", error: "Too many requests. Please wait a moment." },
              { status: 429, headers: { "Retry-After": String(polling.retryAfter) } },
            ),
            correlation,
          );
        }

        try {
          const viewer = await currentUserId(request);

          // The customer is back and the order has not been confirmed yet.
          // Ask the provider before answering, so a missed callback does not
          // become a customer who paid and was told nothing happened.
          let recovered = false;
          if (params.get("verify") !== "0") {
            recovered = await recoverPayment(txnid, viewer, correlation);
          }

          // Columns from a migration production may not have are dropped rather
          // than failing the read; a failed read answered "unknown" to every
          // buyer, paid or not.
          const response = await selectTolerant(
            "marketplace_orders",
            "id,order_no,order_number,status,buyer_id,user_id,amount_inr,amount_charged," +
              "total,currency_charged,payment_gateway,card_last4,card_brand,payment_verified_at",
            (select) =>
              `${url()}/rest/v1/marketplace_orders?select=${select}` +
              `&txnid=eq.${encodeURIComponent(txnid)}&limit=1`,
            { headers: admin() },
          );
          const orders = response.ok ? ((await response.json()) as Record<string, unknown>[]) : [];
          const order = orders[0];
          if (!order) return withCorrelation(Response.json({ status: "unknown" }), correlation);

          const status = PORTAL_STATUS[String(order.status ?? "").toLowerCase()] ?? "pending";
          const payload: Record<string, unknown> = { status, recovered };

          // Everything beyond the status — the order number, the amount, the
          // currency, the method, when it was verified, the card's last four
          // and brand, the key — is shown only to the person who bought it. A
          // reference is printed on pages and quoted to support; holding one
          // used to be enough to read what somebody else paid and how.
          const owner = String(order.user_id ?? order.buyer_id ?? "");
          const isOwner = Boolean(viewer && viewer === owner);
          if (isOwner) {
            payload.order_no = order.order_no ?? order.order_number ?? null;
            payload.amount =
              Number(order.amount_charged ?? order.amount_inr ?? order.total ?? 0) || null;
            payload.currency = order.currency_charged ?? null;
            payload.gateway = order.payment_gateway ?? null;
            payload.verified_at = order.payment_verified_at ?? null;
            payload.card_last4 = order.card_last4 ?? null;
            payload.card_brand = order.card_brand ?? null;
          }

          if (status === "paid" && isOwner) {
            const licenceResponse = await fetch(
              `${url()}/rest/v1/licenses?select=license_key&order_id=eq.${encodeURIComponent(String(order.id))}&limit=1`,
              { headers: admin() },
            );
            const licences = licenceResponse.ok
              ? ((await licenceResponse.json()) as { license_key: string }[])
              : [];
            if (licences[0]) payload.licence_key = licences[0].license_key;

            // The paid-order trigger issues into marketplace_licenses, keyed by
            // order line, and every licence that exists today came from it.
            // Reading `licenses` alone told a buyer who had paid that no key
            // existed. Still only for the buyer who owns the order.
            if (!payload.licence_key) {
              const itemResponse = await fetch(
                `${url()}/rest/v1/marketplace_order_items?select=id` +
                  `&order_id=eq.${encodeURIComponent(String(order.id))}&limit=20`,
                { headers: admin() },
              );
              const items = itemResponse.ok ? ((await itemResponse.json()) as { id: string }[]) : [];
              if (items.length) {
                const keyResponse = await fetch(
                  `${url()}/rest/v1/marketplace_licenses?select=license_key` +
                    `&order_item_id=in.(${items.map((i) => i.id).join(",")})` +
                    `&buyer_id=eq.${encodeURIComponent(owner)}&limit=1`,
                  { headers: admin() },
                );
                const keys = keyResponse.ok
                  ? ((await keyResponse.json()) as { license_key: string }[])
                  : [];
                if (keys[0]) payload.licence_key = keys[0].license_key;
              }
            }
          }

          log({
            correlationId: correlation,
            component: "payment-status",
            action: "poll",
            status: "ok",
            reference: txnid,
            orderId: String(order.id),
            paymentStatus: status,
            recovered,
            durationMs: since(startedAt),
          });

          return withCorrelation(
            Response.json(payload, { headers: { "Cache-Control": "no-store" } }),
            correlation,
          );
        } catch (error) {
          console.error("[payment status] failed", error);
          log({
            correlationId: correlation,
            component: "payment-status",
            action: "poll",
            status: "error",
            errorCode: "status_lookup_failed",
            reference: txnid,
            durationMs: since(startedAt),
          });
          return withCorrelation(
            Response.json({ status: "unknown" }, { status: 502 }),
            correlation,
          );
        }
      },
    },
  },
});
