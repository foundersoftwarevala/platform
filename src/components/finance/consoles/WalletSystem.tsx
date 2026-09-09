import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Lock, RefreshCcw, Unlock, Wallet as WalletIcon } from "lucide-react";

import { walletsQuery, walletTransactionsQuery } from "@/lib/finance/queries";
import { useAdjustWallet, useToggleWalletFreeze } from "@/lib/finance/mutations";
import type { Wallet } from "@/lib/finance/types";
import { PanelCard, QueryState, SectionShell, StatCard, StatGrid, StatusBadge } from "@/components/finance/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, relativeTime } from "@/lib/finance/format";

function AdjustDialog({ wallet }: { wallet: Wallet }) {
  const adjustWallet = useAdjustWallet();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [entryType, setEntryType] = useState<"credit" | "debit">("credit");
  const [reason, setReason] = useState("");

  const submit = () => {
    if (amount <= 0 || !reason.trim()) return;
    adjustWallet.mutate(
      { walletId: wallet.id, amount, entryType, reason: reason.trim(), actor: "finance_manager" },
      { onSuccess: () => { setOpen(false); setAmount(0); setReason(""); } },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 gap-1">
          <RefreshCcw className="h-3.5 w-3.5" /> Adjust
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust {wallet.owner_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Entry Type</Label>
            <Select value={entryType} onValueChange={(v) => setEntryType(v as "credit" | "debit")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="credit">Credit</SelectItem>
                <SelectItem value="debit">Debit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Amount</Label>
            <Input type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for adjustment" />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={adjustWallet.isPending || amount <= 0 || !reason.trim()} onClick={submit}>
            Confirm Adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function WalletSystem() {
  const walletsState = useQuery(walletsQuery());
  const activityState = useQuery(walletTransactionsQuery());
  const toggleFreeze = useToggleWalletFreeze();

  const wallets = walletsState.data ?? [];
  const activity = activityState.data ?? [];

  const stats = useMemo(() => {
    const totalBalance = wallets.reduce((sum, w) => sum + Number(w.balance), 0);
    const active = wallets.filter((w) => w.status === "active").length;
    const frozen = wallets.filter((w) => w.status === "frozen").length;
    const lowBalance = wallets.filter((w) => Number(w.balance) <= Number(w.low_balance_threshold)).length;
    return { totalBalance, active, frozen, lowBalance };
  }, [wallets]);

  return (
    <SectionShell title="Wallet System" description="Role-based wallet management with freeze and manual adjustment controls" icon={WalletIcon}>
      <div className="space-y-6">
        <StatGrid>
          <StatCard label="Total Balance" value={formatCurrency(stats.totalBalance)} icon={WalletIcon} loading={walletsState.isLoading} />
          <StatCard label="Active Wallets" value={stats.active} icon={Unlock} tone="success" loading={walletsState.isLoading} />
          <StatCard label="Frozen Wallets" value={stats.frozen} icon={Lock} tone="danger" loading={walletsState.isLoading} />
          <StatCard label="Low Balance" value={stats.lowBalance} icon={RefreshCcw} tone="warning" loading={walletsState.isLoading} />
        </StatGrid>

        <PanelCard title="Wallets">
          <QueryState isLoading={walletsState.isLoading} error={walletsState.error} isEmpty={wallets.length === 0}>
            <div className="grid gap-4 md:grid-cols-2">
              {wallets.map((wallet) => (
                <div key={wallet.id} className="rounded-xl border border-border/60 bg-muted/30 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{wallet.owner_name}</p>
                      <p className="text-xs capitalize text-muted-foreground">{wallet.owner_type} • {wallet.owner_code} • {wallet.region}</p>
                    </div>
                    <StatusBadge status={wallet.status} />
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Balance</p>
                      <p className="text-xl font-bold text-foreground">{formatCurrency(wallet.balance)}</p>
                      <p className="text-xs text-muted-foreground">Threshold {formatCurrency(wallet.low_balance_threshold)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <AdjustDialog wallet={wallet} />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1"
                        disabled={toggleFreeze.isPending}
                        onClick={() =>
                          toggleFreeze.mutate({ walletId: wallet.id, frozen: wallet.status !== "frozen", actor: "finance_manager" })
                        }
                      >
                        {wallet.status === "frozen" ? (
                          <>
                            <Unlock className="h-3.5 w-3.5" /> Unfreeze
                          </>
                        ) : (
                          <>
                            <Lock className="h-3.5 w-3.5" /> Freeze
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </QueryState>
        </PanelCard>

        <Tabs defaultValue="activity">
          <TabsList>
            <TabsTrigger value="activity">Wallet Activity</TabsTrigger>
          </TabsList>
          <TabsContent value="activity">
            <PanelCard title="Recent Wallet Transactions">
              <QueryState isLoading={activityState.isLoading} error={activityState.error} isEmpty={activity.length === 0}>
                <div className="space-y-2">
                  {activity.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                      <div className="flex items-center gap-3">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tx.entry_type === "credit" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                          {tx.entry_type === "credit" ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-foreground">{tx.finance_wallets?.owner_name ?? "Unknown wallet"}</p>
                          <p className="text-xs text-muted-foreground">{tx.reference} • {relativeTime(tx.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={tx.status} />
                        <span className={`text-sm font-semibold ${tx.entry_type === "credit" ? "text-success" : "text-destructive"}`}>
                          {tx.entry_type === "credit" ? "+" : "-"}
                          {formatCurrency(tx.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </QueryState>
            </PanelCard>
          </TabsContent>
        </Tabs>
      </div>
    </SectionShell>
  );
}
