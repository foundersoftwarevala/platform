import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, Lock, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";

import { authHeaders } from "@/lib/auth/operator-fetch";
import { Card, LoadFailure, PageHeader, PillButton, StatCard } from "../ui";

/**
 * No Fake Data Policy — measured rather than declared.
 *
 * The screen this replaces showed four dashes and six cards all reading
 * ENFORCED. The dashes were honest. The badges were not: this database contains
 * exactly the things those six cards say cannot happen, and a policy that
 * reports itself enforced while its own data disagrees is worse than no policy,
 * because it is what people trust instead of looking.
 *
 * Same four counters, same six cards, same lock. Each status is now computed on
 * every request from the records themselves, so the only way a card turns green
 * is for the data to satisfy it. Nothing on this screen corrects anything —
 * rewriting production values to make a badge go green would be the same
 * failure pointing the other way.
 *
 * The static original is kept as IntegritySectionStatic.
 */

type Policy = {
  id: string; title: string; description: string;
  status: "ENFORCED" | "VIOLATED" | "UNVERIFIABLE";
  source: string; evidence: string;
  violations: { what: string; count: number; sample?: string[] }[];
};

type Data = {
  ok: boolean; locked: boolean; lock_note: string;
  metrics: {
    verified_orders: number | null; verified_reviews: number | null;
    flagged_and_removed: number | null; audit_events: number | null;
  };
  metric_sources: Record<string, string>;
  policies: Policy[];
  summary: { enforced: number; violated: number; unverifiable: number };
  reconciliation: {
    orders_total: number; orders_marked_paid: number;
    payment_intents: number; payment_intents_succeeded: number;
    payments_rows: number; payments_verified: number;
    licences_issued: number; entitlements: number;
    downloads_recorded: number | null;
    revenue_claimed_by_orders: number; revenue_backed_by_settlement: number;
    mismatches: string[]; note: string;
  };
  view_integrity: {
    events: number; product_views: number; distinct_dedupe_keys: number;
    sessions: number; identified_users: number;
  };
};

/** Section 11 and 33: no verified source renders as a dash, never as zero. */
const metric = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : new Intl.NumberFormat().format(v);

const TONE: Record<string, { badge: string; ring: string; icon: typeof ShieldCheck }> = {
  ENFORCED: {
    badge: "bg-success/15 text-success",
    ring: "bg-success/15 text-success ring-success/30",
    icon: ShieldCheck,
  },
  VIOLATED: {
    badge: "bg-destructive/15 text-destructive",
    ring: "bg-destructive/15 text-destructive ring-destructive/30",
    icon: ShieldAlert,
  },
  UNVERIFIABLE: {
    badge: "bg-warning/15 text-warning",
    ring: "bg-warning/15 text-warning ring-warning/30",
    icon: AlertTriangle,
  },
};

