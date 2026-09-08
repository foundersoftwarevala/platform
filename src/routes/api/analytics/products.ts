import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";

/**
 * Per-product analytics, from the events and orders that exist.
 *
 * The screen showed 128k views, 14.2k demo clicks, 3.1% conversion, 27% bounce
 * and revenue of Rs 42L, over a table whose first row was a written-in product
 * called Vala ERP Pro with 48.2k views and a trending score of 92. Section 51
 * lists those exact numbers as the thing to remove.
 *
 * What actually exists: 35 rows in marketplace_events (27 product views, 5 demo
 * clicks, 3 CTA clicks), 10 paid orders worth $2,490, 6 short-link clicks and 1
 * QR scan. Those are the numbers this returns.
 *
 * Three rules it follows rather than papering over:
 *
 *   Revenue comes from paid orders and their line items, never from a Buy
 *   click. Section 7 and section 9 both say so, and a click is intent.
 *
 *   Every rate states its own denominator. A conversion rate is meaningless
 *   without knowing what it was divided by, and mixing denominators between
 *   products makes the column a lie.
 *
 *   A metric with no events behind it returns null and says why. Bounce rate
 *   and session duration need session boundaries that these events do not
 *   carry; country and device need metadata that the historical rows have
 *   empty. Those come back as not-captured rather than as zero, because zero
 *   would read as "nobody bounced".
 */

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

type Row = Record<string, unknown>;

async function read(path: string): Promise<Row[]> {
  try {
    const response = await fetch(`${url()}/rest/v1/${path}`, { headers: admin() });
    if (!response.ok) return [];
    return (await response.json()) as Row[];
  } catch {
    return [];
  }
}

const PERIODS: Record<string, number | null> = {
  today: 1, "7d": 7, "30d": 30, "90d": 90, all: null,
};

/** Signals in, score out, and the inputs kept so the number can be argued with. */
function trending(v: { views: number; demo: number; leads: number; orders: number; shares: number }) {
  const score =
    v.views * 1 + v.demo * 4 + v.leads * 8 + v.orders * 20 + v.shares * 2;
  return {
    score,
    version: "v1",
    weights: { view: 1, demo_click: 4, lead: 8, paid_order: 20, share_or_scan: 2 },
    inputs: v,
    note: "A plain weighted sum of real signals in the selected window. No decay is applied yet because the events do not yet span enough time for decay to mean anything.",
  };
}

