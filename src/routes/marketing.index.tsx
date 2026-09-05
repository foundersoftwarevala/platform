import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { IndianRupee, MousePointerClick, Target, TrendingUp, Users, Zap } from "lucide-react";

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
import { compactInr, compactNum, ctr, dateTime, pct, roas, shortDate, toNum } from "@/lib/marketing/format";

export const Route = createFileRoute("/marketing/")({
  head: () => ({
    meta: [
      { title: "Marketing Overview — Software Vala Marketing Manager" },
      {
        name: "description",
        content:
          "Live marketing command centre for Software Vala: spend, leads, conversions, ROAS and channel performance in one view.",
      },
      { property: "og:title", content: "Marketing Overview — Software Vala" },
      {
        property: "og:description",
        content: "Live spend, leads, conversions and ROAS across every Software Vala campaign.",
      },
    ],
  }),
  component: MarketingOverview,
});

function MarketingOverview() {
  const snapshots = useQuery(tableQuery("marketing_kpi_snapshots", { column: "metric_date", ascending: true }));
  const campaigns = useQuery(tableQuery("marketing_campaigns", { column: "spend" }));
  const channels = useQuery(tableQuery("marketing_channel_performance", { column: "spend" }));
  const alerts = useQuery(tableQuery("marketing_alerts", { column: "created_at" }));

  const rows = snapshots.data ?? [];
  const totals = rows.reduce(
    (acc, r) => ({
      spend: acc.spend + toNum(r.spend),
      leads: acc.leads + toNum(r.leads),
      conversions: acc.conversions + toNum(r.conversions),
      revenue: acc.revenue + toNum(r.revenue),
      clicks: acc.clicks + toNum(r.clicks),
      impressions: acc.impressions + toNum(r.impressions),
    }),
    { spend: 0, leads: 0, conversions: 0, revenue: 0, clicks: 0, impressions: 0 },
  );

  const half = Math.floor(rows.length / 2) || 1;
  const firstHalf = rows.slice(0, half);
  const secondHalf = rows.slice(half);
  const delta = (pick: (r: (typeof rows)[number]) => number) => {
    const a = firstHalf.reduce((s, r) => s + pick(r), 0) / (firstHalf.length || 1);
    const b = secondHalf.reduce((s, r) => s + pick(r), 0) / (secondHalf.length || 1);
    return a > 0 ? ((b - a) / a) * 100 : 0;
  };

  const trend = rows.map((r) => ({
    date: new Date(r.metric_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    spend: toNum(r.spend),
    revenue: toNum(r.revenue),
    leads: toNum(r.leads),
  }));

  const channelMix = (channels.data ?? []).map((c) => ({
    name: c.channel,
    value: toNum(c.spend),
    revenue: toNum(c.revenue),
    roas: toNum(c.roas),
  }));

  const topCampaigns = (campaigns.data ?? []).slice(0, 6);
  const openAlerts = (alerts.data ?? []).filter((a) => a.status === "open").slice(0, 5);

  return (
    <div className="space-y-6">
      <ScreenHeader
        title="Marketing Overview"
        description="Rolling 30-day performance across every channel, campaign and region."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard
          index={0}
          label="Spend"
          value={compactInr(totals.spend)}
          sublabel="Last 30 days"
          delta={delta((r) => toNum(r.spend))}
          icon={IndianRupee}
          tone="violet"
        />
        <StatCard
          index={1}
          label="Revenue"
          value={compactInr(totals.revenue)}
          sublabel="Attributed"
          delta={delta((r) => toNum(r.revenue))}
          icon={TrendingUp}
          tone="green"
        />
        <StatCard
          index={2}
          label="ROAS"
          value={`${roas(totals.revenue, totals.spend).toFixed(2)}x`}
          sublabel="Blended"
          icon={Zap}
          tone="gold"
        />
        <StatCard
          index={3}
          label="Leads"
          value={compactNum(totals.leads)}
          sublabel="All sources"
          delta={delta((r) => r.leads)}
          icon={Users}
          tone="blue"
        />
        <StatCard
          index={4}
          label="Conversions"
          value={compactNum(totals.conversions)}
          sublabel="Closed won + demos"
          delta={delta((r) => r.conversions)}
          icon={Target}
          tone="teal"
        />
        <StatCard
          index={5}
          label="CTR"
          value={pct(ctr(totals.clicks, totals.impressions), 2)}
          sublabel={`${compactNum(totals.clicks)} clicks`}
          icon={MousePointerClick}
          tone="rose"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2"
          title="Spend vs revenue"
          description="Daily pacing over the last 30 days"
        >
          <QueryState
            isLoading={snapshots.isLoading}
            error={snapshots.error}
            data={trend}
            emptyMessage="No performance snapshots recorded yet."
          >
            {(data) => (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS[3]} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={CHART_COLORS[3]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" {...chartAxisProps} />
                  <YAxis {...chartAxisProps} tickFormatter={(v: number) => compactInr(v)} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(v: number) => compactInr(v)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area
                    type="monotone"
                    dataKey="spend"
                    name="Spend"
                    stroke={CHART_COLORS[0]}
                    fill="url(#spendFill)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke={CHART_COLORS[3]}
                    fill="url(#revenueFill)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </QueryState>
        </SectionCard>

        <SectionCard title="Channel spend mix" description="Current month by channel">
          <QueryState
            isLoading={channels.isLoading}
            error={channels.error}
            data={channelMix}
            emptyMessage="No channel performance recorded yet."
          >
            {(data) => (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={3}>
                    {data.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => compactInr(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </QueryState>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard className="xl:col-span-2" title="Top campaigns by spend">
          <QueryState
            isLoading={campaigns.isLoading}
            error={campaigns.error}
            data={topCampaigns}
            emptyMessage="No campaigns yet."
          >
            {(data) => (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Spend</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                      <TableHead className="text-right">ROAS</TableHead>
                      <TableHead>Ends</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-muted-foreground">{c.channel}</TableCell>
                        <TableCell>
                          <StatusBadge value={c.status} />
                        </TableCell>
                        <TableCell className="text-right">{compactInr(toNum(c.spend))}</TableCell>
                        <TableCell className="text-right">{compactNum(toNum(c.leads))}</TableCell>
                        <TableCell className="text-right font-medium text-status-success">
                          {roas(toNum(c.revenue), toNum(c.spend)).toFixed(1)}x
                        </TableCell>
                        <TableCell className="text-muted-foreground">{shortDate(c.end_date)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </QueryState>
        </SectionCard>

        <SectionCard title="Open alerts" description="Needs attention today">
          <QueryState
            isLoading={alerts.isLoading}
            error={alerts.error}
            data={openAlerts}
            emptyMessage="No open alerts. Everything is pacing well."
          >
            {(data) => (
              <ul className="space-y-3">
                {data.map((a) => (
                  <li key={a.id} className="rounded-lg border border-border/50 bg-secondary/40 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{a.title}</p>
                      <StatusBadge value={a.severity} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{a.message}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground">{dateTime(a.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </QueryState>
        </SectionCard>
      </div>

      <SectionCard title="Channel efficiency" description="Spend, revenue and return by channel">
        <QueryState
          isLoading={channels.isLoading}
          error={channels.error}
          data={channelMix}
          emptyMessage="No channel data yet."
        >
          {(data) => (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" {...chartAxisProps} />
                <YAxis {...chartAxisProps} tickFormatter={(v: number) => compactInr(v)} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => compactInr(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="value" name="Spend" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} />
                <Bar dataKey="revenue" name="Revenue" fill={CHART_COLORS[3]} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </QueryState>
      </SectionCard>
    </div>
  );
}
