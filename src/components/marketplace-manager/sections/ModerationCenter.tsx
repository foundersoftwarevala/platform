import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, ArrowLeft, Ban, Check, Copy, GitMerge, RefreshCw, Search,
  ShieldAlert, ShieldCheck, Trash2, X,
} from "lucide-react";

import { Card, EmptyHint, PageHeader, StatCard } from "../ui";
import {
  bulkProducts, cloneProduct, decideDuplicate, executePurge, getModeration,
  getProductModerationDetail, mergeProducts, moderateProduct, requestPurge,
  runCatalogAudit, runDuplicateScan, setModerationPolicy, transitionReport,
  type DuplicatePair, type ModerationProduct, type ModerationStatus,
  type ModerationView, type ProductReport,
} from "@/lib/marketplace-manager/moderation.functions";

/**
 * Product Moderation Center — the screen that already existed, now connected.
 *
 * It showed "14 awaiting", "6 duplicates", "9 reported" and "1,284 clean", and
 * none of those numbers came from anywhere. Behind it there was no moderation
 * record at all.
 *
 * Everything here operates on the canonical catalogue. Three things are refused
 * by the database rather than hidden by this screen:
 *
 *   publication  while any mandatory check on the product is failing
 *   a decision   carrying a lock version another reviewer has already moved past
 *   a purge      that would remove a row an order, licence, review or merge
 *                record still depends on — the listing is emptied instead
 *
 * The duplicate scan is real trigram similarity over the catalogue and reports
 * the evidence behind every match. It proposes and never merges: a merge needs
 * a person to name the canonical product and say why.
 */

