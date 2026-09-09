import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Users, Megaphone, Settings, Zap, DollarSign, TrendingUp, Percent, Download } from "lucide-react";

import { commissionsQuery, payoutsQuery } from "@/lib/finance/queries";
import { useUpdateCommission, useUpdatePayout } from "@/lib/finance/mutations";
import type { FinanceView } from "@/lib/finance/views";
import type { Commission } from "@/lib/finance/types";
import { PanelCard, QueryState, SectionShell, StatCard, StatGrid, StatusBadge } from "@/components/finance/ui-kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCompact, formatCurrency, formatDate, formatPercent, downloadCsv } from "@/lib/finance/format";

const META: Record<string, { partnerType?: Commission["partner_type"]; label: string; icon: typeof Building2; description: string }> = {
  commission_franchise: { partnerType: "franchise", label: "Franchise Commission", icon: Building2, description: "Commission ledger for franchise partners" },
  commission_reseller: { partnerType: "reseller", label: "Reseller Commission", icon: Users, description: "Commission ledger for reseller partners" },
  commission_influencer: { partnerType: "influencer", label: "Influencer Payout", icon: Megaphone, description: "Commission and payouts for influencer partners" },
  commission_rules: { label: "Commission Rules", icon: Settings, description: "Rate structure derived from live commission data" },
  commission_auto_deduct: { label: "Auto Deduction", icon: Zap, description: "Commissions marked for automatic deduction / paid status" },
};

