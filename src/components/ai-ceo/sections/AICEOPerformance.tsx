import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { DegradedNotice, ErrorState, PageBanner, PageShell } from "@/components/ai-ceo/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Users, Target, Award, AlertCircle, RefreshCw } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";

/**
 * Performance Intelligence.
 *
 * Each figure is a plain rate counted from the platform's own records, read
 * through the signed-in executive's session (RLS applies). Where nothing is
 * recorded for a role or metric, it is shown as "—" / "Not tracked" rather
 * than a score. No trend is shown: no history of these rates is stored.
 */

// Tables used here are not all in the generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type Rows = Record<string, unknown>[];

async function read(table: string, select: string, limit = 5000): Promise<Rows> {
  const { data, error } = await db.from(table).select(select).limit(limit);
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []) as Rows;
}

/** Each source fails on its own; a failed source is named, never zeroed. */
async function settle(table: string, select: string, degraded: string[]): Promise<Rows | null> {
  try {
    return await read(table, select);
  } catch {
    degraded.push(table);
    return null;
  }
}

interface RolePerformance {
  role: string;
  score: number | null;
  metric: string;
  basis: string;
}

interface ProductivityMetric {
  metric: string;
  value: string;
  basis: string;
}

interface PerformanceData {
  roles: RolePerformance[];
  productivity: ProductivityMetric[];
  degraded: string[];
}

const rate = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);
const lower = (v: unknown) => String(v ?? "").toLowerCase();

async function loadPerformance(): Promise<PerformanceData> {
  const degraded: string[] = [];
  const [tickets, leads, devTasks, tmTasks, franchise] = await Promise.all([
    settle("support_tickets", "status,created_at,first_response_at", degraded),
    settle("leads", "status", degraded),
    settle("developer_tasks", "status", degraded),
    settle("tm_tasks", "status,quality_score,completed_at", degraded),
    settle("franchise_performance", "period,leads,conversions", degraded),
  ]);

  // Support: share of tickets resolved or closed.
  const supportDone =
    tickets?.filter((t) => ["resolved", "closed"].includes(lower(t.status))).length ?? 0;
  // Sales: won among decided leads.
  const won = leads?.filter((l) => lower(l.status) === "won").length ?? 0;
  const lost = leads?.filter((l) => lower(l.status) === "lost").length ?? 0;
  // Developers: share of assigned tasks completed.
  const devDone = devTasks?.filter((t) => lower(t.status) === "completed").length ?? 0;
  // Franchises: lead conversion in the latest reported period.
  const latestPeriod =
    franchise
      ?.map((f) => String(f.period ?? ""))
      .sort()
      .pop() ?? null;
  const periodRows = franchise?.filter((f) => String(f.period ?? "") === latestPeriod) ?? [];
  const fLeads = periodRows.reduce((sum, f) => sum + (Number(f.leads) || 0), 0);
  const fConv = periodRows.reduce((sum, f) => sum + (Number(f.conversions) || 0), 0);

  const roles: RolePerformance[] = [
    {
      role: "Franchises",
      score: franchise ? rate(fConv, fLeads) : null,
      metric: "Lead conversion",
      basis: franchise
        ? latestPeriod
          ? `${fConv} of ${fLeads} leads · ${latestPeriod}`
          : "No reported period"
        : "franchise_performance unavailable",
    },
    {
      role: "Resellers",
      score: null,
      metric: "Not tracked",
      basis: "No reseller performance record exists",
    },
    {
      role: "Support Team",
      score: tickets ? rate(supportDone, tickets.length) : null,
      metric: "Tickets resolved",
      basis: tickets
        ? `${supportDone} of ${tickets.length} tickets`
        : "support_tickets unavailable",
    },
    {
      role: "Sales Team",
      score: leads ? rate(won, won + lost) : null,
      metric: "Lead win rate",
      basis: leads ? `${won} won of ${won + lost} decided leads` : "leads unavailable",
    },
    {
      role: "Developers",
      score: devTasks ? rate(devDone, devTasks.length) : null,
      metric: "Tasks completed",
      basis: devTasks ? `${devDone} of ${devTasks.length} tasks` : "developer_tasks unavailable",
    },
  ];

  // Productivity, from the Task Manager and support records.
  const since30 = Date.now() - 30 * 86_400_000;
  const completed30 =
    tmTasks?.filter((t) => t.completed_at && new Date(String(t.completed_at)).getTime() >= since30)
      .length ?? 0;
  const quality = (tmTasks ?? [])
    .map((t) => Number(t.quality_score))
    .filter((n) => Number.isFinite(n) && n >= 0);
  const tmDone =
    tmTasks?.filter((t) => ["completed", "approved", "closed"].includes(lower(t.status))).length ??
    0;
  const responseHours = (tickets ?? [])
    .filter((t) => t.first_response_at)
    .map(
      (t) =>
        (new Date(String(t.first_response_at)).getTime() -
          new Date(String(t.created_at)).getTime()) /
        3_600_000,
    )
    .filter((h) => Number.isFinite(h) && h >= 0)
    .sort((a, b) => a - b);
  const medianResponse = responseHours.length
    ? responseHours[Math.floor(responseHours.length / 2)]
    : null;

  const productivity: ProductivityMetric[] = [
    {
      metric: "Avg Tasks/Day",
      value: tmTasks ? (completed30 / 30).toFixed(1) : "—",
      basis: tmTasks ? `${completed30} tasks completed in 30 days` : "tm_tasks unavailable",
    },
    {
      metric: "Response Time",
      value: medianResponse === null ? "—" : `${medianResponse.toFixed(1)}h`,
      basis: tickets
        ? medianResponse === null
          ? "No first response recorded"
          : `Median of ${responseHours.length} tickets`
        : "support_tickets unavailable",
    },
    {
      metric: "Quality Score",
      value: quality.length
        ? `${Math.round(quality.reduce((a, b) => a + b, 0) / quality.length)}/100`
        : "—",
      basis: tmTasks
        ? quality.length
          ? `${quality.length} reviewed tasks`
          : "No task has a quality score"
        : "tm_tasks unavailable",
    },
    {
      metric: "Completion Rate",
      value: tmTasks && tmTasks.length ? `${rate(tmDone, tmTasks.length)}%` : "—",
      basis: tmTasks ? `${tmDone} of ${tmTasks.length} tasks` : "tm_tasks unavailable",
    },
  ];

  if (degraded.length === 5) throw new Error("None of the performance sources could be read.");
  return { roles, productivity, degraded };
}

