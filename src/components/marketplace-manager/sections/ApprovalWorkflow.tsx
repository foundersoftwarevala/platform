import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, ArrowLeft, Ban, Check, ClipboardCheck, Clock, Download,
  History, RefreshCw, Search, ShieldAlert, X,
} from "lucide-react";

import { Card, EmptyHint, PageHeader, StatCard } from "../ui";
import {
  addEvidence, bulkTransition, createSubmission, getSubmissionDetail, getSubmissions,
  runSlaSweep, setApprovalRule, setApprovalSla, transitionSubmission,
  type ApprovalRule, type SubmissionQueue, type SubmissionRow, type SubmissionStatus,
  type TrustedAuthor,
} from "@/lib/marketplace-manager/approvals.functions";

/**
 * Author Approval Workflow — the screen that already existed, now connected.
 *
 * It showed ten status counts and five submissions, all invented: authors that
 * do not exist, risk numbers nobody computed, and a queue length that never
 * changed. Behind it there was no submission record at all — only an
 * operator-guarded endpoint that flipped two status columns.
 *
 * What it reads now:
 *
 *   the queue        author_submissions, with the counts computed per status
 *   the risk         mm_submission_risk, which returns the evidence and the
 *                    source table behind every point it adds, and declares
 *                    itself advisory — nothing approves because of it
 *   the checks       mm_submission_checks, reading the product, the seller from
 *                    Author Manager and any unresolved record in Legal Manager
 *   trusted authors  derived from submissions that actually happened, not a
 *                    toggle somebody set
 *
 * Two things this screen cannot do, by design, because the database refuses
 * them rather than the UI hiding them: approve a submission while a mandatory
 * check is failing, and act on a submission another reviewer has changed since
 * it was loaded.
 */

const TABS: { key: "" | SubmissionStatus; label: string }[] = [
  { key: "", label: "All Submissions" },
  { key: "pending_review", label: "Pending" },
  { key: "verifying", label: "Verifying" },
  { key: "changes_requested", label: "Changes Requested" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "suspended", label: "Suspended" },
  { key: "archived", label: "Archived" },
];

const RISK_TONE: Record<string, string> = {
  low: "bg-emerald-500/10 text-emerald-500",
  medium: "bg-amber-500/10 text-amber-500",
  high: "bg-orange-500/10 text-orange-500",
  critical: "bg-rose-500/10 text-rose-500",
};

const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_review: "bg-amber-500/10 text-amber-500",
  verifying: "bg-sky-500/10 text-sky-500",
  changes_requested: "bg-amber-500/10 text-amber-500",
  approved: "bg-emerald-500/10 text-emerald-500",
  rejected: "bg-rose-500/10 text-rose-500",
  suspended: "bg-rose-500/10 text-rose-500",
  archived: "bg-muted text-muted-foreground",
};

const SLA_TONE: Record<string, string> = {
  breached: "text-rose-500",
  overdue: "text-orange-500",
  due_soon: "text-amber-500",
  on_track: "text-muted-foreground",
  "n/a": "text-muted-foreground",
};

const when = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

const label = (s: string) => s.replace(/_/g, " ");

/* ------------------------------------------------------------- the review */

