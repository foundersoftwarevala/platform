import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/lib/json";
import { createServerFn } from "@tanstack/react-start";
import { callMarketplaceManagerFunction, withMarketplaceManagerDatabase } from "./vps-rpc.server";

import { z } from "zod";

/**
 * Orders Center — the real marketplace commerce records.
 *
 * The screen rendered a hardcoded array: SV-8842 "Aurora Systems Pvt Ltd" paid
 * by Razorpay, SV-8840 "Nimbus Retail LLP" pending on Bank, and so on. None of
 * those orders, customers, amounts or payment providers exist. The real orders
 * are MPO-prefixed rows in marketplace_orders, and they have been there all
 * along.
 *
 * Searching before building meant almost nothing new was needed:
 *
 *   All Orders    marketplace_orders + marketplace_order_items
 *   Invoices      finance_invoices, doc_type='invoice', order carried in
 *                 line_items.meta — the convention src/lib/commerce/invoices.ts
 *                 already set
 *   Proforma      finance_invoices, doc_type='proforma'
 *   Credit Notes  finance_invoices, doc_type='credit_note'
 *   Refunds       marketplace_order_refunds
 *   Disputes      the one table that genuinely did not exist
 *
 * Search, filter, sort and pagination all happen in the database, so the screen
 * never pulls the whole order book down to filter it in the browser.
 */

type Outcome = { ok?: boolean; reason?: string; message?: string; [k: string]: Json | undefined };

function settle<T extends Outcome>(result: T | null, fallback: string): T {
  if (!result?.ok) {
    throw new Error(
      result?.reason === "not_permitted"
        ? "The Orders Center needs marketplace operator rights."
        : String(result?.message ?? result?.reason ?? fallback),
    );
  }
  return result;
}

export type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_gateway: string | null;
  payment_reference: string | null;
  currency: string;
  subtotal: number;
  tax_total: number;
  total: number;
  amount_usd: number | null;
  amount_inr: number | null;
  fx_rate: number | null;
  created_at: string;
  updated_at: string;
  customer: { id: string | null; email: string | null };
  items: {
    product_id: string;
    name: string;
    seller_id: string | null;
    quantity: number;
    unit_amount: number;
    line_total: number;
  }[];
  item_count: number;
  refund_status: string | null;
  dispute_status: string | null;
  invoice_no: string | null;
};

export const listOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        search: z.string().max(120).optional(),
        status: z.string().max(40).optional(),
        payment_status: z.string().max(40).optional(),
        gateway: z.string().max(40).optional(),
        currency: z.string().max(8).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        min_amount: z.string().optional(),
        max_amount: z.string().optional(),
        product_id: z.string().uuid().optional(),
        sort: z.enum(["newest", "oldest", "amount_high", "amount_low", "status"]).optional(),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    const r = await callMarketplaceManagerFunction<{
      ok: boolean;
      reason?: string;
      total: number;
      limit: number;
      offset: number;
      orders: OrderRow[];
    }>("mm_orders_list", { p_query: data }, context.userId);
    return settle(r as Outcome, "The orders could not be loaded.") as unknown as {
      ok: true;
      total: number;
      limit: number;
      offset: number;
      orders: OrderRow[];
    };
  });

export const getOrderDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ orderId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    const r = await callMarketplaceManagerFunction<Outcome>(
      "mm_order_detail",
      { p_order_id: data.orderId },
      context.userId,
    );
    return settle(r, "That order could not be loaded.");
  });

export const listOrderDocs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        tab: z.enum(["invoices", "proforma", "credit_notes", "refunds", "disputes"]),
        limit: z.number().int().min(1).max(200).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    const r = await callMarketplaceManagerFunction<Outcome>(
      "mm_order_docs",
      { p_tab: data.tab, p_limit: data.limit ?? 50 },
      context.userId,
    );
    return settle(r, "Those records could not be loaded.");
  });

/**
 * Request a refund.
 *
 * This does not mark the order refunded, and it is important that it does not.
 * No payment provider is configured on this platform, so nothing can actually
 * return the money; the request is recorded as pending with the reason it is
 * stuck, and the order keeps the status it really has. The response says
 * plainly whether a provider was available.
 */
export const requestRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        amount: z.number().positive(),
        reason: z.string().min(1).max(500),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    const r = await callMarketplaceManagerFunction<Outcome & { provider_configured?: boolean }>(
      "mm_refund_request",
      { p_order_id: data.orderId, p_amount: data.amount, p_reason: data.reason },
      context.userId,
    );
    return settle(r, "The refund could not be requested.");
  });

export const openDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        reason: z.string().min(1).max(500),
        amount: z.number().positive().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    const r = await callMarketplaceManagerFunction<Outcome>(
      "mm_dispute_open",
      { p_order_id: data.orderId, p_reason: data.reason, p_amount: data.amount ?? null },
      context.userId,
    );
    return settle(r, "The dispute could not be opened.");
  });