const TABS = [
  { key: "queue", label: "Queue" },
  { key: "duplicates", label: "Duplicates" },
  { key: "reports", label: "Reports" },
  { key: "archived", label: "Archived" },
  { key: "deleted", label: "Soft Deleted" },
  { key: "trash", label: "Trash" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const STATUS_TONE: Record<string, string> = {
  approved: "bg-emerald-500/10 text-emerald-500",
  submitted: "bg-amber-500/10 text-amber-500",
  under_review: "bg-sky-500/10 text-sky-500",
  changes_requested: "bg-amber-500/10 text-amber-500",
  rejected: "bg-rose-500/10 text-rose-500",
  suspended: "bg-rose-500/10 text-rose-500",
  archived: "bg-muted text-muted-foreground",
  soft_deleted: "bg-rose-500/10 text-rose-500",
  trash: "bg-rose-500/20 text-rose-500",
  draft: "bg-muted text-muted-foreground",
};

const label = (s: string) => s.replace(/_/g, " ");
const when = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString() : "—";

/* --------------------------------------------------------- review packet */

function ProductPacket({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const [note, setNote] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["marketplace", "moderation", "product", id],
    queryFn: () => getProductModerationDetail({ data: { id } }),
    staleTime: 5_000,
  });

  const d = q.data as {
    product?: Record<string, unknown>;
    checks?: { checks?: { key: string; label: string; mandatory: boolean; passed: boolean; detail: string }[]; mandatory_failed?: number; blocking?: boolean };
    owner?: Record<string, unknown> | null;
    category?: { name?: string } | null;
    reviews?: { published: number; total: number; rating: number };
    commerce?: { order_items: number; licenses: number };
    versions?: { version: string; status: string }[];
    reports?: ProductReport[];
    duplicates?: { id: string; match: number; status: string; other: string }[];
    legal?: { ref: string; type: string; severity: string; status: string }[];
    history?: { action: string; at: string; reason: string | null }[];
  } | undefined;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["marketplace", "moderation"] });
  };
  const settled = (res: { ok: boolean; reason?: string; message?: string }) => {
    setNote(res.ok ? null : res.message ?? `That did not work (${res.reason ?? "unknown"})`);
    refresh();
  };

  const p = d?.product as (Record<string, unknown> & { moderation_lock?: number }) | undefined;

  const move = useMutation({
    mutationFn: (v: { status: ModerationStatus; reason?: string }) =>
      moderateProduct({
        data: { id, status: v.status, reason: v.reason, lock: p?.moderation_lock as number },
      }),
    onSuccess: settled,
    onError: (e: Error) => setNote(e.message),
  });

  const clone = useMutation({
    mutationFn: () => cloneProduct({ data: { id } }),
    onSuccess: (res) => {
      setNote(res.ok ? res.note ?? "Cloned." : `That did not work (${res.reason})`);
      refresh();
    },
    onError: (e: Error) => setNote(e.message),
  });

  const report = useMutation({
    mutationFn: (v: { id: string; status: "under_review" | "resolved" | "dismissed"; resolution?: string; escalate_legal?: boolean }) =>
      transitionReport({ data: v }),
    onSuccess: settled,
    onError: (e: Error) => setNote(e.message),
  });

  const ask = (status: ModerationStatus, prompt: string) => {
    const reason = window.prompt(prompt);
    if (reason && reason.trim()) move.mutate({ status, reason });
  };

  const blocking = d?.checks?.blocking ?? false;

  return (
    <div className="px-4 py-8 md:px-8">
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to moderation
      </button>

      {q.isLoading ? (
        <EmptyHint text="Loading…" />
      ) : !p ? (
        <EmptyHint text="That product could not be loaded." />
      ) : (
        <>
          <PageHeader
            eyebrow={`Governance · Moderation · ${label(String(p.moderation_status))}`}
            title={String(p.name)}
            description={`${p.slug} · ${d?.category?.name ?? "no category"} · ${
              p.visible ? "publicly visible" : "not public"
            }`}
          />

          {note && (
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
              {note}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard
              label="Mandatory checks failing"
              value={String(d?.checks?.mandatory_failed ?? "—")}
              tone={blocking ? "destructive" : "success"}
            />
            <StatCard label="Open reports" value={String(d?.reports?.filter((r) => !["resolved", "dismissed"].includes(r.status)).length ?? 0)} />
            <StatCard label="Orders / licences" value={`${d?.commerce?.order_items ?? 0} / ${d?.commerce?.licenses ?? 0}`} />
            <StatCard label="Reviews" value={`${d?.reviews?.published ?? 0} of ${d?.reviews?.total ?? 0}`} />
          </div>

          <Card className="mt-4">
            <h3 className="mb-2 text-sm font-bold">Moderation</h3>
            {blocking && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                <div className="text-[11px] text-rose-500">
                  This product cannot be approved or published: {d?.checks?.mandatory_failed} mandatory
                  check(s) are failing, listed below. The database refuses it; this screen is not
                  merely hiding a button.
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => move.mutate({ status: "approved" })}
                disabled={blocking || move.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
              >
                <Check className="h-3.5 w-3.5" /> Approve &amp; publish
              </button>
              <button
                onClick={() => ask("rejected", "Why is this product being rejected?")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-rose-500 hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" /> Reject
              </button>
              <button
                onClick={() => ask("suspended", "Why is this product being suspended? It comes off the storefront immediately.")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
              >
                <Ban className="h-3.5 w-3.5" /> Suspend
              </button>
              <button
                onClick={() => move.mutate({ status: "archived" })}
                className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
              >
                Archive
              </button>
              <button
                onClick={() => clone.mutate()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
              >
                <Copy className="h-3.5 w-3.5" /> Clone
              </button>
              <button
                onClick={() => ask("soft_deleted", "Why is this listing being removed? It stays recoverable and keeps its orders and licences.")}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-rose-500 hover:bg-muted"
              >
                <Trash2 className="h-3.5 w-3.5" /> Soft delete
              </button>
            </div>
          </Card>

          <Card className="mt-4">
            <h3 className="mb-2 text-sm font-bold">Publication checks</h3>
            <div className="space-y-1">
              {d?.checks?.checks?.map((c) => (
                <div key={c.key} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 px-3 py-1.5">
                  <span
                    className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      c.passed ? "bg-emerald-500/15 text-emerald-500"
                        : c.mandatory ? "bg-rose-500/15 text-rose-500"
                          : "bg-amber-500/15 text-amber-500"
                    }`}
                  >
                    {c.passed ? "✓" : "!"}
                  </span>
                  <span className="text-xs font-semibold">{c.label}</span>
                  {c.mandatory && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                      mandatory
                    </span>
                  )}
                  <span className="flex-1 text-right text-[11px] text-muted-foreground">{c.detail}</span>
                </div>
              ))}
            </div>
          </Card>

          {(d?.reports?.length ?? 0) > 0 && (
            <Card className="mt-4">
              <h3 className="mb-2 text-sm font-bold">Reports</h3>
              <div className="space-y-1">
                {d?.reports?.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 px-3 py-1.5">
                    <span className="text-xs font-semibold">{r.report_no}</span>
                    <span className="text-[11px]">{label(r.reason)}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      ["high", "critical"].includes(r.severity)
                        ? "bg-rose-500/10 text-rose-500" : "bg-muted text-muted-foreground"
                    }`}>
                      {r.severity}
                    </span>
                    <span className="flex-1 text-[11px] text-muted-foreground">{r.detail}</span>
                    <span className="text-[11px] text-muted-foreground">{label(r.status)}</span>
                    {r.status === "reported" && (
                      <button
                        onClick={() => report.mutate({ id: r.id, status: "under_review" })}
                        className="rounded border border-border px-1.5 py-0.5 text-[11px] hover:bg-muted"
                      >
                        Investigate
                      </button>
                    )}
                    {["under_review", "action_required"].includes(r.status) && (
                      <>
                        <button
                          onClick={() => {
                            const f = window.prompt("Record the finding:");
                            if (f && f.trim())
                              report.mutate({ id: r.id, status: "resolved", resolution: f });
                          }}
                          className="rounded border border-border px-1.5 py-0.5 text-[11px] hover:bg-muted"
                        >
                          Resolve
                        </button>
                        <button
                          onClick={() => {
                            const f = window.prompt("Record the finding, and raise it with Legal Manager:");
                            if (f && f.trim())
                              report.mutate({ id: r.id, status: "resolved", resolution: f, escalate_legal: true });
                          }}
                          className="rounded border border-border px-1.5 py-0.5 text-[11px] hover:bg-muted"
                        >
                          Escalate to Legal
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="mt-4">
            <h3 className="mb-2 text-sm font-bold">Moderation history</h3>
            {(d?.history?.length ?? 0) === 0 ? (
              <EmptyHint text="Nothing has been decided about this product yet." />
            ) : (
              <div className="space-y-1">
                {d?.history?.slice(0, 30).map((h, i) => (
                  <div key={i} className="rounded-lg border border-border/60 px-3 py-1.5 text-[11px]">
                    <span className="font-semibold">{label(h.action)}</span>
                    <span className="text-muted-foreground">
                      {" · "}{when(h.at)}{h.reason ? ` · ${h.reason}` : ""}
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

/* ---------------------------------------------------------- the centre */

export function ModerationCenter() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("queue");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [audit, setAudit] = useState<Awaited<ReturnType<typeof runCatalogAudit>> | null>(null);

  const q = useQuery({
    queryKey: ["marketplace", "moderation", tab, search],
    queryFn: () => getModeration({ data: { tab, search: search || undefined } }),
    refetchInterval: 30_000,
    staleTime: 5_000,
  });
  const d = q.data as ModerationView | undefined;

  const settled = (res: { ok: boolean; reason?: string; message?: string }) => {
    setNote(res.ok ? null : res.message ?? `That did not work (${res.reason ?? "unknown"})`);
    void qc.invalidateQueries({ queryKey: ["marketplace", "moderation"] });
  };

  const scan = useMutation({
    mutationFn: () => runDuplicateScan({ data: { threshold: 60 } }),
    onSuccess: (res) => {
      setNote(res.ok
        ? `${res.matches} pair(s) at or above ${res.threshold}%. ${res.open} awaiting a decision. ${res.note ?? ""}`
        : `That did not work (${res.reason})`);
      void qc.invalidateQueries({ queryKey: ["marketplace", "moderation"] });
    },
    onError: (e: Error) => setNote(e.message),
  });

  const fullAudit = useMutation({
    mutationFn: () => runCatalogAudit({ data: { limit: 5 } }),
    onSuccess: (res) => {
      if (res.ok) { setAudit(res); setNote(null); }
      else setNote(`That did not work (${res.reason})`);
    },
    onError: (e: Error) => setNote(e.message),
  });

  const bulk = useMutation({
    mutationFn: (v: { op: Parameters<typeof bulkProducts>[0]["data"]["op"]; reason?: string; target?: string }) =>
      bulkProducts({ data: { ids: picked, op: v.op, reason: v.reason, target: v.target } }),
    onSuccess: (res) => {
      if (res.ok) {
        const failed = (res.results ?? []).filter((r) => !r.ok);
        setNote(`${res.applied} applied, ${res.skipped} skipped.` +
          (failed.length ? ` First skip: ${failed[0].message ?? failed[0].reason}` : ""));
        setPicked([]);
      } else setNote(res.message ?? `That did not work (${res.reason})`);
      void qc.invalidateQueries({ queryKey: ["marketplace", "moderation"] });
    },
    onError: (e: Error) => setNote(e.message),
  });

  const merge = useMutation({
    mutationFn: (v: { canonical: string; duplicate: string; reason: string; candidate: string }) =>
      mergeProducts({ data: v }),
    onSuccess: (res) => {
      setNote(res.ok
        ? `Merged. ${res.moved?.order_items ?? 0} order line(s), ${res.moved?.reviews ?? 0} review(s) and ${res.moved?.licenses ?? 0} licence(s) moved. ${res.note ?? ""}`
        : res.message ?? `That did not work (${res.reason})`);
      void qc.invalidateQueries({ queryKey: ["marketplace", "moderation"] });
    },
    onError: (e: Error) => setNote(e.message),
  });

  const notDuplicate = useMutation({
    mutationFn: (v: { id: string; reason?: string }) =>
      decideDuplicate({ data: { id: v.id, decision: "not_duplicate", reason: v.reason } }),
    onSuccess: settled,
    onError: (e: Error) => setNote(e.message),
  });

  const policy = useMutation({
    mutationFn: (v: { recovery_days?: number; dual_approval?: boolean }) =>
      setModerationPolicy({ data: v }),
    onSuccess: settled,
    onError: (e: Error) => setNote(e.message),
  });

  const purge = useMutation({
    mutationFn: (v: { id: string; reason: string }) => requestPurge({ data: v }),
    onSuccess: (res) => {
      setNote(res.ok
        ? res.dual_approval_required
          ? "Purge requested. A different admin has to confirm it before anything is removed."
          : "Purge requested and approved."
        : res.message ?? `That did not work (${res.reason})`);
      void qc.invalidateQueries({ queryKey: ["marketplace", "moderation"] });
    },
    onError: (e: Error) => setNote(e.message),
  });

  const rows = d?.products ?? [];

  if (open) return <ProductPacket id={open} onBack={() => setOpen(null)} />;

  if (d && d.ok === false) {
    return (
      <div className="px-4 py-8 md:px-8">
        <PageHeader eyebrow="Governance · Moderation" title="Product Moderation Center" />
        <EmptyHint text="This console is for marketplace operators. Sign in with an operator account." />
      </div>
    );
  }

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Governance · Moderation"
        title="Product Moderation Center"
        description="Approve, reject, suspend, archive, restore, clone, merge duplicates and run bulk operations across every listing."
        actions={
          <>
            <button
              onClick={() => scan.mutate()}
              disabled={scan.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
            >
              <GitMerge className="h-3.5 w-3.5" />
              {scan.isPending ? "Scanning…" : "Duplicate scan"}
            </button>
            <button
              onClick={() => fullAudit.mutate()}
              disabled={fullAudit.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-50"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {fullAudit.isPending ? "Auditing…" : "Run full audit"}
            </button>
          </>
        }
      />

      {note && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
          {note}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Awaiting moderation" value={String(d?.awaiting ?? "—")} tone="warning" />
        <StatCard label="Duplicate pairs open" value={String(d?.duplicates ?? "—")} tone="destructive" />
        <StatCard label="Reported this week" value={String(d?.reported_this_week ?? "—")} tone="warning" />
        <StatCard label="Clean listings" value={(d?.clean ?? 0).toLocaleString()} tone="success" />
      </div>

      {audit && (
        <Card className="mt-4">
          <h3 className="mb-1 text-sm font-bold">
            Catalogue audit — {audit.scanned?.toLocaleString()} listings inspected
          </h3>
          <p className="mb-2 text-[11px] text-muted-foreground">{audit.note}</p>
          <div className="space-y-1">
            {audit.findings
              ?.filter((f) => f.count > 0)
              .sort((a, b) => b.count - a.count)
              .map((f) => (
                <div key={f.key} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 px-3 py-1.5">
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      f.severity === "critical" ? "bg-rose-500/10 text-rose-500"
                        : f.severity === "high" ? "bg-orange-500/10 text-orange-500"
                          : "bg-amber-500/10 text-amber-500"
                    }`}
                  >
                    {f.severity}
                  </span>
                  <span className="flex-1 text-xs font-semibold">{f.label}</span>
                  <span className="text-xs">{f.count.toLocaleString()}</span>
                </div>
              ))}
            {audit.findings?.every((f) => f.count === 0) && (
              <EmptyHint text="Nothing wrong found in the catalogue." />
            )}
          </div>
        </Card>
      )}

      <Card className="mt-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setPicked([]); }}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                tab === t.key ? "bg-foreground text-background" : "hover:bg-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
          <div className="relative ml-auto min-w-[200px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Product name, slug or ID"
              className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-xs"
            />
          </div>
          <button
            onClick={() => void q.refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {picked.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-muted px-3 py-2">
            <span className="text-[11px] font-semibold">{picked.length} selected</span>
            <span className="text-[11px] text-muted-foreground">
              Each is validated on its own; a failing record is skipped with its reason.
            </span>
            <button onClick={() => bulk.mutate({ op: "publish", reason: "Bulk publish" })}
              className="ml-auto rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-background">
              Publish
            </button>
            <button onClick={() => bulk.mutate({ op: "unpublish", reason: "Bulk unpublish" })}
              className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-background">
              Unpublish
            </button>
            <button onClick={() => bulk.mutate({ op: "approved" })}
              className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-background">
              Approve
            </button>
            <button
              onClick={() => {
                const r = window.prompt("Why are these being rejected?");
                if (r && r.trim()) bulk.mutate({ op: "rejected", reason: r });
              }}
              className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-rose-500 hover:bg-background">
              Reject
            </button>
            <button onClick={() => bulk.mutate({ op: "archived" })}
              className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-background">
              Archive
            </button>
            <button onClick={() => setPicked([])} className="text-[11px] text-muted-foreground hover:text-foreground">
              Clear
            </button>
          </div>
        )}

        {/* ------------------------------------------------- duplicates */}
        {tab === "duplicates" ? (
          (d?.duplicate_pairs?.length ?? 0) === 0 ? (
            <EmptyHint text="No duplicate pair is waiting on a decision. Run a duplicate scan to look for more." />
          ) : (
            <div className="space-y-2">
              {d?.duplicate_pairs?.map((pair: DuplicatePair) => {
                const a = pair.a as Record<string, string | number>;
                const b = pair.b as Record<string, string | number>;
                const doMerge = (canonical: string, duplicate: string) => {
                  const reason = window.prompt(
                    "Why are these the same product? Orders, licences and reviews will move to the one you keep.",
                  );
                  if (reason && reason.trim())
                    merge.mutate({ canonical, duplicate, reason, candidate: pair.id });
                };
                return (
                  <div key={pair.id} className="rounded-xl border border-border/60 px-3 py-2.5">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-500">
                        {pair.match}% match
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        scanned {when(pair.scanned_at)}
                      </span>
                      <button
                        onClick={() => notDuplicate.mutate({ id: pair.id })}
                        className="ml-auto rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-muted"
                      >
                        Not a duplicate
                      </button>
                    </div>

                    <div className="grid gap-2 md:grid-cols-2">
                      {[{ side: a, other: b }, { side: b, other: a }].map((x, i) => (
                        <div key={i} className="rounded-lg border border-border/60 px-3 py-2">
                          <div className="text-xs font-semibold">{String(x.side.name)}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {String(x.side.owner ?? "first-party")} · {label(String(x.side.status))} ·{" "}
                            {String(x.side.price ?? "—")}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {String(x.side.orders)} order line(s) · {String(x.side.reviews)} review(s) ·
                            rating {String(x.side.rating)} · {String(x.side.downloads)} downloads
                          </div>
                          <button
                            onClick={() => doMerge(String(x.side.id), String(x.other.id))}
                            className="mt-1.5 inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[11px] font-semibold hover:bg-muted"
                          >
                            <GitMerge className="h-3 w-3" /> Keep this one, merge the other in
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="mt-2 space-y-0.5">
                      {pair.reasons?.map((r, i) => (
                        <div key={i} className="text-[11px] text-muted-foreground">
                          · {r.evidence}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : tab === "reports" ? (
          (d?.reports?.length ?? 0) === 0 ? (
            <EmptyHint text="No product has been reported." />
          ) : (
            <div className="space-y-1">
              {d?.reports?.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 px-3 py-2">
                  <span className="text-xs font-semibold">{r.report_no}</span>
                  <button onClick={() => setOpen(r.product_id)} className="text-xs hover:underline">
                    {r.product}
                  </button>
                  <span className="text-[11px]">{label(r.reason)}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    ["high", "critical"].includes(r.severity)
                      ? "bg-rose-500/10 text-rose-500" : "bg-muted text-muted-foreground"
                  }`}>
                    {r.severity}
                  </span>
                  <span className="flex-1 text-[11px] text-muted-foreground">{r.detail}</span>
                  <span className="text-[11px]">{label(r.status)}</span>
                  {r.legal_reference && (
                    <span className="text-[11px] text-muted-foreground">{r.legal_reference}</span>
                  )}
                </div>
              ))}
            </div>
          )
        ) : q.isLoading ? (
          <EmptyHint text="Loading…" />
        ) : rows.length === 0 ? (
          <EmptyHint
            text={
              tab === "queue"
                ? "Nothing is awaiting moderation. Every listing in the catalogue is already approved."
                : "Nothing in this view."
            }
          />
        ) : (
          <div className="space-y-2">
            {rows.map((r: ModerationProduct) => (
              <div key={r.id} className="rounded-xl border border-border/60 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="checkbox"
                    checked={picked.includes(r.id)}
                    onChange={(e) =>
                      setPicked((p) => (e.target.checked ? [...p, r.id] : p.filter((x) => x !== r.id)))
                    }
                    aria-label={`Select ${r.name}`}
                    className="h-3.5 w-3.5"
                  />
                  <button onClick={() => setOpen(r.id)} className="min-w-[190px] flex-1 text-left">
                    <div className="text-sm font-semibold hover:underline">{r.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.owner ?? "first-party"} · {r.category ?? "no category"} · updated {when(r.updated_at)}
                      {r.deleted_at ? ` · removed ${when(r.deleted_at)}` : ""}
                      {r.purge_after ? ` · recoverable until ${when(r.purge_after)}` : ""}
                    </div>
                  </button>

                  {r.checks_failing > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-500">
                      <AlertTriangle className="h-3 w-3" /> {r.checks_failing} check(s)
                    </span>
                  )}
                  {r.reports > 0 && (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-500">
                      {r.reports} report(s)
                    </span>
                  )}
                  {r.duplicate_of > 0 && (
                    <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-500">
                      duplicate
                    </span>
                  )}

                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_TONE[r.status] ?? STATUS_TONE.draft}`}>
                    {label(r.status)}
                  </span>

                  {tab === "trash" ? (
                    <button
                      onClick={() => {
                        const reason = window.prompt(
                          "Permanent deletion. Why? Orders, licences, reviews and merge records are always preserved — a listing they depend on is emptied rather than removed.",
                        );
                        if (reason && reason.trim()) purge.mutate({ id: r.id, reason });
                      }}
                      className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-rose-500 hover:bg-muted"
                    >
                      Request permanent delete
                    </button>
                  ) : (
                    <button
                      onClick={() => setOpen(r.id)}
                      className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
                    >
                      Review
                    </button>
                  )}
                </div>
                {r.delete_reason && (
                  <div className="mt-1.5 text-[11px] text-muted-foreground">
                    Removed because: {r.delete_reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* -------------------------------------------------- deletion policy */}
      <Card className="mt-4">
        <h3 className="mb-2 text-sm font-bold">Deletion policy</h3>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            recovery window
            <input
              type="number"
              min={1}
              defaultValue={d?.policy?.recovery_days}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (v && v !== d?.policy?.recovery_days) policy.mutate({ recovery_days: v });
              }}
              className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-xs"
            />
            days
          </label>
          <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={d?.policy?.dual_approval ?? true}
              onChange={(e) => policy.mutate({ dual_approval: e.target.checked })}
              className="h-3.5 w-3.5"
            />
            a permanent deletion needs a second admin
          </label>
          <span className="text-[11px] text-muted-foreground">
            Orders, licences and reviews are always preserved: a listing they depend on is emptied,
            never removed.
          </span>
        </div>
      </Card>

      {/* ------------------------------------------------------- analytics */}
      {d?.analytics && (
        <Card className="mt-4">
          <h3 className="mb-2 text-sm font-bold">Moderation analytics, last 30 days</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatCard label="Approved" value={String(d.analytics.approved_30d ?? 0)} />
            <StatCard label="Rejected" value={String(d.analytics.rejected_30d ?? 0)} />
            <StatCard label="Suspended" value={String(d.analytics.suspended_30d ?? 0)} />
            <StatCard label="Reports open" value={String(d.analytics.reports_open ?? 0)} />
            <StatCard label="Reports resolved" value={String(d.analytics.reports_resolved_30d ?? 0)} />
            <StatCard label="Merges" value={String(d.analytics.merges_30d ?? 0)} />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Counted from the audit log, not from a stored counter.
          </p>
        </Card>
      )}
    </div>
  );
}

export default ModerationCenter;
