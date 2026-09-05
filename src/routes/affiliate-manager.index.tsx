import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, AlertTriangle, BadgeCheck, Banknote, Coins, Download, Globe2, Link2,
  Loader2, Megaphone, RefreshCcw, ShoppingBag, TrendingUp, UserCheck, Users, Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/affiliate/PageHeader";
import { KpiCard, KpiGrid } from "@/components/affiliate/KpiCard";
import { WallShell, TwoCol } from "@/components/affiliate/WallShell";
import { SectionCard, StatusBadge } from "@/components/affiliate/StatusBadge";
import { ChartEmpty, EmptyState } from "@/components/affiliate/EmptyState";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/affiliate-format";
import { TimeAgo } from "@/components/affiliate/Money";

export const Route = createFileRoute("/affiliate-manager/")({
  head: () => ({ meta: [{ title: "Dashboard — Affiliate Manager" }] }),
  component: DashboardWall,
});

type DashboardStats = {
  affiliates_total: number;
  affiliates_verified: number;
  affiliates_pending: number;
  affiliates_suspended: number;
  countries: number;
  links_total: number;
  campaigns_active: number;
  leads_30d: number;
  customers_30d: number;
  sales_30d: number;
  revenue_cents_30d: number;
  commission_approved_cents: number;
  wallet_balance_cents: number;
  payouts_pending_cents: number;
};

type TopAffiliate = {
  id: string;
  display_name: string;
  country: string | null;
  status: string;
  revenue_cents: number;
  commission_cents: number;
  conversions: number;
};

type ActivityRow = {
  id: string;
  action: string;
  entity: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

async function fetchStats(): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc("affiliate_dashboard_stats");
  if (error) throw error;
  return data as unknown as DashboardStats;
}
async function fetchTop(): Promise<TopAffiliate[]> {
  const { data, error } = await supabase.rpc("affiliate_top", { _limit: 5 });
  if (error) throw error;
  return (data ?? []) as TopAffiliate[];
}
async function fetchActivity(): Promise<ActivityRow[]> {
  const { data, error } = await supabase
    .from("activity_log")
    .select("id, action, entity, created_at, metadata")
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) throw error;
  return (data ?? []) as ActivityRow[];
}

const money = (cents: number | null | undefined, currency = "USD") =>
  cents == null ? "—" : formatMoney(cents, currency);
const num = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("en-US").format(n);