export const Route = createFileRoute("/api/analytics/products")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        if (!url()) return Response.json({ error: "Not configured" }, { status: 503 });

        const params = new URL(request.url).searchParams;
        const periodKey = params.get("period") ?? "30d";
        const days = PERIODS[periodKey] ?? null;
        const since = days
          ? new Date(Date.now() - days * 86400000).toISOString()
          : null;
        const window = since ? `&created_at=gte.${since}` : "";

        const [events, paidOrders, leads, shortClicks, qrScans] = await Promise.all([
          read(`marketplace_events?select=event_type,product_id,metadata,session_id,created_at&limit=20000${window}`),
          read(`marketplace_orders?select=id,total,currency,created_at&status=eq.paid&limit=5000${window}`),
          read(`leads?select=id,product_id,status,created_at&product_id=not.is.null&limit=5000${window}`),
          read(`product_short_link_events?select=product_id,created_at&limit=20000${window}`),
          read(`product_qr_events?select=product_id,created_at&limit=20000${window}`),
        ]);

        // Revenue is attributed through the order's line items, which is the
        // only place a paid order says which product it was for.
        const paidIds = paidOrders.map((o) => String(o.id));
        const items = paidIds.length
          ? await read(
              `marketplace_order_items?select=order_id,product_id,line_total,currency,product_name` +
                `&order_id=in.(${paidIds.join(",")})&limit=10000`,
            )
          : [];

        type Acc = {
          views: number; demo: number; cta: number; leads: number;
          qualified: number; orders: Set<string>; revenue: number;
          currencies: Set<string>; shares: number;
        };
        const per = new Map<string, Acc>();
        const acc = (id: string) => {
          let a = per.get(id);
          if (!a) {
            a = { views: 0, demo: 0, cta: 0, leads: 0, qualified: 0, orders: new Set(), revenue: 0, currencies: new Set(), shares: 0 };
            per.set(id, a);
          }
          return a;
        };

        let viewsWithoutProduct = 0;
        for (const e of events) {
          const id = e.product_id ? String(e.product_id) : null;
          if (!id) { if (e.event_type === "product_view") viewsWithoutProduct++; continue; }
          const a = acc(id);
          if (e.event_type === "product_view") a.views++;
          else if (e.event_type === "demo_click") a.demo++;
          else if (e.event_type === "cta_click") a.cta++;
        }
        for (const l of leads) {
          const a = acc(String(l.product_id));
          a.leads++;
          if (["interested", "negotiation", "qualified", "won", "converted"].includes(String(l.status ?? ""))) {
            a.qualified++;
          }
        }
        for (const i of items) {
          if (!i.product_id) continue;
          const a = acc(String(i.product_id));
          a.orders.add(String(i.order_id));
          a.revenue += Number(i.line_total ?? 0);
          a.currencies.add(String(i.currency ?? "USD"));
        }
        for (const s of [...shortClicks, ...qrScans]) {
          if (s.product_id) acc(String(s.product_id)).shares++;
        }

        const ids = [...per.keys()];
        const products = ids.length
          ? await read(`marketplace_products?select=id,name,slug&id=in.(${ids.join(",")})&limit=1000`)
          : [];
        const nameOf = new Map(products.map((p) => [String(p.id), String(p.name ?? "")]));

        const rows = ids.map((id) => {
          const a = per.get(id)!;
          const orders = a.orders.size;
          return {
            product_id: id,
            name: nameOf.get(id) ?? "(product not found)",
            views: a.views,
            demo_clicks: a.demo,
            cta_clicks: a.cta,
            leads: a.leads,
            qualified_leads: a.qualified,
            orders,
            revenue: Math.round(a.revenue * 100) / 100,
            currencies: [...a.currencies],
            shares_and_scans: a.shares,
            // Stated, not implied: this is paid orders divided by product views.
            conversion_rate: a.views > 0 ? Math.round((orders / a.views) * 1000) / 10 : null,
            conversion_basis: "paid orders / product views",
            ctr: a.views > 0 ? Math.round(((a.demo + a.cta) / a.views) * 1000) / 10 : null,
            ctr_basis: "(demo clicks + CTA clicks) / product views",
            trending: trending({ views: a.views, demo: a.demo, leads: a.leads, orders, shares: a.shares }),
          };
        }).sort((x, y) => y.trending.score - x.trending.score);

        const totalRevenue = items.reduce((t, i) => t + Number(i.line_total ?? 0), 0);
        const currencies = [...new Set(paidOrders.map((o) => String(o.currency ?? "USD")))];

        return Response.json({
          ok: true,
          period: periodKey,
          since,
          totals: {
            events: events.length,
            views: events.filter((e) => e.event_type === "product_view").length,
            demo_clicks: events.filter((e) => e.event_type === "demo_click").length,
            cta_clicks: events.filter((e) => e.event_type === "cta_click").length,
            paid_orders: paidOrders.length,
            revenue: Math.round(totalRevenue * 100) / 100,
            currencies,
            leads_with_product: leads.length,
            short_link_clicks: shortClicks.length,
            qr_scans: qrScans.length,
            views_without_a_product: viewsWithoutProduct,
          },
          products: rows,
          // Said plainly rather than shown as 0.
          unavailable: {
            bounce_rate: "Not captured. marketplace_events carries no session start or end, so a single-engagement session cannot be identified.",
            session_duration: "Not captured, for the same reason.",
            countries: "Not captured. The metadata column is empty on the existing events, so no country was ever recorded.",
            devices: "Not captured, for the same reason.",
            search_ranking: "Not captured. Search result positions and result clicks are not written to marketplace_events.",
            wishlist: "Favourites are held in the browser by the storefront, so no wishlist event reaches the database.",
          },
          reconciliation: {
            orders_paid: paidOrders.length,
            revenue_from_line_items: Math.round(totalRevenue * 100) / 100,
            revenue_from_order_totals:
              Math.round(paidOrders.reduce((t, o) => t + Number(o.total ?? 0), 0) * 100) / 100,
            // Section 45. A mismatch is surfaced, never smoothed over.
            matches:
              Math.abs(
                paidOrders.reduce((t, o) => t + Number(o.total ?? 0), 0) - totalRevenue,
              ) < 0.01,
          },
        });
      },
    },
  },
});
