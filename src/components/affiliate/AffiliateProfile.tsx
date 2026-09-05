import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Activity, BadgeCheck, Ban, ExternalLink, Globe2, Mail, ShieldAlert, Ticket, TrendingUp,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { StatusBadge, SectionCard } from "./StatusBadge";
import { EntityAvatar, Money, TimeAgo } from "./Money";
import { Timeline, type TimelineEvent } from "./Timeline";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/affiliate-format";

export type AffiliateRecord = {
  id: string;
  display_name: string;
  email: string | null;
  code: string | null;
  country: string | null;
  status: string;
  health_score: number | null;
  risk_score: number | null;
  created_at?: string | null;
};

export function statusTone(status: string) {
  return /verified|active/i.test(status) ? "success"
    : /pending/i.test(status) ? "warning"
    : /suspend|reject/i.test(status) ? "destructive" : "neutral";
}

/** Shared data hooks so the drawer and the full profile page stay identical. */
export function useAffiliateProfileData(id: string | undefined) {
  const activity = useQuery({
    queryKey: ["affiliate", "profile-activity", id],
    enabled: !!id,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("id, action, entity, entity_id, metadata, created_at")
        .or(`entity_id.eq.${id},affiliate_id.eq.${id}`)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useQuery({
    queryKey: ["affiliate", "profile-stats", id],
    enabled: !!id,
    staleTime: 15_000,
    queryFn: async () => {
      const [commissions, links, orders] = await Promise.all([
        supabase.from("commissions").select("amount_cents").eq("affiliate_id", id!),
        supabase.from("affiliate_links").select("id", { count: "exact", head: true }).eq("affiliate_id", id!),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("affiliate_id", id!),
      ]);
      const earned = (commissions.data ?? []).reduce(
        (sum, c: { amount_cents: number | null }) => sum + (c.amount_cents ?? 0), 0,
      );
      return { earned, links: links.count ?? 0, orders: orders.count ?? 0 };
    },
  });

  const events: TimelineEvent[] = (activity.data ?? []).map((a) => ({
    id: a.id as string,
    title: String(a.action ?? "event").replace(/[._]/g, " "),
    description: a.entity ? `on ${a.entity}` : undefined,
    at: a.created_at as string,
    icon: Activity,
    tone: /approve|activate|verified|paid/i.test(String(a.action)) ? "success"
      : /suspend|reject|fail/i.test(String(a.action)) ? "destructive" : "default",
  }));

  return { activity, stats, events };
}

/** Identity block reused by the drawer header and the detail page header. */
export function AffiliateIdentity({
  affiliate,
  titleAs = "h1",
  fullProfileLink,
}: {
  affiliate: AffiliateRecord;
  titleAs?: "h1" | "div";
  fullProfileLink?: boolean;
}) {
  const Title = titleAs;
  return (
    <>
      <div className="flex items-start gap-3">
        <EntityAvatar name={affiliate.display_name} size="lg" />
        <div className="min-w-0 flex-1">
          <Title className="truncate font-display text-lg font-semibold tracking-tight">
            {affiliate.display_name}
          </Title>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Mail className="size-3" />{affiliate.email ?? "—"}</span>
            <span className="inline-flex items-center gap-1"><Ticket className="size-3" />{affiliate.code ?? "—"}</span>
            <span className="inline-flex items-center gap-1"><Globe2 className="size-3" />{affiliate.country ?? "—"}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge tone={statusTone(affiliate.status)}>{affiliate.status}</StatusBadge>
            {affiliate.created_at && (
              <span className="text-[11px] text-muted-foreground">
                Joined {formatDate(affiliate.created_at)}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" className="gap-1.5"><BadgeCheck className="size-3.5" /> Approve</Button>
        <Button size="sm" variant="outline" className="gap-1.5"><Ban className="size-3.5" /> Suspend</Button>
        <Button size="sm" variant="outline" className="gap-1.5"><Mail className="size-3.5" /> Message</Button>
        {fullProfileLink && (
          <Button asChild size="sm" variant="ghost" className="gap-1.5">
            <Link to="/affiliate-manager/affiliates/$id" params={{ id: affiliate.id }}>
              <ExternalLink className="size-3.5" /> Open full profile
            </Link>
          </Button>
        )}
      </div>
    </>
  );
}

/** Stats + scorecards + timeline body, shared by drawer and page. */
export function AffiliateProfileBody({ affiliate }: { affiliate: AffiliateRecord }) {
  const { activity, stats, events } = useAffiliateProfileData(affiliate.id);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Earned" value={<Money cents={stats.data?.earned} />} loading={stats.isLoading} />
        <MiniStat label="Links" value={(stats.data?.links ?? 0).toLocaleString()} loading={stats.isLoading} />
        <MiniStat label="Orders" value={(stats.data?.orders ?? 0).toLocaleString()} loading={stats.isLoading} />
      </div>

      <SectionCard title="Scorecards">
        <div className="grid grid-cols-2 gap-3">
          <Score label="Health" icon={<TrendingUp className="size-3.5" />} score={affiliate.health_score} good />
          <Score label="Risk" icon={<ShieldAlert className="size-3.5" />} score={affiliate.risk_score} />
        </div>
      </SectionCard>

      <SectionCard
        title="Activity timeline"
        action={
          activity.data?.length ? (
            <span className="text-[11px] text-muted-foreground">
              last <TimeAgo value={activity.data[0].created_at as string} />
            </span>
          ) : null
        }
      >
        {activity.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : (
          <Timeline events={events} />
        )}
      </SectionCard>
    </div>
  );
}

/**
 * Enterprise affiliate profile drawer: identity header, live KPI strip,
 * scorecards and an audit-backed activity timeline.
 */
export function AffiliateProfileDrawer({
  affiliate,
  onOpenChange,
}: {
  affiliate: AffiliateRecord | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={!!affiliate} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 bg-surface p-0 sm:max-w-xl">
        {affiliate && (
          <>
            <SheetHeader className="space-y-0 border-b border-border px-5 py-4">
              <SheetTitle className="sr-only">{affiliate.display_name}</SheetTitle>
              <AffiliateIdentity affiliate={affiliate} titleAs="div" fullProfileLink />
            </SheetHeader>
            <div className="scrollbar-thin flex-1 overflow-y-auto p-4">
              <AffiliateProfileBody affiliate={affiliate} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MiniStat({ label, value, loading }: { label: string; value: React.ReactNode; loading?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-lg font-semibold tabular-nums">
        {loading ? <span className="inline-block h-5 w-14 animate-pulse rounded bg-muted align-middle" /> : value}
      </div>
    </div>
  );
}

function Score({
  label, score, icon, good,
}: { label: string; score: number | null; icon: React.ReactNode; good?: boolean }) {
  const v = score ?? 0;
  const tone = good
    ? v >= 70 ? "bg-success" : v >= 40 ? "bg-warning" : "bg-destructive"
    : v >= 70 ? "bg-destructive" : v >= 40 ? "bg-warning" : "bg-success";
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">{icon} {label}</span>
        <span className="tabular-nums text-foreground">{score ?? "—"}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${tone} transition-all`} style={{ width: `${Math.min(100, v)}%` }} />
      </div>
    </div>
  );
}
