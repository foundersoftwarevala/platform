import { createFileRoute } from "@tanstack/react-router";

import { requireAuthor, rest } from "@/lib/marketplace/author-guard";

/**
 * Real dashboard numbers for a vendor or author.
 *
 * The vendor and author dashboards were showing figures produced by a seeded
 * random-number generator in `lib/metrics.ts`, keyed on the role name and the
 * KPI name. Every vendor account saw the same invented values — "Revenue Today
 * $159,540" against "Revenue This Month $21,602", which cannot both be true.
 *
 * Every figure below is counted from the database for the seller behind the
 * signed-in session. Where the platform genuinely has no source for a metric —
 * there is no reviews table, no inventory model, no follower model — the value
 * is `null`, and the dashboard shows a dash rather than a number. A missing
 * capability should look missing.
 *
 * The keys match the `kpis[].key` values in `lib/roles.ts`, so a dashboard can
 * look a metric up by the key it already has.
 */

type OrderItem = {
  id: string;
  order_id: string;
  line_total: number | string | null;
  created_at: string;
};

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const money = (n: number): number => Math.round(n * 100) / 100;

export const Route = createFileRoute("/api/seller/metrics")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireAuthor(request, { allowPending: true });
        if (!gate.ok) return gate.response;
        const sellerId = gate.seller.id;

        const now = new Date();
        const startOfDay = new Date(Date.UTC(
          now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
        )).toISOString();
        const startOfMonth = new Date(Date.UTC(
          now.getUTCFullYear(), now.getUTCMonth(), 1,
        )).toISOString();

        const [productsRes, itemsRes, commissionsRes] = await Promise.all([
          rest(
            `marketplace_products?select=id,moderation_status,visible,downloads` +
              `&seller_id=eq.${encodeURIComponent(sellerId)}&limit=2000`,
          ),
          rest(
            `marketplace_order_items?select=id,order_id,line_total,created_at` +
              `&seller_id=eq.${encodeURIComponent(sellerId)}&limit=2000`,
          ),
          rest(
            `marketplace_commissions?select=id,order_item_id,gross_amount,seller_amount,status,created_at` +
              `&seller_id=eq.${encodeURIComponent(sellerId)}&limit=2000`,
          ),
        ]);

        const products = productsRes.ok
          ? ((await productsRes.json()) as { moderation_status: string; visible: boolean; downloads: number | null }[])
          : [];
        const items = itemsRes.ok ? ((await itemsRes.json()) as OrderItem[]) : [];
        const commissions = commissionsRes.ok
          ? ((await commissionsRes.json()) as
              { order_item_id: string; gross_amount: number | string; seller_amount: number | string;
                status: string; created_at: string }[])
          : [];

        // The orders behind this seller's lines, for status and buyer counts.
        let orders: { id: string; status: string; buyer_id: string | null; created_at: string }[] = [];
        const orderIds = Array.from(new Set(items.map((i) => i.order_id).filter(Boolean)));
        if (orderIds.length) {
          const list = orderIds.slice(0, 500).map((id) => `"${id}"`).join(",");
          const ordersRes = await rest(
            `marketplace_orders?select=id,status,buyer_id,created_at&id=in.(${list})&limit=1000`,
          );
          if (ordersRes.ok) orders = await ordersRes.json();
        }

        const live = commissions.filter((c) => c.status !== "reversed");
        const reversed = commissions.filter((c) => c.status === "reversed");

        const published = products.filter((p) => p.visible === true).length;
        const drafts = products.filter((p) =>
          ["draft", "changes_requested", "rejected"].includes(String(p.moderation_status))).length;
        const inReview = products.filter((p) =>
          ["submitted", "under_review"].includes(String(p.moderation_status))).length;

        const paidOrders = orders.filter((o) => o.status === "paid");
        const buyers = paidOrders.map((o) => o.buyer_id).filter(Boolean) as string[];
        const buyerCounts = buyers.reduce<Record<string, number>>((acc, b) => {
          acc[b] = (acc[b] ?? 0) + 1;
          return acc;
        }, {});

        const revenueToday = money(
          live.filter((c) => c.created_at >= startOfDay).reduce((s, c) => s + num(c.gross_amount), 0),
        );
        const revenueMonth = money(
          live.filter((c) => c.created_at >= startOfMonth).reduce((s, c) => s + num(c.gross_amount), 0),
        );

        /**
         * `null` means the platform has no source for this metric yet, not zero.
         * The dashboard shows a dash for these instead of inventing a number.
         */
        const metrics: Record<string, number | null> = {
          // products
          products: published,
          "products-draft": drafts,
          "products-review": inReview,
          downloads: products.reduce((s, p) => s + num(p.downloads), 0),

          // orders
          orders: orders.filter((o) => o.created_at >= startOfDay).length,
          "orders-pending": orders.filter((o) => o.status === "pending_payment").length,
          "orders-completed": paidOrders.length,
          "orders-cancelled": orders.filter((o) =>
            ["cancelled", "payment_failed"].includes(String(o.status))).length,
          sales: live.length,

          // money
          revenue: revenueToday,
          "revenue-month": revenueMonth,
          commissions: money(live.reduce((s, c) => s + num(c.seller_amount), 0)),
          earnings: money(live.reduce((s, c) => s + num(c.seller_amount), 0)),

          // customers
          customers: Object.keys(buyerCounts).length,
          "customers-repeat": Object.values(buyerCounts).filter((n) => n > 1).length,

          // refunds
          returns: reversed.length,
          refunds: reversed.length,

          // No source exists for these yet. A dash is the honest answer.
          inventory: null,
          "inventory-oos": null,
          reviews: null,
          followers: null,
          reach: null,
          views: null,
          leads: null,
          clicks: null,
        };

        return Response.json({
          seller: {
            id: sellerId,
            display_name: gate.seller.display_name,
            status: gate.seller.status,
            currency: gate.seller.payout_currency ?? "USD",
          },
          metrics,
          source: "supabase:marketplace",
          generatedAt: new Date().toISOString(),
        });
      },
    },
  },
});
