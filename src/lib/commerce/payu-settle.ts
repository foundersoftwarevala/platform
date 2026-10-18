import { createHash } from "node:crypto";
import {
  hashesMatch, payuAmount, responseHash, verifyWithPayu, type PayuConfig,
} from "./payu";
import { fulfilOrder, logPaymentEvent } from "./fulfilment";

/**
 * Settling a PayU result, whichever way it reaches us.
 *
 * PayU reports a payment twice: server to server (/api/payment/webhook) and by
 * sending the buyer's browser back with a form POST to surl/furl. Both carry
 * the same signed fields, so both go through this one function and neither is
 * believed until:
 *
 *   1. the reverse hash verifies against our salt
 *   2. the transaction id belongs to an order (its current or an earlier attempt)
 *   3. the amount matches what that attempt was charged
 *   4. PayU's verify endpoint agrees, for the same amount
 *
 * The order only moves from pending_payment to paid, in one conditional update,
 * so two deliveries of the same result cannot both fulfil. A failed attempt
 * leaves the order pending_payment (the only unpaid status the table allows)
 * and records PayU's status, so the buyer can try again.
 */

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

export type PayuAttempt = { txnid: string; amount_inr: number | null };

export type SettleOutcome = {
  /** What to answer PayU's server. A non-200 makes PayU deliver again. */
  httpStatus: number;
  message: string;
  txnid: string;
};

type OrderRow = {
  id: string;
  status: string | null;
  total: number | null;
  amount_inr: number | null;
  txnid: string | null;
  metadata: Record<string, unknown> | null;
};

const ORDER_COLUMNS = "id,status,total,amount_inr,txnid,metadata";

/** PayU posts form fields; a JSON body is accepted too. */
export async function readPayuFields(request: Request): Promise<Record<string, string>> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = (await request.json()) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(body ?? {}).map(([k, v]) => [k, String(v ?? "")]));
  }
  const form = await request.formData();
  const fields: Record<string, string> = {};
  form.forEach((value, key) => {
    fields[key] = String(value);
  });
  return fields;
}

/** The order a transaction id belongs to: its current attempt, or an earlier one. */
export async function orderForTxnid(
  txnid: string,
  columns = ORDER_COLUMNS,
): Promise<Record<string, unknown> | null> {
  if (!txnid) return null;
  const current = await fetch(
    `${url()}/rest/v1/marketplace_orders?select=${columns}&txnid=eq.${encodeURIComponent(txnid)}&limit=1`,
    { headers: admin() },
  );
  const rows = current.ok ? ((await current.json()) as Record<string, unknown>[]) : [];
  if (rows[0]) return rows[0];
  const earlier = await fetch(
    `${url()}/rest/v1/marketplace_orders?select=${columns}` +
      `&metadata->payu_attempts=cs.${encodeURIComponent(JSON.stringify([{ txnid }]))}&limit=1`,
    { headers: admin() },
  );
  const older = earlier.ok ? ((await earlier.json()) as Record<string, unknown>[]) : [];
  return older[0] ?? null;
}

/** The rupee amount a given attempt was charged. */
function chargedFor(order: OrderRow, txnid: string): number {
  if (order.txnid === txnid) return Number(order.amount_inr ?? order.total ?? 0);
  const attempts = (order.metadata?.payu_attempts ?? []) as PayuAttempt[];
  const attempt = Array.isArray(attempts) ? attempts.find((a) => a?.txnid === txnid) : undefined;
  return Number(attempt?.amount_inr ?? 0);
}

/**
 * Keep marketplace_payment_intents (one per order) in step with the provider,
 * and add the provider's event to marketplace_payment_events. Neither write
 * may block a payment: a failure is logged and the payment carries on.
 */
