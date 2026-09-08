import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Clock, History, Loader2, ShieldCheck, X } from "lucide-react";

import { authHeaders } from "@/lib/auth/operator-fetch";
import { Card, LoadFailure, PageHeader, PillButton, StatCard } from "../ui";

/**
 * Activity, Audit & Version History — the screen that already existed, now
 * reading the records that exist.
 *
 * It showed 1,284 events today, 18 scheduled, 42 backups and 6 rollbacks, over
 * a version panel listing V4.2, V4.1, V4.0 and V3.9. There are 87 audit rows,
 * no versions, nothing scheduled, and no backup system at all.
 *
 * The backup number is the one worth being careful about. Showing 42 backups
 * over a system that has never taken one is not a cosmetic problem: it is the
 * number somebody relies on the day they need a restore. So the section says
 * there is no backup system rather than showing a count.
 */

type Activity = {
  id: string; action: string; entity_type: string | null; entity_id: string | null;
  actor: string; actor_role: string; reason: string | null; module: string | null;
  correlation_id: string | null; created_at: string;
  has_before: boolean; has_after: boolean;
};

type Capability = { state: string; detail?: string };

type Data = {
  ok: boolean; timezone: string;
  metrics: {
    events_today: number; events_7d: number; events_held: number;
    rollbacks: number; versions: number; scheduled: number;
  };
  activity: Activity[];
  breakdown: { by_action: Record<string, number>; by_module: Record<string, number>; by_actor_role: Record<string, number> };
  versions: Record<string, unknown>[];
  schedules: { product_id: string; name: string; slug: string; action: string; at: string; currently_visible: boolean }[];
  capabilities: Record<string, Capability>;
};

const n = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : new Intl.NumberFormat().format(v);

const when = (v: string) =>
  new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

const TONE: Record<string, string> = {
  CONNECTED: "border-emerald-500/30 text-emerald-500",
  PARTIALLY_CONNECTED: "border-amber-500/30 text-amber-500",
  NOT_IMPLEMENTED: "border-rose-500/30 text-rose-500",
  PRESENT: "border-emerald-500/30 text-emerald-500",
  ABSENT: "border-rose-500/30 text-rose-500",
};

