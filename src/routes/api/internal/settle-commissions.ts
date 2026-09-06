import { createFileRoute } from "@tanstack/react-router";

import { recordCommissionsForOrder, reverseCommissionsForOrder } from "@/lib/commerce/commission";
import { createInvoiceForOrder } from "@/lib/commerce/invoices";
import { requireInternalOperator } from "@/lib/auth/internal-guard";

/**
 * Replay author commission for an order that has already settled, or reverse it
 * for one that has been refunded.
 *
 * Commission is normally written by the payment webhook. This exists because a
 * webhook can be missed — PayU retries give up, a deploy lands mid-callback, a
 * network blip swallows one — and a finance operator then has no way to credit
 * an author for a sale that genuinely happened. It is the same engine, so a
 * replay converges on the one commission row rather than creating a second.
 *
 * It cannot mint money: every amount is read from the stored order item, the
 * seller comes from the product record, and the rate comes from the commission
 * rules. Nothing in the request body influences what is credited except which
 * order to look at.
 *
 *   POST { orderId }                       -> record commission for that order
 *   POST { orderId, reverse: true, reason } -> reverse it after a refund
 */
export const Route = createFileRoute("/api/internal/settle-commissions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        let body: { orderId?: string; reverse?: boolean; reason?: string; refundId?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Expected a JSON body" }, { status: 400 });
        }

        const orderId = String(body.orderId ?? "").trim();
        if (!orderId) {
          return Response.json({ error: "orderId is required" }, { status: 400 });
        }

        if (body.reverse) {
          const reversal = await reverseCommissionsForOrder(
            orderId,
            body.refundId ?? null,
            String(body.reason ?? "manual reversal"),
          );
          return Response.json(
            { orderId, mode: "reverse", ...reversal },
            { status: reversal.ok ? 200 : 502 },
          );
        }

        const result = await recordCommissionsForOrder(orderId);

        // A missed webhook costs the business its invoice as well as the
        // author's commission, so a replay reissues both. The invoicing module
        // is already idempotent on the order, so this cannot double-issue.
        let invoice: { created: boolean; invoiceNo: string | null; error?: string } = {
          created: false, invoiceNo: null,
        };
        const orderResponse = await fetch(
          `${process.env.SUPABASE_URL?.trim() ?? ""}/rest/v1/marketplace_orders` +
            `?select=id,buyer_id,user_id,total,amount_inr,currency,currency_charged,metadata` +
            `&id=eq.${encodeURIComponent(orderId)}&limit=1`,
          {
            headers: {
              apikey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "",
              Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ""}`,
            },
          },
        );
        if (orderResponse.ok) {
          const order = ((await orderResponse.json()) as Record<string, unknown>[])[0];
          if (order) {
            const metadata = (order.metadata ?? {}) as Record<string, unknown>;
            const currency = String(order.currency_charged ?? order.currency ?? "USD");
            const issued = await createInvoiceForOrder({
              userId: String(order.buyer_id ?? order.user_id ?? ""),
              orderId,
              amount: Number(currency === "INR" ? order.amount_inr ?? order.total : order.total) || 0,
              currency,
              productName: String(metadata.product_name ?? "Software Vala lifetime licence"),
              clientName: String(metadata.buyer_name ?? metadata.email ?? "Marketplace customer"),
              status: "paid",
            });
            invoice = {
              created: issued.created,
              invoiceNo: (issued.invoice as { invoice_no?: string } | null)?.invoice_no ?? null,
              error: issued.error,
            };
          }
        }

        return Response.json(
          { orderId, mode: "record", ...result, invoice },
          { status: result.ok ? 200 : 502 },
        );
      },
    },
  },
});
