import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  FileText,
  Loader2,
  PauseCircle,
  Search,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { authHeaders } from "@/lib/auth/operator-fetch";
import { useTranslation } from "@/lib/i18n/use-translation";

/**
 * Applications submitted through /apply/<role>, managed in one queue.
 *
 * The Control Panel's Application Manager shows every kind together; each role
 * Manager shows its own. Either way the list, the full application, its
 * documents and its decisions come from /api/applications/queue, which reads
 * each role's own table and decides with that role's own review function - so
 * only application staff see anything, nobody can decide their own
 * application, and every refusal and suspension carries its reason.
 */

type Kind = "reseller" | "vendor" | "author" | "franchise" | "influencer" | "affiliate";
const KINDS: Kind[] = ["reseller", "vendor", "author", "franchise", "influencer", "affiliate"];

type Summary = {
  kind: Kind;
  id: string;
  number: string;
  name: string;
  email: string;
  status: string;
  reason: string | null;
  submitted: string;
  actions: string[];
};

type Detail = Summary & {
  sections: { title: string; fields: { key: string; label: string; value: string | null }[] }[];
  documents: {
    id: string;
    field: string;
    label: string;
    name: string;
    mime: string;
    size: number;
    uploadedAt: string;
  }[];
  history: { at: string; action: string; actor: string; reason: string | null }[];
};

/** A decision that must say why. */
const NEEDS_REASON = new Set(["rejected", "suspended"]);

async function api<T>(input: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...(await authHeaders()),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "The request did not go through");
  return body;
}

/** Opens a document in a new tab. It is fetched with the reviewer's own token; no lasting link exists. */
async function openDocument(id: string) {
  const tab = window.open("", "_blank");
  try {
    const response = await fetch(`/api/applications/documents?id=${encodeURIComponent(id)}`, {
      headers: await authHeaders(),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? "The document could not be opened");
    }
    const url = URL.createObjectURL(await response.blob());
    if (tab) tab.location.href = url;
    else window.location.href = url;
    // The object URL is only needed while the tab loads it.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    tab?.close();
    toast.error(error instanceof Error ? error.message : String(error));
  }
}