export async function recordPaymentIntent(
  orderId: string,
  intent: { status: "pending" | "succeeded" | "failed"; txnid: string; amount: number },
  event?: { id: string; type: string; amount: number; fields: Record<string, string> },
): Promise<void> {
  try {
    const values = {
      provider: "payu",
      provider_intent_id: intent.txnid,
      status: intent.status,
      amount: intent.amount,
      currency: "INR",
      updated_at: new Date().toISOString(),
    };
    const patched = await fetch(
      `${url()}/rest/v1/marketplace_payment_intents?order_id=eq.${encodeURIComponent(orderId)}`,
      { method: "PATCH", headers: { ...admin(), Prefer: "return=representation" }, body: JSON.stringify(values) },
    );
    let rows = patched.ok ? ((await patched.json()) as { id: string }[]) : [];
    if (patched.ok && rows.length === 0) {
      // Orders made before checkout wrote intents have none yet.
      const created = await fetch(
        `${url()}/rest/v1/marketplace_payment_intents?on_conflict=order_id`,
        {
          method: "POST",
          headers: { ...admin(), Prefer: "return=representation,resolution=merge-duplicates" },
          body: JSON.stringify({ ...values, order_id: orderId, idempotency_key: `payu:${orderId}` }),
        },
      );
      rows = created.ok ? ((await created.json()) as { id: string }[]) : [];
    }
    const intentId = rows[0]?.id;
    if (!intentId) {
      await logPaymentEvent(orderId, "payment_intent_write_failed", { txnid: intent.txnid, status: intent.status });
      return;
    }
    if (!event) return;
    const { hash: _hash, ...payload } = event.fields;
    const recorded = await fetch(
      `${url()}/rest/v1/marketplace_payment_events?on_conflict=provider,provider_event_id`,
      {
        method: "POST",
        headers: { ...admin(), Prefer: "return=minimal,resolution=ignore-duplicates" },
        body: JSON.stringify({
          payment_intent_id: intentId,
          provider: "payu",
          provider_event_id: event.id,
          event_type: event.type,
          amount: event.amount,
          currency: "INR",
          signature_verified: true,
          payload_hash: createHash("sha256").update(JSON.stringify(event.fields)).digest("hex"),
          payload,
        }),
      },
    );
    if (!recorded.ok) {
      await logPaymentEvent(orderId, "payment_event_write_failed", {
        txnid: intent.txnid, status: recorded.status, detail: (await recorded.text()).slice(0, 300),
      });
    }
  } catch (error) {
    await logPaymentEvent(orderId, "payment_intent_write_failed", {
      txnid: intent.txnid, message: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Issue access for a paid order. Idempotent: a paid order keeps its licence. */
async function fulfil(orderId: string, txnid: string, replay: boolean): Promise<SettleOutcome> {
  const fulfilment = await fulfilOrder(orderId);
  await logPaymentEvent(orderId, fulfilment.ok ? (replay ? "payu_callback_replay" : "payment_settled") : "fulfilment_error", {
    txnid,
    fulfilled: fulfilment.ok,
    licence_created: fulfilment.ok ? fulfilment.created : false,
    detail: fulfilment.ok ? undefined : fulfilment.error,
  }, { provider: "payu" });
  // A paid order without its licence is answered with an error so PayU
  // delivers again, and the next delivery finishes the job.
  return fulfilment.ok
    ? { httpStatus: 200, message: replay ? "Already recorded" : "OK", txnid }
    : { httpStatus: 500, message: "Paid, access not yet issued", txnid };
}

export async function settlePayuCallback(
  config: PayuConfig,
  fields: Record<string, string>,
  source: "webhook" | "return",
): Promise<SettleOutcome> {
  const txnid = String(fields.txnid ?? "").trim();
  const status = String(fields.status ?? "").toLowerCase();
  const amount = String(fields.amount ?? "").trim();

  // ---- 1. the reverse hash --------------------------------------------------
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
  await logPaymentEvent(null, "payu_callback_received", { txnid, status, amount, source }, {
    signatureValid, provider: "payu",
  });
  if (!signatureValid) {
    console.error("[payu] hash mismatch for", txnid);
    return { httpStatus: 400, message: "Signature rejected", txnid };
  }

  // ---- 2. the order ---------------------------------------------------------
  const order = (await orderForTxnid(txnid)) as OrderRow | null;
  if (!order) {
    await logPaymentEvent(null, "payu_unknown_txnid", { txnid, source }, { provider: "payu" });
    return { httpStatus: 404, message: "Unknown transaction", txnid };
  }
  const orderId = String(order.id);
  const orderStatus = String(order.status ?? "").toLowerCase();

  // Already settled? A repeated success makes sure access exists, without
  // settling twice. Anything else for a paid order changes nothing at all.
  if (orderStatus === "paid") {
    if (status === "success") return fulfil(orderId, txnid, true);
    await logPaymentEvent(orderId, "payu_failure_ignored", { txnid, status, reason: "order already paid" },
      { provider: "payu" });
    return { httpStatus: 200, message: "Already recorded", txnid };
  }

  // ---- 3. the amount --------------------------------------------------------
  const charged = chargedFor(order, txnid);
  if (!(charged > 0) || payuAmount(charged) !== payuAmount(Number(amount))) {
    await logPaymentEvent(orderId, "payu_amount_mismatch", {
      txnid, callback_amount: amount, order_amount: charged > 0 ? payuAmount(charged) : null,
    }, { provider: "payu" });
    console.error("[payu] amount mismatch on", txnid);
    return { httpStatus: 409, message: "Amount mismatch", txnid };
  }

  // ---- 4. PayU's own word, for the same amount ------------------------------
  const verified = await verifyWithPayu(config, txnid);
  const verifiedAmountMatches =
    verified.amount == null || payuAmount(Number(verified.amount)) === payuAmount(charged);
  await logPaymentEvent(orderId, "payu_verify", {
    txnid, reason: verified.reason, provider_status: verified.status, amount_matches: verifiedAmountMatches,
  }, { signatureValid: true, provider: "payu" });

  const settled = status === "success" && verified.verified && verifiedAmountMatches;
  const payuId = verified.payuId ?? fields.mihpayid ?? null;
  const event = {
    id: `${payuId ?? txnid}:${status || "unknown"}`,
    type: `payment.${status || "unknown"}`,
    amount: charged,
    fields,
  };

  if (orderStatus !== "pending_payment") {
    // Money reported for an order that is cancelled, refunded or otherwise
    // closed. It is not reopened here; it is recorded for a person to act on.
    await logPaymentEvent(orderId, "payu_result_on_closed_order", {
      txnid, status, order_status: orderStatus, settled,
    }, { provider: "payu" });
    await recordPaymentIntent(orderId, { status: settled ? "succeeded" : "failed", txnid, amount: charged }, event);
    return { httpStatus: 200, message: "Recorded for review", txnid };
  }

  if (!settled) {
    // Only the current attempt may mark the order; a late failure for an
    // earlier attempt must not overwrite a newer one.
    const failed = await fetch(
      `${url()}/rest/v1/marketplace_orders?id=eq.${encodeURIComponent(orderId)}` +
        `&status=eq.pending_payment&txnid=eq.${encodeURIComponent(txnid)}`,
      {
        method: "PATCH",
        headers: { ...admin(), Prefer: "return=representation" },
        body: JSON.stringify({
          payu_status: status || "failure",
          payu_txn_id: payuId,
          payment_gateway: "payu",
          updated_at: new Date().toISOString(),
        }),
      },
    );
    if (!failed.ok) {
      await logPaymentEvent(orderId, "order_update_failed", { txnid, stage: "failed", status: failed.status });
      return { httpStatus: 500, message: "Could not record the result", txnid };
    }
    const marked = (await failed.json()) as unknown[];
    if (marked.length === 0) {
      // The order was settled (or moved to a newer attempt) in the meantime.
      // A failure arriving after a success changes nothing, intent included.
      await logPaymentEvent(orderId, "payu_failure_ignored", { txnid, status, reason: "order no longer awaiting this attempt" },
        { provider: "payu" });
      return { httpStatus: 200, message: "Recorded as failed", txnid };
    }
    await recordPaymentIntent(orderId, { status: "failed", txnid, amount: charged }, event);
    await logPaymentEvent(orderId, "payment_failed", { txnid, status, reason: verified.reason },
      { provider: "payu" });
    return { httpStatus: 200, message: "Recorded as failed", txnid };
  }

  // ---- settle: pending_payment -> paid, exactly once -------------------------
  const paid = await fetch(
    `${url()}/rest/v1/marketplace_orders?id=eq.${encodeURIComponent(orderId)}&status=eq.pending_payment`,
    {
      method: "PATCH",
      headers: { ...admin(), Prefer: "return=representation" },
      body: JSON.stringify({
        status: "paid",
        txnid,
        amount_inr: charged,
        currency_charged: "INR",
        payu_status: status,
        payu_txn_id: payuId,
        payment_gateway: "payu",
        updated_at: new Date().toISOString(),
      }),
    },
  );
  if (!paid.ok) {
    await logPaymentEvent(orderId, "order_update_failed", {
      txnid, stage: "paid", status: paid.status, detail: (await paid.text()).slice(0, 300),
    });
    return { httpStatus: 500, message: "Could not record the payment", txnid };
  }
  const moved = (await paid.json()) as unknown[];
  await recordPaymentIntent(orderId, { status: "succeeded", txnid, amount: charged }, event);
  if (moved.length === 0) {
    // Another delivery settled it first; that one issued access.
    const now = (await orderForTxnid(txnid, "id,status")) as { status?: string } | null;
    if (String(now?.status ?? "") === "paid") return fulfil(orderId, txnid, true);
    await logPaymentEvent(orderId, "payu_settle_conflict", { txnid, order_status: now?.status ?? null });
    return { httpStatus: 409, message: "Order changed while settling", txnid };
  }

  // Only now does the customer get anything.
  return fulfil(orderId, txnid, false);
}
