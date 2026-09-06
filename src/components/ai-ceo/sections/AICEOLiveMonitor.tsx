import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  RefreshCw,
  Shield,
  Target,
  TrendingDown,
  TrendingUp,
  User,
} from "lucide-react";

import {
  DegradedNotice,
  EmptyState,
  LoadingState,
  PageBanner,
  PageShell,
} from "@/components/ai-ceo/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCEOSuggestions, type ActivityEvent } from "@/hooks/useCEOSuggestions";

/**
 * What has actually happened across the platform, newest first.
 *
 * This screen shipped with eight invented rows — "Super Admin modified
 * permission matrix", "Developer #7 deployed hotfix v2.3.1" — each carrying a
 * precise risk percentage that was typed in by hand. None of it had happened,
 * and a percentage that looks calculated but is not is the most misleading
 * thing an executive screen can show.
 *
 * Every row here is a real record: an order, an audit entry, a support ticket
 * or a lead. The risk column is gone as a number and replaced by a review flag
 * derived from the record itself — a negative outcome on a security, risk or
 * compliance event needs looking at, and nothing else claims to be scored.
 */

const IMPACT_STYLE: Record<ActivityEvent["impact"], string> = {
  negative: "bg-destructive/20 text-destructive border-destructive/30",
  neutral: "bg-accent-amber/20 text-accent-amber border-accent-amber/30",
  positive: "bg-accent-emerald/20 text-accent-emerald border-accent-emerald/30",
};

const TYPE_ICON: Record<ActivityEvent["type"], typeof User> = {
  risk: AlertTriangle,
  revenue: TrendingUp,
  operations: Activity,
  security: Shield,
  compliance: CheckCircle,
};

/**
 * Whether a row is worth a human look, derived from the record rather than
 * scored. Deliberately a flag and not a percentage: the underlying data
 * supports "this went badly in a sensitive area" and nothing finer.
 */
function needsReview(event: ActivityEvent): boolean {
  return event.impact === "negative" &&
    (event.type === "risk" || event.type === "security" || event.type === "compliance");
}

const FILTERS: Array<{ label: string; value: ActivityEvent["type"] | "all" }> = [
  { label: "All", value: "all" },
  { label: "Revenue", value: "revenue" },
  { label: "Risk", value: "risk" },
  { label: "Operations", value: "operations" },
  { label: "Security", value: "security" },
  { label: "Compliance", value: "compliance" },
];

const AICEOLiveMonitor = () => {
  const { activityEvents, isLoading, degraded, lastRefresh, refresh, isRefreshing } =
    useCEOSuggestions();
  const [filter, setFilter] = useState<ActivityEvent["type"] | "all">("all");

  const rows = useMemo(
    () => (filter === "all" ? activityEvents : activityEvents.filter((e) => e.type === filter)),
    [activityEvents, filter],
  );

  /** Counted from the events themselves. */
  const stats = useMemo(() => {
    const byType = activityEvents.reduce<Record<string, number>>((acc, e) => {
      acc[e.type] = (acc[e.type] ?? 0) + 1;
      return acc;
    }, {});
    return [
      { label: "Revenue", count: byType.revenue ?? 0, icon: TrendingUp },
      { label: "Operations", count: byType.operations ?? 0, icon: Activity },
      { label: "Security", count: byType.security ?? 0, icon: Shield },
      { label: "Needs Review", count: activityEvents.filter(needsReview).length, icon: AlertTriangle },
      { label: "Positive", count: activityEvents.filter((e) => e.impact === "positive").length, icon: CheckCircle },
    ];
  }, [activityEvents]);

  return (
    <PageShell>
      <PageBanner
        icon={Activity}
        title="Live Action Monitor"
        subtitle="Orders, audit entries, support tickets and leads across the platform, newest first."
        status={
          lastRefresh
            ? `${activityEvents.length} events · read ${lastRefresh.toLocaleTimeString()}`
            : `${activityEvents.length} events`
        }
        actions={
          <Button size="sm" variant="secondary" onClick={refresh} disabled={isRefreshing} className="gap-2">
            <RefreshCw className={isRefreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            {isRefreshing ? "Reading…" : "Read again"}
          </Button>
        }
      />

      <DegradedNotice sources={degraded} />

      {isLoading && !activityEvents.length && <LoadingState label="Reading the activity feed…" rows={2} />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.label} className="card3d premium-halo enter-soft rounded-2xl">
            <CardContent className="flex items-center gap-3 p-4">
              <stat.icon className="h-5 w-5 text-primary-glow" aria-hidden="true" />
              <div>
                <p className="text-lg font-bold text-foreground">{stat.count}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
        <CardHeader>
          <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <CardTitle className="flex min-w-0 items-center gap-2 text-foreground">
              <Activity className="h-5 w-5 shrink-0 text-primary-glow" aria-hidden="true" />
              <span className="truncate">Action Stream</span>
            </CardTitle>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 lg:justify-end">
              {FILTERS.map((f) => (
                <Button
                  key={f.value}
                  size="sm"
                  variant="ghost"
                  onClick={() => setFilter(f.value)}
                  className={`h-7 px-3 text-xs ${
                    filter === f.value
                      ? "bg-primary/20 text-primary-glow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!isLoading && !rows.length ? (
            <EmptyState
              icon={Activity}
              title="Nothing recorded in this view"
              description="No orders, audit entries, tickets or leads match this filter yet."
            />
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {rows.map((event, i) => {
                  const Icon = TYPE_ICON[event.type] ?? User;
                  const review = needsReview(event);
                  return (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i, 10) * 0.04 }}
                      className="rounded-lg border border-border bg-surface p-4 transition-all hover:border-primary/30"
                    >
                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/10">
                            <Icon className="h-5 w-5 text-primary-glow" aria-hidden="true" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-foreground">{event.actor}</span>
                              <Badge variant="outline" className="text-xs">
                                {event.type}
                              </Badge>
                            </div>
                            <p className="truncate text-sm text-muted-foreground">
                              {event.action}
                              <span className="mx-1 text-muted-foreground/60">→</span>
                              <span className="text-foreground">{event.target}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:justify-end">
                          <Badge className={IMPACT_STYLE[event.impact]}>
                            {event.impact === "positive" ? (
                              <TrendingUp className="mr-1 h-3 w-3" aria-hidden="true" />
                            ) : event.impact === "negative" ? (
                              <TrendingDown className="mr-1 h-3 w-3" aria-hidden="true" />
                            ) : null}
                            {event.impact}
                          </Badge>
                          {review && (
                            <Badge className="bg-destructive/20 text-destructive">
                              <Target className="mr-1 h-3 w-3" aria-hidden="true" /> Review
                            </Badge>
                          )}
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span className="text-xs">{event.timestamp}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-3">
          <Eye className="h-5 w-5 shrink-0 text-primary-glow" aria-hidden="true" />
          <p className="text-sm text-primary-glow/80">
            <strong>Observation Mode:</strong> this stream is read from the platform's own records
            and is read-only. "Review" marks a negative outcome in a risk, security or compliance
            record — it is a flag drawn from the record, not a calculated score.
          </p>
        </div>
      </div>
    </PageShell>
  );
};

export default AICEOLiveMonitor;
