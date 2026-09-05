import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { IndianRupee, MapPinned, TrendingUp, Users } from "lucide-react";

import {
  CHART_COLORS,
  QueryState,
  ScreenHeader,
  SectionCard,
  StatCard,
  StatusBadge,
  chartAxisProps,
  chartTooltipStyle,
} from "@/components/marketing/kit";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { tableQuery } from "@/lib/marketing/api";
import { compactInr, compactNum, num, pct, roas } from "@/lib/marketing/format";

export const Route = createFileRoute("/marketing/analytics")({
  head: () => ({
    meta: [
      { title: "ROI Analytics — Software Vala Marketing Manager" },
      {
        name: "description",
        content:
          "Return on ad spend by campaign and region, with revenue attribution and growth trends across India.",
      },
      { property: "og:title", content: "ROI Analytics — Software Vala" },
      {
        property: "og:description",
        content: "Campaign and regional ROI with live revenue attribution.",
      },
    ],
  }),
  component: AnalyticsScreen,
});

function AnalyticsScreen() {
  const campaigns = useQuery(tableQuery("marketing_campaigns", { column: "revenue" }));
  const regions = useQuery(tableQuery("marketing_regions", { column: "revenue" }));

  const camps = campaigns.data ?? [];
  const totalSpend = camps.reduce((s, c) => s + Number(c.spend ?? 0), 0);
  const totalRevenue = camps.reduce((s, c) => s + Number(c.revenue ?? 0), 0);
  const totalLeads = camps.reduce((s, c) => s + Number(c.leads ?? 0), 0);

  const topRoi = [...camps]
    .map((c) => ({
      name: c.name.length > 18 ? `${c.name.slice(0, 18)}…` : c.name,
      roas: roas(Number(c.revenue ?? 0), Number(c.spend ?? 0)),
    }))
    .sort((a, b) => b.roas - a.roas)
    .slice(0, 8);

  const regionPie = (regions.data ?? []).map((r) => ({
    name: r.name,
    value: Number(r.revenue ?? 0),
  }));

  return (
    <div className="space-y-6">
      <ScreenHeader
        title="ROI Analytics"
        description="Where the money comes back: campaign ROAS, regional revenue and growth."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total spend" value={compactInr(totalSpend)} icon={IndianRupee} tone="violet" index={0} />
        <StatCard label="Attributed revenue" value={compactInr(totalRevenue)} icon={TrendingUp} tone="green" index={1} />
        <StatCard
          label="Blended ROAS"
          value={`${roas(totalRevenue, totalSpend).toFixed(2)}x`}
          icon={TrendingUp}
          tone="gold"
          index={2}
        />
        <StatCard
          label="Leads"
          value={compactNum(totalLeads)}
          sublabel={totalLeads ? `${compactInr(totalSpend / totalLeads)} per lead` : ""}
          icon={Users}
          tone="blue"
          index={3}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Top campaigns by ROAS" description="Revenue returned per rupee spent">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topRoi}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" {...chartAxisProps} interval={0} angle={-20} height={60} textAnchor="end" />
                <YAxis {...chartAxisProps} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="roas" fill="hsl(var(--aurora-violet))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Revenue by region" description="Attributed revenue split">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={regionPie} dataKey="value" nameKey="name" outerRadius={100} label>
                  {regionPie.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={chartTooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Regional performance" description="Spend, leads, conversions and growth by region">
        <QueryState
          isLoading={regions.isLoading}
          error={regions.error}
          data={regions.data}
          emptyMessage="No regional data yet."
        >
          {(list) => (
            <div className="overflow-x-auto">
              <Table style={{ minWidth: 900 }}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Region</TableHead>
                    <TableHead>Country / state</TableHead>
                    <TableHead className="text-right">Spend</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Conversions</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">ROAS</TableHead>
                    <TableHead className="text-right">Growth</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{[r.state, r.country].filter(Boolean).join(", ")}</TableCell>
                      <TableCell className="text-right">{compactInr(r.spend)}</TableCell>
                      <TableCell className="text-right">{num(r.leads)}</TableCell>
                      <TableCell className="text-right">{num(r.conversions)}</TableCell>
                      <TableCell className="text-right">{compactInr(r.revenue)}</TableCell>
                      <TableCell className="text-right">
                        {roas(Number(r.revenue ?? 0), Number(r.spend ?? 0)).toFixed(2)}x
                      </TableCell>
                      <TableCell
                        className={`text-right ${Number(r.growth_rate ?? 0) >= 0 ? "text-status-success" : "text-status-error"}`}
                      >
                        {pct(r.growth_rate)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge value={r.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </QueryState>
      </SectionCard>

      <SectionCard title="Campaign ROI detail" description="Every campaign ranked by attributed revenue">
        <QueryState
          isLoading={campaigns.isLoading}
          error={campaigns.error}
          data={camps}
          emptyMessage="No campaigns yet."
        >
          {(list) => (
            <div className="overflow-x-auto">
              <Table style={{ minWidth: 960 }}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead className="text-right">Spend</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">ROAS</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Cost / lead</TableHead>
                    <TableHead><MapPinned className="h-4 w-4" /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.channel}</TableCell>
                      <TableCell className="text-right">{compactInr(c.spend)}</TableCell>
                      <TableCell className="text-right">{compactInr(c.revenue)}</TableCell>
                      <TableCell className="text-right">
                        {roas(Number(c.revenue ?? 0), Number(c.spend ?? 0)).toFixed(2)}x
                      </TableCell>
                      <TableCell className="text-right">{num(c.leads)}</TableCell>
                      <TableCell className="text-right">
                        {Number(c.leads ?? 0) > 0
                          ? compactInr(Number(c.spend ?? 0) / Number(c.leads))
                          : "—"}
                      </TableCell>
                      <TableCell>{c.region ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </QueryState>
      </SectionCard>
    </div>
  );
}