function DashboardWall() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const stats = useQuery({
    queryKey: ["affiliate", "dashboard-stats"],
    queryFn: fetchStats,
    enabled: authed === true,
    staleTime: 30_000,
    retry: 1,
  });
  const top = useQuery({
    queryKey: ["affiliate", "top-5"],
    queryFn: fetchTop,
    enabled: authed === true,
    staleTime: 30_000,
    retry: 1,
  });
  const activity = useQuery({
    queryKey: ["affiliate", "activity", 12],
    queryFn: fetchActivity,
    enabled: authed === true,
    staleTime: 15_000,
    retry: 1,
  });

  // Realtime cache invalidation for KPIs/top/activity is handled centrally
  // by useAffiliateRealtimeSync in the affiliate-manager layout, which also
  // dedupes, retries, and orders events across every open workspace tab.

  const loading = authed === null || stats.isLoading;
  const errored = stats.isError;
  const s = stats.data;

  return (
    <>
      <PageHeader
        title="Global Affiliate Overview"
        description="Realtime control center for every affiliate, referral, campaign, commission and payout across Software Vala."
        crumbs={[{ label: "Boss Panel" }, { label: "Affiliate Manager" }, { label: "Dashboard" }]}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                stats.refetch();
                top.refetch();
                activity.refetch();
              }}
              disabled={stats.isFetching}
            >
              {stats.isFetching ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCcw className="size-3.5" />
              )}
              Refresh
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <Link to="/affiliate-manager/export">
                <Download className="size-3.5" /> Export
              </Link>
            </Button>
            <Button size="sm" className="gap-1.5" asChild>
              <Link to="/affiliate-manager/campaigns">
                <Megaphone className="size-3.5" /> Launch Campaign
              </Link>
            </Button>
          </>
        }
      />

      <WallShell>
        {authed === false && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-[13px] text-warning-foreground flex items-start gap-2">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">Sign in required</div>
              <div className="text-warning-foreground/80">
                Live KPIs, top affiliates and activity are only accessible to Admin and Manager
                operators. Sign in to load production data.
              </div>
            </div>
          </div>
        )}

        {errored && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-[13px] text-destructive flex items-start gap-2">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium">Could not load dashboard stats</div>
              <div className="text-destructive/80 truncate">
                {(stats.error as Error)?.message ?? "Unknown error"}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => stats.refetch()}>
              Retry
            </Button>
          </div>
        )}

        <KpiGrid>
          <KpiCard
            label="Total Affiliates"
            value={loading ? "…" : num(s?.affiliates_total ?? 0)}
            hint={
              s
                ? `${num(s.affiliates_verified)} verified · ${num(s.affiliates_pending)} pending · ${num(s.affiliates_suspended)} suspended`
                : "Verified · Pending · Suspended"
            }
            icon={<Users className="size-4" />}
            tone="primary"
          />
          <KpiCard label="Verified" value={loading ? "…" : num(s?.affiliates_verified ?? 0)} hint="KYC approved" icon={<BadgeCheck className="size-4" />} tone="success" />
          <KpiCard label="Countries" value={loading ? "…" : num(s?.countries ?? 0)} hint="Active regions" icon={<Globe2 className="size-4" />} />
          <KpiCard label="Referral Links" value={loading ? "…" : num(s?.links_total ?? 0)} hint="All time" icon={<Link2 className="size-4" />} />
          <KpiCard label="Leads Generated" value={loading ? "…" : num(s?.leads_30d ?? 0)} hint="Last 30 days" icon={<UserCheck className="size-4" />} />
          <KpiCard label="Customers Acquired" value={loading ? "…" : num(s?.customers_30d ?? 0)} hint="Last 30 days" icon={<ShoppingBag className="size-4" />} />
          <KpiCard label="Sales" value={loading ? "…" : num(s?.sales_30d ?? 0)} hint="Completed orders · 30d" icon={<TrendingUp className="size-4" />} />
          <KpiCard label="Revenue" value={loading ? "…" : money(s?.revenue_cents_30d ?? 0)} hint="Gross, last 30 days" icon={<Coins className="size-4" />} />
          <KpiCard label="Commission Earned" value={loading ? "…" : money(s?.commission_approved_cents ?? 0)} hint="Approved + Paid" icon={<Banknote className="size-4" />} />
          <KpiCard label="Wallet Balance" value={loading ? "…" : money(s?.wallet_balance_cents ?? 0)} hint="Across all wallets" icon={<Wallet className="size-4" />} />
          <KpiCard label="Pending Payouts" value={loading ? "…" : money(s?.payouts_pending_cents ?? 0)} hint="Awaiting settlement" icon={<Wallet className="size-4" />} tone="warning" />
          <KpiCard label="Active Campaigns" value={loading ? "…" : num(s?.campaigns_active ?? 0)} hint="Running now" icon={<Megaphone className="size-4" />} />
        </KpiGrid>

        <TwoCol>
          <div className="lg:col-span-2 space-y-4">
            <SectionCard
              title="Revenue & Commission"
              action={<span className="text-[11px] text-muted-foreground">Last 30 days</span>}
            >
              <ChartEmpty label="Revenue / commission trend appears once orders flow in" />
            </SectionCard>
            <SectionCard
              title="Global Affiliate Map"
              action={<span className="text-[11px] text-muted-foreground">All regions</span>}
            >
              <ChartEmpty label="Country distribution map appears once affiliates onboard" />
            </SectionCard>
          </div>
          <div className="space-y-4">
            <SectionCard
              title="Top Affiliates"
              action={
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/affiliate-manager/affiliates">View all</Link>
                </Button>
              }
              padded={false}
            >
              <TopAffiliatesList query={top} />
            </SectionCard>
            <SectionCard
              title="Live Activity"
              action={
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-success animate-pulse" /> Live
                </span>
              }
              padded={false}
            >
              <ActivityList query={activity} />
            </SectionCard>
            <SectionCard title="Quick Actions">
              <div className="grid grid-cols-2 gap-2">
                <QuickLink to="/affiliate-manager/applications">Approve KYC</QuickLink>
                <QuickLink to="/affiliate-manager/campaigns">Create Campaign</QuickLink>
                <QuickLink to="/affiliate-manager/payouts">Issue Payout</QuickLink>
                <QuickLink to="/affiliate-manager/referral-codes">Generate Codes</QuickLink>
                <QuickLink to="/affiliate-manager/communication">Broadcast</QuickLink>
                <QuickLink to="/affiliate-manager/affiliates">New Affiliate</QuickLink>
              </div>
            </SectionCard>
          </div>
        </TwoCol>
      </WallShell>
    </>
  );
}

function QuickLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Button variant="outline" size="sm" className="justify-start" asChild>
      <Link to={to}>{children}</Link>
    </Button>
  );
}

function TopAffiliatesList({
  query,
}: {
  query: { isLoading: boolean; isError: boolean; data?: TopAffiliate[] };
}) {
  if (query.isLoading)
    return (
      <div className="px-4 py-8 flex items-center justify-center text-[12px] text-muted-foreground gap-2">
        <Loader2 className="size-3.5 animate-spin" /> Loading top affiliates…
      </div>
    );
  if (query.isError)
    return (
      <div className="px-4 py-6 text-[12px] text-destructive">Failed to load top affiliates.</div>
    );
  const rows = query.data ?? [];
  if (rows.length === 0)
    return (
      <EmptyState
        icon={Users}
        title="No affiliates yet"
        description="Top performers rank here by revenue, conversions and commission earned."
      />
    );
  return (
    <ul className="divide-y divide-border">
      {rows.map((r, i) => (
        <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
          <div className="grid size-7 place-items-center rounded-md bg-muted text-[11px] font-semibold text-foreground tabular-nums">
            {i + 1}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="truncate font-medium text-sm text-foreground">{r.display_name}</div>
              <StatusBadge
                tone={
                  r.status === "verified"
                    ? "success"
                    : r.status === "suspended"
                      ? "destructive"
                      : "neutral"
                }
              >
                {r.status}
              </StatusBadge>
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              {r.country ?? "—"} · {num(r.conversions)} conversions
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold tabular-nums">{money(r.revenue_cents)}</div>
            <div className="text-[11px] text-muted-foreground tabular-nums">
              {money(r.commission_cents)} comm.
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ActivityList({
  query,
}: {
  query: { isLoading: boolean; isError: boolean; data?: ActivityRow[] };
}) {
  if (query.isLoading)
    return (
      <div className="px-4 py-8 flex items-center justify-center text-[12px] text-muted-foreground gap-2">
        <Loader2 className="size-3.5 animate-spin" /> Streaming activity…
      </div>
    );
  if (query.isError)
    return <div className="px-4 py-6 text-[12px] text-destructive">Failed to load activity.</div>;
  const rows = query.data ?? [];
  if (rows.length === 0)
    return (
      <EmptyState
        icon={Activity}
        title="Quiet on the wire"
        description="Clicks, signups, sales and payouts stream in here in realtime."
      />
    );
  return (
    <ul className="divide-y divide-border">
      {rows.map((r) => (
        <li key={r.id} className="flex items-start gap-3 px-4 py-2.5">
          <div className="mt-1 size-1.5 rounded-full bg-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-sm text-foreground truncate">
              <span className="font-medium">{r.action}</span>
              {r.entity && <span className="text-muted-foreground"> · {r.entity}</span>}
            </div>
            <div className="text-[11px] text-muted-foreground">
              <TimeAgo value={r.created_at} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