export function IntegrityPolicy() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/marketplace/integrity", { headers: await authHeaders() });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.message ?? payload?.error ?? `The policy could not be read (${response.status}).`);
        return;
      }
      setData(payload as Data);
    } catch (cause) {
      setError(cause);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (error) {
    return (
      <div className="px-4 py-8 md:px-8">
        <PageHeader eyebrow="Integrity · Locked Policy" title="No Fake Data Policy" description="Software Vala marketplace operates on verified, source-of-truth data only. These guards are enforced platform-wide." />
        <LoadFailure error={error} onRetry={load} what="the integrity policy" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-4 py-8 md:px-8">
        <PageHeader eyebrow="Integrity · Locked Policy" title="No Fake Data Policy" description="Software Vala marketplace operates on verified, source-of-truth data only. These guards are enforced platform-wide." />
        <Card><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Measuring each guard against the records…</div></Card>
      </div>
    );
  }

  const r = data.reconciliation;

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Integrity · Locked Policy"
        title="No Fake Data Policy"
        description="Software Vala marketplace operates on verified, source-of-truth data only. These guards are enforced platform-wide."
        actions={
          <>
            <PillButton variant="premium">
              <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Policy is Locked</span>
            </PillButton>
            <PillButton onClick={load}><RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh</PillButton>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Verified Orders" value={metric(data.metrics.verified_orders)} tone="success" />
        <StatCard label="Verified Reviews" value={metric(data.metrics.verified_reviews)} tone="success" />
        <StatCard label="Flagged & Removed" value={metric(data.metrics.flagged_and_removed)} tone="warning" />
        <StatCard label="Audit Events" value={metric(data.metrics.audit_events)} tone="premium" />
      </div>

      {data.summary.violated > 0 ? (
        <Card className="mb-6">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="text-sm">
              <div className="font-bold">
                {data.summary.violated} of {data.policies.length} guards are not holding.
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                These statuses are computed from the records on every request, not stored. Nothing on this screen
                changes the data to make a badge go green — the evidence is below and the decision is the owner&apos;s.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.policies.map((p) => {
          const tone = TONE[p.status];
          const Icon = tone.icon;
          return (
            <Card key={p.id}>
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${tone.ring}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-bold">{p.title}</div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tone.badge}`}>
                      {p.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
                  <p className="mt-2 border-t border-border pt-2 text-[11px] text-muted-foreground">{p.evidence}</p>
                  {p.violations.map((v) => (
                    <div key={v.what} className="mt-2 text-[11px] text-destructive">
                      <div className="font-semibold">{v.what}: {v.count}</div>
                      {v.sample ? (
                        <div className="mt-0.5 text-muted-foreground">e.g. {v.sample.slice(0, 4).join(", ")}</div>
                      ) : null}
                    </div>
                  ))}
                  <div className="mt-2 text-[10px] text-muted-foreground">Source: {p.source}</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Reconciliation — order to settlement to licence to download
          </div>
          <div className="space-y-1 text-sm">
            {([
              ["Orders", r.orders_total],
              ["Marked paid", r.orders_marked_paid],
              ["Payment intents", r.payment_intents],
              ["Intents succeeded", r.payment_intents_succeeded],
              ["Payment rows", r.payments_rows],
              ["Automatically verified", r.payments_verified],
              ["Licences issued", r.licences_issued],
              ["Entitlements", r.entitlements],
              ["Downloads recorded", r.downloads_recorded],
            ] as const).map(([label, value]) => (
              <div key={label} className="flex justify-between border-b border-border/40 pb-1">
                <span className="text-muted-foreground">{label}</span>
                <span>{metric(value as number | null)}</span>
              </div>
            ))}
            <div className="flex justify-between border-b border-border/40 pb-1">
              <span className="text-muted-foreground">Revenue claimed by orders</span>
              <span>{r.revenue_claimed_by_orders}</span>
            </div>
            <div className="flex justify-between pb-1">
              <span className="text-muted-foreground">Revenue backed by settlement</span>
              <span className={r.revenue_backed_by_settlement < r.revenue_claimed_by_orders ? "text-destructive" : ""}>
                {r.revenue_backed_by_settlement}
              </span>
            </div>
          </div>
          {r.mismatches.length ? (
            <ul className="mt-3 space-y-1 border-t border-border pt-2 text-[11px] text-destructive">
              {r.mismatches.map((m) => <li key={m}>{m}</li>)}
            </ul>
          ) : (
            <p className="mt-3 border-t border-border pt-2 text-[11px] text-success">Every step reconciles.</p>
          )}
          <p className="mt-2 text-[10px] text-muted-foreground">{r.note}</p>
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              View integrity
            </div>
            <div className="space-y-1 text-sm">
              {([
                ["Events recorded", data.view_integrity.events],
                ["Product views", data.view_integrity.product_views],
                ["Distinct dedupe keys", data.view_integrity.distinct_dedupe_keys],
                ["Sessions", data.view_integrity.sessions],
                ["Identified users", data.view_integrity.identified_users],
              ] as const).map(([label, value]) => (
                <div key={label} className="flex justify-between border-b border-border/40 pb-1">
                  <span className="text-muted-foreground">{label}</span><span>{metric(value)}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Where each counter comes from
            </div>
            <div className="space-y-2 text-[11px] text-muted-foreground">
              {Object.entries(data.metric_sources).map(([key, value]) => (
                <div key={key}>
                  <span className="font-medium text-foreground">{key.replace(/_/g, " ")}</span> — {value}
                </div>
              ))}
            </div>
            <p className="mt-3 border-t border-border pt-2 text-[11px] text-muted-foreground">{data.lock_note}</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
