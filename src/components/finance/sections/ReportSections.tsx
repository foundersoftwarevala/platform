import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Download,
  Receipt,
  FileSpreadsheet,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

import { dailyMetricsQuery, transactionsQuery, expensesQuery, invoicesQuery } from "@/lib/finance/queries";
import type { FinanceView } from "@/lib/finance/views";
import type { DailyMetric } from "@/lib/finance/types";
import { PanelCard, QueryState, SectionShell, StatCard, StatGrid } from "@/components/finance/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadCsv, formatCompact, formatCurrency, formatPercent, percentChange } from "@/lib/finance/format";

const VIEW_META: Record<string, { title: string; description: string; bucket: "day" | "month" | "year" }> = {
  report_daily: { title: "Daily Finance Report", description: "Revenue, expenses and profit trend by day", bucket: "day" },
  report_monthly: { title: "Monthly Report", description: "Revenue, expenses and profit trend by month", bucket: "month" },
  report_yearly: { title: "Yearly Report", description: "Revenue, expenses and profit trend by year", bucket: "year" },
  report_export: { title: "Export Reports", description: "Download finance datasets for a chosen date range", bucket: "month" },
};

function bucketKey(dateStr: string, bucket: "day" | "month" | "year") {
  const d = new Date(dateStr);
  if (bucket === "day") return d.toISOString().slice(0, 10);
  if (bucket === "month") return d.toISOString().slice(0, 7);
  return String(d.getFullYear());
}

function aggregate(metrics: DailyMetric[], bucket: "day" | "month" | "year") {
  const map = new Map<string, { key: string; revenue: number; expenses: number; profit: number; inflow: number; outflow: number; txn_count: number }>();
  metrics.forEach((m) => {
    const key = bucketKey(m.metric_date, bucket);
    const entry = map.get(key) ?? { key, revenue: 0, expenses: 0, profit: 0, inflow: 0, outflow: 0, txn_count: 0 };
    entry.revenue += Number(m.revenue);
    entry.expenses += Number(m.expenses);
    entry.profit += Number(m.profit);
    entry.inflow += Number(m.inflow);
    entry.outflow += Number(m.outflow);
    entry.txn_count += Number(m.txn_count);
    map.set(key, entry);
  });
  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}

function ReportView({ view }: { view: FinanceView }) {
  const meta = VIEW_META[view] ?? VIEW_META['report_daily']!;
  const days = meta.bucket === "day" ? 60 : meta.bucket === "month" ? 730 : 1825;
  const metricsState = useQuery(dailyMetricsQuery(days));

  const buckets = useMemo(() => aggregate(metricsState.data ?? [], meta.bucket), [metricsState.data, meta.bucket]);
  const chartData = useMemo(() => buckets.slice(-30), [buckets]);

  const latest = buckets[buckets.length - 1];
  const previous = buckets[buckets.length - 2];

  const revenueChange = latest && previous ? percentChange(latest.revenue, previous.revenue) : 0;
  const expenseChange = latest && previous ? percentChange(latest.expenses, previous.expenses) : 0;
  const profitChange = latest && previous ? percentChange(latest.profit, previous.profit) : 0;
  const txnChange = latest && previous ? percentChange(latest.txn_count, previous.txn_count) : 0;

  return (
    <SectionShell title={meta.title} description={meta.description} icon={BarChart3}>
      <div className="space-y-6">
        <StatGrid>
          <StatCard
            label="Revenue"
            value={formatCurrency(latest?.revenue ?? 0)}
            hint={`${revenueChange >= 0 ? "+" : ""}${formatPercent(revenueChange)} vs prior period`}
            icon={revenueChange >= 0 ? TrendingUp : TrendingDown}
            tone={revenueChange >= 0 ? "success" : "danger"}
          />
          <StatCard
            label="Expenses"
            value={formatCurrency(latest?.expenses ?? 0)}
            hint={`${expenseChange >= 0 ? "+" : ""}${formatPercent(expenseChange)} vs prior period`}
            icon={expenseChange >= 0 ? TrendingUp : TrendingDown}
            tone={expenseChange >= 0 ? "warning" : "success"}
          />
          <StatCard
            label="Net Profit"
            value={formatCurrency(latest?.profit ?? 0)}
            hint={`${profitChange >= 0 ? "+" : ""}${formatPercent(profitChange)} vs prior period`}
            icon={DollarSign}
            tone={profitChange >= 0 ? "success" : "danger"}
          />
          <StatCard
            label="Transactions"
            value={latest?.txn_count ?? 0}
            hint={`${txnChange >= 0 ? "+" : ""}${formatPercent(txnChange)} vs prior period`}
            icon={BarChart3}
            tone="info"
          />
        </StatGrid>

        <PanelCard title="Revenue vs Expenses vs Profit">
          <QueryState isLoading={metricsState.isLoading} error={metricsState.error} isEmpty={!chartData.length} emptyLabel="No metrics recorded yet">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="key" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => formatCompact(v)} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="expenses" name="Expenses" className="fill-warning" radius={[4, 4, 0, 0]} />
                  <Area dataKey="revenue" name="Revenue" className="fill-primary/20 stroke-primary" type="monotone" />
                  <Line dataKey="profit" name="Profit" className="stroke-success" type="monotone" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </QueryState>
        </PanelCard>
      </div>
    </SectionShell>
  );
}

