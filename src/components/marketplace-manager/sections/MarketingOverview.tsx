import { AlertTriangle, ArrowUpRight, FlaskConical, Plug } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Card, EmptyHint, LoadFailure, PageHeader, StatCard } from "../ui";
import { getMarketingProviders, type ProviderStatus } from "@/lib/marketing/providers.functions";
import { getMarketingSummary } from "@/lib/marketing/summary.functions";

/**
 * Marketing, inside the Marketplace Manager.
 *
 * This was a ModulePage listing twelve channel names over four stat cards with
 * no values. It is not rebuilt into a second marketing suite, because one
 * already exists: /marketing has seventeen routes and twenty-six tables behind
 * it, and duplicating that here is exactly what must not happen.
 *
 * What this screen does instead is tell the truth about that suite and hand you
 * to it: how much of the data is demonstration data, and which channels can
 * actually send.
 *
 * Both numbers matter. Ten seeded campaigns assert roughly ₹2.62 crore of
 * revenue and 12,451 leads against ten real lead records, and no messaging
 * provider is configured at all — so every channel tab in that suite currently
 * describes a capability the server does not have.
 */

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(Number(n) || 0);

function ProviderRow({ p }: { p: ProviderStatus }) {
  return (
    <div className="rounded-lg border border-border/60 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{p.label}</span>
        <span
          className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            p.connected
              ? "bg-success/15 text-success"
              : "bg-destructive/15 text-destructive"
          }`}
        >
          {p.connected ? "connected" : "not connected"}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{p.note}</p>
      {!p.connected && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Needs one of: <code>{p.requires.join("</code>, <code>")}</code>
        </p>
      )}
    </div>
  );
}

export function MarketingSection() {
  const providers = useQuery({
    queryKey: ["marketing", "providers"],
    queryFn: () => getMarketingProviders(),
    staleTime: 60_000,
  });

  const summary = useQuery({
    queryKey: ["marketing", "summary"],
    queryFn: () => getMarketingSummary(),
    staleTime: 60_000,
  });

  const failed = summary.isError ? summary.error : providers.isError ? providers.error : null;

  const s = summary.data as {
    ok?: boolean;
    real_campaigns?: number; seed_campaigns?: number;
    seed_revenue?: number; seed_leads?: number; lead_records?: number;
    templates?: number; automations?: number; approvals_pending?: number;
  } | undefined;

  const p = providers.data;
  const n = (v?: number) => (summary.isLoading ? "…" : String(v ?? 0));

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Marketing Suite"
        title="Marketing"
        description="Email, SMS, push, WhatsApp, Telegram, Discord, campaigns and loyalty."
        actions={
          <a
            href="/marketing"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/[0.03] px-5 py-2 text-[12px] font-bold text-foreground hover:bg-white/[0.06]"
          >
            Open Marketing Manager <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Real campaigns" value={n(s?.real_campaigns)} tone="success" />
        <StatCard label="Demonstration campaigns" value={n(s?.seed_campaigns)} tone="warning" />
        <StatCard
          label="Channels connected"
          value={providers.isLoading ? "…" : `${p?.connected ?? 0} / ${p?.total ?? 0}`}
          tone={p && p.connected > 0 ? "success" : "destructive"}
        />
        <StatCard label="Actual lead records" value={n(s?.lead_records)} />
      </div>

      {s?.seed_campaigns ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
          <FlaskConical className="mt-0.5 h-4 w-4 flex-none" />
          <span>
            <b>The marketing figures are demonstration data.</b>{" "}
            {s.seed_campaigns} seeded campaign{s.seed_campaigns === 1 ? "" : "s"} assert{" "}
            {inr(s.seed_revenue ?? 0)} of revenue and{" "}
            {(s.seed_leads ?? 0).toLocaleString()} leads against{" "}
            {s.lead_records ?? 0} actual lead record{s.lead_records === 1 ? "" : "s"}. They
            came with the module and are kept for reference; {s.real_campaigns ?? 0} campaign
            {s.real_campaigns === 1 ? " is" : "s are"} real.
          </span>
        </div>
      ) : null}

      {p && p.connected === 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
          <span>
            <b>No messaging provider is connected.</b> Nothing can be delivered on any
            channel, and no campaign will be reported as sent. Configure a provider below
            and the channel enables itself.
          </span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <h3 className="mb-1 flex items-center gap-2 text-base font-bold">
            <Plug className="h-4 w-4 text-accent" /> Channel connections
          </h3>
          <p className="mb-3 text-[11px] text-muted-foreground">
            Checked on the server against the environment. Only the setting names are
            shown here — never a value.
          </p>
          {failed ? (
            <LoadFailure
              error={failed}
              what="the marketing console"
              onRetry={() => { void summary.refetch(); void providers.refetch(); }}
            />
          ) : null}
          {providers.isLoading && <EmptyHint text="Checking the providers…" />}
          <div className="grid gap-1.5 sm:grid-cols-2">
            {(p?.providers ?? []).map((prov) => (
              <ProviderRow key={prov.channel} p={prov} />
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 text-base font-bold">What is already built</h3>
          <p className="mb-3 text-[11px] text-muted-foreground">
            The Marketing Manager is its own module at <code>/marketing</code> with
            seventeen screens and twenty-six tables. This panel does not duplicate it.
          </p>
          <div className="space-y-1">
            {[
              ["Campaigns", "/marketing/campaigns"],
              ["Campaign builder", "/marketing/campaign-builder"],
              ["Approvals", "/marketing/approvals"],
              ["Performance", "/marketing/performance"],
              ["ROI analytics", "/marketing/analytics"],
              ["AI automation", "/marketing/ai-automation"],
              ["Audit", "/marketing/audit"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-1.5 text-sm hover:border-accent/60"
              >
                <span>{label}</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
              </a>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-border/60 py-2">
              <div className="text-sm font-bold">{n(s?.templates)}</div>
              <div className="text-[10px] text-muted-foreground">Templates</div>
            </div>
            <div className="rounded-lg border border-border/60 py-2">
              <div className="text-sm font-bold">{n(s?.automations)}</div>
              <div className="text-[10px] text-muted-foreground">Automations</div>
            </div>
            <div className="rounded-lg border border-border/60 py-2">
              <div className="text-sm font-bold">{n(s?.approvals_pending)}</div>
              <div className="text-[10px] text-muted-foreground">Approvals</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default MarketingSection;
