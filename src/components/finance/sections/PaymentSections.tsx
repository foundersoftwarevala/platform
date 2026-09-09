/**
 * PAYMENT MANAGEMENT SECTIONS
 * Incoming, Outgoing, Failed, Pending, Partial Payments
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  TrendingDown,
  XCircle,
  Clock,
  PieChart,
  Search,
  Download,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { FinanceView } from "@/lib/finance/views";
import type { FinanceTransaction } from "@/lib/finance/types";
import { transactionsQuery, gatewaysQuery } from "@/lib/finance/queries";
import { formatCurrency, formatDateTime, maskValue, downloadCsv } from "@/lib/finance/format";
import { SectionShell, StatGrid, StatCard, PanelCard, QueryState, StatusBadge } from "@/components/finance/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Meta = {
  title: string;
  description: string;
  icon: LucideIcon;
  direction?: FinanceTransaction["direction"];
  status?: FinanceTransaction["status"];
};

const TITLES: Record<string, Meta> = {
  payment_incoming: { title: "Incoming Payments", description: "Credits received from franchises, resellers, and users", icon: TrendingUp, direction: "credit" },
  payment_outgoing: { title: "Outgoing Payments", description: "Payouts, refunds, and operating expenses", icon: TrendingDown, direction: "debit" },
  payment_failed: { title: "Failed Payments", description: "Transactions that failed to settle", icon: XCircle, status: "failed" },
  payment_pending: { title: "Pending Payments", description: "Transactions awaiting confirmation", icon: Clock, status: "pending" },
  payment_partial: { title: "Partial Payments", description: "Transactions settled only partially", icon: PieChart, status: "partial" },
};

export default function PaymentSections({ view }: { view: FinanceView }) {
  const meta = TITLES[view] ?? TITLES['payment_incoming']!;
  const [search, setSearch] = useState("");
  const [gatewayFilter, setGatewayFilter] = useState<string>("all");

  const txnFilters = useMemo(() => {
    const f: { direction?: FinanceTransaction["direction"]; status?: FinanceTransaction["status"]; limit: number } = { limit: 300 };
    if (meta.direction) f.direction = meta.direction;
    if (meta.status) f.status = meta.status;
    return f;
  }, [meta.direction, meta.status]);
  const txnQ = useQuery(transactionsQuery(txnFilters));
  const allTxnQ = useQuery(transactionsQuery({ limit: 500 }));
  const gatewaysQ = useQuery(gatewaysQuery());

  const rows = txnQ.data ?? [];
  const allRows = allTxnQ.data ?? [];

  const filtered = useMemo(() => {
    let list = rows;
    if (gatewayFilter !== "all") list = list.filter((t) => (t.gateway ?? "unknown") === gatewayFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) => t.txn_code.toLowerCase().includes(q) || t.counterparty.toLowerCase().includes(q) || String(t.amount).includes(q),
      );
    }
    return [...list].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
  }, [rows, gatewayFilter, search]);

  const kpis = useMemo(() => {
    const sum = (pred: (t: FinanceTransaction) => boolean) => allRows.filter(pred).reduce((s, t) => s + Number(t.amount), 0);
    return {
      incoming: sum((t) => t.direction === "credit"),
      outgoing: sum((t) => t.direction === "debit"),
      failed: sum((t) => t.status === "failed"),
      pending: sum((t) => t.status === "pending"),
      partial: sum((t) => t.status === "partial"),
    };
  }, [allRows]);

  const gatewayBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((t) => map.set(t.gateway ?? "Unknown", (map.get(t.gateway ?? "Unknown") ?? 0) + Number(t.amount)));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const gatewayOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((t) => set.add(t.gateway ?? "unknown"));
    return Array.from(set);
  }, [rows]);

  const handleExport = () => {
    downloadCsv(`${view}.csv`, filtered.map((t) => ({
      txn_code: t.txn_code,
      amount: t.amount,
      direction: t.direction,
      counterparty: t.counterparty,
      gateway: t.gateway,
      method: t.method,
      status: t.status,
      occurred_at: t.occurred_at,
    })));
  };

  const Icon = meta.icon;

  return (
    <SectionShell
      title={meta.title}
      description={meta.description}
      icon={Icon}
      actions={
        <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
          <Download className="h-4 w-4" /> Export
        </Button>
      }
    >
      <StatGrid>
        <StatCard label="Incoming" value={formatCurrency(kpis.incoming)} icon={TrendingUp} tone={view === "payment_incoming" ? "info" : "success"} loading={allTxnQ.isLoading} />
        <StatCard label="Outgoing" value={formatCurrency(kpis.outgoing)} icon={TrendingDown} tone={view === "payment_outgoing" ? "info" : "danger"} loading={allTxnQ.isLoading} />
        <StatCard label="Failed" value={formatCurrency(kpis.failed)} icon={XCircle} tone={view === "payment_failed" ? "info" : "danger"} loading={allTxnQ.isLoading} />
        <StatCard label="Pending" value={formatCurrency(kpis.pending)} icon={Clock} tone={view === "payment_pending" ? "info" : "warning"} loading={allTxnQ.isLoading} />
      </StatGrid>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by transaction code, party, or amount..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button variant={gatewayFilter === "all" ? "secondary" : "outline"} size="sm" onClick={() => setGatewayFilter("all")}>
            All gateways
          </Button>
          {gatewayOptions.map((g) => (
            <Button key={g} variant={gatewayFilter === g ? "secondary" : "outline"} size="sm" className="capitalize" onClick={() => setGatewayFilter(g)}>
              {g}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <PanelCard title="Transactions" className="lg:col-span-2">
          <QueryState isLoading={txnQ.isLoading} error={txnQ.error} isEmpty={filtered.length === 0}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead>Gateway</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 100).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{maskValue(t.txn_code)}</TableCell>
                    <TableCell className={t.direction === "credit" ? "font-semibold text-success" : "font-semibold text-destructive"}>
                      {t.direction === "credit" ? "+" : "-"}
                      {formatCurrency(t.amount)}
                    </TableCell>
                    <TableCell>{t.counterparty}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">{t.gateway ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(t.occurred_at)}</TableCell>
                    <TableCell><StatusBadge status={t.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </QueryState>
        </PanelCard>

        <PanelCard title="Gateway Breakdown">
          <QueryState isLoading={gatewaysQ.isLoading} error={gatewaysQ.error} isEmpty={gatewayBreakdown.length === 0}>
            <div className="space-y-3">
              {gatewayBreakdown.map(([gateway, amount]) => {
                const max = gatewayBreakdown[0]?.[1] || 1;
                return (
                  <div key={gateway}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="capitalize text-foreground">{gateway}</span>
                      <span className="font-medium text-muted-foreground">{formatCurrency(amount)}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(amount / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </QueryState>
        </PanelCard>
      </div>
    </SectionShell>
  );
}
