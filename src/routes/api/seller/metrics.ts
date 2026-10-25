import { createFileRoute } from "@tanstack/react-router";

import { AuthorBackendError, requireAuthor, rest } from "@/lib/marketplace/author-guard";

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

export const Route = createFileRoute("/api/seller/metrics")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireAuthor(request, { allowPending: true });
        if (!gate.ok) return gate.response;
        const sellerId = gate.seller.id;

        const now = new Date();
        const startOfDay = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
        ).toISOString();
        const startOfMonth = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
        ).toISOString();

        try {
          const response = await rest("rpc/marketplace_seller_metrics_summary", {
            method: "POST",
            body: JSON.stringify({
              p_seller_id: sellerId,
              p_start_day: startOfDay,
              p_start_month: startOfMonth,
            }),
          });
          if (!response.ok)
            throw new AuthorBackendError("Seller metrics aggregation", response.status);
          const summary: unknown = await response.json();
          if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
            throw new AuthorBackendError("Seller metrics aggregation response");
          }
          const data = summary as {
            products: { published: number; drafts: number; in_review: number; downloads: number };
            orders: {
              today: number;
              pending: number;
              completed: number;
              cancelled: number;
              sales: number;
              returns: number;
              customers: number;
              repeat_customers: number;
            };
            revenue_by_currency: { currency: string; amount: number }[];
            revenue_today_by_currency: { currency: string; amount: number }[];
            revenue_month_by_currency: { currency: string; amount: number }[];
            commissions_by_currency: { currency: string; amount: number }[];
            recent_activities: Record<string, unknown>[];
          };
          const metrics: Record<string, number | null> = {
            products: data.products.published,
            "products-draft": data.products.drafts,
            "products-review": data.products.in_review,
            downloads: data.products.downloads,
            orders: data.orders.today,
            "orders-pending": data.orders.pending,
            "orders-completed": data.orders.completed,
            "orders-cancelled": data.orders.cancelled,
            sales: data.orders.sales,
            revenue:
              data.revenue_today_by_currency.length === 1
                ? (data.revenue_today_by_currency[0]?.amount ?? 0)
                : data.revenue_today_by_currency.length
                  ? null
                  : 0,
            "revenue-month":
              data.revenue_month_by_currency.length === 1
                ? (data.revenue_month_by_currency[0]?.amount ?? 0)
                : data.revenue_month_by_currency.length
                  ? null
                  : 0,
            commissions:
              data.commissions_by_currency.length === 1
                ? (data.commissions_by_currency[0]?.amount ?? 0)
                : data.commissions_by_currency.length
                  ? null
                  : 0,
            earnings:
              data.commissions_by_currency.length === 1
                ? (data.commissions_by_currency[0]?.amount ?? 0)
                : data.commissions_by_currency.length
                  ? null
                  : 0,
            customers: data.orders.customers,
            "customers-repeat": data.orders.repeat_customers,
            returns: data.orders.returns,
            refunds: data.orders.returns,
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
            revenueByCurrency: data.revenue_by_currency,
            revenueTodayByCurrency: data.revenue_today_by_currency,
            revenueMonthByCurrency: data.revenue_month_by_currency,
            commissionsByCurrency: data.commissions_by_currency,
            recentActivities: data.recent_activities,
            source: "supabase:marketplace",
            generatedAt: new Date().toISOString(),
          });
        } catch (error) {
          if (!(error instanceof AuthorBackendError)) throw error;
          console.error("[seller metrics] source read failed", error.message);
          return Response.json({ error: "Could not read your seller metrics" }, { status: 502 });
        }
      },
    },
  },
});
