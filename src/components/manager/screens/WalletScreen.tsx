import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Download,
  History,
  Lock,
  Plus,
  Unlock,
  Wallet as WalletIcon,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useInsertRecord, useManyRecords, useUpdateRecord, type Row } from "@/lib/manager-queries";
import {
  day,
  downloadRows,
  EmptyState,
  ErrorState,
  GlassCard,
  inr,
  LoadingBlock,
  PageHeader,
  StatCard,
  StatusBadge,
  when,
} from "@/components/manager/primitives";

const QUICK_AMOUNTS = [1000, 5000, 10000, 25000];
const PAGE_SIZE = 10;

function n(row: Row, key: string): number {
  return Number(row[key] ?? 0);
}

export default function WalletScreen({ view }: { view?: string | undefined }) {
  const tab = view && SUBSECTIONS.includes(view) ? view : "wallet-central";
  const [activeTab, setActiveTab] = useState(tab);

  const many = useManyRecords([
    { table: "wallets", orderBy: "created_at", ascending: true, limit: 50 },
    { table: "wallet_transactions", orderBy: "created_at", ascending: false, limit: 500 },
  ]);

  const [selectedWalletId, setSelectedWalletId] = useState<string | undefined>(undefined);

  const wallets = many.data?.[0] ?? [];
  const transactions = many.data?.[1] ?? [];

  const wallet = useMemo(() => {
    if (wallets.length === 0) return undefined;
    return wallets.find((w) => w['id'] === selectedWalletId) ?? wallets[0];
  }, [wallets, selectedWalletId]);

  const walletTx = useMemo(
    () => transactions.filter((t) => !wallet || t['wallet_id'] === wallet['id']),
    [transactions, wallet],
  );

  const holdTotal = useMemo(
    () => walletTx.filter((t) => t['type'] === "hold").reduce((s, t) => s + n(t, "amount"), 0),
    [walletTx],
  );

  const monthSpent = useMemo(() => {
    const now = new Date();
    return walletTx
      .filter((t) => t['type'] === "debit" && new Date(String(t['created_at'])).getMonth() === now.getMonth())
      .reduce((s, t) => s + n(t, "amount"), 0);
  }, [walletTx]);

  const balance = wallet ? n(wallet, "balance") : 0;
  const available = balance - holdTotal;

  const chartData = useMemo(
    () =>
      [...walletTx]
        .sort((a, b) => new Date(String(a['created_at'])).getTime() - new Date(String(b['created_at'])).getTime())
        .map((t) => ({
          date: day(t['created_at'] as string | null),
          balance: n(t, "balance_after"),
        })),
    [walletTx],
  );

  if (many.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Wallet System" description="UPI-based wallet for all API payments" />
        <LoadingBlock rows={6} />
      </div>
    );
  }
  if (many.error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Wallet System" description="UPI-based wallet for all API payments" />
        <ErrorState error={many.error} />
      </div>
    );
  }
  if (wallets.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Wallet System" description="UPI-based wallet for all API payments" />
        <EmptyState message="No wallets configured yet" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wallet System"
        description="UPI-based wallet for all API payments"
        actions={
          wallets.length > 1 ? (
            <Select value={wallet?.['id'] as string} onValueChange={setSelectedWalletId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select wallet" />
              </SelectTrigger>
              <SelectContent>
                {wallets.map((w) => (
                  <SelectItem key={w['id'] as string} value={w['id'] as string}>
                    {String(w['name'])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : undefined
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="wallet-central">Central</TabsTrigger>
          <TabsTrigger value="wallet-balance">Balance Trend</TabsTrigger>
          <TabsTrigger value="wallet-upi">Add Money (UPI)</TabsTrigger>
          <TabsTrigger value="wallet-hold">Hold Amount</TabsTrigger>
          <TabsTrigger value="wallet-lock">Lock / Settings</TabsTrigger>
          <TabsTrigger value="wallet-ledger">Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="wallet-central" className="space-y-6">
          {wallet ? (
            <Card_Alert wallet={wallet} />
          ) : null}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Current Balance" value={inr(balance)} icon={<WalletIcon className="h-4 w-4" />} tone="green" />
            <StatCard label="Hold Amount" value={inr(holdTotal)} icon={<Lock className="h-4 w-4" />} tone="amber" />
            <StatCard label="Available Balance" value={inr(available)} icon={<ArrowDownRight className="h-4 w-4" />} tone="cyan" />
            <StatCard label="This Month Spent" value={inr(monthSpent)} icon={<ArrowUpRight className="h-4 w-4" />} tone="red" />
          </div>
          <GlassCard title="Recent Transactions" icon={<History className="h-4 w-4 text-primary" />}>
            {walletTx.length === 0 ? (
              <EmptyState message="No transactions yet" />
            ) : (
              <div className="space-y-2">
                {walletTx.slice(0, 8).map((t) => (
                  <div
                    key={t['id'] as string}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/20 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={
                          t['type'] === "credit"
                            ? "rounded-lg bg-status-success/15 p-2"
                            : t['type'] === "hold"
                              ? "rounded-lg bg-status-warning/15 p-2"
                              : "rounded-lg bg-status-error/15 p-2"
                        }
                      >
                        {t['type'] === "credit" ? (
                          <ArrowDownRight className="h-4 w-4 text-status-success" />
                        ) : t['type'] === "hold" ? (
                          <Lock className="h-4 w-4 text-status-warning" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4 text-status-error" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{String(t['description'] ?? "—")}</p>
                        <p className="text-xs text-muted-foreground">{when(t['created_at'] as string | null)}</p>
                      </div>
                    </div>
                    <p
                      className={
                        t['type'] === "credit"
                          ? "text-sm font-semibold text-status-success"
                          : t['type'] === "hold"
                            ? "text-sm font-semibold text-status-warning"
                            : "text-sm font-semibold text-status-error"
                      }
                    >
                      {t['type'] === "debit" ? "-" : "+"}
                      {inr(n(t, "amount"))}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </TabsContent>

        <TabsContent value="wallet-balance">
          <GlassCard title="Balance Trend" icon={<WalletIcon className="h-4 w-4 text-primary" />}>
            {chartData.length === 0 ? (
              <EmptyState message="No transaction history to chart" />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="walletBalanceFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <RTooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                    }}
                    formatter={(v: number) => inr(v)}
                  />
                  <Area type="monotone" dataKey="balance" stroke="hsl(var(--chart-1))" fill="url(#walletBalanceFill)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </GlassCard>
        </TabsContent>

        <TabsContent value="wallet-upi">
          <AddMoneyPanel wallet={wallet} />
        </TabsContent>

        <TabsContent value="wallet-hold">
          <HoldPanel wallet={wallet} holdTotal={holdTotal} />
        </TabsContent>

        <TabsContent value="wallet-lock">
          <LockSettingsPanel wallet={wallet} />
        </TabsContent>

        <TabsContent value="wallet-ledger">
          <LedgerPanel rows={walletTx} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const SUBSECTIONS = [
  "wallet-central",
  "wallet-balance",
  "wallet-upi",
  "wallet-ledger",
  "wallet-hold",
  "wallet-lock",
];

function Card_Alert({ wallet }: { wallet: Row }) {
  if (wallet['status'] !== "active") return null;
  const balance = n(wallet, "balance");
  const threshold = n(wallet, "low_balance_threshold");
  if (threshold <= 0 || balance > threshold) return null;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-status-warning/40 bg-status-warning/10 p-4">
      <AlertTriangle className="h-5 w-5 shrink-0 text-status-warning" />
      <div>
        <p className="text-sm font-medium text-status-warning">Low Balance Alert</p>
        <p className="text-xs text-status-warning/80">
          Balance {inr(balance)} is below your threshold of {inr(threshold)}.
          {wallet['auto_topup'] ? ` Auto top-up of ${inr(n(wallet, "auto_topup_amount"))} will be triggered.` : ""}
        </p>
      </div>
    </div>
  );
}

function AddMoneyPanel({ wallet }: { wallet: Row | undefined }) {
  const insert = useInsertRecord("Money added");
  const update = useUpdateRecord("Wallet balance updated");
  const [open, setOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState("");

  const addMoney = (amount: number) => {
    if (!wallet || amount <= 0) return;
    const newBalance = n(wallet, "balance") + amount;
    insert.mutate({
      table: "wallet_transactions",
      values: {
        wallet_id: wallet['id'],
        type: "credit",
        amount,
        balance_after: newBalance,
        description: "UPI Add Money",
        reference: `UPI-${Date.now()}`,
      },
    });
    update.mutate({ table: "wallets", id: wallet['id'] as string, values: { balance: newBalance } });
    setOpen(false);
    setCustomAmount("");
  };

  return (
    <GlassCard title="Add Money via UPI" icon={<Plus className="h-4 w-4 text-primary" />}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {QUICK_AMOUNTS.map((amount) => (
            <Button key={amount} variant="outline" disabled={!wallet} onClick={() => addMoney(amount)}>
              {inr(amount)}
            </Button>
          ))}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" disabled={!wallet}>
              Custom Amount
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Money via UPI</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="custom-amount">Amount (INR)</Label>
              <Input
                id="custom-amount"
                type="number"
                min="1"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>
            <DialogFooter>
              <Button onClick={() => addMoney(Number(customAmount))} disabled={!customAmount || Number(customAmount) <= 0}>
                Add Money
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <p className="text-center text-xs text-muted-foreground">
          Payments via UPI only. No credit/debit cards or auto-debit.
        </p>
      </div>
    </GlassCard>
  );
}

function HoldPanel({ wallet, holdTotal }: { wallet: Row | undefined; holdTotal: number }) {
  const insert = useInsertRecord("Amount held");
  const [amount, setAmount] = useState("");

  const placeHold = () => {
    if (!wallet) return;
    const value = Number(amount);
    if (!value || value <= 0) return;
    insert.mutate({
      table: "wallet_transactions",
      values: {
        wallet_id: wallet['id'],
        type: "hold",
        amount: value,
        balance_after: n(wallet, "balance"),
        description: "Reserved for scheduled tasks",
        reference: `HOLD-${Date.now()}`,
      },
    });
    setAmount("");
  };

  return (
    <GlassCard title="Hold Amount" icon={<Lock className="h-4 w-4 text-status-warning" />}>
      <div className="space-y-4">
        <div className="rounded-lg border border-border/50 bg-secondary/20 p-4">
          <p className="text-xs text-muted-foreground">Currently Held</p>
          <p className="text-2xl font-bold text-status-warning">{inr(holdTotal)}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="number"
            placeholder="Amount to hold"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Button onClick={placeHold} disabled={!wallet || !amount}>
            <Lock className="mr-2 h-4 w-4" />
            Place Hold
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Held amounts reduce available balance without debiting the wallet — useful for reserving funds for
          scheduled or pending tasks.
        </p>
      </div>
    </GlassCard>
  );
}

function LockSettingsPanel({ wallet }: { wallet: Row | undefined }) {
  const update = useUpdateRecord("Wallet updated");
  const [threshold, setThreshold] = useState(wallet ? String(n(wallet, "low_balance_threshold")) : "");
  const [autoTopupAmount, setAutoTopupAmount] = useState(wallet ? String(n(wallet, "auto_topup_amount")) : "");

  if (!wallet) return <EmptyState message="No wallet selected" />;

  const locked = wallet['status'] === "locked";

  const toggleLock = () => {
    update.mutate({ table: "wallets", id: wallet['id'] as string, values: { status: locked ? "active" : "locked" } });
  };

  const toggleAutoTopup = (checked: boolean) => {
    update.mutate({ table: "wallets", id: wallet['id'] as string, values: { auto_topup: checked } });
  };

  const saveThresholds = () => {
    update.mutate({
      table: "wallets",
      id: wallet['id'] as string,
      values: {
        low_balance_threshold: Number(threshold) || 0,
        auto_topup_amount: Number(autoTopupAmount) || 0,
      },
    });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <GlassCard title="Wallet Lock" icon={<Lock className="h-4 w-4 text-status-warning" />}>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/20 p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Wallet Status</p>
              <p className="text-xs text-muted-foreground">Locking disables all wallet debits and top-ups.</p>
            </div>
            <StatusBadge value={wallet['status'] as string} />
          </div>
          <Button
            variant="outline"
            className={locked ? "w-full" : "w-full border-status-warning/40 text-status-warning hover:bg-status-warning/10"}
            onClick={toggleLock}
          >
            {locked ? <Unlock className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
            {locked ? "Unlock Wallet" : "Lock Wallet"}
          </Button>
        </div>
      </GlassCard>

      <GlassCard title="Low Balance & Auto Top-up" icon={<AlertTriangle className="h-4 w-4 text-primary" />}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="threshold">Low Balance Threshold (INR)</Label>
            <Input id="threshold" type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/20 p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Auto Top-up</p>
              <p className="text-xs text-muted-foreground">Automatically add money when balance is low</p>
            </div>
            <Switch checked={Boolean(wallet['auto_topup'])} onCheckedChange={toggleAutoTopup} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="topup-amount">Auto Top-up Amount (INR)</Label>
            <Input
              id="topup-amount"
              type="number"
              value={autoTopupAmount}
              onChange={(e) => setAutoTopupAmount(e.target.value)}
            />
          </div>
          <Button className="w-full" onClick={saveThresholds}>
            Save Settings
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}

function LedgerPanel({ rows }: { rows: Row[] }) {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (typeFilter !== "all" && r['type'] !== typeFilter) return false;
      if (search && !String(r['description'] ?? "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [rows, typeFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <GlassCard
      title="Wallet Ledger"
      icon={<History className="h-4 w-4 text-primary" />}
      actions={
        <Button variant="outline" size="sm" onClick={() => downloadRows("wallet-ledger.csv", filtered)}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      }
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="Search description…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="sm:max-w-xs"
        />
        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="sm:w-40">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="credit">Credit</SelectItem>
            <SelectItem value="debit">Debit</SelectItem>
            <SelectItem value="hold">Hold</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {filtered.length === 0 ? (
        <EmptyState message="No transactions match your filters" />
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance After</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((t) => (
                  <TableRow key={t['id'] as string}>
                    <TableCell className="text-xs text-muted-foreground">{when(t['created_at'] as string | null)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {String(t['type'])}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{String(t['description'] ?? "—")}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{String(t['reference'] ?? "—")}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{inr(n(t, "amount"))}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{inr(n(t, "balance_after"))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {page} of {totalPages} ({filtered.length} transactions)
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </GlassCard>
  );
}
