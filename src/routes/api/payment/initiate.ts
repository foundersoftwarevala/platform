import { createFileRoute } from "@tanstack/react-router";
import {
  newTxnId, payuAmount, payuConfig, requestHash, usdToInr,
} from "@/lib/commerce/payu";
import { logPaymentEvent } from "@/lib/commerce/fulfilment";

/**
 * Start a payment.
 *
 * The customer's browser tells us which order to pay for and nothing else. The
 * price is read from the order in the database, converted server side, and the
 * hash is computed with a salt the browser never sees — so a customer cannot
 * choose what they are charged.
 *
 * The response is the exact set of fields to POST to PayU. The salt is not
 * among them.
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

export const Route = createFileRoute("/api/payment/initiate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const config = payuConfig();
        if (!config) {
          return Response.json(
            { error: "Online payment is not configured yet. Please contact support." },
            { status: 503 },
          );
        }

        const user = await currentUser(request);
        if (!user) {
          return Response.json({ error: "Please sign in to pay." }, { status: 401 });
        }

        let body: { orderId?: string; firstname?: string; phone?: string };
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
            `?select=id,buyer_id,user_id,status,total,currency,txnid,metadata` +
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

        // PayU settles in rupees, so the fixed USD price is converted here.
        const converted = await usdToInr(amountUsd);
        if (!converted) {
          await logPaymentEvent(orderId, "fx_lookup_failed", { amount_usd: amountUsd });
          return Response.json(
            { error: "We could not work out today's exchange rate. Please try again shortly." },
            { status: 503 },
          );
        }

        // Reuse the transaction id if this order already has one, so a customer
        // who retries does not create a second transaction for one order.
        const txnid = String(order.txnid ?? "") || newTxnId();
        const amount = payuAmount(converted.amount);
        const productinfo = String(
          (order.metadata as { product_name?: string })?.product_name ?? "Software Vala licence",
        ).slice(0, 100);
        const firstname = String(body.firstname ?? user.email.split("@")[0] ?? "Customer").slice(0, 60);

        await fetch(`${url()}/rest/v1/marketplace_orders?id=eq.${encodeURIComponent(orderId)}`, {
          method: "PATCH",
          headers: { ...admin(), Prefer: "return=minimal" },
          body: JSON.stringify({
            txnid,
            amount_usd: amountUsd,
            fx_rate: converted.rate,
            amount_inr: converted.amount,
            currency_charged: "INR",
            payment_gateway: "payu",
            status: "pending_payment",
            updated_at: new Date().toISOString(),
          }),
        });

        const hash = requestHash(config, { txnid, amount, productinfo, firstname, email: user.email });

        await logPaymentEvent(orderId, "payment_initiated", {
          txnid, amount_usd: amountUsd, fx_rate: converted.rate, amount_inr: converted.amount,
        }, { provider: "payu" });

        return Response.json({
          action: `${config.baseUrl}${config.paymentEndpoint}`,
          method: "POST",
          fields: {
            key: config.merchantKey,
            txnid,
            amount,
            productinfo,
            firstname,
            email: user.email,
            phone: String(body.phone ?? "").slice(0, 20),
            surl: `${config.appBaseUrl}/payment/success`,
            furl: `${config.appBaseUrl}/payment/fail`,
            hash,
          },
        });
      },
    },
  },
});
