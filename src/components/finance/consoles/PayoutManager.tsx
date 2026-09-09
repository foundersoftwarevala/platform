import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, Clock, Download, PauseCircle, Search, Send, Wallet2, XCircle } from "lucide-react";

import { payoutsQuery } from "@/lib/finance/queries";
import { useUpdatePayout } from "@/lib/finance/mutations";
import type { Payout } from "@/lib/finance/types";
import { PanelCard, QueryState, SectionShell, StatCard, StatGrid, StatusBadge } from "@/components/finance/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadCsv, formatCurrency, formatDateTime } from "@/lib/finance/format";

const FILTERS: { key: string; label: string; status?: Payout["status"] }[] = [
  { key: "all", label: "All" },
  { key: "requested", label: "Requested", status: "requested" },
  { key: "approved", label: "Approved", status: "approved" },
  { key: "processing", label: "Processing", status: "processing" },
  { key: "on_hold", label: "On Hold", status: "on_hold" },
  { key: "paid", label: "Paid", status: "paid" },
  { key: "rejected", label: "Rejected", status: "rejected" },
];

export default function PayoutManager() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const payoutsState = useQuery(payoutsQuery());
  const updatePayout = useUpdatePayout();

  const rows = payoutsState.data ?? [];

  const filtered = useMemo(() => {
    let list = rows;
    if (filter !== "all") list = list.filter((p) => p.status === filter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) => p.payout_code.toLowerCase().includes(q) || p.recipient_name.toLowerCase().includes(q),
      );
    }
    return list;
  }, [rows, filter, search]);

  const stats = useMemo(() => {
    const sum = (status: string) => rows.filter((p) => p.status === status).reduce((s, p) => s + Number(p.amount), 0);
    const count = (status: string) => rows.filter((p) => p.status === status).length;
    return {
      requested: { value: sum("requested"), count: count("requested") },
      onHold: { value: sum("on_hold"), count: count("on_hold") },
      paid: { value: sum("paid"), count: count("paid") },
      rejected: { value: sum("rejected"), count: count("rejected") },
    };
  }, [rows]);

  const handleExport = () => {
    if (!filtered.length) return;
    downloadCsv("payouts.csv", filtered.map((p) => ({
      payout_code: p.payout_code,
      recipient_name: p.recipient_name,
      recipient_type: p.recipient_type,
      amount: p.amount,
      method: p.method,
      status: p.status,
      requested_at: p.requested_at,
      processed_at: p.processed_at,
    })));
  };

  const act = (id: string, status: Payout["status"]) =>
    updatePayout.mutate({ id, status, actor: "finance_manager" });

  return (
    <SectionShell
      title="Payout Manager"
      description="Approve, reject, hold or process withdrawal and partner payout requests"
      icon={Send}
      actions={
        <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Export
        </Button>
      }
    >
      <div className="space-y-6">
        <StatGrid>
          <StatCard label="Requested" value={formatCurrency(stats.requested.value)} hint={`${stats.requested.count} items`} icon={Clock} tone="warning" loading={payoutsState.isLoading} />
          <StatCard label="On Hold" value={formatCurrency(stats.onHold.value)} hint={`${stats.onHold.count} items`} icon={PauseCircle} tone="warning" loading={payoutsState.isLoading} />
          <StatCard label="Paid" value={formatCurrency(stats.paid.value)} hint={`${stats.paid.count} items`} icon={CheckCircle} tone="success" loading={payoutsState.isLoading} />
          <StatCard label="Rejected" value={formatCurrency(stats.rejected.value)} hint={`${stats.rejected.count} items`} icon={XCircle} tone="danger" loading={payoutsState.isLoading} />
        </StatGrid>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by payout code or recipient..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <Button key={f.key} size="sm" variant={filter === f.key ? "default" : "outline"} onClick={() => setFilter(f.key)}>
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        <PanelCard title="Payout Queue">
          <QueryState isLoading={payoutsState.isLoading} error={payoutsState.error} isEmpty={filtered.length === 0} emptyLabel="No payout requests found">
            <div className="space-y-3">
              {filtered.map((payout) => (
                <div key={payout.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border/60 bg-muted/30 p-4">
                  <div className="flex items-center gap-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                      {payout.recipient_name.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{payout.recipient_name}</p>
                        <span className="rounded border border-border px-1.5 py-0.5 text-[10px] capitalize text-muted-foreground">{payout.recipient_type}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{payout.payout_code} • {payout.method} • {formatDateTime(payout.requested_at)}</p>
                      {payout.reviewer_note ? <p className="text-xs text-destructive">{payout.reviewer_note}</p> : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <p className="text-sm font-semibold text-foreground">{formatCurrency(payout.amount)}</p>
                    <StatusBadge status={payout.status} />
                    <div className="flex items-center gap-1">
                      {(payout.status === "requested" || payout.status === "on_hold") && (
                        <>
                          <Button size="sm" variant="outline" className="h-8 gap-1 text-success" disabled={updatePayout.isPending} onClick={() => act(payout.id, "approved")}>
                            <CheckCircle className="h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 gap-1 text-destructive" disabled={updatePayout.isPending} onClick={() => act(payout.id, "rejected")}>
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </>
                      )}
                      {payout.status === "requested" && (
                        <Button size="sm" variant="outline" className="h-8 gap-1 text-warning" disabled={updatePayout.isPending} onClick={() => act(payout.id, "on_hold")}>
                          <PauseCircle className="h-3.5 w-3.5" /> Hold
                        </Button>
                      )}
                      {payout.status === "approved" && (
                        <Button size="sm" variant="outline" className="h-8 gap-1 text-info" disabled={updatePayout.isPending} onClick={() => act(payout.id, "processing")}>
                          <Wallet2 className="h-3.5 w-3.5" /> Process
                        </Button>
                      )}
                      {payout.status === "processing" && (
                        <Button size="sm" variant="outline" className="h-8 gap-1 text-success" disabled={updatePayout.isPending} onClick={() => act(payout.id, "paid")}>
                          <CheckCircle className="h-3.5 w-3.5" /> Mark Paid
                        </Button>
                      )}
                    </div>
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
