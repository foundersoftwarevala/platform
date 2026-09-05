import { createFileRoute } from "@tanstack/react-router";
import { Gauge, MousePointerClick, TrendingUp } from "lucide-react";
import { EntityWall, Row, Cell, fmtMoney, fmtDate } from "@/components/affiliate/EntityWall";

type Snap = { id: string; affiliate_id: string; period: string; clicks: number; conversions: number; sales: number; revenue_cents: number; commission_cents: number };

export const Route = createFileRoute("/affiliate-manager/performance")({
  head: () => ({ meta: [{ title: "Performance — Affiliate Manager" }] }),
  component: () => (
    <EntityWall<Snap>
      title="Performance"
      description="Clicks, visitors, conversions, revenue, ROI, CTR and leaderboard by affiliate."
      crumbLabel="Performance"
      table="performance_snapshots"
      searchColumns={[]}
      searchPlaceholder="Search performance…"
      filters={["Period", "Affiliate", "Country", "Tier"]}
      tabs={["Today", "7 days", "30 days", "Quarter", "All-time"]}
      order={{ column: "period", ascending: false }}
      kpis={[
        { label: "Snapshots", icon: <Gauge className="size-4" />, tone: "primary" },
        { label: "Clicks", icon: <MousePointerClick className="size-4" /> },
        { label: "Conversions", icon: <TrendingUp className="size-4" />, tone: "success" },
      ]}
      columns={[
        { key: "period", label: "Period" },
        { key: "aff", label: "Affiliate" },
        { key: "clk", label: "Clicks", align: "right" },
        { key: "conv", label: "Conv.", align: "right" },
        { key: "rev", label: "Revenue", align: "right" },
        { key: "comm", label: "Commission", align: "right" },
      ]}
      renderRow={(s) => (
        <Row id={s.id}>
          <Cell>{fmtDate(s.period)}</Cell>
          <Cell className="font-mono text-[11px] text-muted-foreground">{s.affiliate_id?.slice(0, 8) ?? "—"}</Cell>
          <Cell align="right" className="tabular-nums">{s.clicks.toLocaleString()}</Cell>
          <Cell align="right" className="tabular-nums">{s.conversions.toLocaleString()}</Cell>
          <Cell align="right" className="tabular-nums">{fmtMoney(s.revenue_cents)}</Cell>
          <Cell align="right" className="tabular-nums">{fmtMoney(s.commission_cents)}</Cell>
        </Row>
      )}
      emptyIcon={Gauge}
      emptyTitle="No performance data"
      emptyDescription="Daily snapshots per affiliate appear here once clicks, conversions and sales are recorded."
    />
  ),
});
