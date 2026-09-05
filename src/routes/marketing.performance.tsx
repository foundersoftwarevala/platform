import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Download, IndianRupee, MousePointerClick, Wallet } from "lucide-react";
import { toast } from "sonner";

import {
  ProgressBar,
  QueryState,
  ScreenHeader,
  SectionCard,
  StatCard,
  StatusBadge,
  chartAxisProps,
  chartTooltipStyle,
} from "@/components/marketing/kit";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { recordAudit, tableQuery } from "@/lib/marketing/api";
import { buildCsv, csvFilename, downloadCsv } from "@/lib/marketing/csv";
import { compactInr, compactNum, ctr, num, pct, roas, shortDate } from "@/lib/marketing/format";

export const Route = createFileRoute("/marketing/performance")({
  head: () => ({
    meta: [
      { title: "Performance — Software Vala Marketing Manager" },
      {
        name: "description",
        content:
          "Daily marketing performance: spend, clicks, conversions and ROAS by channel with live budget pacing.",
      },
      { property: "og:title", content: "Performance — Software Vala" },
      {
        property: "og:description",
        content: "Channel performance and budget pacing from live marketing data.",
      },
    ],
  }),
  component: PerformanceScreen,
});

function PerformanceScreen() {
  const snapshots = useQuery(
    tableQuery("marketing_kpi_snapshots", { column: "metric_date", ascending: true }),
  );
  const channels = useQuery(tableQuery("marketing_channel_performance", { column: "spend" }));
  const budgets = useQuery(tableQuery("marketing_budgets", { column: "allocated" }));

  const snaps = snapshots.data ?? [];
  const totals = snaps.reduce(
    (acc, s) => ({
      spend: acc.spend + Number(s.spend ?? 0),
      clicks: acc.clicks + Number(s.clicks ?? 0),
      impressions: acc.impressions + Number(s.impressions ?? 0),
      conversions: acc.conversions + Number(s.conversions ?? 0),
      revenue: acc.revenue + Number(s.revenue ?? 0),
    }),
    { spend: 0, clicks: 0, impressions: 0, conversions: 0, revenue: 0 },
  );

  const trend = snaps.map((s) => ({
    date: shortDate(s.metric_date).slice(0, 6),
    clicks: Number(s.clicks ?? 0),
    conversions: Number(s.conversions ?? 0),
    roas: Number(s.roas ?? 0),
  }));

  const channelBars = (channels.data ?? []).map((c) => ({
    channel: c.channel,
    spend: Number(c.spend ?? 0),
    revenue: Number(c.revenue ?? 0),
  }));

  const exportRows = async (
    label: string,
    slug: string,
    entity: string,
    data: Array<Record<string, unknown>>,
  ) => {
    const csv = buildCsv(data);
    if (!csv) {
      toast.error(`No ${label} rows to export.`);
      return;
    }
    await recordAudit({
      actor: "Marketing Manager",
      action: "export",
      entity_type: entity,
      entity_name: `${data.length} rows`,
      module: "performance",
      details: `Exported ${data.length} ${label} rows to CSV`,
    });
    downloadCsv(csvFilename(slug), csv);
    toast.success(`Exported ${data.length} ${label} rows.`);
  };

  return (
    <div className="space-y-6">
      <ScreenHeader
        title="Performance"
        description="Daily delivery, channel efficiency and budget pacing across the marketing portfolio."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={snaps.length === 0}
              onClick={() =>
                void exportRows("KPI snapshot", "marketing-kpi-snapshots", "KPI snapshot", snaps)
              }
            >
              <Download className="mr-2 h-4 w-4" /> Export KPI snapshots
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={(channels.data ?? []).length === 0}
              onClick={() =>
                void exportRows(
                  "channel performance",
                  "marketing-channel-performance",
                  "Channel performance",
                  channels.data ?? [],
                )
              }
            >
              <Download className="mr-2 h-4 w-4" /> Export channels
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Spend" value={compactInr(totals.spend)} icon={IndianRupee} tone="violet" index={0} />
        <StatCard
          label="Clicks"
          value={compactNum(totals.clicks)}
          sublabel={`CTR ${pct(ctr(totals.clicks, totals.impressions), 2)}`}
          icon={MousePointerClick}
          tone="blue"
          index={1}
        />
        <StatCard
          label="Conversions"
          value={compactNum(totals.conversions)}
          icon={Activity}
          tone="teal"
          index={2}
        />
        <StatCard
          label="ROAS"
          value={`${roas(totals.revenue, totals.spend).toFixed(2)}x`}
          sublabel={`${compactInr(totals.revenue)} revenue`}
          icon={Wallet}
          tone="gold"
          index={3}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Daily clicks & conversions" description="Last 30 days of delivery">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" {...chartAxisProps} />
                <YAxis {...chartAxisProps} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Line type="monotone" dataKey="clicks" stroke="hsl(var(--aurora-blue))" dot={false} />
                <Line
                  type="monotone"
                  dataKey="conversions"
                  stroke="hsl(var(--aurora-green))"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Channel spend vs revenue" description="Current reporting period">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelBars}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="channel" {...chartAxisProps} />
                <YAxis {...chartAxisProps} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="spend" fill="hsl(var(--aurora-violet))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="revenue" fill="hsl(var(--aurora-teal))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Channel performance" description="Efficiency by channel">
        <QueryState
          isLoading={channels.isLoading}
          error={channels.error}
          data={channels.data}
          emptyMessage="No channel performance rows yet."
        >
          {(list) => (
            <div className="overflow-x-auto">
              <Table style={{ minWidth: 960 }}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Channel</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Spend</TableHead>
                    <TableHead className="text-right">Impressions</TableHead>
                    <TableHead className="text-right">Clicks</TableHead>
                    <TableHead className="text-right">CTR</TableHead>
                    <TableHead className="text-right">Conversions</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">ROAS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.channel}</TableCell>
                      <TableCell>
                        {shortDate(c.period_start)} → {shortDate(c.period_end)}
                      </TableCell>
                      <TableCell className="text-right">{compactInr(c.spend)}</TableCell>
                      <TableCell className="text-right">{compactNum(c.impressions)}</TableCell>
                      <TableCell className="text-right">{compactNum(c.clicks)}</TableCell>
                      <TableCell className="text-right">
                        {pct(ctr(Number(c.clicks ?? 0), Number(c.impressions ?? 0)), 2)}
                      </TableCell>
                      <TableCell className="text-right">{num(c.conversions)}</TableCell>
                      <TableCell className="text-right">{compactInr(c.revenue)}</TableCell>
                      <TableCell className="text-right">{Number(c.roas ?? 0).toFixed(2)}x</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </QueryState>
      </SectionCard>

      <SectionCard title="Budget pacing" description="Allocated vs spent and committed">
        <QueryState
          isLoading={budgets.isLoading}
          error={budgets.error}
          data={budgets.data}
          emptyMessage="No budgets configured yet."
        >
          {(list) => (
            <div className="space-y-4">
              {list.map((b) => (
                <div key={b.id} className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      {b.name}
                      <StatusBadge value={b.status} />
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {b.channel} · {b.period} · {compactInr(b.spent)} spent + {compactInr(b.committed)}{" "}
                      committed of {compactInr(b.allocated)}
                      {b.owner ? ` · ${b.owner}` : ""}
                    </span>
                  </div>
                  <ProgressBar
                    value={Number(b.spent ?? 0)}
                    max={Number(b.allocated ?? 0)}
                    tone={
                      Number(b.spent ?? 0) > Number(b.allocated ?? 0)
                        ? "rose"
                        : Number(b.spent ?? 0) / Math.max(1, Number(b.allocated ?? 0)) > 0.8
                          ? "gold"
                          : "green"
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </QueryState>
      </SectionCard>
    </div>
  );
}
