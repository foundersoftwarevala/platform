import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, CheckCircle, Clock, Download, RefreshCcw, Search, Wallet2, XCircle } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { commissionsQuery } from "@/lib/finance/queries";
import { useUpdateCommission } from "@/lib/finance/mutations";
import type { Commission } from "@/lib/finance/types";
import { PanelCard, QueryState, SectionShell, StatCard, StatGrid, StatusBadge } from "@/components/finance/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadCsv, formatCurrency, formatDate } from "@/lib/finance/format";

const PARTNER_TYPES = ["reseller", "franchise", "influencer", "developer"];

export default function CommissionLedger() {
  const [roleFilter, setRoleFilter] = useState("all");
  const [search, setSearch] = useState("");
  const commissionsState = useQuery(commissionsQuery());
  const updateCommission = useUpdateCommission();

  const rows = commissionsState.data ?? [];

  const filtered = useMemo(() => {
    let list = rows;
    if (roleFilter !== "all") list = list.filter((c) => c.partner_type === roleFilter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((c) => c.partner_name.toLowerCase().includes(q) || c.period.toLowerCase().includes(q));
    return list;
  }, [rows, roleFilter, search]);

  const totalsByType = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const type of PARTNER_TYPES) {
      totals[type] = rows.filter((c) => c.partner_type === type).reduce((s, c) => s + Number(c.commission_amount), 0);
    }
    return totals;
  }, [rows]);

  const chartData = useMemo(() => {
    const byPeriod = new Map<string, Record<string, number>>();
    for (const c of rows) {
      const entry = byPeriod.get(c.period) ?? {};
      entry[c.partner_type] = (entry[c.partner_type] ?? 0) + Number(c.commission_amount);
      byPeriod.set(c.period, entry);
    }
    return Array.from(byPeriod.entries())
      .map(([period, values]) => ({ ...values, period }))
      .sort((a, b) => a.period.localeCompare(b.period))
      .slice(-6);
  }, [rows]);

  const stats = useMemo(() => {
    const pending = rows.filter((c) => c.status === "pending").reduce((s, c) => s + Number(c.commission_amount), 0);
    const approved = rows.filter((c) => c.status === "approved").reduce((s, c) => s + Number(c.commission_amount), 0);
    const paid = rows.filter((c) => c.status === "paid").reduce((s, c) => s + Number(c.commission_amount), 0);
    const reversed = rows.filter((c) => c.status === "reversed").reduce((s, c) => s + Number(c.commission_amount), 0);
    return { pending, approved, paid, reversed };
  }, [rows]);

  const handleExport = () => {
    if (!filtered.length) return;
    downloadCsv(
      "commission-ledger.csv",
      filtered.map((c) => ({
        partner_name: c.partner_name,
        partner_type: c.partner_type,
        period: c.period,
        base_amount: c.base_amount,
        rate_percent: c.rate_percent,
        commission_amount: c.commission_amount,
        status: c.status,
        created_at: c.created_at,
      })),
    );
  };

  const act = (id: string, status: Commission["status"]) => updateCommission.mutate({ id, status, actor: "finance_manager" });

  return (
    <SectionShell
      title="Commission Ledger"
      description="Complete commission tracking with auto-allocation"
      icon={Wallet2}
      actions={
        <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      }
    >
      <div className="space-y-6">
        <StatGrid>
          <StatCard label="Pending" value={formatCurrency(stats.pending)} icon={Clock} tone="warning" loading={commissionsState.isLoading} />
          <StatCard label="Approved" value={formatCurrency(stats.approved)} icon={CheckCircle} tone="info" loading={commissionsState.isLoading} />
          <StatCard label="Paid" value={formatCurrency(stats.paid)} icon={CheckCircle} tone="success" loading={commissionsState.isLoading} />
          <StatCard label="Reversed" value={formatCurrency(stats.reversed)} icon={XCircle} tone="danger" loading={commissionsState.isLoading} />
        </StatGrid>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {PARTNER_TYPES.map((type) => (
            <div key={type} className="rounded-xl border border-border/60 bg-card/80 p-4">
              <p className="text-xs capitalize text-muted-foreground">{type}</p>
              <p className="mt-1 text-lg font-bold text-foreground">{formatCurrency(totalsByType[type] ?? 0)}</p>
            </div>
          ))}
        </div>

        <PanelCard title="Commission Distribution by Period">
          <QueryState isLoading={commissionsState.isLoading} error={commissionsState.error} isEmpty={chartData.length === 0}>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="period" fontSize={11} stroke="var(--muted-foreground)" />
                  <YAxis fontSize={11} stroke="var(--muted-foreground)" tickFormatter={(v: number) => `${v / 1000}k`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      color: "var(--foreground)",
                    }}
                    formatter={(value: number) => [formatCurrency(value), ""]}
                  />
                  <Legend />
                  <Bar dataKey="reseller" name="Reseller" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="franchise" name="Franchise" fill="var(--info)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="influencer" name="Influencer" fill="var(--warning)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="developer" name="Developer" fill="var(--success)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </QueryState>
        </PanelCard>

        <PanelCard
          title="Commission Entries"
          actions={
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="w-64 pl-9" placeholder="Search entries..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {PARTNER_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
        >
          <QueryState isLoading={commissionsState.isLoading} error={commissionsState.error} isEmpty={filtered.length === 0}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Recipient</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Period</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">Base Amount</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">Commission</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-muted-foreground">Rate</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry) => (
                    <tr key={entry.id} className="border-b border-border/60 hover:bg-muted/40">
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{entry.partner_name}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs capitalize">
                          {entry.partner_type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{entry.period}</td>
                      <td className="px-4 py-3 text-right text-sm text-muted-foreground">{formatCurrency(entry.base_amount)}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-primary">{formatCurrency(entry.commission_amount)}</td>
                      <td className="px-4 py-3 text-center text-sm text-muted-foreground">{Number(entry.rate_percent).toFixed(1)}%</td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={entry.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {entry.status === "pending" && (
                            <Button size="sm" variant="outline" className="h-7 gap-1 text-success" disabled={updateCommission.isPending} onClick={() => act(entry.id, "approved")}>
                              <CheckCircle className="h-3.5 w-3.5" /> Approve
                            </Button>
                          )}
                          {entry.status === "approved" && (
                            <Button size="sm" variant="outline" className="h-7 gap-1 text-success" disabled={updateCommission.isPending} onClick={() => act(entry.id, "paid")}>
                              <Wallet2 className="h-3.5 w-3.5" /> Mark Paid
                            </Button>
                          )}
                          {(entry.status === "pending" || entry.status === "approved") && (
                            <Button size="sm" variant="outline" className="h-7 gap-1 text-destructive" disabled={updateCommission.isPending} onClick={() => act(entry.id, "reversed")}>
                              <RefreshCcw className="h-3.5 w-3.5" /> Reverse
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </QueryState>
        </PanelCard>
      </div>
    </SectionShell>
  );
}
