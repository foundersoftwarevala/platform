/**
 * FINANCE OVERVIEW SECTIONS
 * Total Balance, Today Inflow/Outflow, Net Profit, Pending Amount
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CircleDollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Clock,
  Download,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { FinanceView } from "@/lib/finance/views";
import { dailyMetricsQuery, walletsQuery, transactionsQuery, invoicesQuery, payoutsQuery } from "@/lib/finance/queries";
import { formatCurrency, formatCompact, formatDateTime, downloadCsv, percentChange, formatPercent } from "@/lib/finance/format";
import { SectionShell, StatGrid, StatCard, PanelCard, QueryState, StatusBadge } from "@/components/finance/ui-kit";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const TITLES: Record<string, { title: string; description: string }> = {
  overview_total_balance: { title: "Total Balance", description: "Aggregate balance across all wallets in the system" },
  overview_today_inflow: { title: "Today's Income", description: "Credits received today across all channels" },
  overview_today_outflow: { title: "Today's Expense", description: "Debits and expenses recorded today" },
  overview_net_profit: { title: "Net Profit", description: "Revenue minus expenses over time" },
  overview_pending: { title: "Pending Payments", description: "Transactions and invoices awaiting settlement" },
};

function isToday(dateStr: string | null | undefined) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export default function OverviewSections({ view }: { view: FinanceView }) {
  const meta = TITLES[view] ?? TITLES['overview_total_balance']!;

  const metricsQ = useQuery(dailyMetricsQuery(180));
  const walletsQ = useQuery(walletsQuery());
  const txnQ = useQuery(transactionsQuery({ limit: 300 }));
  const invoicesQ = useQuery(invoicesQuery());
  const payoutsQ = useQuery(payoutsQuery());

  const isLoading = metricsQ.isLoading || walletsQ.isLoading || txnQ.isLoading || invoicesQ.isLoading || payoutsQ.isLoading;
  const error = metricsQ.error || walletsQ.error || txnQ.error || invoicesQ.error || payoutsQ.error;

  const metrics = metricsQ.data ?? [];
  const wallets = walletsQ.data ?? [];
  const transactions = txnQ.data ?? [];
  const invoices = invoicesQ.data ?? [];
  const payouts = payoutsQ.data ?? [];

  const sortedMetrics = useMemo(
    () => [...metrics].sort((a, b) => new Date(a.metric_date).getTime() - new Date(b.metric_date).getTime()),
    [metrics],
  );

  const latest = sortedMetrics[sortedMetrics.length - 1];
  const previous = sortedMetrics[sortedMetrics.length - 2];

  const totalBalance = useMemo(() => wallets.reduce((sum, w) => sum + Number(w.balance ?? 0), 0), [wallets]);

  const todayInflow = useMemo(
    () => transactions.filter((t) => t.direction === "credit" && isToday(t.occurred_at)).reduce((s, t) => s + Number(t.amount), 0),
    [transactions],
  );
  const todayOutflow = useMemo(
    () => transactions.filter((t) => t.direction === "debit" && isToday(t.occurred_at)).reduce((s, t) => s + Number(t.amount), 0),
    [transactions],
  );

  const pendingAmount = useMemo(() => {
    const pendingTxn = transactions.filter((t) => t.status === "pending").reduce((s, t) => s + Number(t.amount), 0);
    const pendingInvoices = invoices.filter((i) => i.status === "unpaid" || i.status === "overdue").reduce((s, i) => s + Number(i.total), 0);
    const pendingPayouts = payouts.filter((p) => ["requested", "approved", "processing", "on_hold"].includes(p.status)).reduce((s, p) => s + Number(p.amount), 0);
    return pendingTxn + pendingInvoices + pendingPayouts;
  }, [transactions, invoices, payouts]);

  const netProfit = latest ? Number(latest.profit) : 0;
  const netProfitChange = latest && previous ? percentChange(Number(latest.profit), Number(previous.profit)) : 0;
  const inflowChange = latest && previous ? percentChange(Number(latest.inflow), Number(previous.inflow)) : 0;
  const outflowChange = latest && previous ? percentChange(Number(latest.outflow), Number(previous.outflow)) : 0;
  const revenueChange = latest && previous ? percentChange(Number(latest.revenue), Number(previous.revenue)) : 0;

  const chartData = useMemo(
    () =>
      sortedMetrics.slice(-30).map((m) => ({
        date: m.metric_date,
        revenue: Number(m.revenue),
        expenses: Number(m.expenses),
        profit: Number(m.profit),
      })),
    [sortedMetrics],
  );

  const summaryCards = [
    { label: "Total Balance", value: formatCurrency(totalBalance), change: revenueChange, icon: CircleDollarSign, key: "overview_total_balance" },
    { label: "Today Inflow", value: formatCurrency(todayInflow), change: inflowChange, icon: TrendingUp, key: "overview_today_inflow" },
    { label: "Today Outflow", value: formatCurrency(todayOutflow), change: outflowChange, icon: TrendingDown, key: "overview_today_outflow" },
    { label: "Net Profit", value: formatCurrency(netProfit), change: netProfitChange, icon: BarChart3, key: "overview_net_profit" },
    { label: "Pending", value: formatCurrency(pendingAmount), change: 0, icon: Clock, key: "overview_pending" },
  ];

  const recentTransactions = useMemo(
    () => [...transactions].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()).slice(0, 10),
    [transactions],
  );

  const handleExport = () => {
    downloadCsv(`${view}.csv`, recentTransactions.map((t) => ({
      txn_code: t.txn_code,
      direction: t.direction,
      amount: t.amount,
      counterparty: t.counterparty,
      gateway: t.gateway,
      status: t.status,
      occurred_at: t.occurred_at,
    })));
  };

  const pendingRows = useMemo(() => {
    const rows: { id: string; type: string; label: string; amount: number; status: string; date: string | null }[] = [];
    transactions.filter((t) => t.status === "pending").forEach((t) => rows.push({ id: t.id, type: "Transaction", label: t.counterparty, amount: Number(t.amount), status: t.status, date: t.occurred_at }));
    invoices.filter((i) => i.status === "unpaid" || i.status === "overdue").forEach((i) => rows.push({ id: i.id, type: "Invoice", label: i.client_name, amount: Number(i.total), status: i.status, date: i.due_date }));
    payouts.filter((p) => ["requested", "approved", "processing", "on_hold"].includes(p.status)).forEach((p) => rows.push({ id: p.id, type: "Payout", label: p.recipient_name, amount: Number(p.amount), status: p.status, date: p.requested_at }));
    return rows.sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime());
  }, [transactions, invoices, payouts]);

  return (
    <SectionShell
      title={meta.title}
      description={meta.description}
      icon={CircleDollarSign}
      actions={
        <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
          <Download className="h-4 w-4" /> Export
        </Button>
      }
    >
      <StatGrid>
        {summaryCards.map((card) => (
          <StatCard
            key={card.key}
            label={card.label}
            value={card.value}
            icon={card.icon}
            loading={isLoading}
            tone={card.key === view ? "info" : "default"}
            hint={
              card.change !== 0 ? (
                <span className={card.change >= 0 ? "flex items-center gap-1 text-success" : "flex items-center gap-1 text-destructive"}>
                  {card.change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {formatPercent(card.change)} vs prior period
                </span>
              ) : undefined
            }
          />
        ))}
      </StatGrid>

      <PanelCard title="Revenue vs Expenses Trend (30 days)">
        <QueryState isLoading={isLoading} error={error} isEmpty={chartData.length === 0}>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary, #6366f1)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--color-primary, #6366f1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tickFormatter={(v) => formatDateTime(v).split(",")[0] ?? v} tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => formatCompact(v)} tick={{ fontSize: 11 }} width={70} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={(v) => formatDateTime(v as string)} />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" fill="url(#revGrad)" name="Revenue" />
                <Area type="monotone" dataKey="expenses" stroke="#ef4444" fill="url(#expGrad)" name="Expenses" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </QueryState>
      </PanelCard>

      {view === "overview_pending" ? (
        <PanelCard title="Pending Items">
          <QueryState isLoading={isLoading} error={error} isEmpty={pendingRows.length === 0} emptyLabel="Nothing pending">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.type}</TableCell>
                    <TableCell>{r.label}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(r.amount)}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(r.date)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </QueryState>
        </PanelCard>
      ) : (
        <PanelCard title="Recent Transactions">
          <QueryState isLoading={isLoading} error={error} isEmpty={recentTransactions.length === 0}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Txn</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Counterparty</TableHead>
                  <TableHead>Gateway</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTransactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.txn_code}</TableCell>
                    <TableCell className={t.direction === "credit" ? "text-success" : "text-destructive"}>
                      {t.direction === "credit" ? "Credit" : "Debit"}
                    </TableCell>
                    <TableCell className="font-semibold">{formatCurrency(t.amount)}</TableCell>
                    <TableCell>{t.counterparty}</TableCell>
                    <TableCell>{t.gateway ?? "—"}</TableCell>
                    <TableCell><StatusBadge status={t.status} /></TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(t.occurred_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </QueryState>
        </PanelCard>
      )}
    </SectionShell>
  );
}