function ReviewPacket({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const [note, setNote] = useState<string | null>(null);
  const [evidence, setEvidence] = useState({ label: "", url: "" });

  const q = useQuery({
    queryKey: ["marketplace", "submission", id],
    queryFn: () => getSubmissionDetail({ data: { id } }),
    staleTime: 5_000,
  });

  const d = q.data as {
    ok?: boolean;
    submission?: SubmissionRow & { lock_version: number; status: SubmissionStatus };
    product?: Record<string, unknown> | null;
    author?: Record<string, unknown> | null;
    checks?: { checks?: { key: string; label: string; mandatory: boolean; passed: boolean; detail: string }[]; mandatory_failed?: number; blocking?: boolean };
    risk?: { score?: number; level?: string; reasons?: { factor: string; weight: number; evidence: string; source: string }[]; advisory?: boolean; note?: string };
    versions?: { id: string; version: string; status: string }[];
    evidence?: { id: string; kind: string; label: string; url: string | null; detail: string | null; created_at: string }[];
    history?: { revision: number; action: string; from: string | null; to: string | null; role: string | null; reason: string | null; at: string }[];
  } | undefined;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["marketplace", "submission", id] });
    void qc.invalidateQueries({ queryKey: ["marketplace", "submissions"] });
  };

  const move = useMutation({
    mutationFn: (v: { status: SubmissionStatus; reason?: string; override?: boolean }) =>
      transitionSubmission({
        data: {
          id, status: v.status, reason: v.reason, override: v.override,
          // The version this screen is holding. The server refuses the call if
          // another reviewer has acted since.
          lock: d?.submission?.lock_version,
        },
      }),
    onSuccess: (res) => {
      if (res.ok) {
        setNote(res.published ? "Approved. The product is now public." : null);
      } else if (res.reason === "stale") {
        setNote(res.message ?? "Submission changed by another reviewer. Refresh before continuing.");
      } else if (res.reason === "checks_failed") {
        setNote(res.message ?? "Approval is blocked while a mandatory check is failing.");
      } else {
        setNote(res.message ?? `That did not work (${res.reason ?? "unknown"})`);
      }
      refresh();
    },
    onError: (e: Error) => setNote(e.message),
  });

  const attach = useMutation({
    mutationFn: () =>
      addEvidence({
        data: {
          submission_id: id, kind: evidence.url ? "url" : "note",
          label: evidence.label, url: evidence.url || undefined,
          detail: evidence.url ? undefined : evidence.label,
        },
      }),
    onSuccess: (res) => {
      setNote(res.ok ? null : res.message ?? `That did not work (${res.reason})`);
      if (res.ok) setEvidence({ label: "", url: "" });
      refresh();
    },
    onError: (e: Error) => setNote(e.message),
  });

  const s = d?.submission;
  const blocking = d?.checks?.blocking ?? false;

  const ask = (status: SubmissionStatus, prompt: string, override = false) => {
    const reason = window.prompt(prompt);
    if (reason && reason.trim()) move.mutate({ status, reason, override });
  };

  return (
    <div className="px-4 py-8 md:px-8">
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to the queue
      </button>

      {q.isLoading ? (
        <EmptyHint text="Loading the review packet…" />
      ) : !s ? (
        <EmptyHint text="That submission could not be loaded." />
      ) : (
        <>
          <PageHeader
            eyebrow={`Governance · ${s.submission_no} · revision ${s.revision}`}
            title={String(d?.product?.name ?? "Submission")}
            description={`${label(s.status)} · ${s.type} · submitted ${when(s.submitted_at)}`}
          />

          {note && (
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
              {note}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Risk score" value={`${d?.risk?.score ?? "—"} / 100`} />
            <StatCard label="Risk level" value={String(d?.risk?.level ?? "—")} />
            <StatCard
              label="Mandatory checks failing"
              value={String(d?.checks?.mandatory_failed ?? "—")}
              tone={blocking ? "destructive" : "success"}
            />
            <StatCard label="History entries" value={String(d?.history?.length ?? 0)} />
          </div>

          {/* ------------------------------------------------- decisions */}
          <Card className="mt-4">
            <h3 className="mb-2 text-sm font-bold">Decision</h3>
            {blocking && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                <div className="text-[11px] text-rose-500">
                  Approval is blocked. {d?.checks?.mandatory_failed} mandatory check(s) are
                  failing, listed below. This is refused by the database, not hidden by this
                  screen — an unapproved product must never become public.
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {s.status === "pending_review" && (
                <button
                  onClick={() => move.mutate({ status: "verifying" })}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
                >
                  <ClipboardCheck className="h-3.5 w-3.5" /> Start verification
                </button>
              )}
              {s.status === "verifying" && (
                <button
                  onClick={() => move.mutate({ status: "approved" })}
                  disabled={blocking || move.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
                >
                  <Check className="h-3.5 w-3.5" /> Approve and publish
                </button>
              )}
              {["pending_review", "verifying", "changes_requested"].includes(s.status) && (
                <>
                  <button
                    onClick={() =>
                      ask("changes_requested", "What has to change before this can be approved?")
                    }
                    className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
                  >
                    Request changes
                  </button>
                  <button
                    onClick={() => ask("rejected", "Why is this submission being rejected?")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-rose-500 hover:bg-muted"
                  >
                    <X className="h-3.5 w-3.5" /> Reject
                  </button>
                </>
              )}
              {s.status === "changes_requested" && (
                <button
                  onClick={() => move.mutate({ status: "pending_review", reason: "Resubmitted after changes." })}
                  className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
                >
                  Resubmit for review
                </button>
              )}
              {s.status === "approved" && (
                <button
                  onClick={() =>
                    ask("suspended", "Why is this product being suspended? It comes off the storefront immediately.")
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-rose-500 hover:bg-muted"
                >
                  <Ban className="h-3.5 w-3.5" /> Suspend
                </button>
              )}
              {s.status !== "archived" && (
                <button
                  onClick={() => move.mutate({ status: "archived" })}
                  className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
                >
                  Archive
                </button>
              )}
              <button
                onClick={() =>
                  ask(
                    window.prompt(
                      "Override to which status? (pending_review, verifying, approved, rejected, suspended, archived)",
                    ) as SubmissionStatus,
                    "This is a boss override outside the normal workflow. Why?",
                    true,
                  )
                }
                className="ml-auto rounded-lg border border-dashed border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted"
              >
                Boss override
              </button>
            </div>
          </Card>

          {/* ---------------------------------------------------- checks */}
          <Card className="mt-4">
            <h3 className="mb-2 text-sm font-bold">Verification checks</h3>
            <div className="space-y-1">
              {d?.checks?.checks?.map((c) => (
                <div
                  key={c.key}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 px-3 py-1.5"
                >
                  <span
                    className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      c.passed
                        ? "bg-emerald-500/15 text-emerald-500"
                        : c.mandatory
                          ? "bg-rose-500/15 text-rose-500"
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
                  <span className="flex-1 text-right text-[11px] text-muted-foreground">
                    {c.detail}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* ------------------------------------------------------ risk */}
          <Card className="mt-4">
            <h3 className="mb-1 text-sm font-bold">Risk assessment</h3>
            <p className="mb-2 text-[11px] text-muted-foreground">{d?.risk?.note}</p>
            {(d?.risk?.reasons?.length ?? 0) === 0 ? (
              <EmptyHint text="Nothing raised a risk signal on this submission." />
            ) : (
              <div className="space-y-1">
                {d?.risk?.reasons?.map((r) => (
                  <div key={r.factor} className="rounded-lg border border-border/60 px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold capitalize">
                        {label(r.factor)}
                      </span>
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                        +{r.weight}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">{r.evidence}</div>
                    <div className="text-[10px] text-muted-foreground">source: {r.source}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* -------------------------------------------------- the author */}
          <Card className="mt-4">
            <h3 className="mb-2 text-sm font-bold">Author, from Author Manager</h3>
            {!d?.author ? (
              <EmptyHint text="No seller is attached — this is a first-party product." />
            ) : (
              <div className="grid gap-2 text-xs md:grid-cols-2">
                <div>Name: {String(d.author.name)}</div>
                <div>Status: {String(d.author.status)}</div>
                <div>Previously approved: {String(d.author.previous_approved)}</div>
                <div>Previously rejected: {String(d.author.previous_rejected)}</div>
                <div>Open legal violations: {String(d.author.open_violations)}</div>
                <div>Approved as a seller: {when(String(d.author.approved_at ?? ""))}</div>
              </div>
            )}
          </Card>

          {/* ---------------------------------------------------- evidence */}
          <Card className="mt-4">
            <h3 className="mb-2 text-sm font-bold">Evidence</h3>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <input
                value={evidence.label}
                onChange={(e) => setEvidence((x) => ({ ...x, label: e.target.value }))}
                placeholder="What you checked"
                className="min-w-[200px] flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
              />
              <input
                value={evidence.url}
                onChange={(e) => setEvidence((x) => ({ ...x, url: e.target.value }))}
                placeholder="Link (optional)"
                className="min-w-[180px] flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
              />
              <button
                onClick={() => attach.mutate()}
                disabled={!evidence.label.trim() || attach.isPending}
                className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
              >
                Attach
              </button>
            </div>
            {(d?.evidence?.length ?? 0) === 0 ? (
              <EmptyHint text="Nothing recorded against this submission yet." />
            ) : (
              <div className="space-y-1">
                {d?.evidence?.map((e) => (
                  <div key={e.id} className="rounded-lg border border-border/60 px-3 py-1.5 text-[11px]">
                    <span className="font-semibold">{e.label}</span>
                    <span className="text-muted-foreground"> · {e.kind} · {when(e.created_at)}</span>
                    {e.url && (
                      <a href={e.url} target="_blank" rel="noreferrer" className="ml-2 underline">
                        open
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* ----------------------------------------------------- history */}
          <Card className="mt-4">
            <h3 className="mb-1 flex items-center gap-2 text-sm font-bold">
              <History className="h-4 w-4 text-muted-foreground" /> Approval history
            </h3>
            <p className="mb-2 text-[11px] text-muted-foreground">
              Append-only. There is no update or delete policy on this table for anyone,
              including operators, so it cannot be rewritten from the application at all.
            </p>
            <div className="space-y-1">
              {d?.history?.map((h, i) => (
                <div key={i} className="rounded-lg border border-border/60 px-3 py-1.5 text-[11px]">
                  <span className="font-semibold">{label(h.action)}</span>
                  <span className="text-muted-foreground">
                    {h.from ? ` · ${label(h.from)} → ${label(h.to ?? "")}` : ""}
                    {" · rev "}{h.revision}
                    {h.role ? ` · ${h.role}` : ""}
                    {" · "}{when(h.at)}
                  </span>
                  {h.reason && <div className="text-muted-foreground">{h.reason}</div>}
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- the queue */

export function ApprovalWorkflow() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"" | SubmissionStatus>("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "risk" | "sla">("newest");
  const [open, setOpen] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["marketplace", "submissions", tab, search, sort],
    queryFn: () =>
      getSubmissions({
        data: { status: tab || undefined, search: search || undefined, sort },
      }),
    // The queue is shared between reviewers, so it is refetched often enough
    // that two people are unlikely to be looking at different worlds. The
    // lock version is what actually prevents a conflicting decision.
    refetchInterval: 20_000,
    staleTime: 5_000,
  });
  const d = q.data as SubmissionQueue | undefined;

  const settled = (res: { ok: boolean; reason?: string; message?: string }) => {
    setNote(res.ok ? null : res.message ?? `That did not work (${res.reason ?? "unknown"})`);
    void qc.invalidateQueries({ queryKey: ["marketplace", "submissions"] });
  };

  const bulk = useMutation({
    mutationFn: (v: { status: SubmissionStatus; reason?: string }) =>
      bulkTransition({ data: { ids: picked, status: v.status, reason: v.reason } }),
    onSuccess: (res) => {
      if (res.ok) {
        const failed = (res.results ?? []).filter((r) => !r.ok);
        setNote(
          `${res.applied} applied, ${res.skipped} skipped.` +
            (failed.length
              ? ` Skipped because: ${[...new Set(failed.map((f) => f.reason))].join(", ")}.`
              : ""),
        );
        setPicked([]);
      } else {
        setNote(`That did not work (${res.reason})`);
      }
      void qc.invalidateQueries({ queryKey: ["marketplace", "submissions"] });
    },
    onError: (e: Error) => setNote(e.message),
  });

  const rule = useMutation({
    mutationFn: (v: { key: string; enabled: boolean }) => setApprovalRule({ data: v }),
    onSuccess: settled,
    onError: (e: Error) => setNote(e.message),
  });

  const sla = useMutation({
    mutationFn: (v: { response_hours?: number; escalate_hours?: number; stale_draft_days?: number }) =>
      setApprovalSla({ data: v }),
    onSuccess: settled,
    onError: (e: Error) => setNote(e.message),
  });

  const sweep = useMutation({
    mutationFn: () => runSlaSweep(),
    onSuccess: (res) => {
      setNote(
        res.ok
          ? `${res.escalated ?? 0} escalated, ${res.due_soon ?? 0} due soon, ${res.stale_drafts ?? 0} stale draft(s). ${res.note ?? ""}`
          : `That did not work (${res.reason})`,
      );
      void qc.invalidateQueries({ queryKey: ["marketplace", "submissions"] });
    },
    onError: (e: Error) => setNote(e.message),
  });

  const rows = d?.submissions ?? [];
  const next = useMemo(
    () => rows.find((r) => r.status === "pending_review") ?? rows.find((r) => r.status === "verifying"),
    [rows],
  );

  const exportCsv = () => {
    const head = [
      "submission_no", "product", "author", "type", "status", "revision",
      "risk_score", "risk_level", "sla_state", "submitted_at", "decided_at",
    ];
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
    a.download = `approvals-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (open) return <ReviewPacket id={open} onBack={() => setOpen(null)} />;

  if (d && d.ok === false) {
    return (
      <div className="px-4 py-8 md:px-8">
        <PageHeader eyebrow="Governance · Author Approval" title="Author Approval Workflow" />
        <EmptyHint text="This console is for marketplace operators. Sign in with an operator account." />
      </div>
    );
  }

  const c = d?.counts;

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Governance · Author Approval"
        title="Author Approval Workflow"
        description="Every author submission is reviewed, verified and approved by the Marketplace Manager before going public."
        actions={
          <>
            <button
              onClick={() => sweep.mutate()}
              disabled={sweep.isPending}
              className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
            >
              Run SLA sweep
            </button>
            <button
              onClick={() => next && setOpen(next.id)}
              disabled={!next}
              className="rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-40"
            >
              {next ? `Review ${next.submission_no}` : "Nothing to review"}
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
        <StatCard label="Pending review" value={String(c?.pending_review ?? "—")} tone="warning" />
        <StatCard label="Under verification" value={String(c?.verifying ?? "—")} />
        <StatCard label="Changes requested" value={String(c?.changes_requested ?? "—")} tone="warning" />
        <StatCard label="Approved" value={String(c?.approved ?? "—")} tone="success" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Draft" value={String(c?.draft ?? "—")} />
        <StatCard label="Rejected" value={String(c?.rejected ?? "—")} tone="destructive" />
        <StatCard label="Suspended" value={String(c?.suspended ?? "—")} tone="destructive" />
        <StatCard label="Archived" value={String(c?.archived ?? "—")} />
      </div>

      {/* --------------------------------------------------- SLA & escalation */}
      <Card className="mt-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Clock className="h-4 w-4 text-muted-foreground" /> SLA &amp; escalation
          </h3>
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            respond within
            <input
              type="number"
              min={1}
              defaultValue={d?.sla?.response_hours}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (v && v !== d?.sla?.response_hours) sla.mutate({ response_hours: v });
              }}
              className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-xs"
            />
            h
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            escalate after
            <input
              type="number"
              min={1}
              defaultValue={d?.sla?.escalate_hours}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (v && v !== d?.sla?.escalate_hours) sla.mutate({ escalate_hours: v });
              }}
              className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-xs"
            />
            h
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            stale drafts after
            <input
              type="number"
              min={1}
              defaultValue={d?.sla?.stale_draft_days}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (v && v !== d?.sla?.stale_draft_days) sla.mutate({ stale_draft_days: v });
              }}
              className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-xs"
            />
            d
          </label>
          <span className="ml-auto text-[11px]">
            <span className="text-rose-500">{d?.sla?.breached ?? 0} breached</span>
            {" · "}
            <span className="text-amber-500">{d?.sla?.due_soon ?? 0} due soon</span>
          </span>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Measured from each submission's own timestamps. A stale draft is reported for a
          person to decide on — nothing is auto-rejected.
        </p>
      </Card>

      {/* ------------------------------------------------------------- queue */}
      <Card className="mt-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {TABS.map((t) => (
            <button
              key={t.key || "all"}
              onClick={() => { setTab(t.key); setPicked([]); }}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                tab === t.key ? "bg-foreground text-background" : "hover:bg-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Submission ID, product, author or author ID"
              className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-xs"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="risk">Risk</option>
            <option value="sla">SLA</option>
          </select>
          <button
            onClick={() => void q.refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>

        {picked.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-muted px-3 py-2">
            <span className="text-[11px] font-semibold">{picked.length} selected</span>
            <span className="text-[11px] text-muted-foreground">
              Each is validated on its own — a failing mandatory check stops that one, not the rest.
            </span>
            <button
              onClick={() => bulk.mutate({ status: "approved" })}
              className="ml-auto rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-background"
            >
              Bulk approve
            </button>
            <button
              onClick={() => {
                const reason = window.prompt("Why are these being rejected?");
                if (reason && reason.trim()) bulk.mutate({ status: "rejected", reason });
              }}
              className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-rose-500 hover:bg-background"
            >
              Bulk reject
            </button>
            <button
              onClick={() => bulk.mutate({ status: "archived" })}
              className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-background"
            >
              Archive
            </button>
            <button
              onClick={() => setPicked([])}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
        )}

        {q.isLoading ? (
          <EmptyHint text="Loading the queue…" />
        ) : rows.length === 0 ? (
          <EmptyHint
            text={
              (d?.total ?? 0) === 0
                ? "No submission has been raised yet. A submission is created when a product enters the approval workflow; until then every product keeps the state it already has."
                : "No submission matches this view."
            }
          />
        ) : (
          <div className="space-y-2">
            {rows.map((r: SubmissionRow) => (
              <div key={r.id} className="rounded-xl border border-border/60 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="checkbox"
                    checked={picked.includes(r.id)}
                    onChange={(e) =>
                      setPicked((p) =>
                        e.target.checked ? [...p, r.id] : p.filter((x) => x !== r.id),
                      )
                    }
                    aria-label={`Select ${r.submission_no}`}
                    className="h-3.5 w-3.5"
                  />
                  <button onClick={() => setOpen(r.id)} className="min-w-[190px] flex-1 text-left">
                    <div className="text-sm font-semibold hover:underline">
                      {r.product ?? "Untitled product"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.submission_no} · {r.author ?? "first-party"} · {r.type} · rev {r.revision}
                      {" · "}submitted {when(r.submitted_at)}
                    </div>
                  </button>

                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      RISK_TONE[r.risk_level] ?? RISK_TONE.low
                    }`}
                  >
                    risk {r.risk_score} · {r.risk_level}
                  </span>

                  <span className={`text-[11px] font-semibold ${SLA_TONE[r.sla_state]}`}>
                    {r.sla_state === "breached" && (
                      <AlertTriangle className="mr-1 inline h-3 w-3" />
                    )}
                    {label(r.sla_state)}
                  </span>

                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      STATUS_TONE[r.status] ?? STATUS_TONE.draft
                    }`}
                  >
                    {label(r.status)}
                  </span>

                  <button
                    onClick={() => setOpen(r.id)}
                    className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
                  >
                    Review
                  </button>
                </div>

                {r.last_reason && (
                  <div className="mt-1.5 text-[11px] text-muted-foreground">
                    Last action: {label(r.last_action ?? "")} — {r.last_reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ------------------------------------------------------------ rules */}
      <Card className="mt-4">
        <h3 className="mb-2 text-sm font-bold">Approval rules</h3>
        <div className="space-y-2">
          {(d?.rules ?? []).map((r: ApprovalRule) => (
            <div
              key={r.key}
              className="flex flex-wrap items-start gap-3 rounded-lg border border-border/60 px-3 py-2"
            >
              <div className="min-w-[220px] flex-1">
                <div className="text-xs font-semibold">{r.label}</div>
                <div className="text-[11px] text-muted-foreground">{r.description}</div>
              </div>
              <button
                role="switch"
                aria-checked={r.enabled}
                onClick={() => rule.mutate({ key: r.key, enabled: !r.enabled })}
                className={`relative h-5 w-9 shrink-0 rounded-full transition ${
                  r.enabled ? "bg-emerald-500" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${
                    r.enabled ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* -------------------------------------------------- trusted authors */}
      <Card className="mt-4">
        <h3 className="mb-1 text-sm font-bold">Trusted authors</h3>
        <p className="mb-2 text-[11px] text-muted-foreground">
          Derived from submissions that actually happened and from Author Manager's own status —
          not from a toggle on this screen.
        </p>
        {(d?.trusted_authors?.length ?? 0) === 0 ? (
          <EmptyHint text="No sellers are registered yet." />
        ) : (
          <div className="space-y-1">
            {d?.trusted_authors?.map((a: TrustedAuthor) => (
              <div
                key={a.seller_id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 px-3 py-1.5 text-xs"
              >
                <span className="min-w-[140px] flex-1 font-semibold">{a.name}</span>
                <span className="text-muted-foreground">{a.status}</span>
                <span>{a.approved} approved</span>
                <span className="text-muted-foreground">{a.rejected} rejected</span>
                {a.violations > 0 && (
                  <span className="text-rose-500">{a.violations} violation(s)</span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    a.trust_level === "trusted"
                      ? "bg-emerald-500/10 text-emerald-500"
                      : a.trust_level === "flagged" || a.trust_level === "untrusted"
                        ? "bg-rose-500/10 text-rose-500"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {a.trust_level}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default ApprovalWorkflow;
