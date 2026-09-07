import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Banknote, Download, Info, Percent, RefreshCw, Search, Timer,
} from "lucide-react";

import { Card, EmptyHint, PageHeader, StatCard } from "../ui";
import {
  createPayout, getSellerDetail, getSellers, releaseEarnings, setPayoutSchedule,
  setPayoutStatus, setSellerCommission, setSellerKind, setSellerStatus,
  type SellerKind, type SellerOverview, type SellerRow, type SellerStatus,
} from "@/lib/marketplace-manager/sellers.functions";

/**
 * Authors and Vendors — the two screens that already existed, now connected.
 *
 * Both were ModulePages: six or seven feature names over four stat cards with
 * no values. Behind them sat a complete seller system nobody could see — seven
 * sellers, their products, four commissions splitting real money, a rules
 * engine, a reversal table and a ledger.
 *
 * The two consoles share this component because an author and a vendor are the
 * same record with a different `kind`. Their money stays separate for the
 * reason section 28 gives: each one is its own seller row, so its own
 * commissions, payouts and ledger entries. What differs between the two screens
 * is the roster they show and the commission controls the vendor console adds.
 *
 * A seller nobody has classified yet appears in both, so it cannot fall between
 * them, and can be assigned from either.
 *
 * Two things are worth knowing when reading the numbers here. Every seller in
 * this database today is an end-to-end test fixture — the names say so — and
 * 5,528 of the 5,533 products have no seller at all, because Software Vala owns
 * its own catalogue. Sellers are a real capability with almost nothing real in
 * it yet, and the screen says so rather than dressing up the emptiness.
 */

const money = (v: unknown, currency = "USD") =>
  typeof v === "number" || typeof v === "string"
    ? `${currency === "USD" ? "$" : ""}${Number(v).toLocaleString(undefined, {
        maximumFractionDigits: 2, minimumFractionDigits: 2,
      })}`
    : "—";

const when = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString() : "—";

// The brief's vocabulary against the vocabulary the table actually enforces.
// 'approved' is what both "verified" and "active" mean here; 'deactivated' is
// what it calls terminated. One state, one name, mapped for the reader.
const STATUS_LABEL: Record<SellerStatus, string> = {
  pending: "Pending",
  approved: "Verified & active",
  rejected: "Rejected",
  suspended: "Suspended",
  deactivated: "Terminated",
};

const STATUS_TONE: Record<string, string> = {
  approved: "bg-emerald-500/10 text-emerald-500",
  pending: "bg-amber-500/10 text-amber-500",
  rejected: "bg-rose-500/10 text-rose-500",
  suspended: "bg-rose-500/10 text-rose-500",
  deactivated: "bg-muted text-muted-foreground",
};

const PAYOUT_TONE: Record<string, string> = {
  completed: "text-emerald-500",
  failed: "text-rose-500",
  cancelled: "text-muted-foreground",
};

