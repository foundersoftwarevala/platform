import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Banknote, Copy, Download, Info, Link2, RefreshCw, Search, Timer,
} from "lucide-react";

import { Card, EmptyHint, PageHeader, StatCard } from "../ui";
import {
  createResellerCode, createResellerPayout, getResellerDetail, getResellers,
  releaseResellerEarnings, setResellerPayoutStatus, setResellerPlan,
  setResellerSchedule, setResellerStatus,
  type PlanCode, type ResellerOverview, type ResellerRow, type ResellerStatus,
} from "@/lib/marketplace-manager/resellers.functions";

/**
 * Resellers — the screen that already existed, now connected.
 *
 * It was a ModulePage: feature names over four stat cards with no values.
 * Behind it sat a real reseller system nobody could see — three resellers, and
 * three plans carrying the actual commercial terms (Starter 20%, Professional
 * 30%, Master 40%), which is why no percentage is written into this code.
 *
 * The gap was that a reseller could not be tracked or paid at all. The
 * canonical referral tables carried an affiliate and an influencer column and
 * nothing for a reseller, so a reseller's link tracked a visit for nobody, and
 * there was no commission or payout machinery behind them. Rather than a second
 * tracker, resellers now travel the same attribution path the affiliate and
 * influencer consoles use, and earn through their own ledger so no event is
 * settled twice.
 *
 * Two things this screen deliberately does not show. finance_commissions and
 * finance_payouts look like reseller money and are not: eighty identical rows
 * for one invented partner, and seventy payouts to a single name matching no
 * reseller in the database. They are seeded demo data, left untouched and read
 * by nothing here. And every reseller currently in the system is a test
 * fixture, which the numbers reflect honestly rather than dressing up.
 */

const money = (v: unknown, c = "USD") =>
  typeof v === "number" || typeof v === "string"
    ? `${c === "USD" ? "$" : ""}${Number(v).toLocaleString(undefined, {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      })}`
    : "—";

const when = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString() : "—";

const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-500",
  pending: "bg-amber-500/10 text-amber-500",
  paused: "bg-amber-500/10 text-amber-500",
  suspended: "bg-rose-500/10 text-rose-500",
  rejected: "bg-rose-500/10 text-rose-500",
  terminated: "bg-muted text-muted-foreground",
};

const PAYOUT_TONE: Record<string, string> = {
  paid: "text-emerald-500",
  failed: "text-rose-500",
  reversed: "text-rose-500",
  cancelled: "text-muted-foreground",
};