export function AuditHistory() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [open, setOpen] = useState<Activity | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
      const response = await fetch(`/api/governance/console?tz=${encodeURIComponent(tz)}`, {
        headers: await authHeaders(),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(new Error(payload?.error ?? (response.status === 401 || response.status === 403
          ? "Sign in as an operator to open the audit history."
          : "Could not read the audit history.")));
        return;
      }
      setData(payload as Data);
    } catch {
      setError(new Error("Could not reach the server."));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const m = data?.metrics;
  const backups = data?.capabilities.backups;

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Governance · Audit"
        title="Activity, Audit & Version History"
        description="Every marketplace operation, who performed it and what changed — read from the append-only audit trail."
        actions={
          <PillButton variant="ghost" onClick={() => window.dispatchEvent(new CustomEvent("sv:open-vala-ai"))}>
            Vala AI
          </PillButton>
        }
      />

      {error ? <LoadFailure error={error} what="the audit history" onRetry={() => void load()} /> : null}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Events today" value={n(m?.events_today)} tone="premium" icon={<History className="h-3.5 w-3.5" />} />
        <StatCard label="Scheduled" value={n(m?.scheduled)} icon={<Clock className="h-3.5 w-3.5" />} />
        <StatCard
          label="Backups"
          value={backups?.state === "NOT_IMPLEMENTED" ? "none" : n(0)}
          tone="destructive"
        />
        <StatCard label="Rollbacks" value={n(m?.rollbacks)} tone="warning" />
      </div>

      {backups?.state === "NOT_IMPLEMENTED" && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-500">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold">There is no backup system.</div>
            <p className="mt-1 text-rose-500/80">{backups.detail}</p>
          </div>
        </div>
      )}

      {!data ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Reading the audit trail…
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-0 lg:col-span-2">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-bold">Activity</span>
              <span className="text-[11px] text-muted-foreground">
                {n(m?.events_held)} most recent · {n(m?.events_7d)} in 7 days · counted in {data.timezone}
              </span>
            </div>
            {data.activity.length === 0 ? (
              <div className="px-4 py-10 text-center text-[12px] text-muted-foreground">
                Nothing has been recorded yet.
              </div>
            ) : (
              <div className="max-h-[520px] divide-y divide-border overflow-auto">
                {data.activity.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02]">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-semibold">{e.action}</div>
                      <div className="truncate text-[10px] text-muted-foreground">
                        {e.actor} · {e.actor_role} · {e.entity_type ?? "—"} · {when(e.created_at)}
                      </div>
                    </div>
                    <button
                      onClick={() => setOpen(e)}
                      className="shrink-0 rounded-lg border border-border px-2 py-1 text-[10px] font-semibold hover:bg-muted"
                    >
                      Details
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="space-y-4">
            <Card>
              <div className="mb-2 text-sm font-bold">Version history</div>
              {data.versions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-[11px] text-muted-foreground">
                  {data.capabilities.versions.detail}
                </div>
              ) : (
                <div className="space-y-1">
                  {data.versions.slice(0, 8).map((v, i) => (
                    <div key={String(v.id ?? i)} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-1.5 text-[11px]">
                      <span className="font-semibold">v{String(v.version_number ?? v.version ?? i + 1)}</span>
                      <span className="text-muted-foreground">{v.created_at ? when(String(v.created_at)) : "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <div className="mb-2 text-sm font-bold">Scheduled publish / unpublish</div>
              {data.schedules.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-[11px] text-muted-foreground">
                  No product carries a publish or unpublish time. {data.capabilities.scheduling.detail}
                </div>
              ) : (
                <div className="space-y-1">
                  {data.schedules.map((s) => (
                    <div key={`${s.product_id}-${s.action}`} className="rounded-lg border border-border/60 px-3 py-1.5 text-[11px]">
                      <div className="truncate font-semibold">{s.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {s.action} at {when(s.at)} · currently {s.currently_visible ? "visible" : "hidden"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <div className="mb-2 text-sm font-bold">What this module can and cannot do</div>
              <div className="space-y-1">
                {Object.entries(data.capabilities).map(([key, c]) => (
                  <div key={key} className={`rounded-lg border px-3 py-1.5 ${TONE[c.state] ?? "border-border text-muted-foreground"}`}>
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                      <ShieldCheck className="h-3 w-3" />
                      <span className="capitalize">{key.replace(/_/g, " ")}</span>
                      <span className="ml-auto text-[10px]">{c.state.replace(/_/g, " ")}</span>
                    </div>
                    {c.detail && <div className="mt-0.5 text-[10px] opacity-80">{c.detail}</div>}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(null)}>
          <div className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-2xl border border-border bg-background p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-bold">{open.action}</div>
              <button onClick={() => setOpen(null)} aria-label="Close" className="rounded-lg border border-border p-1">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <dl className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-[11px]">
              {[
                ["Actor", open.actor],
                ["Role", open.actor_role],
                ["Entity", `${open.entity_type ?? "—"} ${open.entity_id ?? ""}`],
                ["Module", open.module ?? "—"],
                ["Correlation ID", open.correlation_id ?? "not recorded"],
                ["When", when(open.created_at)],
                ["Reason", open.reason ?? "none given"],
                ["Before state", open.has_before ? "recorded" : "not recorded"],
                ["After state", open.has_after ? "recorded" : "not recorded"],
              ].map(([k, v]) => (
                <div key={String(k)} className="contents">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="col-span-2 break-words">{String(v)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[10px] text-muted-foreground">
              This record cannot be edited or removed by any signed-in role.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