function csv(rows: SellerRow[], kind: SellerKind) {
  const head = [
    "id", "name", "slug", "status", "kind", "products", "published", "sales",
    "gross", "earned", "available", "paid_out", "commission_rate", "created_at",
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
  a.download = `${kind}s-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* --------------------------------------------------------------- profile */

function SellerProfile({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const [note, setNote] = useState<string | null>(null);
  const [reference, setReference] = useState<Record<string, string>>({});

  const q = useQuery({
    queryKey: ["marketplace", "seller", id],
    queryFn: () => getSellerDetail({ data: { id } }),
    staleTime: 10_000,
  });

  const d = q.data as {
    ok?: boolean;
    seller?: Record<string, string | null>;
    schedule?: Record<string, unknown>;
    products?: Record<string, unknown>[];
    earnings?: Record<string, number>;
    commissions?: Record<string, unknown>[];
    payouts?: Record<string, unknown>[];
    ledger?: Record<string, unknown>[];
    audit?: Record<string, unknown>[];
  } | undefined;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["marketplace", "seller", id] });
    void qc.invalidateQueries({ queryKey: ["marketplace", "sellers"] });
  };

  // Each of these is declared on its own rather than through a helper: calling
  // useMutation from inside a function would put a hook behind a call site.
  const settled = (res: { ok: boolean; reason?: string; message?: string }) => {
    setNote(res.ok ? null : res.message ?? `That did not work (${res.reason ?? "unknown"})`);
    refresh();
  };

  const release = useMutation({
    mutationFn: () => releaseEarnings({ data: { id } }),
    onSuccess: settled,
    onError: (e: Error) => setNote(e.message),
  });

  const payout = useMutation({
    mutationFn: () => createPayout({ data: { id } }),
    onSuccess: settled,
    onError: (e: Error) => setNote(e.message),
  });

  const payoutStatus = useMutation({
    mutationFn: (v: {
      payoutId: string;
      status: "pending" | "approved" | "processing" | "completed" | "failed" | "cancelled";
      reference?: string;
    }) => setPayoutStatus({ data: { id: v.payoutId, status: v.status, reference: v.reference } }),
    onSuccess: settled,
    onError: (e: Error) => setNote(e.message),
  });

  const s = d?.seller;
  const e = d?.earnings ?? {};
  const currency = String(s?.payout_currency ?? "USD");

  return (
    <div className="px-4 py-8 md:px-8">
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to the roster
      </button>

      {q.isLoading ? (
        <EmptyHint text="Loading…" />
      ) : !s ? (
        <EmptyHint text="That seller could not be loaded." />
      ) : (
        <>
          <PageHeader
            eyebrow={String(s.seller_kind ?? "Unclassified seller")}
            title={String(s.display_name ?? "Seller")}
            description={`${s.slug} · ${STATUS_LABEL[(s.status ?? "pending") as SellerStatus]} · joined ${when(s.created_at)}`}
          />

          {note && (
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
              {note}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Gross sales" value={money(e.gross, currency)} />
            <StatCard label="Marketplace share" value={money(e.marketplace_share, currency)} />
            <StatCard label="Seller share" value={money(e.seller_share, currency)} tone="premium" />
            <StatCard label="Refunded back" value={money(e.reversed, currency)} tone="destructive" />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="In holding" value={money(e.pending, currency)} tone="warning" />
            <StatCard label="Released & payable" value={money(e.available, currency)} tone="success" />
            <StatCard label="Already paid" value={money(e.paid, currency)} />
            <StatCard label="Products" value={String(d?.products?.length ?? 0)} />
          </div>

          {/* ---------------------------------------------------- payouts */}
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
                  {release.isPending ? "Releasing…" : "Release held earnings"}
                </button>
                <button
                  onClick={() => payout.mutate()}
                  disabled={payout.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-50"
                >
                  <Banknote className="h-3.5 w-3.5" />
                  {payout.isPending ? "Preparing…" : "Prepare a payout"}
                </button>
              </div>
            </div>

            <p className="mb-3 text-[11px] text-muted-foreground">
              Earnings sit in holding for {String(d?.schedule?.holding_days ?? 14)} days so a
              refund can still take them back. Releasing makes them payable; preparing a
              payout claims them. Nothing is recorded as paid until a provider reference is
              entered below.
            </p>

            {(d?.payouts?.length ?? 0) === 0 ? (
              <EmptyHint text="No payout has been prepared for this seller yet." />
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
                            <span className={`text-xs font-medium ${PAYOUT_TONE[st] ?? "text-amber-500"}`}>
                              {st}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {String(p.lines)} sale(s) · prepared {when(String(p.created_at))}
                            {p.provider_reference ? ` · ref ${p.provider_reference}` : ""}
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
                                setReference((r) => ({ ...r, [pid]: ev.target.value }))
                              }
                              placeholder="Bank or provider reference"
                              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
                            />
                            <button
                              onClick={() =>
                                payoutStatus.mutate({
                                  payoutId: pid, status: "completed",
                                  reference: reference[pid],
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
                            onClick={() => payoutStatus.mutate({ payoutId: pid, status: "failed" })}
                            className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-rose-500 hover:bg-muted"
                          >
                            Mark failed
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* --------------------------------------------------- products */}
          <Card className="mt-4">
            <h3 className="mb-2 text-sm font-bold">Products</h3>
            <p className="mb-3 text-[11px] text-muted-foreground">
              Read from the one product catalogue. Nothing is copied here, so Product
              Manager stays the only place these are edited.
            </p>
            {(d?.products?.length ?? 0) === 0 ? (
              <EmptyHint text="This seller has no products in the catalogue." />
            ) : (
              <div className="space-y-1">
                {d?.products?.map((p) => (
                  <div
                    key={String(p.id)}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 px-3 py-1.5"
                  >
                    <div className="min-w-[160px] flex-1 text-xs font-semibold">
                      {String(p.name)}
                      <span className="ml-2 font-normal text-muted-foreground">
                        {p.version ? `v${p.version}` : ""}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {p.visible ? "published" : "hidden"} · {String(p.moderation_status)}
                    </div>
                    <div className="text-xs">{String(p.sales)} sold</div>
                    <div className="text-xs font-semibold">{money(p.revenue, currency)}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* ------------------------------------------- earnings detail */}
          <Card className="mt-4">
            <h3 className="mb-2 text-sm font-bold">Every sale, and how it was split</h3>
            {(d?.commissions?.length ?? 0) === 0 ? (
              <EmptyHint text="No sale has settled for this seller yet." />
            ) : (
              <div className="space-y-1">
                {d?.commissions?.map((c) => (
                  <div
                    key={String(c.id)}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 px-3 py-1.5 text-xs"
                  >
                    <div className="flex-1 text-muted-foreground">{when(String(c.created_at))}</div>
                    <div>gross {money(c.gross, currency)}</div>
                    <div className="text-muted-foreground">
                      marketplace {money(c.marketplace_share, currency)}
                    </div>
                    <div className="font-semibold">seller {money(c.seller_share, currency)}</div>
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
                ))}
              </div>
            )}
          </Card>

          {/* ------------------------------------------------------ audit */}
          <Card className="mt-4">
            <h3 className="mb-2 text-sm font-bold">Audit history</h3>
            {(d?.audit?.length ?? 0) === 0 ? (
              <EmptyHint text="Nothing has been decided about this seller yet." />
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

/* ---------------------------------------------------------------- roster */

function SellerRoster({ kind }: { kind: SellerKind }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | SellerStatus>("");
  const [tab, setTab] = useState<"all" | "verified" | "commission" | "payouts">("all");
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [rate, setRate] = useState<Record<string, string>>({});

  const q = useQuery({
    queryKey: ["marketplace", "sellers", kind, search, status],
    queryFn: () =>
      getSellers({
        data: { kind, search: search || undefined, status: status || undefined },
      }),
    staleTime: 15_000,
  });

  const d = q.data as SellerOverview | undefined;
  const refresh = () => qc.invalidateQueries({ queryKey: ["marketplace", "sellers"] });

  const decide = useMutation({
    mutationFn: (v: { id: string; status: SellerStatus; reason?: string }) =>
      setSellerStatus({ data: v }),
    onSuccess: (res) => {
      setNote(res.ok ? null : res.message ?? `That did not work (${res.reason})`);
      refresh();
    },
    onError: (e: Error) => setNote(e.message),
  });

  const classify = useMutation({
    mutationFn: (v: { id: string; kind: SellerKind }) => setSellerKind({ data: v }),
    onSuccess: () => refresh(),
    onError: (e: Error) => setNote(e.message),
  });

  const commission = useMutation({
    mutationFn: (v: { id: string; rate: number }) => setSellerCommission({ data: v }),
    onSuccess: (res) => {
      setNote(res.ok ? null : res.message ?? `That did not work (${res.reason})`);
      refresh();
    },
    onError: (e: Error) => setNote(e.message),
  });

  const schedule = useMutation({
    mutationFn: (v: { seller_id: string; cadence: "weekly" | "biweekly" | "monthly" }) =>
      setPayoutSchedule({ data: v }),
    onSuccess: () => refresh(),
    onError: (e: Error) => setNote(e.message),
  });

  const rows = useMemo(() => {
    const all = d?.sellers ?? [];
    if (tab === "verified") return all.filter((r) => r.status === "approved");
    if (tab === "payouts") return all.filter((r) => r.available > 0 || r.paid_out > 0);
    return all;
  }, [d?.sellers, tab]);

  if (open) return <SellerProfile id={open} onBack={() => setOpen(null)} />;

  if (q.isError) {
    return (
      <div className="px-4 py-8 md:px-8">
        <PageHeader eyebrow="" title={kind === "author" ? "Authors" : "Vendors"} />
        <EmptyHint text={(q.error as Error).message} />
      </div>
    );
  }

  if (d && d.ok === false) {
    return (
      <div className="px-4 py-8 md:px-8">
        <PageHeader eyebrow="" title={kind === "author" ? "Authors" : "Vendors"} />
        <EmptyHint text="This console is for finance and marketplace operators. Sign in with an operator account." />
      </div>
    );
  }

  const tabs: { key: typeof tab; label: string }[] =
    kind === "vendor"
      ? [
          { key: "all", label: "All" }, { key: "verified", label: "Verified" },
          { key: "commission", label: "Commission" }, { key: "payouts", label: "Payouts" },
        ]
      : [
          { key: "all", label: "All" }, { key: "verified", label: "Verified" },
          { key: "payouts", label: "Payouts" },
        ];

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow={kind === "author" ? "Author Network" : "Vendor Network"}
        title={kind === "author" ? "Authors" : "Vendors"}
        description={
          kind === "author"
            ? "Author verification, catalog, earnings and payout control."
            : "Vendor onboarding, commission tiers, product catalog and payout schedules."
        }
      />

      {note && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
          {note}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={kind === "author" ? "Authors" : "Vendors"} value={String(d?.total ?? "—")} />
        <StatCard label="Verified" value={String(d?.approved ?? "—")} tone="success" />
        <StatCard label="Awaiting verification" value={String(d?.pending ?? "—")} tone="warning" />
        <StatCard label="Products" value={String(d?.products ?? "—")} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Gross sales" value={money(d?.gross)} />
        <StatCard
          label={kind === "vendor" ? "Marketplace commission" : "Marketplace share"}
          value={money(d?.marketplace_share)}
          tone="premium"
        />
        <StatCard label="In holding" value={money(d?.pending_earnings)} tone="warning" />
        <StatCard label="Released & payable" value={money(d?.available_earnings)} tone="success" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Sales settled" value={String(d?.sales ?? "—")} />
        <StatCard label="Payouts paid" value={money(d?.payouts_paid)} />
        <StatCard label="Payouts pending" value={money(d?.payouts_pending)} tone="warning" />
        <StatCard label="Unclassified sellers" value={String(d?.unclassified ?? "—")} />
      </div>

      <Card className="mt-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {tabs.map((t) => (
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
              placeholder="Search by name or slug"
              className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-xs"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
          >
            <option value="">All statuses</option>
            {(Object.keys(STATUS_LABEL) as SellerStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
          <button
            onClick={() => void q.refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button
            onClick={() => csv(rows, kind)}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>

        {q.isLoading ? (
          <EmptyHint text="Loading…" />
        ) : rows.length === 0 ? (
          <EmptyHint
            text={`No ${kind} matches this view. Sellers arrive by applying, and appear here for verification.`}
          />
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="rounded-xl border border-border/60 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setOpen(r.id)}
                    className="min-w-[170px] flex-1 text-left"
                  >
                    <div className="text-sm font-semibold hover:underline">{r.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.slug} · joined {when(r.created_at)}
                      {r.kind === null ? " · unclassified" : ""}
                    </div>
                  </button>

                  <div className="text-center">
                    <div className="text-sm font-semibold">{r.products}</div>
                    <div className="text-[10px] uppercase text-muted-foreground">products</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-semibold">{r.sales}</div>
                    <div className="text-[10px] uppercase text-muted-foreground">sales</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-semibold">{money(r.earned)}</div>
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
                    {STATUS_LABEL[r.status]}
                  </span>

                  {r.status !== "approved" ? (
                    <button
                      onClick={() => decide.mutate({ id: r.id, status: "approved" })}
                      className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
                    >
                      Verify
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        const reason = window.prompt(
                          "Why is this seller being suspended? Their products come off the storefront and this is recorded.",
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

                {/* An unclassified seller can be assigned from either console. */}
                {r.kind === null && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5">
                    <span className="text-[11px] text-muted-foreground">
                      Nobody has said whether this is an author or a vendor.
                    </span>
                    <button
                      onClick={() => classify.mutate({ id: r.id, kind: "author" })}
                      className="text-[11px] font-semibold hover:underline"
                    >
                      It is an author
                    </button>
                    <button
                      onClick={() => classify.mutate({ id: r.id, kind: "vendor" })}
                      className="text-[11px] font-semibold hover:underline"
                    >
                      It is a vendor
                    </button>
                  </div>
                )}

                {/* Commission and schedule live on the vendor console, which is
                    where the brief puts them. */}
                {kind === "vendor" && tab === "commission" && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5">
                    <Percent className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">
                      Marketplace takes{" "}
                      {r.commission_rate === null ? "the house default" : `${r.commission_rate}%`}
                    </span>
                    <input
                      value={rate[r.id] ?? ""}
                      onChange={(e) => setRate((x) => ({ ...x, [r.id]: e.target.value }))}
                      placeholder="new %"
                      className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-xs"
                    />
                    <button
                      onClick={() => {
                        const v = Number(rate[r.id]);
                        if (Number.isFinite(v)) commission.mutate({ id: r.id, rate: v });
                      }}
                      className="text-[11px] font-semibold hover:underline"
                    >
                      Apply to future sales
                    </button>
                    <span className="ml-auto text-[11px] text-muted-foreground">Payout run:</span>
                    {(["weekly", "biweekly", "monthly"] as const).map((c) => (
                      <button
                        key={c}
                        onClick={() => schedule.mutate({ seller_id: r.id, cadence: c })}
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

      <Card className="mt-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
          <Info className="h-4 w-4 text-muted-foreground" /> What these numbers are
        </h3>
        <div className="space-y-1 text-[11px] text-muted-foreground">
          <p>
            {d?.unassigned_products?.toLocaleString() ?? "—"} products in the catalogue have no
            seller at all. Software Vala owns its own catalogue, so a small seller roster is the
            correct picture rather than a gap.
          </p>
          <p>
            Every commission figure is counted from marketplace_commissions, written by the
            settlement engine when an order is paid and reversed when it is refunded. Nothing on
            this screen is stored as a total.
          </p>
          <p>
            Add, Import, Columns and Sort from the specification are not here: a seller is
            created by applying, and the rest would have been controls that look real without
            doing anything.
          </p>
        </div>
      </Card>
    </div>
  );
}

export function AuthorsManager() {
  return <SellerRoster kind="author" />;
}

export function VendorsManager() {
  return <SellerRoster kind="vendor" />;
}
