import { createFileRoute } from "@tanstack/react-router";
import { translateApiMessage } from "@/lib/i18n/server-translate.server";

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

type ProductRow = {
  id: string;
  moderation_status: string | null;
  content_status: string | null;
  visible: boolean | null;
  publish_at: string | null;
  unpublish_at: string | null;
};

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const money = (n: number): number => Math.round(n * 100) / 100;
const PAGE_SIZE = 1000;

async function readAllRows<T extends Record<string, unknown>>(path: string): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;

  while (true) {
    const response = await rest(`${path}&order=id.asc`, {
      headers: {
        Range: `${offset}-${offset + PAGE_SIZE - 1}`,
        Prefer: "count=exact",
      },
    });
    if (!response.ok) {
      throw new Error(`Marketplace dashboard data could not be read (${response.status})`);
    }

    const contentRange = response.headers.get("content-range");
    const total = Number(contentRange?.split("/")[1]);
    if (!Number.isSafeInteger(total) || total < 0) {
      throw new Error("Marketplace dashboard data returned no exact row count");
    }

    const page: unknown = await response.json();
    if (!Array.isArray(page)) {
      throw new Error("Marketplace dashboard data returned an invalid row set");
    }
    rows.push(...(page as T[]));

    if (rows.length >= total) return rows;
    if (page.length === 0) {
      throw new Error("Marketplace dashboard data returned an incomplete row set");
    }
    offset += page.length;
  }
}

async function readRowsByIds<T extends Record<string, unknown>>(
  table: string,
  select: string,
  column: string,
  ids: string[],
): Promise<T[]> {
  const rows: T[] = [];
  const unique = [...new Set(ids.filter(Boolean))];

  for (let offset = 0; offset < unique.length; offset += 100) {
    const batch = unique.slice(offset, offset + 100);
    const list = batch.map((id) => `"${id}"`).join(",");
    rows.push(...(await readAllRows<T>(`${table}?select=${select}&${column}=in.(${list})`)));
  }

  return rows;
}

function isPublicProduct(product: ProductRow, now: number): boolean {
  return (
    product.visible === true &&
    product.moderation_status === "approved" &&
    (product.content_status === null || product.content_status === "published") &&
    (!product.publish_at || Date.parse(product.publish_at) <= now) &&
    (!product.unpublish_at || Date.parse(product.unpublish_at) > now)
  );
}

export const Route = createFileRoute("/api/seller/metrics")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const translateText = translateApiMessage.bind(null, request);
        const gate = await requireAuthor(request, {
          allowPending: true,
          sellerKinds: ["author", "vendor"],
        });
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
          const sellerFilter = `seller_id=eq.${encodeURIComponent(sellerId)}`;
          const [products, items, commissions] = await Promise.all([
            readAllRows<ProductRow & { downloads: number | null }>(
              `marketplace_products?select=id,moderation_status,content_status,visible,publish_at,unpublish_at,downloads&${sellerFilter}`,
            ),
            readAllRows<OrderItem>(
              `marketplace_order_items?select=id,order_id,line_total,created_at&${sellerFilter}`,
            ),
            readAllRows<{
              order_item_id: string;
              gross_amount: number | string;
              seller_amount: number | string;
              status: string;
              created_at: string;
            }>(
              `marketplace_commissions?select=id,order_item_id,gross_amount,seller_amount,status,created_at&${sellerFilter}`,
            ),
          ]);

          const productIds = products.map((product) => product.id);
          const versions = await readRowsByIds<{ id: string }>(
            "marketplace_product_versions",
            "id",
            "product_id",
            productIds,
          );
          const downloads = await readRowsByIds<{ id: string }>(
            "marketplace_downloads",
            "id",
            "version_id",
            versions.map((version) => version.id),
          );

          const orderIds = Array.from(new Set(items.map((item) => item.order_id).filter(Boolean)));
          const orders = await readRowsByIds<{
            id: string;
            status: string;
            buyer_id: string | null;
            created_at: string;
          }>("marketplace_orders", "id,status,buyer_id,created_at", "id", orderIds);

          const live = commissions.filter((commission) => commission.status !== "reversed");
          const reversed = commissions.filter((commission) => commission.status === "reversed");
          const nowTimestamp = now.getTime();

          const published = products.filter((product) =>
            isPublicProduct(product, nowTimestamp),
          ).length;
          const drafts = products.filter((product) =>
            ["draft", "changes_requested", "rejected"].includes(String(product.moderation_status)),
          ).length;
          const inReview = products.filter((product) =>
            ["submitted", "under_review"].includes(String(product.moderation_status)),
          ).length;

          const paidOrders = orders.filter((order) => order.status === "paid");
          const buyers = paidOrders.map((order) => order.buyer_id).filter(Boolean) as string[];
          const buyerCounts = buyers.reduce<Record<string, number>>((acc, buyer) => {
            acc[buyer] = (acc[buyer] ?? 0) + 1;
            return acc;
          }, {});

          const revenueToday = money(
            live
              .filter((commission) => commission.created_at >= startOfDay)
              .reduce((sum, commission) => sum + num(commission.gross_amount), 0),
          );
          const revenueMonth = money(
            live
              .filter((commission) => commission.created_at >= startOfMonth)
              .reduce((sum, commission) => sum + num(commission.gross_amount), 0),
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
            downloads: downloads.length,

            // orders
            orders: orders.filter((order) => order.created_at >= startOfDay).length,
            "orders-pending": orders.filter((order) => order.status === "pending_payment").length,
            "orders-completed": paidOrders.length,
            "orders-cancelled": orders.filter((order) =>
              ["cancelled", "payment_failed"].includes(String(order.status)),
            ).length,
            sales: live.length,

            // money
            revenue: revenueToday,
            "revenue-month": revenueMonth,
            commissions: money(
              live.reduce((sum, commission) => sum + num(commission.seller_amount), 0),
            ),
            earnings: money(
              live.reduce((sum, commission) => sum + num(commission.seller_amount), 0),
            ),

            // customers
            customers: Object.keys(buyerCounts).length,
            "customers-repeat": Object.values(buyerCounts).filter((count) => count > 1).length,

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
        } catch (error) {
          console.error("[seller metrics] database read failed", error);
          return Response.json({ error: await translateText("dashboard.api_could_not_load_your_dashboard_figures_1d34ea6") }, { status: 502 });
        }
      },
    },
  },
});
