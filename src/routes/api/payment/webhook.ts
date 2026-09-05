import { createFileRoute } from "@tanstack/react-router";
import {
  hashesMatch, payuAmount, payuConfig, responseHash, verifyWithPayu,
} from "@/lib/commerce/payu";
import { fulfilOrder, logPaymentEvent } from "@/lib/commerce/fulfilment";

/**
 * Where PayU tells us what happened.
 *
 * Nothing here trusts the caller. Before an order is marked paid the callback
 * has to clear four separate checks, and every attempt — passed or failed — is
 * written to payment_logs so a disputed payment can be reconstructed later.
 *
 *   1. the reverse hash must verify against our salt
 *   2. the order named by the transaction id must exist
 *   3. the amount must match what that order was for
 *   4. PayU's own verify endpoint must agree the payment succeeded
 *
 * Replays are harmless: an order already paid is acknowledged without being
 * fulfilled twice, because PayU retries this callback.
 */

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function readFields(request: Request): Promise<Record<string, string>> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    return (await request.json()) as Record<string, string>;
  }
  const form = await request.formData();
  const fields: Record<string, string> = {};
  form.forEach((value, key) => {
    fields[key] = String(value);
  });
  return fields;
}

export const Route = createFileRoute("/api/payment/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const config = payuConfig();
        if (!config || !url()) {
          // Fail closed. A callback we cannot check is not a payment.
          console.error("[payu webhook] refused: no credentials configured");
          return new Response("Payment provider is not configured", { status: 503 });
        }

        let fields: Record<string, string>;
        try {
          fields = await readFields(request);
        } catch {
          return new Response("Unreadable callback", { status: 400 });
        }

        const txnid = String(fields.txnid ?? "").trim();
        const status = String(fields.status ?? "").toLowerCase();
        const amount = String(fields.amount ?? "").trim();

        // ---- 1. the reverse hash ------------------------------------------
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

        await logPaymentEvent(null, "payu_callback_received", { txnid, status, amount }, {
          signatureValid, provider: "payu",
        });

        if (!signatureValid) {
          console.error("[payu webhook] hash mismatch for", txnid);
          return new Response("Signature rejected", { status: 400 });
        }

        // ---- 2. the order -------------------------------------------------
        const orderResponse = await fetch(
          `${url()}/rest/v1/marketplace_orders?select=id,status,total,amount_inr,currency_charged` +
            `&txnid=eq.${encodeURIComponent(txnid)}&limit=1`,
          { headers: admin() },
        );
        const orders = orderResponse.ok
          ? ((await orderResponse.json()) as Record<string, unknown>[])
          : [];
        const order = orders[0];
        if (!order) {
          await logPaymentEvent(null, "payu_unknown_txnid", { txnid }, { provider: "payu" });
          return new Response("Unknown transaction", { status: 404 });
        }
        const orderId = String(order.id);

        // Already settled? Acknowledge without doing the work twice.
        if (String(order.status).toLowerCase() === "paid") {
          await logPaymentEvent(orderId, "payu_callback_replay", { txnid }, { provider: "payu" });
          return new Response("Already recorded", { status: 200 });
        }

        // ---- 3. the amount ------------------------------------------------
        const charged = Number(order.amount_inr ?? order.total ?? 0);
        if (charged > 0 && payuAmount(charged) !== payuAmount(Number(amount))) {
          await logPaymentEvent(orderId, "payu_amount_mismatch", {
            txnid, callback_amount: amount, order_amount: payuAmount(charged),
          }, { provider: "payu" });
          console.error("[payu webhook] amount mismatch on", txnid);
          return new Response("Amount mismatch", { status: 409 });
        }

        // ---- 4. PayU's own word -------------------------------------------
        const verified = await verifyWithPayu(config, txnid);
        await logPaymentEvent(orderId, "payu_verify", {
          txnid, reason: verified.reason, provider_status: verified.status,
        }, { signatureValid: true, provider: "payu" });

        const settled = status === "success" && verified.verified;

        await fetch(`${url()}/rest/v1/marketplace_orders?id=eq.${encodeURIComponent(orderId)}`, {
          method: "PATCH",
          headers: { ...admin(), Prefer: "return=minimal" },
          body: JSON.stringify({
            status: settled ? "paid" : "payment_failed",
            payu_status: status,
            payu_txn_id: verified.payuId ?? fields.mihpayid ?? null,
            payment_gateway: "payu",
            updated_at: new Date().toISOString(),
          }),
        });

        if (!settled) {
          await logPaymentEvent(orderId, "payment_failed", { txnid, status, reason: verified.reason },
            { provider: "payu" });
          return new Response("Recorded as failed", { status: 200 });
        }

        // Only now does the customer get anything.
        const fulfilment = await fulfilOrder(orderId);
        await logPaymentEvent(orderId, fulfilment.ok ? "payment_settled" : "fulfilment_error", {
          txnid,
          fulfilled: fulfilment.ok,
          detail: fulfilment.ok ? undefined : fulfilment.error,
        }, { provider: "payu" });

        return new Response("OK", { status: 200 });
      },

      // PayU probes the endpoint; answer without revealing anything.
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