const AICEOPerformance = () => {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ["ai-ceo", "performance"],
    queryFn: loadPerformance,
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const data = query.data;
  const productivityMetrics = data?.productivity ?? [];
  const rolePerformance = data?.roles ?? [];

  return (
    <PageShell>
      <PageBanner
        icon={TrendingUp}
        title="Performance Intelligence"
        subtitle="Ecosystem-wide performance intelligence across revenue, growth, efficiency and team output."
        status={query.isLoading ? "Loading…" : query.isError ? "Unavailable" : "Live metrics"}
      />

      {data && <DegradedNotice sources={data.degraded} />}

      {query.isError ? (
        <ErrorState
          description={
            query.error instanceof Error
              ? query.error.message
              : "The performance sources could not be read."
          }
          onRetry={() => void query.refetch()}
        />
      ) : (
        <>
          {/* Productivity Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {(query.isLoading
              ? ["Avg Tasks/Day", "Response Time", "Quality Score", "Completion Rate"].map((m) => ({
                  metric: m,
                  value: "—",
                  basis: "Loading…",
                }))
              : productivityMetrics
            ).map((metric, i) => (
              <motion.div
                key={metric.metric}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="card3d premium-halo enter-soft rounded-2xl">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">{metric.metric}</span>
                      {query.isLoading ? (
                        <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                    <p className="text-xl font-bold text-foreground">{metric.value}</p>
                    <p className="text-xs text-muted-foreground">{metric.basis}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Role Performance */}
            <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary-glow" />
                  {t("ceo.performance.role_performance")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[350px]">
                  <div className="space-y-4">
                    {query.isLoading && (
                      <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        {t("ceo.performance.loading")}
                      </p>
                    )}
                    {rolePerformance.map((role, i) => (
                      <motion.div
                        key={role.role}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="p-4 rounded-lg bg-surface border border-border"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{role.role}</span>
                            <Badge
                              className="bg-muted/20 text-muted-foreground"
                              title={t("ceo.performance.no_trend_reason")}
                            >
                              {role.score === null
                                ? t("ceo.performance.not_tracked")
                                : t("ceo.performance.no_trend")}
                            </Badge>
                          </div>
                          <span className="text-lg font-bold text-primary-glow">
                            {role.score === null ? "—" : `${role.score}%`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={role.score ?? 0} className="h-2 flex-1" />
                          <span className="text-xs text-muted-foreground">{role.metric}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">{role.basis}</p>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Corrective Actions */}
            <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Target className="w-5 h-5 text-accent-amber" />
                  {t("ceo.performance.corrective_actions")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 rounded-lg border bg-surface border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium text-foreground">
                        {t("ceo.performance.not_tracked")}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t("ceo.performance.no_corrective_engine")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* AI Notice */}
      <div className="p-4 rounded-lg bg-accent-emerald/5 border border-accent-emerald/20">
        <div className="flex items-center gap-3">
          <Award className="w-5 h-5 text-accent-emerald" />
          <p className="text-sm text-accent-emerald/80">
            <strong>Performance Analysis:</strong> Rates are counted directly from support tickets,
            leads, developer and Task Manager tasks, and franchise reports. No benchmark or target
            is configured.
          </p>
        </div>
      </div>
    </PageShell>
  );
};

export default AICEOPerformance;