function ExportView() {
  const metricsState = useQuery(dailyMetricsQuery(1825));
  const txnState = useQuery(transactionsQuery({ limit: 500 }));
  const expensesState = useQuery(expensesQuery());
  const invoicesState = useQuery(invoicesQuery());

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const inRange = (dateStr: string) => {
    const t = new Date(dateStr).getTime();
    if (from && t < new Date(from).getTime()) return false;
    if (to && t > new Date(to).getTime() + 86_400_000) return false;
    return true;
  };

  const filteredMetrics = useMemo(() => (metricsState.data ?? []).filter((m) => inRange(m.metric_date)), [metricsState.data, from, to]);
  const filteredTxns = useMemo(() => (txnState.data ?? []).filter((t) => inRange(t.occurred_at)), [txnState.data, from, to]);
  const filteredExpenses = useMemo(() => (expensesState.data ?? []).filter((e) => inRange(e.expense_date)), [expensesState.data, from, to]);
  const filteredInvoices = useMemo(() => (invoicesState.data ?? []).filter((i) => inRange(i.issue_date)), [invoicesState.data, from, to]);

  const datasets = [
    {
      key: "daily-metrics",
      label: "Daily Metrics",
      icon: BarChart3,
      rows: filteredMetrics,
      count: filteredMetrics.length,
    },
    {
      key: "transactions",
      label: "Transactions",
      icon: Receipt,
      rows: filteredTxns,
      count: filteredTxns.length,
    },
    {
      key: "expenses",
      label: "Expenses",
      icon: DollarSign,
      rows: filteredExpenses,
      count: filteredExpenses.length,
    },
    {
      key: "invoices",
      label: "Invoices",
      icon: FileSpreadsheet,
      rows: filteredInvoices,
      count: filteredInvoices.length,
    },
  ];

  return (
    <SectionShell title="Export Reports" description="Download real finance datasets for a chosen date range" icon={Download}>
      <div className="space-y-6">
        <PanelCard title="Date Range">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            {(from || to) && (
              <Button variant="ghost" size="sm" onClick={() => { setFrom(""); setTo(""); }}>
                Clear
              </Button>
            )}
          </div>
        </PanelCard>

        <StatGrid>
          {datasets.map((d) => (
            <StatCard key={d.key} label={d.label} value={d.count} icon={d.icon} />
          ))}
        </StatGrid>

        <PanelCard title="Export Datasets">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {datasets.map((d) => {
              const Icon = d.icon;
              return (
                <div key={d.key} className="rounded-lg border border-border/60 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="font-medium text-foreground">{d.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{d.count} rows in range</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full gap-1"
                    disabled={!d.count}
                    onClick={() => downloadCsv(`${d.key}.csv`, d.rows as unknown as Record<string, unknown>[])}
                  >
                    <Download className="h-3 w-3" />
                    Export CSV
                  </Button>
                </div>
              );
            })}
          </div>
        </PanelCard>
      </div>
    </SectionShell>
  );
}

export default function ReportSections({ view }: { view: FinanceView }) {
  if (view === "report_export") return <ExportView />;
  return <ReportView view={view} />;
}
