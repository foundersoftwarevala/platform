import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  RotateCcw,
  Clock,
  CheckCircle,
  XCircle,
  ArrowUpDown,
  ThumbsUp,
  ThumbsDown,
  Loader2,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

import { refundsQuery, walletsQuery, walletTransactionsQuery, transactionsQuery } from "@/lib/finance/queries";
import { useUpdateRefund, useAdjustWallet } from "@/lib/finance/mutations";
import type { FinanceView } from "@/lib/finance/views";
import type { Refund } from "@/lib/finance/types";
import { PanelCard, QueryState, SectionShell, StatCard, StatGrid, StatusBadge } from "@/components/finance/ui-kit";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate, formatDateTime, formatPercent } from "@/lib/finance/format";

const VIEW_META: Record<string, { title: string; description: string; status?: Refund["status"] }> = {
  refund_requests: { title: "Refund Requests", description: "Pending refund requests awaiting review", status: "pending" },
  refund_approved: { title: "Approved Refunds", description: "Refunds approved and processed", status: "approved" },
  refund_rejected: { title: "Rejected Refunds", description: "Refund requests that were declined", status: "rejected" },
  refund_wallet_adjust: { title: "Wallet Adjustments", description: "Credit or debit wallet balances directly" },
};

function ReasonBreakdown({ refunds }: { refunds: Refund[] }) {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    refunds.forEach((r) => {
      map.set(r.reason, (map.get(r.reason) ?? 0) + Number(r.amount));
    });
    return Array.from(map.entries())
      .map(([reason, amount]) => ({ reason, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  }, [refunds]);

  if (!data.length) return null;

  return (
    <PanelCard title="Refund Reason Breakdown">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="reason" width={140} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Bar dataKey="amount" radius={[0, 4, 4, 0]} className="fill-primary" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </PanelCard>
  );
}

function RefundQueue({ view }: { view: FinanceView }) {
  const meta = VIEW_META[view] ?? VIEW_META["refund_requests"]!;
  const refundsState = useQuery(refundsQuery(meta.status));
  const txnState = useQuery(transactionsQuery({ direction: "credit", limit: 150 }));
  const updateRefund = useUpdateRefund();
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const rows = refundsState.data ?? [];
  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return (
          r.refund_code.toLowerCase().includes(q) ||
          r.customer_name.toLowerCase().includes(q) ||
          String(r.amount).includes(q)
        );
      }),
    [rows, search],
  );

  const stats = useMemo(() => {
    const pending = rows.filter((r) => r.status === "pending").length;
    const approved = rows.filter((r) => r.status === "approved" || r.status === "processed").length;
    const rejected = rows.filter((r) => r.status === "rejected").length;
    const totalRefunded = rows
      .filter((r) => r.status === "approved" || r.status === "processed")
      .reduce((sum, r) => sum + Number(r.amount), 0);
    const inflowVolume = (txnState.data ?? []).reduce((sum, t) => sum + Number(t.amount), 0);
    const refundRate = inflowVolume ? (totalRefunded / inflowVolume) * 100 : 0;
    return { pending, approved, rejected, totalRefunded, refundRate };
  }, [rows, txnState.data]);

  return (
    <SectionShell title={meta.title} description={meta.description} icon={RotateCcw}>
      <div className="space-y-6">
        <StatGrid>
          <StatCard label="Pending Requests" value={stats.pending} icon={Clock} tone="warning" />
          <StatCard label="Approved / Processed" value={stats.approved} icon={CheckCircle} tone="success" />
          <StatCard label="Rejected" value={stats.rejected} icon={XCircle} tone="danger" />
          <StatCard
            label="Refund Rate"
            value={formatPercent(stats.refundRate)}
            hint={`${formatCurrency(stats.totalRefunded)} refunded vs inflow`}
            icon={RotateCcw}
            tone="info"
          />
        </StatGrid>

        <ReasonBreakdown refunds={rows} />

        <PanelCard
          title="Refund Requests"
          actions={<Input placeholder="Search by code, customer, amount…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />}
        >
          <QueryState isLoading={refundsState.isLoading} error={refundsState.error} isEmpty={!filtered.length} emptyLabel="No refund requests found">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-3 font-medium">Code</th>
                    <th className="pb-3 font-medium">Customer</th>
                    <th className="pb-3 font-medium">Amount</th>
                    <th className="pb-3 font-medium">Reason</th>
                    <th className="pb-3 font-medium">Mode</th>
                    <th className="pb-3 font-medium">Requested</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Note</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((r) => (
                    <tr key={r.id}>
                      <td className="py-3 font-mono text-xs text-muted-foreground">{r.refund_code}</td>
                      <td className="py-3 font-medium text-foreground">{r.customer_name}</td>
                      <td className="py-3 font-semibold text-foreground">{formatCurrency(r.amount)}</td>
                      <td className="py-3 max-w-[200px] truncate text-muted-foreground">{r.reason}</td>
                      <td className="py-3 text-muted-foreground">{r.mode}</td>
                      <td className="py-3 text-muted-foreground">{formatDate(r.requested_at)}</td>
                      <td className="py-3"><StatusBadge status={r.status} /></td>
                      <td className="py-3">
                        {r.status === "pending" ? (
                          <Input
                            placeholder="Reviewer note…"
                            value={notes[r.id] ?? ""}
                            onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                            className="h-8 w-40 text-xs"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">{r.reviewer_note ?? "—"}</span>
                        )}
                      </td>
                      <td className="py-3">
                        {r.status === "pending" ? (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-success"
                              disabled={updateRefund.isPending}
                              onClick={() =>
                                updateRefund.mutate({ id: r.id, status: "approved", note: notes[r.id] || undefined })
                              }
                            >
                              <ThumbsUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive"
                              disabled={updateRefund.isPending}
                              onClick={() =>
                                updateRefund.mutate({ id: r.id, status: "rejected", note: notes[r.id] || undefined })
                              }
                            >
                              <ThumbsDown className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : r.status === "approved" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={updateRefund.isPending}
                            onClick={() => updateRefund.mutate({ id: r.id, status: "processed" })}
                          >
                            Mark Processed
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
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

function WalletAdjustForm() {
  const walletsState = useQuery(walletsQuery());
  const ledgerState = useQuery(walletTransactionsQuery());
  const adjustWallet = useAdjustWallet();

  const [walletId, setWalletId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [entryType, setEntryType] = useState<"credit" | "debit">("credit");
  const [reason, setReason] = useState("");

  const wallets = walletsState.data ?? [];
  const ledger = (ledgerState.data ?? []).filter((t) => t.entry_type === "credit" || t.entry_type === "debit");

  const selectedWallet = wallets.find((w) => w.id === walletId);

  const handleSubmit = () => {
    const amt = Number(amount);
    if (!walletId || !amt || amt <= 0 || !reason.trim()) return;
    adjustWallet.mutate(
      { walletId, amount: amt, entryType, reason: reason.trim() },
      {
        onSuccess: () => {
          setAmount("");
          setReason("");
        },
      },
    );
  };

  return (
    <SectionShell
      title="Wallet Adjustments"
      description="Manually credit or debit a wallet and review the recent adjustment ledger"
      icon={ArrowUpDown}
    >
      <div className="space-y-6">
        <StatGrid>
          <StatCard label="Total Wallets" value={wallets.length} icon={ArrowUpDown} />
          <StatCard
            label="Total Balance"
            value={formatCurrency(wallets.reduce((sum, w) => sum + Number(w.balance), 0))}
            tone="info"
          />
          <StatCard
            label="Frozen Wallets"
            value={wallets.filter((w) => w.status === "frozen").length}
            tone="danger"
          />
          <StatCard
            label="Recent Adjustments"
            value={ledger.length}
            tone="success"
          />
        </StatGrid>

        <PanelCard title="New Adjustment">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Wallet</Label>
              <Select value={walletId} onValueChange={setWalletId}>
                <SelectTrigger><SelectValue placeholder="Select wallet" /></SelectTrigger>
                <SelectContent>
                  {wallets.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.owner_name} ({w.owner_code}) — {formatCurrency(w.balance)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={entryType} onValueChange={(v) => setEntryType(v as "credit" | "debit")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">Credit</SelectItem>
                  <SelectItem value="debit">Debit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Amount</Label>
              <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reason</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for adjustment" />
            </div>
          </div>
          {selectedWallet ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Current balance: {formatCurrency(selectedWallet.balance)} · Status: {selectedWallet.status}
            </p>
          ) : null}
          <div className="mt-4">
            <Button
              size="sm"
              className="gap-2"
              disabled={adjustWallet.isPending || !walletId || !amount || !reason.trim()}
              onClick={handleSubmit}
            >
              {adjustWallet.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpDown className="h-4 w-4" />}
              Apply Adjustment
            </Button>
          </div>
        </PanelCard>

        <PanelCard title="Recent Adjustment Ledger">
          <QueryState isLoading={ledgerState.isLoading} error={ledgerState.error} isEmpty={!ledger.length} emptyLabel="No adjustments yet">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-3 font-medium">Wallet</th>
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">Amount</th>
                    <th className="pb-3 font-medium">Balance After</th>
                    <th className="pb-3 font-medium">Reason</th>
                    <th className="pb-3 font-medium">By</th>
                    <th className="pb-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ledger.slice(0, 30).map((t) => (
                    <tr key={t.id} className="text-sm">
                      <td className="py-3 font-medium text-foreground">{t.finance_wallets?.owner_name ?? "—"}</td>
                      <td className="py-3"><StatusBadge status={t.entry_type} /></td>
                      <td className={`py-3 font-semibold ${t.entry_type === "credit" ? "text-success" : "text-destructive"}`}>
                        {t.entry_type === "credit" ? "+" : "-"}
                        {formatCurrency(t.amount)}
                      </td>
                      <td className="py-3 text-muted-foreground">{formatCurrency(t.balance_after)}</td>
                      <td className="py-3 text-muted-foreground max-w-[200px] truncate">{t.note ?? "—"}</td>
                      <td className="py-3 text-muted-foreground">{t.performed_by}</td>
                      <td className="py-3 text-muted-foreground">{formatDateTime(t.created_at)}</td>
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

export default function RefundSections({ view }: { view: FinanceView }) {
  if (view === "refund_wallet_adjust") return <WalletAdjustForm />;
  return <RefundQueue view={view} />;
}