function exportCsv(rows: ResellerRow[]) {
  const head = [
    "id", "name", "code", "email", "region", "status", "plan_code",
    "clicks", "conversions", "sales", "revenue", "commission", "available",
    "paid_out", "created_at",
  ];
  const body = rows.map((r) =>
    head
      .map((k) => {
        const v = (r as unknown as Record<string, unknown>)[k];
        const s = v === null || v === undefined ? "" : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      })
      .join(","),
  );
  const blob = new Blob([[head.join(","), ...body].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `resellers-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* --------------------------------------------------------------- profile */

function ResellerProfile({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const [note, setNote] = useState<string | null>(null);
  const [reference, setReference] = useState<Record<string, string>>({});

  const q = useQuery({
    queryKey: ["marketplace", "reseller", id],
    queryFn: () => getResellerDetail({ data: { id } }),
    staleTime: 10_000,
  });

  const d = q.data as {
    reseller?: Record<string, string | null>;
    plan?: Record<string, unknown> | null;
    schedule?: Record<string, unknown>;
    codes?: Record<string, unknown>[];
    commissions?: Record<string, unknown>[];
    payouts?: Record<string, unknown>[];
    ledger?: Record<string, unknown>[];
    audit?: Record<string, unknown>[];
  } | undefined;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["marketplace", "reseller", id] });
    void qc.invalidateQueries({ queryKey: ["marketplace", "resellers"] });
  };
  const settled = (res: { ok: boolean; reason?: string; message?: string }) => {
    setNote(res.ok ? null : res.message ?? `That did not work (${res.reason ?? "unknown"})`);
    refresh();
  };

  const release = useMutation({
    mutationFn: () => releaseResellerEarnings({ data: { id } }),
    onSuccess: settled,
    onError: (e: Error) => setNote(e.message),
  });
  const payout = useMutation({
    mutationFn: () => createResellerPayout({ data: { id } }),
    onSuccess: settled,
    onError: (e: Error) => setNote(e.message),
  });
  const payoutStatus = useMutation({
    mutationFn: (v: {
      payoutId: string;
      status: "approved" | "processing" | "paid" | "failed" | "reversed" | "cancelled";
      reference?: string;
      reason?: string;
    }) =>
      setResellerPayoutStatus({
        data: { id: v.payoutId, status: v.status, reference: v.reference, reason: v.reason },
      }),
    onSuccess: settled,
    onError: (e: Error) => setNote(e.message),
  });
  const mintCode = useMutation({
    mutationFn: () => createResellerCode({ data: { id } }),
    onSuccess: settled,
    onError: (e: Error) => setNote(e.message),
  });

  const r = d?.reseller;
  const totals = useMemo(() => {
    const list = d?.commissions ?? [];
    const sum = (f: (c: Record<string, unknown>) => boolean) =>
      list.filter(f).reduce((s, c) => s + Number(c.commission ?? 0), 0);
    return {
      pending: sum((c) => c.status === "pending"),
      available: sum((c) => c.status === "available" && !c.payout_id),
      paid: sum((c) => c.status === "paid"),
      reversed: sum((c) => c.status === "reversed"),
      revenue: list
        .filter((c) => c.status !== "reversed")
        .reduce((s, c) => s + Number(c.gross ?? 0), 0),
    };
  }, [d?.commissions]);

  return (
    <div className="px-4 py-8 md:px-8">
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to the registry
      </button>

      {q.isLoading ? (
        <EmptyHint text="Loading…" />
      ) : !r ? (
        <EmptyHint text="That reseller could not be loaded." />
      ) : (
        <>
          <PageHeader
            eyebrow={
              d?.plan
                ? `${String(d.plan.name)} · ${String(d.plan.profit_percent)}% margin`
                : "No plan assigned — no margin can be resolved"
            }
            title={String(r.name)}
            description={`${r.code} · ${r.email} · ${r.status} · KYC ${r.kyc_status} · joined ${when(r.created_at)}`}
          />

          {note && (
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
              {note}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Revenue referred" value={money(totals.revenue)} />
            <StatCard label="In holding" value={money(totals.pending)} tone="warning" />
            <StatCard label="Released & payable" value={money(totals.available)} tone="success" />
            <StatCard label="Paid" value={money(totals.paid)} />
          </div>

          {/* -------------------------------------------------- referral */}
          <Card className="mt-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <Link2 className="h-4 w-4 text-muted-foreground" /> Referral links
              </h3>
              <button
                onClick={() => mintCode.mutate()}
                disabled={mintCode.isPending}
                className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
              >
                {mintCode.isPending ? "Creating…" : "New referral link"}
              </button>
            </div>
            {(d?.codes?.length ?? 0) === 0 ? (
              <EmptyHint text="No referral link yet. Without one this reseller cannot be credited for anything." />
            ) : (
              <div className="space-y-1">
                {d?.codes?.map((c) => (
                  <div
                    key={String(c.id)}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 px-3 py-1.5"
                  >
                    <code className="flex-1 truncate text-[11px]">{String(c.url)}</code>
                    <span className="text-[11px] text-muted-foreground">
                      {String(c.clicks)} visit(s) · {String(c.conversions)} order(s)
                    </span>
                    <span
                      className={`text-[11px] font-semibold ${
                        c.active ? "text-emerald-500" : "text-muted-foreground"
                      }`}
                    >
                      {c.active ? "active" : "off"}
                    </span>
                    <button
                      onClick={() => navigator.clipboard?.writeText(String(c.url))}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold hover:underline"
                    >
                      <Copy className="h-3 w-3" /> Copy
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* --------------------------------------------------- payouts */}
          <Card className="mt-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <Banknote className="h-4 w-4 text-muted-foreground" /> Payouts
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => release.mutate()}
                  disabled={release.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                >
                  <Timer className="h-3.5 w-3.5" />
                  {release.isPending ? "Releasing…" : "Release held commission"}
                </button>
                <button
                  onClick={() => payout.mutate()}
                  disabled={payout.isPending}
                  className="rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-50"
                >
                  {payout.isPending ? "Preparing…" : "Request a payout"}
                </button>
              </div>
            </div>

            <p className="mb-3 text-[11px] text-muted-foreground">
              Commission is held for {String(d?.schedule?.holding_days ?? 14)} days so a refund
              can still take it back. Nothing is recorded as paid until the provider's
              transaction reference is entered below.
            </p>

            {(d?.payouts?.length ?? 0) === 0 ? (
              <EmptyHint text="No payout has been requested for this reseller yet." />
            ) : (
              <div className="space-y-2">
                {d?.payouts?.map((p) => {
                  const pid = String(p.id);
                  const st = String(p.status);
                  return (
                    <div key={pid} className="rounded-lg border border-border/60 px-3 py-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex-1">
                          <div className="text-sm font-semibold">
                            {money(p.amount, String(p.currency))}{" "}
                            <span
                              className={`text-xs font-medium ${PAYOUT_TONE[st] ?? "text-amber-500"}`}
                            >
                              {st}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {String(p.lines)} sale(s) · requested {when(String(p.requested_at))}
                            {p.provider_reference ? ` · ref ${p.provider_reference}` : ""}
                            {p.failure_reason ? ` · ${p.failure_reason}` : ""}
                          </div>
                        </div>

                        {st === "pending" && (
                          <button
                            onClick={() => payoutStatus.mutate({ payoutId: pid, status: "approved" })}
                            className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
                          >
                            Approve
                          </button>
                        )}
                        {st === "approved" && (
                          <button
                            onClick={() => payoutStatus.mutate({ payoutId: pid, status: "processing" })}
                            className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
                          >
                            Send to provider
                          </button>
                        )}
                        {st === "processing" && (
                          <>
                            <input
                              value={reference[pid] ?? ""}
                              onChange={(ev) =>
                                setReference((x) => ({ ...x, [pid]: ev.target.value }))
                              }
                              placeholder="Provider transaction reference"
                              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
                            />
                            <button
                              onClick={() =>
                                payoutStatus.mutate({
                                  payoutId: pid, status: "paid", reference: reference[pid],
                                })
                              }
                              className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                            >
                              Confirm paid
                            </button>
                          </>
                        )}
                        {["pending", "approved", "processing"].includes(st) && (
                          <button
                            onClick={() => {
                              const reason = window.prompt("Why did this payout fail?");
                              if (reason && reason.trim())
                                payoutStatus.mutate({ payoutId: pid, status: "failed", reason });
                            }}
                            className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-rose-500 hover:bg-muted"
                          >
                            Mark failed
                          </button>
                        )}
                        {st === "paid" && (
                          <button
                            onClick={() => {
                              const reason = window.prompt(
                                "Why is this payout being reversed? The commission returns to the queue and the ledger keeps a counter-entry.",
                              );
                              if (reason && reason.trim())
                                payoutStatus.mutate({ payoutId: pid, status: "reversed", reason });
                            }}
                            className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-rose-500 hover:bg-muted"
                          >
                            Reverse
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* ------------------------------------------------ commission */}
          <Card className="mt-4">
            <h3 className="mb-2 text-sm font-bold">Commission, and why each line paid what it did</h3>
            {(d?.commissions?.length ?? 0) === 0 ? (
              <EmptyHint text="No sale has been attributed to this reseller yet." />
            ) : (
              <div className="space-y-1">
                {d?.commissions?.map((c) => {
                  const rate = (c.rate ?? {}) as Record<string, unknown>;
                  return (
                    <div
                      key={String(c.id)}
                      className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 px-3 py-1.5 text-xs"
                    >
                      <div className="flex-1 text-muted-foreground">
                        {when(String(c.created_at))}
                      </div>
                      <div>order {money(c.gross, String(c.currency))}</div>
                      <div className="text-muted-foreground">
                        {rate.rate_percent ? `${String(rate.rate_percent)}%` : "—"} from the{" "}
                        {String(rate.source ?? "—")}
                        {rate.scope ? ` (${String(rate.scope)})` : ""}
                      </div>
                      <div className="font-semibold">
                        {money(c.commission, String(c.currency))}
                      </div>
                      <div
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          c.status === "reversed"
                            ? "bg-rose-500/10 text-rose-500"
                            : c.status === "paid"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {String(c.status)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="mt-4">
            <h3 className="mb-2 text-sm font-bold">Audit history</h3>
            {(d?.audit?.length ?? 0) === 0 ? (
              <EmptyHint text="Nothing has been decided about this reseller yet." />
            ) : (
              <div className="space-y-1">
                {d?.audit?.slice(0, 40).map((a, i) => (
                  <div key={i} className="rounded-lg border border-border/60 px-3 py-1.5 text-[11px]">
                    <span className="font-semibold">{String(a.action)}</span>
                    <span className="text-muted-foreground">
                      {" · "}{when(String(a.at))}
                      {a.reason ? ` · ${String(a.reason)}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- registry */

export function ResellerManager() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | ResellerStatus>("");
  const [tab, setTab] = useState<"all" | "active" | "commission" | "payouts">("all");
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["marketplace", "resellers", search, status],
    queryFn: () =>
      getResellers({ data: { search: search || undefined, status: status || undefined } }),
    staleTime: 15_000,
  });

  const d = q.data as ResellerOverview | undefined;
  const refresh = () => qc.invalidateQueries({ queryKey: ["marketplace", "resellers"] });
  const settled = (res: { ok: boolean; reason?: string; message?: string }) => {
    setNote(res.ok ? null : res.message ?? `That did not work (${res.reason ?? "unknown"})`);
    refresh();
  };

  const decide = useMutation({
    mutationFn: (v: { id: string; status: ResellerStatus; reason?: string }) =>
      setResellerStatus({ data: v }),
    onSuccess: settled,
    onError: (e: Error) => setNote(e.message),
  });
  const assignPlan = useMutation({
    mutationFn: (v: { id: string; plan: PlanCode | null }) => setResellerPlan({ data: v }),
    onSuccess: settled,
    onError: (e: Error) => setNote(e.message),
  });
  const schedule = useMutation({
    mutationFn: (v: { reseller_id: string; cadence: "weekly" | "biweekly" | "monthly" }) =>
      setResellerSchedule({ data: v }),
    onSuccess: settled,
    onError: (e: Error) => setNote(e.message),
  });
  const mint = useMutation({
    mutationFn: (v: { id: string }) => createResellerCode({ data: v }),
    onSuccess: settled,
    onError: (e: Error) => setNote(e.message),
  });

  const rows = useMemo(() => {
    const all = d?.resellers ?? [];
    if (tab === "active") return all.filter((r) => r.status === "active");
    if (tab === "payouts") return all.filter((r) => r.available > 0 || r.paid_out > 0);
    return all;
  }, [d?.resellers, tab]);

  if (open) return <ResellerProfile id={open} onBack={() => setOpen(null)} />;

  if (q.isError) {
    return (
      <div className="px-4 py-8 md:px-8">
        <PageHeader eyebrow="Reseller Network" title="Resellers" />
        <EmptyHint text={(q.error as Error).message} />
      </div>
    );
  }

  if (d && d.ok === false) {
    return (
      <div className="px-4 py-8 md:px-8">
        <PageHeader eyebrow="Reseller Network" title="Resellers" />
        <EmptyHint text="This console is for finance and marketplace operators. Sign in with an operator account." />
      </div>
    );
  }

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Reseller Network"
        title="Resellers"
        description="Reseller programs, commission, referral tracking and performance."
      />

      {note && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
          {note}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Resellers" value={String(d?.total ?? "—")} />
        <StatCard label="Active" value={String(d?.active ?? "—")} tone="success" />
        <StatCard label="Pending" value={String(d?.pending ?? "—")} tone="warning" />
        <StatCard label="Suspended or closed" value={String(d?.suspended ?? "—")} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Referral links" value={String(d?.referral_codes ?? "—")} tone="premium" />
        <StatCard label="Visits tracked" value={String(d?.clicks ?? "—")} />
        <StatCard label="Referred orders" value={String(d?.conversions ?? "—")} />
        <StatCard label="Revenue referred" value={money(d?.revenue)} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Commission earned" value={money(d?.commission_total)} />
        <StatCard label="In holding" value={money(d?.commission_pending)} tone="warning" />
        <StatCard label="Released & payable" value={money(d?.commission_available)} tone="success" />
        <StatCard label="Paid out" value={money(d?.payouts_paid)} />
      </div>

      {/* The plans are the commercial terms, read from the plans table. */}
      <Card className="mt-4">
        <h3 className="mb-2 text-sm font-bold">Reseller plans</h3>
        <p className="mb-3 text-[11px] text-muted-foreground">
          A reseller's margin comes from their plan unless a more specific rule overrides it.
          These are read from the plans table, so no rate is written into the console.
        </p>
        <div className="grid gap-2 md:grid-cols-3">
          {d?.plans?.map((p) => (
            <div key={p.code} className="rounded-lg border border-border/60 px-3 py-2">
              <div className="text-sm font-semibold">{p.name}</div>
              <div className="text-[11px] text-muted-foreground">
                ${p.price_usd} · {p.validity_days} days · {p.profit_percent}% margin
              </div>
              <div className="mt-1 text-[11px]">
                {p.resellers} reseller(s) on this plan · {p.memberships} membership(s) bought
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {([
            { key: "all", label: "All" },
            { key: "active", label: "Active" },
            { key: "commission", label: "Commission" },
            { key: "payouts", label: "Payouts" },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                tab === t.key ? "bg-foreground text-background" : "hover:bg-muted"
              }`}
            >
              {t.label}
            </button>
          ))}

          <div className="relative ml-auto min-w-[180px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, code, business or region"
              className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-xs"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
          >
            <option value="">All statuses</option>
            {["pending", "active", "paused", "suspended", "rejected", "terminated"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={() => void q.refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button
            onClick={() => exportCsv(rows)}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>

        {q.isLoading ? (
          <EmptyHint text="Loading…" />
        ) : rows.length === 0 ? (
          <EmptyHint text="No reseller matches this view. Resellers arrive by applying, and appear here for verification." />
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="rounded-xl border border-border/60 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-3">
                  <button onClick={() => setOpen(r.id)} className="min-w-[170px] flex-1 text-left">
                    <div className="text-sm font-semibold hover:underline">{r.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.code} · {r.email}
                      {r.region ? ` · ${r.region}` : ""}
                      {r.plan ? ` · ${r.plan.name} ${r.plan.profit_percent}%` : " · no plan"}
                    </div>
                  </button>

                  <div className="text-center">
                    <div className="text-sm font-semibold">{r.clicks}</div>
                    <div className="text-[10px] uppercase text-muted-foreground">visits</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-semibold">{r.conversions}</div>
                    <div className="text-[10px] uppercase text-muted-foreground">orders</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-semibold">{money(r.commission)}</div>
                    <div className="text-[10px] uppercase text-muted-foreground">earned</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-semibold">{money(r.available)}</div>
                    <div className="text-[10px] uppercase text-muted-foreground">payable</div>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      STATUS_TONE[r.status] ?? STATUS_TONE.pending
                    }`}
                  >
                    {r.status}
                  </span>

                  {r.status !== "active" ? (
                    <button
                      onClick={() => decide.mutate({ id: r.id, status: "active" })}
                      className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
                    >
                      Approve
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        const reason = window.prompt(
                          "Why is this reseller being suspended? Their referral links stop attributing and this is recorded.",
                        );
                        if (reason && reason.trim())
                          decide.mutate({ id: r.id, status: "suspended", reason });
                      }}
                      className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-rose-500 hover:bg-muted"
                    >
                      Suspend
                    </button>
                  )}
                </div>

                {/* A reseller with no plan earns nothing, so it is said plainly
                    and fixable here. */}
                {!r.plan_code && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5">
                    <span className="text-[11px] text-muted-foreground">
                      No plan, so no margin can be resolved and this reseller earns nothing.
                      Assign one:
                    </span>
                    {d?.plans?.map((p) => (
                      <button
                        key={p.code}
                        onClick={() => assignPlan.mutate({ id: r.id, plan: p.code })}
                        className="rounded border border-border px-1.5 py-0.5 text-[11px] hover:bg-background"
                      >
                        {p.name} {p.profit_percent}%
                      </button>
                    ))}
                  </div>
                )}

                {r.status === "active" && r.referral_codes.length === 0 && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5">
                    <span className="text-[11px] text-muted-foreground">
                      No referral link, so nothing can be attributed to them.
                    </span>
                    <button
                      onClick={() => mint.mutate({ id: r.id })}
                      className="text-[11px] font-semibold hover:underline"
                    >
                      Create one
                    </button>
                  </div>
                )}

                {tab === "commission" && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5">
                    <span className="text-[11px] text-muted-foreground">
                      Margin {r.plan ? `${r.plan.profit_percent}% from ${r.plan.name}` : "unresolved"}
                      {" · "}payout run:
                    </span>
                    {(["weekly", "biweekly", "monthly"] as const).map((c) => (
                      <button
                        key={c}
                        onClick={() => schedule.mutate({ reseller_id: r.id, cadence: c })}
                        className="rounded border border-border px-1.5 py-0.5 text-[11px] hover:bg-background"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {d?.unavailable && (
        <Card className="mt-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
            <Info className="h-4 w-4 text-muted-foreground" /> What is not shown, and why
          </h3>
          <div className="space-y-1">
            {Object.entries(d.unavailable).map(([k, v]) => (
              <div key={k} className="rounded-lg border border-border/60 px-3 py-1.5">
                <div className="text-xs font-semibold capitalize">{k.replace(/_/g, " ")}</div>
                <div className="text-[11px] text-muted-foreground">{v}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export default ResellerManager;