function ApplicationDetails({ kind, id }: { kind: Kind; id: string }) {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ["role-application", kind, id],
    queryFn: () =>
      api<{ application: Detail }>(
        `/api/applications/queue?kind=${kind}&id=${encodeURIComponent(id)}`,
      ),
  });

  if (q.isLoading) {
    return (
      <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("apply.queue.loading")}
      </p>
    );
  }
  if (q.error) return <p className="mt-3 text-sm text-destructive">{(q.error as Error).message}</p>;
  const detail = q.data?.application;
  if (!detail) return null;

  return (
    <div
      className="mt-4 space-y-4 border-t border-border pt-4"
      data-application-detail={detail.number}
    >
      {detail.sections.map((section) => (
        <div key={section.title}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {section.title}
          </p>
          <dl className="mt-2 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {section.fields.map((field) => (
              <div key={field.key} className="flex min-w-0 gap-2" data-field={field.key}>
                <dt className="shrink-0 text-muted-foreground">{field.label}:</dt>
                <dd className="min-w-0 break-words">
                  {field.value ?? <span className="text-muted-foreground">—</span>}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("apply.documents")}
        </p>
        {detail.documents.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("apply.queue.no_documents")}</p>
        ) : (
          <ul className="mt-2 space-y-1.5 text-sm">
            {detail.documents.map((doc) => (
              <li key={doc.id} data-document={doc.field}>
                <button
                  type="button"
                  onClick={() => void openDocument(doc.id)}
                  className="inline-flex items-center gap-1.5 text-primary underline-offset-2 hover:underline"
                >
                  <FileText className="h-4 w-4" /> {doc.label}
                </button>{" "}
                <span className="text-muted-foreground">
                  {doc.name} · {Math.max(1, Math.round(doc.size / 1024))} KB
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {detail.history.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("apply.queue.history")}
          </p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {detail.history.map((event, index) => (
              <li key={`${event.at}-${index}`}>
                {new Date(event.at).toLocaleString()} · {event.action} · {event.actor}
                {event.reason ? ` · ${event.reason}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function RoleApplicationsQueue({ kind }: { kind: Kind | "all" }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [only, setOnly] = useState<Kind | "all">("all");
  const [search, setSearch] = useState("");
  const [asking, setAsking] = useState<{ id: string; status: string } | null>(null);
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const showing = kind === "all" ? only : kind;

  const q = useQuery({
    queryKey: ["role-applications", kind, showing, filter],
    queryFn: async () =>
      (await api<{ rows: Summary[] }>(`/api/applications/queue?kind=${showing}&filter=${filter}`))
        .rows,
  });

  const decide = useMutation({
    mutationFn: (v: { kind: Kind; id: string; status: string; reason: string | null }) =>
      api("/api/applications/queue", {
        method: "POST",
        body: JSON.stringify({
          action: "decide",
          kind: v.kind,
          id: v.id,
          status: v.status,
          reason: v.reason,
        }),
      }),
    onSuccess: (_d, v) => {
      toast.success(t("apply.queue.decided", { status: v.status }));
      setAsking(null);
      setReason("");
      void qc.invalidateQueries({ queryKey: ["role-applications"] });
      void qc.invalidateQueries({ queryKey: ["role-application", v.kind, v.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const label = (row: Summary, status: string) => {
    if (status === "in_review") return t("apply.queue.review");
    if (status === "rejected") return t("apply.queue.reject");
    if (status === "suspended") return t("apply.queue.suspend");
    return row.status === "suspended" ? t("apply.queue.reinstate") : t("apply.queue.approve");
  };

  const needle = search.trim().toLowerCase();
  const rows = (q.data ?? []).filter(
    (r) => !needle || `${r.number} ${r.name} ${r.email} ${r.kind}`.toLowerCase().includes(needle),
  );

  const title =
    kind === "all"
      ? t("apply.queue.title_all")
      : kind === "franchise"
        ? t("apply.queue.title_franchise")
        : kind === "influencer"
          ? t("apply.queue.title_influencer")
          : t("apply.queue.title_role", { role: kind });

  return (
    <section className="space-y-4" data-applications-queue={kind}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("apply.queue.eyebrow")}
          </p>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <ClipboardCheck className="h-5 w-5 text-primary" /> {title}
          </h1>
          <p className="text-sm text-muted-foreground">{t("apply.queue.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("apply.queue.search")}
              className="w-40 bg-transparent outline-none"
            />
          </label>
          {kind === "all" && (
            <select
              value={only}
              onChange={(e) => setOnly(e.target.value as Kind | "all")}
              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
              aria-label={t("apply.queue.kind")}
            >
              <option value="all">{t("apply.queue.kind_all")}</option>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          )}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as "open" | "all")}
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
          >
            <option value="open">{t("apply.queue.filter_open")}</option>
            <option value="all">{t("apply.queue.filter_all")}</option>
          </select>
        </div>
      </header>

      {q.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("apply.queue.loading")}
        </p>
      ) : q.error ? (
        <p className="text-sm text-destructive">{(q.error as Error).message}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
          {t("apply.queue.empty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li
              key={`${r.kind}-${r.id}`}
              data-application={r.number}
              data-application-kind={r.kind}
              data-application-status={r.status}
              className="rounded-xl border border-border bg-surface/60 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-muted-foreground">
                    <span className="mr-2 rounded bg-primary/10 px-1.5 py-0.5 font-sans font-semibold uppercase text-primary">
                      {r.kind}
                    </span>
                    {r.number}
                  </p>
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.email} · {new Date(r.submitted).toLocaleString()}
                  </p>
                  {r.reason && <p className="mt-1 text-xs text-amber-300">{r.reason}</p>}
                  <button
                    type="button"
                    data-details
                    onClick={() =>
                      setOpen(open === `${r.kind}-${r.id}` ? null : `${r.kind}-${r.id}`)
                    }
                    className="mt-2 inline-flex items-center gap-1 text-xs text-primary"
                  >
                    {open === `${r.kind}-${r.id}` ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                    {t("apply.queue.details")}
                  </button>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                    {r.status}
                  </span>
                  {r.actions.length > 0 && (
                    <div className="flex flex-wrap justify-end gap-2">
                      {r.actions.map((status) => (
                        <button
                          key={status}
                          type="button"
                          data-approve={
                            status === "approved" || status === "active" ? "" : undefined
                          }
                          data-reject={status === "rejected" ? "" : undefined}
                          data-suspend={status === "suspended" ? "" : undefined}
                          data-review={status === "in_review" ? "" : undefined}
                          disabled={decide.isPending}
                          onClick={() => {
                            if (NEEDS_REASON.has(status)) {
                              setAsking(
                                asking?.id === r.id && asking.status === status
                                  ? null
                                  : { id: r.id, status },
                              );
                              setReason("");
                            } else {
                              decide.mutate({ kind: r.kind, id: r.id, status, reason: null });
                            }
                          }}
                          className={
                            status === "rejected"
                              ? "inline-flex items-center gap-1 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs text-destructive"
                              : status === "suspended"
                                ? "inline-flex items-center gap-1 rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs text-amber-300"
                                : status === "in_review"
                                  ? "rounded-lg border border-border px-3 py-1.5 text-xs"
                                  : "inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs text-white"
                          }
                        >
                          {status === "rejected" && <XCircle className="h-3.5 w-3.5" />}
                          {status === "suspended" && <PauseCircle className="h-3.5 w-3.5" />}
                          {(status === "approved" || status === "active") && (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          {label(r, status)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {asking?.id === r.id && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={
                      asking.status === "suspended"
                        ? t("apply.queue.suspend_reason")
                        : t("apply.queue.reason")
                    }
                    className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    data-confirm-decision
                    disabled={!reason.trim() || decide.isPending}
                    onClick={() =>
                      decide.mutate({
                        kind: r.kind,
                        id: r.id,
                        status: asking.status,
                        reason: reason.trim(),
                      })
                    }
                    className="rounded-lg bg-destructive px-3 py-1.5 text-xs text-destructive-foreground disabled:opacity-50"
                  >
                    {asking.status === "suspended"
                      ? t("apply.queue.confirm_suspend")
                      : t("apply.queue.confirm_reject")}
                  </button>
                </div>
              )}
              {open === `${r.kind}-${r.id}` && <ApplicationDetails kind={r.kind} id={r.id} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function FranchiseApplicationsQueue() {
  return <RoleApplicationsQueue kind="franchise" />;
}

export function InfluencerApplicationsQueue() {
  return <RoleApplicationsQueue kind="influencer" />;
}

export function AllApplicationsQueue() {
  return <RoleApplicationsQueue kind="all" />;
}
