import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, DownloadCloud, Eye, Loader2, Play, TrendingUp } from "lucide-react";

import { authHeaders } from "@/lib/auth/operator-fetch";
import { Card, LoadFailure, PageHeader, PillButton, StatCard, SubNav } from "../ui";

/**
 * Per-Product Analytics — the screen that already existed, now counting.
 *
 * It showed 128k views, 14.2k demo clicks, 3.1% conversion, 27% bounce and
 * revenue of Rs 42L, above a table led by a written-in product called Vala ERP
 * Pro with 48.2k views and a trending score of 92. Section 51 names those exact
 * numbers as the thing to remove.
 *
 * Everything here is counted from marketplace_events, marketplace_orders and
 * their line items, leads, short-link clicks and QR scans, for the period
 * chosen. Revenue comes from paid orders, never from a Buy click.
 *
 * The metrics that have no events behind them - bounce, session duration,
 * country, device, search ranking, wishlist - are listed with the reason they
 * are empty rather than shown as zero, because a zero bounce rate reads as
 * "nobody bounced" and that is not what the data says.
 */

type Product = {
  product_id: string; name: string; views: number; demo_clicks: number;
  cta_clicks: number; leads: number; qualified_leads: number; orders: number;
  revenue: number; currencies: string[]; shares_and_scans: number;
  conversion_rate: number | null; conversion_basis: string;
  ctr: number | null; ctr_basis: string;
  trending: { score: number; version: string; weights: Record<string, number>; note: string };
};

type Data = {
  ok: boolean; period: string; since: string | null;
  totals: {
    events: number; views: number; demo_clicks: number; cta_clicks: number;
    paid_orders: number; revenue: number; currencies: string[];
    leads_with_product: number; short_link_clicks: number; qr_scans: number;
    views_without_a_product: number;
  };
  products: Product[];
  unavailable: Record<string, string>;
  reconciliation: {
    orders_paid: number; revenue_from_line_items: number;
    revenue_from_order_totals: number; matches: boolean;
  };
};

const PERIODS = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "90d", label: "90 Days" },
  { key: "all", label: "All time" },
];

const n = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : new Intl.NumberFormat().format(v);

