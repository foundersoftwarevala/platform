/**
 * WALLET MANAGEMENT SECTIONS
 * Master / Franchise / Reseller / User, Top-up, Deduction, Low Balance
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Wallet as WalletIcon,
  Building2,
  Users,
  Landmark,
  AlertTriangle,
  Search,
  Plus,
  Minus,
  Snowflake,
  Download,
} from "lucide-react";

import type { FinanceView } from "@/lib/finance/views";
import type { Wallet } from "@/lib/finance/types";
import { walletsQuery, walletTransactionsQuery } from "@/lib/finance/queries";
import { useAdjustWallet, useToggleWalletFreeze } from "@/lib/finance/mutations";
import { formatCurrency, formatCompact, relativeTime, downloadCsv } from "@/lib/finance/format";
import { SectionShell, StatGrid, StatCard, PanelCard, QueryState, StatusBadge } from "@/components/finance/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const TITLES: Record<string, { title: string; description: string; ownerType?: Wallet["owner_type"] }> = {
  wallet_master: { title: "Master Wallet", description: "The primary company treasury wallet", ownerType: "master" },
  wallet_franchise: { title: "Franchise Wallets", description: "All franchise-owned wallets", ownerType: "franchise" },
  wallet_reseller: { title: "Reseller Wallets", description: "All reseller-owned wallets", ownerType: "reseller" },
  wallet_user: { title: "User Wallets", description: "End-user wallets", ownerType: "user" },
  wallet_topup: { title: "Wallet Top-up", description: "Credit funds into any wallet" },
  wallet_deduction: { title: "Wallet Deduction", description: "Debit funds from any wallet" },
  wallet_low_balance: { title: "Low Balance Alerts", description: "Wallets under their configured threshold" },
};

export default function WalletSections({ view }: { view: FinanceView }) {
  const meta = TITLES[view] ?? TITLES['wallet_master']!;
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<{ mode: "topup" | "deduct"; wallet: Wallet } | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const walletsQ = useQuery(walletsQuery(meta.ownerType));
  const allWalletsQ = useQuery(walletsQuery());
  const txnQ = useQuery(walletTransactionsQuery(view === "wallet_topup" ? "credit" : view === "wallet_deduction" ? "debit" : undefined));

  const adjustWallet = useAdjustWallet();
  const toggleFreeze = useToggleWalletFreeze();

  const allWallets = allWalletsQ.data ?? [];
  const scopedWallets = view === "wallet_low_balance" ? allWallets : walletsQ.data ?? [];

  const wallets = useMemo(() => {
    let rows = scopedWallets;
    if (view === "wallet_low_balance") {
      rows = rows.filter((w) => Number(w.balance) <= Number(w.low_balance_threshold));
    }
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (w) => w.owner_name.toLowerCase().includes(q) || w.owner_code.toLowerCase().includes(q) || w.owner_type.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [scopedWallets, search, view]);

  const isLoading = view === "wallet_low_balance" ? allWalletsQ.isLoading : walletsQ.isLoading;
  const error = view === "wallet_low_balance" ? allWalletsQ.error : walletsQ.error;

  const totals = useMemo(() => {
    const byType = (t: string) => allWallets.filter((w) => w.owner_type === t).reduce((s, w) => s + Number(w.balance), 0);
    return {
      master: byType("master"),
      franchise: byType("franchise"),
      reseller: byType("reseller"),
      user: byType("user"),
      lowCount: allWallets.filter((w) => Number(w.balance) <= Number(w.low_balance_threshold)).length,
    };
  }, [allWallets]);

  const isTopupOrDeduct = view === "wallet_topup" || view === "wallet_deduction";

  const openDialog = (mode: "topup" | "deduct", wallet: Wallet) => {
    setDialog({ mode, wallet });
    setAmount("");
    setReason("");
  };

  const confirmAdjust = () => {
    if (!dialog || !amount) return;
    adjustWallet.mutate({
      walletId: dialog.wallet.id,
      amount: Number(amount),
      entryType: dialog.mode === "topup" ? "credit" : "debit",
      reason: reason || (dialog.mode === "topup" ? "Manual top-up" : "Manual deduction"),
      actor: "admin",
    });
    setDialog(null);
  };

  const handleFreezeToggle = (wallet: Wallet) => {
    toggleFreeze.mutate({ walletId: wallet.id, frozen: wallet.status !== "frozen", actor: "admin" });
  };

  const handleExport = () => {
    downloadCsv(`${view}.csv`, wallets.map((w) => ({
      owner_code: w.owner_code,
      owner_name: w.owner_name,
      owner_type: w.owner_type,
      balance: w.balance,
      low_balance_threshold: w.low_balance_threshold,
      status: w.status,
      last_activity_at: w.last_activity_at,
    })));
  };

  return (
    <SectionShell
      title={meta.title}
      description={meta.description}
      icon={WalletIcon}
      actions={
        <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
          <Download className="h-4 w-4" /> Export
        </Button>
      }
    >
      <StatGrid>
        <StatCard label="Master Wallet" value={formatCompact(totals.master)} icon={Landmark} loading={allWalletsQ.isLoading} />
        <StatCard label="Franchise Total" value={formatCompact(totals.franchise)} icon={Building2} loading={allWalletsQ.isLoading} />
        <StatCard label="Reseller Total" value={formatCompact(totals.reseller)} icon={Users} loading={allWalletsQ.isLoading} />
        <StatCard label="Low Balance" value={`${totals.lowCount} Alerts`} icon={AlertTriangle} tone="warning" loading={allWalletsQ.isLoading} />
      </StatGrid>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search wallets by name, code, or type..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <PanelCard title={view === "wallet_low_balance" ? "Wallets Below Threshold" : "Wallets"}>
        <QueryState isLoading={isLoading} error={error} isEmpty={wallets.length === 0}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Threshold</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Activity</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wallets.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-mono text-xs">{w.owner_code}</TableCell>
                  <TableCell className="font-medium">{w.owner_name}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{w.owner_type}</TableCell>
                  <TableCell className="font-semibold">{formatCurrency(w.balance)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatCurrency(w.low_balance_threshold)}</TableCell>
                  <TableCell><StatusBadge status={Number(w.balance) <= Number(w.low_balance_threshold) ? "warning" : w.status} /></TableCell>
                  <TableCell className="text-muted-foreground">{relativeTime(w.last_activity_at)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openDialog("topup", w)} title="Top-up">
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openDialog("deduct", w)} title="Deduct">
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleFreezeToggle(w)} title={w.status === "frozen" ? "Unfreeze" : "Freeze"}>
                        <Snowflake className={w.status === "frozen" ? "h-4 w-4 text-info" : "h-4 w-4"} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </QueryState>
      </PanelCard>

      {isTopupOrDeduct ? (
        <PanelCard title="Recent Wallet Entries">
          <QueryState isLoading={txnQ.isLoading} error={txnQ.error} isEmpty={(txnQ.data ?? []).length === 0}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Balance After</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(txnQ.data ?? []).slice(0, 30).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.reference}</TableCell>
                    <TableCell>{t.finance_wallets?.owner_name ?? "—"}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(t.amount)}</TableCell>
                    <TableCell>{formatCurrency(t.balance_after)}</TableCell>
                    <TableCell><StatusBadge status={t.status} /></TableCell>
                    <TableCell className="text-muted-foreground">{relativeTime(t.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </QueryState>
        </PanelCard>
      ) : null}

      {view === "wallet_low_balance" ? (
        <PanelCard title="Low Balance Detail">
          <QueryState isLoading={isLoading} error={error} isEmpty={wallets.length === 0} emptyLabel="No wallets below threshold">
            <div className="space-y-3">
              {wallets.map((w) => (
                <div key={w.id} className="flex items-center justify-between rounded-lg bg-warning/10 p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{w.owner_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Balance: {formatCurrency(w.balance)} | Threshold: {formatCurrency(w.low_balance_threshold)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={Number(w.balance) === 0 ? "critical" : "warning"} />
                    <Button size="sm" className="gap-1" onClick={() => openDialog("topup", w)}>
                      <Plus className="h-3 w-3" /> Top-up
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </QueryState>
        </PanelCard>
      ) : null}

      <Dialog open={!!dialog} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.mode === "topup" ? "Wallet Top-up" : "Wallet Deduction"}</DialogTitle>
          </DialogHeader>
          {dialog ? (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                {dialog.wallet.owner_name} — Current balance: {formatCurrency(dialog.wallet.balance)}
              </p>
              <div className="space-y-1.5">
                <Label>Amount</Label>
                <Input type="number" placeholder="Enter amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Reason</Label>
                <Textarea placeholder="Reason for this adjustment" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              variant={dialog?.mode === "deduct" ? "destructive" : "default"}
              onClick={confirmAdjust}
              disabled={!amount || Number(amount) <= 0 || adjustWallet.isPending}
            >
              Confirm {dialog?.mode === "topup" ? "Top-up" : "Deduction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionShell>
  );
}
