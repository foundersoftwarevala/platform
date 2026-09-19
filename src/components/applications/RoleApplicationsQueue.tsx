import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardCheck, Loader2, Search, XCircle } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";

/**
 * Applications submitted through /apply/<role>, read from the table that owns
 * them and decided with that table's review function. Row access is the
 * table's RLS (staff only); approving your own application is refused by the
 * database, and a rejection needs a reason.
 */

type Kind = "franchise" | "influencer";

type Row = {
  id: string;
  number: string;
  name: string;
  detail: string;
  email: string;
  status: string;
  note: string | null;
  submitted: string;
};

const SOURCES: Record<
  Kind,
  {
    table: string;
    select: string;
    map: (r: Record<string, string | number | null>) => Row;
    review: (
      id: string,
      status: string,
      note: string | null,
    ) => { fn: string; args: Record<string, unknown> };
  }
> = {
  franchise: {
    table: "franchise_applications",
    select:
      "id,code,business_name,owner_name,email,requested_territory,city,investment_capacity,status,review_notes,created_at",
    map: (r) => ({
      id: String(r.id),
      number: String(r.code),
      name: `${r.owner_name} — ${r.business_name}`,
      detail: [r.requested_territory, r.city, r.investment_capacity].filter(Boolean).join(" · "),
      email: String(r.email ?? ""),
      status: String(r.status),
      note: r.review_notes == null ? null : String(r.review_notes),
      submitted: String(r.created_at),
    }),
    review: (id, status, note) => ({
      fn: "review_franchise_application",
      args: { p_id: id, p_status: status, p_notes: note },
    }),
  },
  influencer: {
    table: "influencer_applications",
    select:
      "id,application_number,full_name,email,niche,followers,country,status,rejection_reason,created_at",
    map: (r) => ({
      id: String(r.id),
      number: String(r.application_number),
      name: String(r.full_name),
      detail: [r.niche, r.followers != null ? `${r.followers} followers` : null, r.country]
        .filter(Boolean)
        .join(" · "),
      email: String(r.email ?? ""),
      status: String(r.status),
      note: r.rejection_reason == null ? null : String(r.rejection_reason),
      submitted: String(r.created_at),
    }),
    review: (id, status, note) => ({
      fn: "review_influencer_application",
      args: { p_application_id: id, p_status: status, p_rejection_reason: note },
    }),
  },
};

const OPEN = ["pending", "in_review"];

export function RoleApplicationsQueue({ kind }: { kind: Kind }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const source = SOURCES[kind];
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [search, setSearch] = useState("");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const q = useQuery({
    queryKey: ["role-applications", kind, filter],
    queryFn: async (): Promise<Row[]> => {
      // These tables are not in the generated Supabase types (src/integrations/supabase/types.ts).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from(source.table)
        .select(source.select)
        .order("created_at", { ascending: false })
        .limit(200);
      if (filter === "open") query = query.in("status", OPEN);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []).map(source.map);
    },
  });

  const decide = useMutation({
    mutationFn: async ({
      id,
      status,
      note,
    }: {
      id: string;
      status: string;
      note: string | null;
    }) => {
      const { fn, args } = source.review(id, status, note);
      const { error } = await supabase.rpc(fn as never, args as never);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, v) => {
      toast.success(t("apply.queue.decided", { status: v.status }));
      setRejecting(null);
      setReason("");
      void qc.invalidateQueries({ queryKey: ["role-applications", kind] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const needle = search.trim().toLowerCase();
  const rows = (q.data ?? []).filter(
    (r) => !needle || `${r.number} ${r.name} ${r.email} ${r.detail}`.toLowerCase().includes(needle),
  );

  return (
    <section className="space-y-4" data-applications-queue={kind}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("apply.queue.eyebrow")}
          </p>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <ClipboardCheck className="h-5 w-5 text-primary" />{" "}
            {t(
              kind === "franchise" ? "apply.queue.title_franchise" : "apply.queue.title_influencer",
            )}
          </h1>
          <p className="text-sm text-muted-foreground">{t("apply.queue.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("apply.queue.search")}
              className="w-40 bg-transparent outline-none"
            />
          </label>
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
              key={r.id}
              data-application={r.number}
              data-application-status={r.status}
              className="rounded-xl border border-border bg-surface/60 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-muted-foreground">{r.number}</p>
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-sm text-muted-foreground">{r.detail}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.email} · {new Date(r.submitted).toLocaleString()}
                  </p>
                  {r.note && <p className="mt-1 text-xs text-amber-300">{r.note}</p>}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                    {r.status}
                  </span>
                  {OPEN.includes(r.status) && (
                    <div className="flex flex-wrap gap-2">
                      {r.status === "pending" && (
                        <button
                          type="button"
                          disabled={decide.isPending}
                          onClick={() =>
                            decide.mutate({ id: r.id, status: "in_review", note: null })
                          }
                          className="rounded-lg border border-border px-3 py-1.5 text-xs"
                        >
                          {t("apply.queue.review")}
                        </button>
                      )}
                      <button
                        type="button"
                        data-approve
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ id: r.id, status: "approved", note: null })}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs text-white"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> {t("apply.queue.approve")}
                      </button>
                      <button
                        type="button"
                        data-reject
                        disabled={decide.isPending}
                        onClick={() => setRejecting(rejecting === r.id ? null : r.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs text-destructive"
                      >
                        <XCircle className="h-3.5 w-3.5" /> {t("apply.queue.reject")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {rejecting === r.id && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={t("apply.queue.reason")}
                    className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    disabled={!reason.trim() || decide.isPending}
                    onClick={() =>
                      decide.mutate({ id: r.id, status: "rejected", note: reason.trim() })
                    }
                    className="rounded-lg bg-destructive px-3 py-1.5 text-xs text-destructive-foreground disabled:opacity-50"
                  >
                    {t("apply.queue.confirm_reject")}
                  </button>
                </div>
              )}
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
