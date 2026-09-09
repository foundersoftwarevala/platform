import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Banknote, Download, RefreshCcw, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { dailyMetricsQuery, invoicesQuery, transactionsQuery } from "@/lib/finance/queries";
import { PanelCard, QueryState, SectionShell, StatCard, StatGrid, StatusBadge } from "@/components/finance/ui-kit";
import { Button } from "@/components/ui/button";
import { downloadCsv, formatCurrency, formatDate, percentChange, relativeTime } from "@/lib/finance/format";

const PIE_COLORS = ["var(--success)", "var(--info)", "var(--primary)", "var(--warning)"];

export default function RevenueDashboard() {
  const metricsState = useQuery(dailyMetricsQuery(180));
  const transactionsState = useQuery(transactionsQuery({ limit: 10 }));
  const invoicesState = useQuery(invoicesQuery());

  const metrics = metricsState.data ?? [];
  const transactions = transactionsState.data ?? [];
  const invoices = invoicesState.data ?? [];

  const chartData = useMemo(
    () =>
      [...metrics]
        .sort((a, b) => a.metric_date.localeCompare(b.metric_date))
        .map((m) => ({
          date: formatDate(m.metric_date),
          revenue: Number(m.revenue),
          expenses: Number(m.expenses),
        })),
    [metrics],
  );

  const stats = useMemo(() => {
    const totalRevenue = metrics.reduce((sum, m) => sum + Number(m.revenue), 0);
    const totalProfit = metrics.reduce((sum, m) => sum + Number(m.profit), 0);
    const sorted = [...metrics].sort((a, b) => b.metric_date.localeCompare(a.metric_date));
    const latest = sorted[0];
    const prev = sorted[1];
    const monthlyRevenue = latest ? Number(latest.revenue) : 0;
    const revenueChange = latest && prev ? percentChange(Number(latest.revenue), Number(prev.revenue)) : 0;
    const pendingCollection = invoices
      .filter((i) => i.status === "unpaid" || i.status === "overdue")
      .reduce((sum, i) => sum + Number(i.total), 0);
    return { totalRevenue, totalProfit, monthlyRevenue, revenueChange, pendingCollection };
  }, [metrics, invoices]);

  const incomeBreakdown = useMemo(() => {
    const byCategory = new Map<string, number>();
    for (const t of transactions) {
      if (t.direction !== "credit") continue;
      byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + Number(t.amount));
    }
    return Array.from(byCategory.entries()).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  const handleExport = () => {
    if (!metrics.length) return;
    downloadCsv("revenue-dashboard.csv", metrics.map((m) => ({
      date: m.metric_date,
      revenue: m.revenue,
      expenses: m.expenses,
      profit: m.profit,
      inflow: m.inflow,
      outflow: m.outflow,
      txn_count: m.txn_count,
    })));
  };

  return (
    <SectionShell
      title="Revenue Dashboard"
      description="Complete financial overview with real-time analytics"
      icon={Banknote}
      actions={
        <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Export
        </Button>
      }
    >
      <div className="space-y-6">
        <StatGrid>
          <StatCard
            label="Total Revenue"
            value={formatCurrency(stats.totalRevenue)}
            hint="Trailing 180 days"
            icon={Banknote}
            loading={metricsState.isLoading}
          />
          <StatCard
            label="Monthly Revenue"
            value={formatCurrency(stats.monthlyRevenue)}
            hint={`${stats.revenueChange >= 0 ? "+" : ""}${stats.revenueChange.toFixed(1)}% vs prior day`}
            icon={TrendingUp}
            tone={stats.revenueChange >= 0 ? "success" : "danger"}
            loading={metricsState.isLoading}
          />
          <StatCard
            label="Net Profit"
            value={formatCurrency(stats.totalProfit)}
            hint="After all deductions"
            icon={ArrowUpRight}
            tone="success"
            loading={metricsState.isLoading}
          />
          <StatCard
            label="Pending Collection"
            value={formatCurrency(stats.pendingCollection)}
            hint="Awaiting payment"
            icon={RefreshCcw}
            tone="warning"
            loading={invoicesState.isLoading}
          />
        </StatGrid>

        <div className="grid gap-6 xl:grid-cols-3">
          <PanelCard title="Revenue vs Expenses" className="xl:col-span-2">
            <QueryState isLoading={metricsState.isLoading} error={metricsState.error} isEmpty={chartData.length === 0}>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" fontSize={11} stroke="var(--muted-foreground)" />
                    <YAxis fontSize={11} stroke="var(--muted-foreground)" tickFormatter={(v) => `${v / 1000}k`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        color: "var(--foreground)",
                      }}
                      formatter={(value: number) => [formatCurrency(value), ""]}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={2} dot={false} name="Revenue" />
                    <Line type="monotone" dataKey="expenses" stroke="var(--destructive)" strokeWidth={2} dot={false} name="Expenses" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </QueryState>
          </PanelCard>

          <PanelCard title="Income Sources">
            <QueryState isLoading={transactionsState.isLoading} error={transactionsState.error} isEmpty={incomeBreakdown.length === 0}>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={incomeBreakdown} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={4} dataKey="value">
                      {incomeBreakdown.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        color: "var(--foreground)",
                      }}
                      formatter={(value: number) => [formatCurrency(value), ""]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 space-y-2">
                {incomeBreakdown.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="capitalize text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="font-medium text-foreground">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </QueryState>
          </PanelCard>
        </div>

        <PanelCard title="Recent Transactions">
          <QueryState isLoading={transactionsState.isLoading} error={transactionsState.error} isEmpty={transactions.length === 0}>
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        tx.direction === "credit" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                      }`}
                    >
                      {tx.direction === "credit" ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{tx.counterparty}</p>
                      <p className="text-xs text-muted-foreground">{tx.txn_code} • {relativeTime(tx.occurred_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={tx.status} />
                    <span className={`text-sm font-semibold ${tx.direction === "credit" ? "text-success" : "text-foreground"}`}>
                      {tx.direction === "credit" ? "+" : "-"}
                      {formatCurrency(tx.amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </QueryState>
        </PanelCard>
      </div>
    </SectionShell>
  );
}
