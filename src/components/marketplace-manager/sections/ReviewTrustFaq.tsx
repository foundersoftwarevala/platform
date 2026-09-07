import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check, Download, History, Info, RefreshCw, Search, Send, ShieldCheck,
  Sparkles, Star, X,
} from "lucide-react";

import { Card, EmptyHint, PageHeader, StatCard } from "../ui";
import {
  getFaqs, getReviews, getTrustBadges, moderateReview, replyToReview,
  resolveReport, rollbackFaq, saveFaq, setTrustBadge, transitionFaq,
  getReviewAnalytics,
  type FaqOverview, type FaqRow, type ReviewOverview, type TrustBadge,
} from "@/lib/marketplace-manager/trust.functions";
import {
  generateFaqDrafts, getFaqFacts, type SystemFact,
} from "@/lib/marketplace-manager/faq-ai.functions";

/**
 * Reviews, Trust and FAQ — the three screens that already existed, connected.
 *
 * All three were shells. Reviews rendered six placeholder cards reading "Review
 * content appears here when live data is connected". Trust rendered six titles
 * with a Switch that was permanently on and wired to nothing. FAQ was a
 * complete editor — with a real AI generator behind it — writing to a
 * browser-local store, so an operator could edit the storefront FAQ all day and
 * no visitor would ever see a change.
 *
 * What each one reads now:
 *
 *   Reviews  marketplace_reviews, whose order_item_id is NOT NULL. That single
 *            constraint is what makes every review a verified purchase: there
 *            is no way to record one without the order line behind it, so the
 *            verified badge is a fact about the schema rather than a decoration.
 *            The table is empty today and the screen says so.
 *   Trust    trust_badges for the configuration, and trust_evaluate for whether
 *            a badge is earned. Nothing is stored per product: a badge is worked
 *            out from the canonical data each time it is asked for, so it can
 *            never outlive the fact behind it. A badge that fails its rule
 *            reports why rather than quietly vanishing.
 *   FAQ      the twenty-eight real FAQs, moved verbatim out of the TypeScript
 *            file into the faqs table that the storefront now reads.
 */

const when = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString() : "—";

/* ======================================================== REVIEW MANAGER */

const TABS = ["queue", "latest", "top", "video", "reported", "replies"] as const;
type Tab = (typeof TABS)[number];

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex text-amber-500">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`h-3 w-3 ${i < n ? "fill-current" : "opacity-25"}`} />
      ))}
    </span>
  );
}

const WINDOWS = [
  { days: 7, label: "7D" }, { days: 30, label: "30D" },
  { days: 90, label: "90D" }, { days: 365, label: "1Y" },
] as const;

