import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { DownloadCloud, Loader2, Sparkles } from "lucide-react";

import { authHeaders } from "@/lib/auth/operator-fetch";
import { Card, LoadFailure, PageHeader, PillButton, StatCard, SubNav } from "../ui";
import { LiveTable } from "../LiveTable";

/**
 * Lead Generation & Management — the screen that already existed, now reading
 * the leads that exist.
 *
 * It showed 1,284 total leads, 42 new today, 318 qualified, 87 converted this
 * month and an average score of 71. There are 129 leads, and none of those five
 * numbers came from anywhere.
 *
 * Lead Manager owns the lead, and this does not become a second CRM: every
 * figure is read from the same tables Lead Manager writes, and per-lead work -
 * assigning, calling, converting - stays there, one click away. What this adds
 * is the product view, which is the reason lead operations appear in the
 * Marketplace Manager at all: which product produced the lead, which CTA, and
 * how each source performs.
 *
 * Two things it refuses to do. An average of no scores is reported as "not
 * scored" rather than 0, and a conversion rate is withheld below five leads,
 * because one lead that converted is not a 100% source.
 */

type Pipeline = { tab: string; count: number; statuses: string[] };
type Source = {
  source: string; leads: number; qualified: number; converted: number;
  conversion_rate: number | null; average_score: number | null;
};

type Console = {
  ok: boolean;
  timezone: string;
  metrics: {
    total: number; new_today: number; qualified: number; converted_mtd: number;
    average_score: number | null; scored: number; unassigned: number;
    overdue_followups: number; duplicates: number;
  };
  pipeline: Pipeline[];
  raw_statuses: Record<string, number>;
  sources: Source[];
  products: { product_id: string; name: string; leads: number; converted: number }[];
  configured: { sources: number; routing_rules: number; agents: number; open_escalations: number };
  note: string;
};

const n = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : new Intl.NumberFormat().format(v);

export function LeadOps() {
  const [data, setData] = useState<Console | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [tab, setTab] = useState("Pipeline");

  const load = useCallback(async () => {
    setError(null);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
      const response = await fetch(`/api/leads/console?tz=${encodeURIComponent(tz)}`, {
        headers: await authHeaders(),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(new Error(payload?.error ?? (response.status === 401 || response.status === 403
          ? "Sign in as an operator to open lead operations."
          : "Could not read the leads.")));
        return;
      }
      setData(payload as Console);
    } catch {
      setError(new Error("Could not reach the server."));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const m = data?.metrics;
  const active = data?.pipeline.find((p) => p.tab === tab);

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Governance · Lead Ops"
        title="Lead Generation & Management"
        description="Every product page collects leads via demo, callback, WhatsApp, email, sales, brochure and enterprise inquiry — all routed here."
        actions={
          <>
            <PillButton variant="ghost" onClick={() => window.dispatchEvent(new CustomEvent("sv:open-vala-ai"))}>
              Vala AI
            </PillButton>
            <Link to="/lead-manager" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted">
              <DownloadCloud className="h-3.5 w-3.5" /> Open Lead Manager
            </Link>
          </>
        }
      />

      {error ? <LoadFailure error={error} what="lead operations" onRetry={() => void load()} /> : null}

      <SubNav items={["Pipeline", "New", "Contacted", "Qualified", "Converted", "Lost"]} active={tab} onChange={setTab} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Total leads" value={n(m?.total)} tone="premium" />
        <StatCard label="New today" value={n(m?.new_today)} tone="success" />
        <StatCard label="Qualified" value={n(m?.qualified)} />
        <StatCard label="Converted MTD" value={n(m?.converted_mtd)} tone="success" />
        <StatCard
          label="Average score"
          value={m ? (m.average_score === null ? "not scored" : String(m.average_score)) : "—"}
          tone="warning"
        />
      </div>

      {!data ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Reading the leads…
        </div>
      ) : (
        <>
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            {[
              ["Unassigned", m!.unassigned],
              ["Follow-ups overdue", m!.overdue_followups],
              ["Marked duplicate", m!.duplicates],
              ["Open escalations", data.configured.open_escalations],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg border border-border bg-background/40 px-3 py-2">
                <div className="text-[11px] text-muted-foreground">{label}</div>
                <div className="text-sm font-bold">{n(Number(value))}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <div className="mb-3 text-sm font-bold">
                {tab === "Pipeline" ? "Pipeline" : `${tab} — ${n(active?.count)} lead(s)`}
              </div>
              <div className="space-y-1.5">
                {data.pipeline.map((p) => (
                  <button
                    key={p.tab}
                    onClick={() => setTab(p.tab)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                      tab === p.tab ? "border-accent/50 bg-accent/[0.06]" : "border-border bg-background/40 hover:bg-white/[0.03]"
                    }`}
                  >
                    <div>
                      <div className="text-[12px] font-semibold">{p.tab}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {p.statuses.length ? p.statuses.join(", ") : "no leads in this state"}
                      </div>
                    </div>
                    <span className="text-sm font-bold">{n(p.count)}</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Every status held
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {Object.entries(data.raw_statuses).sort((a, b) => b[1] - a[1]).map(([s, c]) => (
                  <span key={s} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                    {s} {c}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Counted in {data.timezone}, so "today" and "this month" mean the operator's day.
              </p>
            </Card>

            <Card>
              <div className="mb-3 text-sm font-bold">By CTA and source</div>
              <div className="space-y-1">
                {data.sources.slice(0, 12).map((s) => (
                  <div key={s.source} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-1.5 text-[11px]">
                    <span className="min-w-0 flex-1 truncate font-semibold">{s.source}</span>
                    <span className="text-muted-foreground">{n(s.leads)} leads</span>
                    <span className="text-muted-foreground">{n(s.converted)} won</span>
                    <span className="w-14 text-right font-semibold">
                      {s.conversion_rate === null ? "—" : `${s.conversion_rate}%`}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                A conversion rate is withheld below five leads — one lead that converted is not a 100% source.
              </p>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <div className="mb-3 text-sm font-bold">Products producing leads</div>
              {data.products.length === 0 ? (
                <div className="text-[12px] text-muted-foreground">No lead is linked to a product yet.</div>
              ) : (
                <div className="space-y-1">
                  {data.products.map((p) => (
                    <div key={p.product_id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-1.5 text-[11px]">
                      <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                      <span className="text-muted-foreground">{n(p.leads)} leads</span>
                      <span className="w-12 text-right">{n(p.converted)} won</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <div className="mb-3 text-sm font-bold">Routing configuration</div>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                {[
                  ["Sources", data.configured.sources],
                  ["Routing rules", data.configured.routing_rules],
                  ["Agents", data.configured.agents],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg border border-border bg-background/40 px-3 py-2">
                    <div className="text-muted-foreground">{label}</div>
                    <div className="font-semibold">{n(Number(value))}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">{data.note}</p>
            </Card>
          </div>

          <div className="mt-4">
            <LiveTable
              resource="leads"
              title="Leads"
              columns={["name", "email", "phone", "status", "source", "created_at"]}
              description="Reading the leads…"
            />
          </div>
        </>
      )}
    </div>
  );
}