export function ProductAnalytics() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [period, setPeriod] = useState("30 Days");

  const load = useCallback(async (label: string) => {
    setError(null);
    const key = PERIODS.find((p) => p.label === label)?.key ?? "30d";
    try {
      const response = await fetch(`/api/analytics/products?period=${key}`, {
        headers: await authHeaders(),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(new Error(payload?.error ?? (response.status === 401 || response.status === 403
          ? "Sign in as an operator to open product analytics."
          : "Could not read the analytics.")));
        return;
      }
      setData(payload as Data);
    } catch {
      setError(new Error("Could not reach the server."));
    }
  }, []);

  useEffect(() => { void load(period); }, [load, period]);

  const exportCsv = () => {
    if (!data) return;
    const head = ["product", "views", "demo_clicks", "cta_clicks", "leads", "qualified_leads",
      "orders", "revenue", "conversion_rate", "ctr", "trending_score"];
    const body = data.products.map((p) =>
      [p.name, p.views, p.demo_clicks, p.cta_clicks, p.leads, p.qualified_leads, p.orders,
       p.revenue, p.conversion_rate ?? "", p.ctr ?? "", p.trending.score]
        .map((v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v)))
        .join(","),
    );
    const meta = `# period=${data.period} since=${data.since ?? "all time"} generated=${new Date().toISOString()}`;
    const blob = new Blob([[meta, head.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `product-analytics-${data.period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const t = data?.totals;

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Governance · Analytics"
        title="Per-Product Analytics"
        description="Views, demo clicks, leads, orders and revenue for every marketplace product, counted from the events and orders themselves."
        actions={
          <>
            <PillButton variant="ghost" onClick={() => window.dispatchEvent(new CustomEvent("sv:open-vala-ai"))}>
              Vala AI
            </PillButton>
            <PillButton variant="ghost" onClick={exportCsv}>
              <span className="inline-flex items-center gap-1.5"><DownloadCloud className="h-3.5 w-3.5" /> Export CSV</span>
            </PillButton>
          </>
        }
      />

      {error ? <LoadFailure error={error} what="product analytics" onRetry={() => void load(period)} /> : null}

      <SubNav items={PERIODS.map((p) => p.label)} active={period} onChange={setPeriod} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Views" value={n(t?.views)} tone="premium" icon={<Eye className="h-3.5 w-3.5" />} />
        <StatCard label="Demo clicks" value={n(t?.demo_clicks)} icon={<Play className="h-3.5 w-3.5" />} />
        <StatCard label="Paid orders" value={n(t?.paid_orders)} tone="success" icon={<TrendingUp className="h-3.5 w-3.5" />} />
        <StatCard label="Leads with a product" value={n(t?.leads_with_product)} />
        <StatCard
          label="Revenue"
          value={t ? `${t.currencies[0] ?? "USD"} ${n(t.revenue)}` : "—"}
          tone="premium"
        />
      </div>

      {!data ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Counting the events…
        </div>
      ) : (
        <>
          {!data.reconciliation.matches && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Revenue from order line items ({n(data.reconciliation.revenue_from_line_items)}) does not match the
                sum of paid order totals ({n(data.reconciliation.revenue_from_order_totals)}). Reported, not smoothed
                over — the orders are the source of truth.
              </span>
            </div>
          )}

          <Card className="p-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-bold">Products with activity</span>
              <span className="text-[11px] text-muted-foreground">
                {data.products.length} product(s) · {n(t?.events)} events in this window
              </span>
            </div>
            {data.products.length === 0 ? (
              <div className="px-4 py-10 text-center text-[12px] text-muted-foreground">
                No product event, lead or paid order falls in this period.
              </div>
            ) : (
              <div className="-mx-1 overflow-x-auto px-1">
                <table className="w-full min-w-[820px] border-collapse text-[12px]">
                  <thead>
                    <tr>
                      {["Product", "Views", "Demo", "CTA", "Leads", "Qualified", "Orders", "Revenue", "Conv %", "CTR %", "Trending"].map((h) => (
                        <th key={h} className="whitespace-nowrap border-b border-border px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.products.map((p) => (
                      <tr key={p.product_id} className="border-b border-border/60 last:border-0 hover:bg-white/[0.02]">
                        <td className="max-w-[220px] truncate px-2 py-1.5 font-medium">{p.name}</td>
                        <td className="px-2 py-1.5">{n(p.views)}</td>
                        <td className="px-2 py-1.5">{n(p.demo_clicks)}</td>
                        <td className="px-2 py-1.5">{n(p.cta_clicks)}</td>
                        <td className="px-2 py-1.5">{n(p.leads)}</td>
                        <td className="px-2 py-1.5">{n(p.qualified_leads)}</td>
                        <td className="px-2 py-1.5">{n(p.orders)}</td>
                        <td className="px-2 py-1.5">{p.revenue ? `${p.currencies[0] ?? "USD"} ${n(p.revenue)}` : "—"}</td>
                        <td className="px-2 py-1.5" title={p.conversion_basis}>
                          {p.conversion_rate === null ? "—" : `${p.conversion_rate}%`}
                        </td>
                        <td className="px-2 py-1.5" title={p.ctr_basis}>
                          {p.ctr === null ? "—" : `${p.ctr}%`}
                        </td>
                        <td className="px-2 py-1.5 font-semibold" title={p.trending.note}>{n(p.trending.score)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <div className="mb-2 text-sm font-bold">How each rate is calculated</div>
              <div className="space-y-1 text-[11px] text-muted-foreground">
                <div>Conversion — paid orders divided by product views, per product.</div>
                <div>CTR — demo clicks plus CTA clicks, divided by product views.</div>
                <div>
                  Trending — a weighted sum: view 1, demo click 4, lead 8, paid order 20, share or scan 2.
                  No time decay yet, because the events do not span enough time for decay to mean anything.
                </div>
                <div className="pt-1">
                  Revenue is taken from paid orders and their line items. A Buy click is intent, not a sale.
                </div>
                {t && t.views_without_a_product > 0 && (
                  <div className="pt-1 text-amber-600">
                    {n(t.views_without_a_product)} product view(s) in this window carry no product id and are
                    excluded from every per-product row.
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <div className="mb-2 text-sm font-bold">Not captured yet</div>
              <div className="space-y-1.5">
                {Object.entries(data.unavailable).map(([key, why]) => (
                  <div key={key} className="rounded-lg border border-border/60 px-3 py-1.5">
                    <div className="text-[11px] font-semibold capitalize">{key.replace(/_/g, " ")}</div>
                    <div className="text-[10px] text-muted-foreground">{why}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