export default function CommissionSections({ view }: { view: FinanceView }) {
  const meta = META[view] ?? META["commission_franchise"]!;
  const commissionsState = useQuery(commissionsQuery(meta.partnerType));
  const payoutsState = useQuery(payoutsQuery());
  const updateCommission = useUpdateCommission();
  const updatePayout = useUpdatePayout();
  const [search, setSearch] = useState("");

  const rows = commissionsState.data ?? [];
  const payoutRows = payoutsState.data ?? [];

  const filteredRows = useMemo(() => {
    let list = rows;
    if (view === "commission_auto_deduct") {
      list = list.filter((c) => c.status === "paid" || c.status === "approved");
    }
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter((c) => c.partner_name.toLowerCase().includes(q) || c.partner_type.toLowerCase().includes(q));
  }, [rows, search, view]);

  const stats = useMemo(() => {
    const totalEarned = rows.reduce((sum, c) => sum + Number(c.commission_amount), 0);
    const totalPaid = rows.filter((c) => c.status === "paid").reduce((sum, c) => sum + Number(c.commission_amount), 0);
    const totalPending = rows.filter((c) => c.status === "pending" || c.status === "approved").reduce((sum, c) => sum + Number(c.commission_amount), 0);
    const avgRate = rows.length ? rows.reduce((sum, c) => sum + Number(c.rate_percent), 0) / rows.length : 0;
    return { totalEarned, totalPaid, totalPending, avgRate };
  }, [rows]);

  // Leaderboard grouped by partner
  const leaderboard = useMemo(() => {
    const map = new Map<string, { name: string; type: string; earned: number; paid: number; pending: number; count: number }>();
    for (const c of rows) {
      const entry = map.get(c.partner_name) ?? { name: c.partner_name, type: c.partner_type, earned: 0, paid: 0, pending: 0, count: 0 };
      entry.earned += Number(c.commission_amount);
      entry.count += 1;
      if (c.status === "paid") entry.paid += Number(c.commission_amount);
      else entry.pending += Number(c.commission_amount);
      map.set(c.partner_name, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.earned - a.earned).slice(0, 10);
  }, [rows]);

  // Rate/tier structure derived from distinct rates present in data
  const rateStructure = useMemo(() => {
    const map = new Map<string, { partnerType: string; rate: number; count: number; totalBase: number }>();
    for (const c of rows) {
      const key = `${c.partner_type}-${c.rate_percent}`;
      const entry = map.get(key) ?? { partnerType: c.partner_type, rate: Number(c.rate_percent), count: 0, totalBase: 0 };
      entry.count += 1;
      entry.totalBase += Number(c.base_amount);
      map.set(key, entry);
    }
    return Array.from(map.values()).sort((a, b) => a.partnerType.localeCompare(b.partnerType) || a.rate - b.rate);
  }, [rows]);

  const linkedPayouts = useMemo(
    () => payoutRows.filter((p) => p.recipient_type === "partner" || p.recipient_type === meta.partnerType),
    [payoutRows, meta.partnerType],
  );

  const handleExport = () => {
    downloadCsv(`${view}.csv`, filteredRows.map((c) => ({
      id: c.id,
      partner_name: c.partner_name,
      partner_type: c.partner_type,
      period: c.period,
      base_amount: c.base_amount,
      rate_percent: c.rate_percent,
      commission_amount: c.commission_amount,
      status: c.status,
      created_at: c.created_at,
    })));
  };

  const Icon = meta.icon;
  const isEmpty = filteredRows.length === 0;

  return (
    <SectionShell
      title={meta.label}
      description={meta.description}
      icon={Icon}
      actions={
        <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Export
        </Button>
      }
    >
      <QueryState isLoading={commissionsState.isLoading} error={commissionsState.error}>
        <div className="space-y-6">
          <StatGrid>
            <StatCard label="Total Earned" value={formatCompact(stats.totalEarned)} icon={DollarSign} tone="default" />
            <StatCard label="Total Paid" value={formatCompact(stats.totalPaid)} icon={TrendingUp} tone="success" />
            <StatCard label="Pending" value={formatCompact(stats.totalPending)} icon={Zap} tone="warning" />
            <StatCard label="Avg Rate" value={formatPercent(stats.avgRate)} icon={Percent} tone="info" />
          </StatGrid>

          {view !== "commission_rules" && (
            <PanelCard title="Partner Leaderboard">
              <QueryState isLoading={false} isEmpty={leaderboard.length === 0} emptyLabel="No partners yet">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b border-border">
                        <th className="pb-2 font-medium">Partner</th>
                        <th className="pb-2 font-medium">Type</th>
                        <th className="pb-2 font-medium">Entries</th>
                        <th className="pb-2 font-medium">Earned</th>
                        <th className="pb-2 font-medium">Paid</th>
                        <th className="pb-2 font-medium">Pending</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {leaderboard.map((p) => (
                        <tr key={p.name}>
                          <td className="py-2 font-medium text-foreground">{p.name}</td>
                          <td className="py-2"><Badge variant="outline" className="text-xs capitalize">{p.type}</Badge></td>
                          <td className="py-2 text-muted-foreground">{p.count}</td>
                          <td className="py-2 text-foreground">{formatCompact(p.earned)}</td>
                          <td className="py-2 text-success">{formatCompact(p.paid)}</td>
                          <td className="py-2 text-warning">{formatCompact(p.pending)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </QueryState>
            </PanelCard>
          )}

          {view === "commission_rules" && (
            <PanelCard title="Rate Structure (derived from live commissions)">
              <QueryState isLoading={false} isEmpty={rateStructure.length === 0} emptyLabel="No commission rates recorded yet">
                <div className="space-y-3">
                  {rateStructure.map((r) => (
                    <div key={`${r.partnerType}-${r.rate}`} className="flex items-center justify-between rounded-lg border border-border p-4">
                      <div className="flex items-center gap-4">
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                          <Percent className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="font-medium capitalize text-foreground">{r.partnerType} partners</p>
                          <p className="text-xs text-muted-foreground">{r.count} commission entries · Base volume {formatCompact(r.totalBase)}</p>
                        </div>
                      </div>
                      <span className="text-lg font-bold text-success">{formatPercent(r.rate)}</span>
                    </div>
                  ))}
                </div>
              </QueryState>
            </PanelCard>
          )}

          {view === "commission_auto_deduct" && (
            <PanelCard title="Linked Payouts">
              <QueryState isLoading={payoutsState.isLoading} error={payoutsState.error} isEmpty={linkedPayouts.length === 0} emptyLabel="No linked payouts">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b border-border">
                        <th className="pb-2 font-medium">Payout Code</th>
                        <th className="pb-2 font-medium">Recipient</th>
                        <th className="pb-2 font-medium">Amount</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {linkedPayouts.slice(0, 20).map((p) => (
                        <tr key={p.id}>
                          <td className="py-2 font-mono text-primary">{p.payout_code}</td>
                          <td className="py-2 text-foreground">{p.recipient_name}</td>
                          <td className="py-2 font-semibold text-foreground">{formatCurrency(p.amount)}</td>
                          <td className="py-2"><StatusBadge status={p.status} /></td>
                          <td className="py-2">
                            {p.status === "pending" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                disabled={updatePayout.isPending}
                                onClick={() => updatePayout.mutate({ id: p.id, status: "approved", actor: "finance_manager" })}
                              >
                                Approve
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </QueryState>
            </PanelCard>
          )}

          <PanelCard
            title="Commission Ledger"
            actions={
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search partner or type..."
                className="h-8 w-56 rounded-md border border-border bg-background px-2 text-xs"
              />
            }
          >
            <QueryState isLoading={commissionsState.isLoading} error={commissionsState.error} isEmpty={isEmpty} emptyLabel="No commission records found">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="pb-2 font-medium">Partner</th>
                      <th className="pb-2 font-medium">Type</th>
                      <th className="pb-2 font-medium">Period</th>
                      <th className="pb-2 font-medium">Rate</th>
                      <th className="pb-2 font-medium">Base</th>
                      <th className="pb-2 font-medium">Commission</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRows.map((c) => (
                      <tr key={c.id} className="text-sm">
                        <td className="py-2 font-medium text-foreground">{c.partner_name}</td>
                        <td className="py-2"><Badge variant="outline" className="text-xs capitalize">{c.partner_type}</Badge></td>
                        <td className="py-2 text-muted-foreground">{c.period}</td>
                        <td className="py-2 font-semibold text-primary">{formatPercent(c.rate_percent)}</td>
                        <td className="py-2 text-foreground">{formatCompact(c.base_amount)}</td>
                        <td className="py-2 text-foreground">{formatCompact(c.commission_amount)}</td>
                        <td className="py-2"><StatusBadge status={c.status} /></td>
                        <td className="py-2">
                          <div className="flex gap-1">
                            {c.status === "pending" && (
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={updateCommission.isPending}
                                onClick={() => updateCommission.mutate({ id: c.id, status: "approved", actor: "finance_manager" })}>
                                Approve
                              </Button>
                            )}
                            {c.status === "approved" && (
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={updateCommission.isPending}
                                onClick={() => updateCommission.mutate({ id: c.id, status: "paid", actor: "finance_manager" })}>
                                <DollarSign className="mr-1 h-3 w-3" />
                                Pay
                              </Button>
                            )}
                            {(c.status === "approved" || c.status === "paid") && (
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive" disabled={updateCommission.isPending}
                                onClick={() => updateCommission.mutate({ id: c.id, status: "reversed", actor: "finance_manager" })}>
                                Reverse
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
      </QueryState>
    </SectionShell>
  );
}