export const resolveDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        disputeId: z.string().uuid(),
        status: z.enum([
          "under_review",
          "evidence_required",
          "won",
          "lost",
          "withdrawn",
          "resolved",
        ]),
        resolution: z.string().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    const r = await callMarketplaceManagerFunction<Outcome>(
      "mm_dispute_resolve",
      {
        p_dispute_id: data.disputeId,
        p_status: data.status,
        p_resolution: data.resolution ?? null,
      },
      context.userId,
    );
    return settle(r, "The dispute could not be updated.");
  });

/**
 * Export the current view — section 9.
 *
 * Runs the same authorised query the table is showing, so an export can never
 * contain an order the person could not already see, and records that it
 * happened.
 */
export const exportOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        search: z.string().max(120).optional(),
        status: z.string().max(40).optional(),
        sort: z.enum(["newest", "oldest", "amount_high", "amount_low", "status"]).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    const r = await callMarketplaceManagerFunction<{ ok: boolean; orders: OrderRow[]; total: number }>(
      "mm_orders_list",
      { p_query: { ...data, limit: data.limit ?? 100 } },
      context.userId,
    );
    settle(r as Outcome, "The export could not be produced.");

    const head = [
      "order_number",
      "status",
      "payment_status",
      "payment_reference",
      "currency",
      "total",
      "customer_email",
      "items",
      "invoice_no",
      "refund_status",
      "dispute_status",
      "created_at",
    ];
    const esc = (v: unknown) => {
      let s = v === null || v === undefined ? "" : String(v);
      // Customer e-mails and product names are other people's text; a cell that
      // starts like a formula would run as one when the file is opened in a
      // spreadsheet. Numbers are left as they are.
      if (typeof v === "string" && /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) {
        s = `'${s}`;
      }
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [head.join(",")];
    for (const o of r.orders) {
      lines.push(
        [
          o.order_number,
          o.status,
          o.payment_status,
          o.payment_reference,
          o.currency,
          o.total,
          o.customer?.email,
          o.items.map((i) => i.name).join(" | "),
          o.invoice_no,
          o.refund_status,
          o.dispute_status,
          o.created_at,
        ]
          .map(esc)
          .join(","),
      );
    }
    return {
      ok: true as const,
      filename: `marketplace-orders-${new Date().toISOString().slice(0, 10)}.csv`,
      rows: r.orders.length,
      total: r.total,
      csv: lines.join("\n"),
    };
  });

/**
 * Who was credited with an order.
 *
 * marketplace_order_attributions has always carried the partner chain —
 * reseller, affiliate, influencer, the attribution method and the click that
 * started it — and no Marketplace Manager screen showed any of it. An
 * operator looking at an attributed order saw the customer and the products
 * and no sign that somebody was owed credit for it.
 *
 * Read for one open order rather than joined into the list, so the Orders
 * Center page load is unchanged.
 */
export type OrderPartner = {
  id: string;
  method: string | null;
  attributed_at: string | null;
  click_id: string | null;
  reseller: { id: string; name: string; code: string | null; status: string | null } | null;
  affiliate: { id: string; name: string; status: string | null } | null;
  influencer: { id: string; name: string; status: string | null } | null;
};

export const getOrderPartners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ orderId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    const r = await callMarketplaceManagerFunction<{
      ok: boolean;
      count: number;
      attributions: OrderPartner[];
    }>(
      "mm_order_partners",
      { p_order_id: data.orderId },
      context.userId,
    );
    return settle(r as Outcome, "The order's partner credit could not be read.") as unknown as {
      ok: boolean;
      count: number;
      attributions: OrderPartner[];
    };
  });

export type OrderSummary = {
  orders: number;
  paid: number;
  refunded: number;
  pending: number;
};

export const getOrdersSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OrderSummary> => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    return withMarketplaceManagerDatabase(context.userId, async (tx) => {
      const [orders] = await tx<OrderSummary[]>`
        select
          count(*)::int as orders,
          count(*) filter (where status = 'paid')::int as paid,
          count(*) filter (where status in ('pending', 'pending_payment'))::int as pending,
          (select count(*)::int from public.marketplace_order_refunds) as refunded
        from public.marketplace_orders
      `;
      if (!orders) throw new Error("The order summary could not be loaded.");
      return orders;
    });
  });

export type PaymentLogRow = {
  id: string;
  order_id: string | null;
  order_number: string | null;
  event_type: string;
  provider: string | null;
  signature_valid: boolean | null;
  created_at: string;
};

export const listPaymentLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ limit: z.number().int().min(1).max(100).optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ rows: PaymentLogRow[]; total: number }> => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    return withMarketplaceManagerDatabase(context.userId, async (tx) => {
      const limit = data.limit ?? 50;
      const [count] = await tx<{ total: number }[]>`
        select count(*)::int as total from public.payment_logs
      `;
      const rows = await tx<PaymentLogRow[]>`
        select
          log.id,
          log.order_id,
          orders.order_number,
          log.event_type,
          log.provider,
          log.signature_valid,
          log.created_at
        from public.payment_logs as log
        left join public.marketplace_orders as orders on orders.id = log.order_id
        order by log.created_at desc, log.id desc
        limit ${limit}
      `;
      if (!count) throw new Error("The payment log count could not be loaded.");
      return { rows, total: count.total };
    });
  });