export function ReviewsManager() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("queue");
  const [days, setDays] = useState<number>(30);
  const [search, setSearch] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const q = useQuery({
    queryKey: ["marketplace", "reviews", tab, search],
    queryFn: () => getReviews({ data: { tab, search: search || undefined } }),
    staleTime: 10_000,
  });
  const d = q.data as ReviewOverview | undefined;

  const analytics = useQuery({
    queryKey: ["marketplace", "reviews", "analytics", days],
    queryFn: () => getReviewAnalytics({ data: { days } }),
    staleTime: 30_000,
  });
  const a = analytics.data;

  const settled = (res: { ok: boolean; reason?: string; message?: string }) => {
    setNote(res.ok ? null : res.message ?? `That did not work (${res.reason ?? "unknown"})`);
    void qc.invalidateQueries({ queryKey: ["marketplace", "reviews"] });
  };

  const moderate = useMutation({
    mutationFn: (v: { id: string; status: "published" | "rejected" | "hidden"; note?: string }) =>
      moderateReview({ data: v }),
    onSuccess: settled,
    onError: (e: Error) => setNote(e.message),
  });
  const reply = useMutation({
    mutationFn: (v: { id: string; content: string }) => replyToReview({ data: v }),
    onSuccess: (r) => { setDraft({}); settled(r); },
    onError: (e: Error) => setNote(e.message),
  });
  const resolve = useMutation({
    mutationFn: (v: { id: string; status: "upheld" | "dismissed"; resolution: string }) =>
      resolveReport({ data: v }),
    onSuccess: settled,
    onError: (e: Error) => setNote(e.message),
  });

  if (d && d.ok === false) {
    return (
      <div className="px-4 py-8 md:px-8">
        <PageHeader eyebrow="Review Manager" title="Reviews & Ratings" />
        <EmptyHint text="This console is for marketplace operators. Sign in with an operator account." />
      </div>
    );
  }

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Review Manager"
        title="Reviews & Ratings"
        description="G2-style moderation, replies and analytics."
      />

      {note && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
          {note}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Reviews" value={String(d?.total ?? "—")} />
        <StatCard label="Awaiting moderation" value={String(d?.pending ?? "—")} tone="warning" />
        <StatCard label="Published" value={String(d?.published ?? "—")} tone="success" />
        <StatCard
          label="Average rating"
          value={d?.average_rating ? String(d.average_rating) : "—"}
          tone="premium"
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Open reports" value={String(d?.reported ?? "—")} tone="destructive" />
        <StatCard label="Replies" value={String(d?.replies ?? "—")} />
        <StatCard
          label="Response rate"
          value={d?.response_rate === null || d?.response_rate === undefined ? "—" : `${d.response_rate}%`}
        />
        <StatCard
          label="Approval rate"
          value={d?.approval_rate === null || d?.approval_rate === undefined ? "—" : `${d.approval_rate}%`}
        />
      </div>

      <Card className="mt-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold">Analytics</h3>
          <div className="ml-auto flex items-center gap-1">
            {WINDOWS.map((w) => (
              <button
                key={w.days}
                onClick={() => setDays(w.days)}
                className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                  days === w.days ? "bg-foreground text-background" : "hover:bg-muted"
                }`}
              >
                {w.label}
              </button>
            ))}
            <input
              type="number"
              min={1}
              max={3650}
              value={days}
              onChange={(e) => setDays(Math.max(1, Math.min(3650, Number(e.target.value) || 1)))}
              className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-[11px]"
              aria-label="Custom window in days"
            />
            <span className="text-[11px] text-muted-foreground">days</span>
          </div>
        </div>

        {/* A rate with nothing behind it reads as a dash, never as 0%. */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Reviews in window" value={String(a?.volume ?? "—")} />
          <StatCard
            label="Average rating"
            value={a?.average_rating ? String(a.average_rating) : "—"}
          />
          <StatCard
            label="Verified purchases"
            value={a?.verified_percent === null || a?.verified_percent === undefined
              ? "—" : `${a.verified_percent}%`}
            tone="success"
          />
          <StatCard
            label="Report rate"
            value={a?.report_rate === null || a?.report_rate === undefined
              ? "—" : `${a.report_rate}%`}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label="Approval rate"
            value={a?.approval_rate === null || a?.approval_rate === undefined
              ? "—" : `${a.approval_rate}%`}
          />
          <StatCard
            label="Rejection rate"
            value={a?.rejection_rate === null || a?.rejection_rate === undefined
              ? "—" : `${a.rejection_rate}%`}
          />
          <StatCard
            label="Response rate"
            value={a?.response_rate === null || a?.response_rate === undefined
              ? "—" : `${a.response_rate}%`}
          />
          <StatCard label="Products reviewed" value={String(a?.by_product?.length ?? "—")} />
        </div>

        {(a?.by_product?.length ?? 0) > 0 && (
          <div className="mt-3 space-y-1">
            {a?.by_product?.slice(0, 8).map((row) => (
              <div
                key={row.product_id}
                className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-1.5 text-xs"
              >
                <span className="flex-1 truncate">{row.product ?? row.product_id}</span>
                <Stars n={Math.round(row.average)} />
                <span className="font-semibold">{row.average}</span>
                <span className="text-muted-foreground">{row.reviews} review(s)</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold capitalize ${
                tab === t ? "bg-foreground text-background" : "hover:bg-muted"
              }`}
            >
              {t}
            </button>
          ))}
          <div className="relative ml-auto min-w-[180px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search titles and content"
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

        {q.isLoading ? (
          <EmptyHint text="Loading…" />
        ) : (d?.reviews?.length ?? 0) === 0 ? (
          <EmptyHint
            text={
              (d?.total ?? 0) === 0
                ? "No customer has left a review yet. A review can only be written against a real order line, so this fills up as orders are paid."
                : "No review matches this tab."
            }
          />
        ) : (
          <div className="space-y-2">
            {d?.reviews?.map((r) => (
              <div key={r.id} className="rounded-xl border border-border/60 px-3 py-2.5">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-[220px] flex-1">
                    <div className="flex items-center gap-2">
                      <Stars n={r.rating} />
                      <span className="text-sm font-semibold">{r.title ?? "Untitled"}</span>
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">
                        verified purchase
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.buyer ?? "customer"} on {r.product_name ?? "a product"} ·{" "}
                      {when(r.created_at)} · {r.status}
                    </div>
                    <p className="mt-1.5 text-sm text-muted-foreground">{r.content}</p>
                    {r.moderation_note && (
                      <p className="mt-1 text-[11px] text-amber-600">
                        Moderator note: {r.moderation_note}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {r.status !== "published" && (
                      <button
                        onClick={() => moderate.mutate({ id: r.id, status: "published" })}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
                      >
                        <Check className="h-3.5 w-3.5" /> Approve
                      </button>
                    )}
                    <button
                      onClick={() => {
                        const why = window.prompt(
                          "Why is this review being rejected? It is recorded and the author is told.",
                        );
                        if (why && why.trim())
                          moderate.mutate({ id: r.id, status: "rejected", note: why });
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-rose-500 hover:bg-muted"
                    >
                      <X className="h-3.5 w-3.5" /> Reject
                    </button>
                    {r.status === "published" && (
                      <button
                        onClick={() => {
                          const why = window.prompt("Why is this review being hidden?");
                          if (why && why.trim())
                            moderate.mutate({ id: r.id, status: "hidden", note: why });
                        }}
                        className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
                      >
                        Hide
                      </button>
                    )}
                  </div>
                </div>

                {r.open_reports.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {r.open_reports.map((rep) => (
                      <div
                        key={rep.id}
                        className="flex flex-wrap items-center gap-2 rounded-lg bg-rose-500/10 px-2.5 py-1.5"
                      >
                        <span className="text-[11px] font-semibold text-rose-500">
                          Reported: {rep.reason}
                        </span>
                        <span className="flex-1 text-[11px] text-muted-foreground">
                          {rep.detail ?? ""}
                        </span>
                        {(["upheld", "dismissed"] as const).map((s) => (
                          <button
                            key={s}
                            onClick={() => {
                              const finding = window.prompt(`Record the finding for "${s}":`);
                              if (finding && finding.trim())
                                resolve.mutate({ id: rep.id, status: s, resolution: finding });
                            }}
                            className="rounded border border-border px-1.5 py-0.5 text-[11px] font-semibold hover:bg-background"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {r.replies.map((rp) => (
                  <div key={rp.id} className="mt-2 rounded-lg bg-muted px-2.5 py-1.5">
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                      {rp.role} reply · {when(rp.created_at)}
                    </div>
                    <div className="text-xs">{rp.content}</div>
                  </div>
                ))}

                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={draft[r.id] ?? ""}
                    onChange={(e) => setDraft((x) => ({ ...x, [r.id]: e.target.value }))}
                    placeholder="Reply as Software Vala…"
                    className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
                  />
                  <button
                    onClick={() => {
                      const c = (draft[r.id] ?? "").trim();
                      if (c) reply.mutate({ id: r.id, content: c });
                    }}
                    disabled={reply.isPending}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" /> Reply
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {d?.verified_note && (
        <Card className="mt-4">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-bold">
            <Info className="h-4 w-4 text-muted-foreground" /> How verified purchase works here
          </h3>
          <p className="text-[11px] text-muted-foreground">{d.verified_note}</p>
        </Card>
      )}
    </div>
  );
}

/* ========================================================= TRUST MANAGER */

export function TrustManager() {
  const qc = useQueryClient();
  const [note, setNote] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["marketplace", "trust"],
    queryFn: () => getTrustBadges(),
    staleTime: 15_000,
  });
  const d = q.data;

  const toggle = useMutation({
    mutationFn: (v: { key: string; enabled: boolean }) => setTrustBadge({ data: v }),
    onSuccess: (res) => {
      setNote(res.ok ? null : `That did not work (${res.reason ?? "unknown"})`);
      void qc.invalidateQueries({ queryKey: ["marketplace", "trust"] });
    },
    onError: (e: Error) => setNote(e.message),
  });

  const sample = d?.sample as { all?: { key: string; label: string; earned: boolean; reason: string | null }[] } | null;
  const byKey = useMemo(() => {
    const m: Record<string, { earned: boolean; reason: string | null }> = {};
    (sample?.all ?? []).forEach((b) => { m[b.key] = { earned: b.earned, reason: b.reason }; });
    return m;
  }, [sample]);

  if (d && d.ok === false) {
    return (
      <div className="px-4 py-8 md:px-8">
        <PageHeader eyebrow="Trust Manager" title="Trust Layer" />
        <EmptyHint text="This console is for marketplace operators. Sign in with an operator account." />
      </div>
    );
  }

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Trust Manager"
        title="Trust Layer"
        description="Badges, counters and verification ribbons that appear sitewide."
      />

      {note && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
          {note}
        </div>
      )}

      <Card className="mb-4">
        <p className="text-[11px] text-muted-foreground">
          A badge is not a stored flag. Each one is a rule, checked against the live data every
          time it is asked for, so a badge can never outlive the fact behind it. Switching one on
          makes it <em>eligible</em> to appear — it still only shows where its rule passes, and
          where it fails the reason is shown below rather than the badge quietly vanishing.
        </p>
      </Card>

      {q.isLoading ? (
        <EmptyHint text="Loading…" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {(d?.badges ?? []).map((b: TrustBadge) => {
            const ev = byKey[b.key];
            return (
              <Card key={b.key}>
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      b.enabled ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold">{b.label}</div>
                    <div className="text-[11px] text-muted-foreground">{b.description}</div>
                  </div>
                  <button
                    role="switch"
                    aria-checked={b.enabled}
                    onClick={() => toggle.mutate({ key: b.key, enabled: !b.enabled })}
                    className={`relative h-5 w-9 shrink-0 rounded-full transition ${
                      b.enabled ? "bg-emerald-500" : "bg-muted-foreground/30"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${
                        b.enabled ? "left-[18px]" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>

                <div className="mt-2 rounded-lg bg-muted px-2.5 py-1.5">
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                    Rule
                  </div>
                  <div className="text-[11px]">{b.rule_summary}</div>
                </div>

                <div className="mt-1.5 text-[11px] text-muted-foreground">
                  Shows on: {b.display_locations.join(", ").replace(/_/g, " ")}
                </div>

                {ev && (
                  <div
                    className={`mt-1.5 text-[11px] ${
                      ev.earned ? "text-emerald-500" : "text-amber-600"
                    }`}
                  >
                    {ev.earned
                      ? "On a live product right now: earned."
                      : `On a live product right now: withheld — ${ev.reason}`}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {(d?.audit?.length ?? 0) > 0 && (
        <Card className="mt-4">
          <h3 className="mb-2 text-sm font-bold">Trust audit</h3>
          <div className="space-y-1">
            {d?.audit?.slice(0, 20).map((a, i) => (
              <div key={i} className="rounded-lg border border-border/60 px-3 py-1.5 text-[11px]">
                <span className="font-semibold">{a.action}</span>
                <span className="text-muted-foreground">
                  {" · "}{a.badge}{" · "}{when(a.at)}
                  {a.reason ? ` · ${a.reason}` : ""}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* =========================================================== FAQ MANAGER */

const FAQ_STATUS: FaqRow["status"][] = [
  "draft", "pending_review", "scheduled", "published", "archived",
];

export function FaqManager() {
  const qc = useQueryClient();
  const [showFacts, setShowFacts] = useState(false);
  const [topic, setTopic] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | FaqRow["status"]>("");
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<{ question: string; answer: string; summary: string }>({
    question: "", answer: "", summary: "",
  });
  const [note, setNote] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["marketplace", "faqs", search, status],
    queryFn: () => getFaqs({ data: { search: search || undefined, status: status || undefined } }),
    staleTime: 10_000,
  });
  const d = q.data as FaqOverview | undefined;

  const settled = (res: { ok: boolean; reason?: string; message?: string }) => {
    setNote(res.ok ? null : res.message ?? `That did not work (${res.reason ?? "unknown"})`);
    void qc.invalidateQueries({ queryKey: ["marketplace", "faqs"] });
  };

  const save = useMutation({
    mutationFn: (v: { id?: string; question: string; answer: string; change_summary?: string }) =>
      saveFaq({ data: v }),
    onSuccess: (res) => { if (res.ok) setEditing(null); settled(res); },
    onError: (e: Error) => setNote(e.message),
  });
  const move = useMutation({
    mutationFn: (v: { id: string; status: FaqRow["status"]; when?: string }) =>
      transitionFaq({ data: v }),
    onSuccess: settled,
    onError: (e: Error) => setNote(e.message),
  });
  const rollback = useMutation({
    mutationFn: (v: { id: string; version: number }) => rollbackFaq({ data: v }),
    onSuccess: settled,
    onError: (e: Error) => setNote(e.message),
  });

  // The facts an FAQ is allowed to state, counted from the live system. Worth
  // reading even when the model is unavailable: it is the list a person writing
  // an answer by hand should be working from.
  const facts = useQuery({
    queryKey: ["marketplace", "faq-facts"],
    queryFn: () => getFaqFacts(),
    staleTime: 60_000,
  });

  const generate = useMutation({
    mutationFn: () => generateFaqDrafts({ data: { topic: topic || undefined, count: 5 } }),
    onSuccess: (res) => {
      if (res.ok) {
        setNote(
          `${res.created ?? 0} draft(s) added. They are flagged as AI-generated and stay that way until a person publishes them.`,
        );
        setTopic("");
        void qc.invalidateQueries({ queryKey: ["marketplace", "faqs"] });
      } else if (res.needsConfiguration) {
        setNote(
          "No AI credential is configured in this environment, so nothing was generated. " +
            "Add one in AI API Manager. The verified facts below are still usable for writing an answer by hand.",
        );
        setShowFacts(true);
      } else {
        setNote(res.error ?? "The generator did not return anything usable.");
      }
    },
    onError: (e: Error) => setNote(e.message),
  });

  const exportCsv = () => {
    const rows = d?.faqs ?? [];
    const head = ["id", "category", "status", "language", "version", "question", "answer"];
    const body = rows.map((r) =>
      head
        .map((k) => {
          const s = String((r as unknown as Record<string, unknown>)[k] ?? "");
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    );
    const blob = new Blob([[head.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `faqs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (d && d.ok === false) {
    return (
      <div className="px-4 py-8 md:px-8">
        <PageHeader eyebrow="FAQ Manager" title="Frequently Asked Questions" />
        <EmptyHint text="This console is for marketplace operators. Sign in with an operator account." />
      </div>
    );
  }

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="FAQ Manager"
        title="Frequently Asked Questions"
        description="Storefront FAQ content — edited here and read straight from the database by the public site."
      />

      {note && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
          {note}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="FAQs" value={String(d?.total ?? "—")} />
        <StatCard label="Published" value={String(d?.published ?? "—")} tone="success" />
        <StatCard label="Drafts" value={String(d?.drafts ?? "—")} tone="warning" />
        <StatCard label="Categories" value={String(d?.categories ?? "—")} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Awaiting review" value={String(d?.pending ?? "—")} />
        <StatCard label="Scheduled" value={String(d?.scheduled ?? "—")} tone="premium" />
        <StatCard label="AI drafts, unapproved" value={String(d?.ai_generated ?? "—")} />
        <StatCard label="Updated this week" value={String(d?.recently_updated ?? "—")} />
      </div>

      <Card className="mt-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setEditing("new"); setForm({ question: "", answer: "", summary: "" }); }}
            className="rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-semibold text-background hover:opacity-90"
          >
            New question
          </button>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic for the generator (optional)"
            className="w-56 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
          />
          <button
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {generate.isPending ? "Generating…" : "Generate with AI"}
          </button>
          <button
            onClick={() => setShowFacts((v) => !v)}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            {showFacts ? "Hide facts" : "System facts"}
          </button>
          <div className="relative ml-auto min-w-[180px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search questions, answers and tags"
              className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-xs"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
          >
            <option value="">All statuses</option>
            {FAQ_STATUS.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
          <button
            onClick={() => void q.refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button
            onClick={exportCsv}
            disabled={(d?.faqs?.length ?? 0) === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>

        {showFacts && (
          <div className="mb-3 rounded-xl border border-border px-3 py-2.5">
            <h4 className="mb-1 text-xs font-bold">
              What an answer may state, counted from the live system
            </h4>
            <p className="mb-2 text-[11px] text-muted-foreground">
              The generator is given only these. It is told not to add prices, delivery
              times, refund terms, guarantees or certifications that are not here, and to
              answer "Source information required." rather than invent one.
            </p>
            <div className="space-y-1">
              {(facts.data?.facts ?? []).map((f: SystemFact) => (
                <div key={f.key} className="rounded-lg bg-muted px-2.5 py-1.5">
                  <div className="text-[11px]">{f.statement}</div>
                  <div className="text-[10px] text-muted-foreground">source: {f.source}</div>
                </div>
              ))}
            </div>
            {(facts.data?.unverifiable?.length ?? 0) > 0 && (
              <>
                <h4 className="mb-1 mt-2 text-xs font-bold">
                  Cannot be verified from this system
                </h4>
                <div className="space-y-1">
                  {facts.data?.unverifiable?.map((u) => (
                    <div
                      key={u.key}
                      className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5"
                    >
                      <div className="text-[11px] font-semibold capitalize">
                        {u.key.replace(/_/g, " ")}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{u.note}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {editing === "new" && (
          <div className="mb-3 rounded-xl border border-border px-3 py-2.5">
            <input
              value={form.question}
              onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
              placeholder="Question"
              className="mb-2 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
            />
            <textarea
              value={form.answer}
              onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
              placeholder="Answer — state only what can be verified from the system."
              rows={4}
              className="mb-2 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => save.mutate({ question: form.question, answer: form.answer })}
                disabled={save.isPending}
                className="rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-semibold text-background disabled:opacity-50"
              >
                Save as draft
              </button>
              <button
                onClick={() => setEditing(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {q.isLoading ? (
          <EmptyHint text="Loading…" />
        ) : (d?.faqs?.length ?? 0) === 0 ? (
          <EmptyHint text="No FAQ matches this view." />
        ) : (
          <div className="space-y-2">
            {d?.faqs?.map((f) => (
              <div key={f.id} className="rounded-xl border border-border/60 px-3 py-2.5">
                {editing === f.id ? (
                  <>
                    <input
                      value={form.question}
                      onChange={(e) => setForm((x) => ({ ...x, question: e.target.value }))}
                      className="mb-2 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                    />
                    <textarea
                      value={form.answer}
                      onChange={(e) => setForm((x) => ({ ...x, answer: e.target.value }))}
                      rows={4}
                      className="mb-2 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                    />
                    <input
                      value={form.summary}
                      onChange={(e) => setForm((x) => ({ ...x, summary: e.target.value }))}
                      placeholder="What changed, and why (kept with the version)"
                      className="mb-2 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          save.mutate({
                            id: f.id, question: form.question, answer: form.answer,
                            change_summary: form.summary || undefined,
                          })
                        }
                        className="rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-semibold text-background"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="min-w-[220px] flex-1">
                        <div className="text-sm font-semibold">{f.question}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {f.category ?? "Uncategorised"} · v{f.version} · {f.language} ·{" "}
                          {f.status.replace(/_/g, " ")}
                          {f.ai_generated ? " · AI draft, not yet approved" : ""}
                          {f.scheduled_for ? ` · publishes ${when(f.scheduled_for)}` : ""}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{f.answer}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          onClick={() => {
                            setEditing(f.id);
                            setForm({ question: f.question, answer: f.answer, summary: "" });
                          }}
                          className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
                        >
                          Edit
                        </button>
                        {f.status !== "published" && (
                          <button
                            onClick={() => move.mutate({ id: f.id, status: "published" })}
                            className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
                          >
                            Publish
                          </button>
                        )}
                        <button
                          onClick={() => {
                            const at = window.prompt(
                              "Publish at (e.g. 2026-10-01T09:00). It goes live on its own once that time passes.",
                            );
                            if (at && at.trim())
                              move.mutate({ id: f.id, status: "scheduled", when: at.trim() });
                          }}
                          className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
                        >
                          Schedule
                        </button>
                        {f.status === "published" && (
                          <button
                            onClick={() => move.mutate({ id: f.id, status: "archived" })}
                            className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-rose-500 hover:bg-muted"
                          >
                            Archive
                          </button>
                        )}
                        {f.versions > 0 && (
                          <button
                            onClick={() => {
                              const v = window.prompt(
                                `Roll back to which version? This FAQ has ${f.versions} kept. The current text is saved first, so this is undoable.`,
                              );
                              const n = Number(v);
                              if (Number.isInteger(n) && n > 0)
                                rollback.mutate({ id: f.id, version: n });
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
                          >
                            <History className="h-3.5 w-3.5" /> {f.versions}
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
