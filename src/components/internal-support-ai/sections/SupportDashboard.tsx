/**
 * Internal Support AI - Main Dashboard
 * Live issue overview (support_tickets), self-healing results
 * (founder_healing_*), AI decision confidence (ai_decision_logs) and SLA
 * position. Figures with no recorded source are shown as "Not tracked".
 */

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Users,
  Zap,
  Target,
  Shield,
  Brain,
  BarChart3,
  Gauge,
} from "lucide-react";
import {
  attemptSucceeded,
  avgResolutionMinutes,
  formatMinutes,
  isOpenEscalation,
  isOpenTicket,
  isToday,
  maskUser,
  pct,
  shortId,
  timeAgo,
  useAiDecisions,
  useHealing,
  useSupportEscalations,
  useSupportTickets,
} from "../data";
import { EmptyRow, ErrorRow, QueryRows } from "../states";
import { useTranslation } from "@/lib/i18n/use-translation";

interface SupportDashboardProps {
  activeView: string;
}

const DAY_MS = 86_400_000;

export const SupportDashboard: React.FC<SupportDashboardProps> = ({ activeView }) => {
  const { t } = useTranslation();
  const ticketsQ = useSupportTickets();
  const escalationsQ = useSupportEscalations();
  const healingQ = useHealing();
  const decisionsQ = useAiDecisions();

  const tickets = ticketsQ.data ?? [];
  const escalations = escalationsQ.data ?? [];
  const totals = healingQ.data?.totals ?? null;
  const timeline = healingQ.data?.timeline ?? [];

  const openTickets = useMemo(() => tickets.filter(isOpenTicket), [tickets]);
  const breached = openTickets.filter(
    (t) => t.sla_breached === true || (t.sla_minutes_remaining ?? 1) <= 0,
  );
  const atRisk = openTickets.filter(
    (t) =>
      !breached.includes(t) && t.sla_minutes_remaining !== null && t.sla_minutes_remaining <= 30,
  );
  const onTrack = openTickets.length - breached.length - atRisk.length;
  const resolvedTickets = tickets.filter((t) => t.resolved_at);
  const avgResolution = avgResolutionMinutes(tickets);

  const ticketsReady = !ticketsQ.isLoading && !ticketsQ.isError;
  const escalationsReady = !escalationsQ.isLoading && !escalationsQ.isError;

  const metrics = {
    activeIssues: ticketsReady ? String(openTickets.length) : "—",
    openedToday: tickets.filter((t) => isToday(t.created_at)).length,
    autoRecovered: totals ? String(totals.autoRecovered) : "—",
    autoFixSuccessRate: totals ? pct(totals.autoRecovered, totals.incidents) : null,
    escalatedIssues: escalationsReady ? String(escalations.filter(isOpenEscalation).length) : "—",
    slaAtRisk: ticketsReady ? String(atRisk.length) : "—",
    avgResolutionTime: ticketsReady ? formatMinutes(avgResolution) : "—",
  };

  // Mean confidence of recorded AI decisions (0..1 or 0..100 stored).
  const decisionRows = decisionsQ.data ?? [];
  const confidences = decisionRows
    .map((r) => Number(r.confidence))
    .filter((n) => Number.isFinite(n))
    .map((n) => (n <= 1 ? n * 100 : n));
  const aiConfidenceScore =
    confidences.length > 0
      ? Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 10) / 10
      : null;

  // Recovery attempts per day over the last seven days.
  const trend = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * DAY_MS);
      return {
        key: d.toDateString(),
        label: d.toLocaleDateString([], { weekday: "short" }),
        ok: 0,
        total: 0,
      };
    });
    for (const row of timeline) {
      if (row.attemptNumber === null || !row.attemptStartedAt) continue;
      const day = days.find(
        (d) => d.key === new Date(row.attemptStartedAt as string).toDateString(),
      );
      if (!day) continue;
      day.total += 1;
      if (attemptSucceeded(row)) day.ok += 1;
    }
    return days;
  }, [timeline]);
  const trendHasData = trend.some((d) => d.total > 0);

  const liveIssues = openTickets.slice(0, 8).map((t) => ({
    id: t.reference ?? shortId(t.id),
    type: t.category ? t.category.replace(/_/g, " ") : "—",
    user: maskUser(t.customer_id),
    status: (t.status ?? "unknown").toLowerCase(),
    priority: (t.priority ?? "low").toLowerCase(),
    time: timeAgo(t.created_at),
  }));

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "new":
      case "analyzing":
        return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
      case "assigned":
      case "in_progress":
      case "auto_fixing":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "escalated":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "resolved":
      case "closed":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      default:
        return "bg-muted/40 text-muted-foreground border-border";
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-red-500/20 text-red-400";
      case "high":
        return "bg-orange-500/20 text-orange-400";
      case "medium":
        return "bg-amber-500/20 text-amber-400";
      case "low":
        return "bg-muted/40 text-muted-foreground";
      default:
        return "bg-muted/40 text-muted-foreground";
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Metrics Grid */}
      <div className="grid grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-600/5 border-cyan-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {t("manager.support_ai.active_issues")}
                  </p>
                  <p className="text-2xl font-bold text-cyan-400 mt-1">{metrics.activeIssues}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-cyan-400" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-2">
                <TrendingUp className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] text-emerald-400">
                  {ticketsReady
                    ? `${metrics.openedToday} opened today`
                    : ticketsQ.isError
                      ? t("manager.support_ai.tickets_unavailable")
                      : t("manager.support_ai.loading_short")}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-gradient-to-br from-emerald-500/10 to-green-600/5 border-emerald-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {t("manager.support_ai.auto_recovered_short")}
                  </p>
                  <p className="text-2xl font-bold text-emerald-400 mt-1">
                    {metrics.autoRecovered}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-2">
                <Zap className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] text-emerald-400">
                  {metrics.autoFixSuccessRate === null
                    ? healingQ.isError
                      ? t("manager.support_ai.healing_unavailable")
                      : t("manager.support_ai.no_incidents")
                    : `${metrics.autoFixSuccessRate}% of ${totals?.incidents ?? 0} incidents`}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-gradient-to-br from-red-500/10 to-rose-600/5 border-red-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {t("manager.support_ai.escalated")}
                  </p>
                  <p className="text-2xl font-bold text-red-400 mt-1">{metrics.escalatedIssues}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-2">
                <Clock className="w-3 h-3 text-amber-400" />
                <span className="text-[10px] text-amber-400">{metrics.slaAtRisk} at SLA risk</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-gradient-to-br from-purple-500/10 to-indigo-600/5 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {t("manager.support_ai.avg_resolution_short")}
                  </p>
                  <p className="text-2xl font-bold text-purple-400 mt-1">
                    {metrics.avgResolutionTime}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-purple-400" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-2">
                <Target className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] text-emerald-400">
                  {ticketsReady ? `From ${resolvedTickets.length} resolved tickets` : "—"}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-4">
        {/* Live Issues Panel */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="col-span-2"
        >
          <Card className="bg-card/60 border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-foreground flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  {t("manager.support_ai.live_issue_overview")}
                </CardTitle>
                <Badge className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px]">
                  {t("manager.support_ai.open_tickets")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <QueryRows
                  query={ticketsQ}
                  source="support_tickets"
                  rows={liveIssues}
                  empty="No open support tickets."
                >
                  {(rows) =>
                    rows.map((issue, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-card/60 rounded-lg border border-border hover:border-cyan-500/30 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-cyan-400">{issue.id}</span>
                          <span className="text-xs text-foreground capitalize">{issue.type}</span>
                          <Badge
                            className={`${getPriorityBadge(issue.priority)} text-[9px] px-1.5`}
                          >
                            {issue.priority.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-muted-foreground">{issue.user}</span>
                          <Badge
                            className={`${getStatusBadge(issue.status)} border text-[9px] px-1.5`}
                          >
                            {issue.status.replace("_", " ").toUpperCase()}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{issue.time}</span>
                        </div>
                      </div>
                    ))
                  }
                </QueryRows>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* AI Confidence & Trust Index */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
          className="space-y-4"
        >
          <Card className="bg-card/60 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-foreground flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" />
                AI Confidence Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-4">
                <div className="relative w-24 h-24 mx-auto">
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle
                      className="text-foreground"
                      strokeWidth="8"
                      stroke="currentColor"
                      fill="transparent"
                      r="40"
                      cx="48"
                      cy="48"
                    />
                    <circle
                      className="text-purple-500"
                      strokeWidth="8"
                      strokeDasharray={`${(aiConfidenceScore ?? 0) * 2.51} 251`}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="transparent"
                      r="40"
                      cx="48"
                      cy="48"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold text-purple-400">
                      {aiConfidenceScore === null ? "—" : `${aiConfidenceScore}%`}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  {decisionsQ.isLoading
                    ? "Loading…"
                    : decisionsQ.isError
                      ? "ai_decision_logs could not be read"
                      : aiConfidenceScore === null
                        ? "No AI decisions recorded yet"
                        : `Mean confidence of last ${confidences.length} AI decisions`}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/60 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-foreground flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                System Trust Index
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3" title={t("manager.support_ai.trust_reason")}>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {t("manager.support_ai.overall_trust")}
                  </span>
                  <span className="text-sm font-bold text-muted-foreground">
                    {t("manager.console.not_tracked")}
                  </span>
                </div>
                <Progress value={0} className="h-2" />
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="bg-card/60 rounded p-2">
                    <p className="text-muted-foreground">Uptime</p>
                    <p className="text-muted-foreground font-bold">—</p>
                  </div>
                  <div className="bg-card/60 rounded p-2">
                    <p className="text-muted-foreground">Accuracy</p>
                    <p className="text-muted-foreground font-bold">—</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Auto-Fix Success Graph */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-foreground flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                Auto-Fix Success Trend (Last 7 Days)
              </CardTitle>
              <div className="flex items-center gap-4 text-[10px]">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-muted-foreground">Success</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-muted-foreground">Failed</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {healingQ.isLoading ? (
              <EmptyRow>Loading recovery attempts…</EmptyRow>
            ) : healingQ.isError ? (
              <ErrorRow
                error={healingQ.error}
                source="self-healing timeline"
                onRetry={() => void healingQ.refetch()}
              />
            ) : (
              <>
                <div className="h-32 flex items-end gap-2">
                  {trend.map((day) => {
                    const value = day.total > 0 ? Math.round((day.ok / day.total) * 100) : 0;
                    return (
                      <div
                        key={day.key}
                        className="flex-1 flex flex-col items-center gap-1"
                        title={`${day.ok} of ${day.total} attempts succeeded`}
                      >
                        <div className="w-full flex flex-col-reverse gap-0.5">
                          <div
                            className="bg-emerald-500/80 rounded-t"
                            style={{ height: `${value}px` }}
                          />
                          <div
                            className="bg-red-500/80 rounded-t"
                            style={{ height: `${day.total > 0 ? 100 - value : 0}px` }}
                          />
                        </div>
                        <span className="text-[9px] text-muted-foreground">{day.label}</span>
                      </div>
                    );
                  })}
                </div>
                {!trendHasData && (
                  <p className="text-[10px] text-muted-foreground mt-2">
                    No recovery attempts in the last 7 days.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* User Frustration Index & SLA Predictor */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Card className="bg-card/60 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                User Frustration Index
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="flex items-center gap-4"
                title={t("manager.support_ai.frustration_reason")}
              >
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Current Level</span>
                    <span className="text-sm font-bold text-muted-foreground">
                      {t("manager.console.not_tracked")}
                    </span>
                  </div>
                  <div className="h-3 bg-card/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500"
                      style={{ width: "0%" }}
                    />
                  </div>
                  <div className="flex justify-between mt-1 text-[9px] text-muted-foreground">
                    <span>Happy</span>
                    <span>Neutral</span>
                    <span>Frustrated</span>
                  </div>
                </div>
                <div className="w-16 h-16 rounded-lg bg-muted/40 flex items-center justify-center">
                  <Gauge className="w-8 h-8 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <Card className="bg-card/60 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                SLA Position (Open Tickets)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ticketsQ.isError ? (
                <ErrorRow
                  error={ticketsQ.error}
                  source="support_tickets"
                  onRetry={() => void ticketsQ.refetch()}
                />
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-emerald-500/10 rounded border border-emerald-500/20">
                    <span className="text-xs text-muted-foreground">On Track</span>
                    <span className="text-xs font-bold text-emerald-400">
                      {ticketsReady ? `${onTrack} issues` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-amber-500/10 rounded border border-amber-500/20">
                    <span className="text-xs text-muted-foreground">At Risk (30min)</span>
                    <span className="text-xs font-bold text-amber-400">
                      {ticketsReady ? `${atRisk.length} issues` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-red-500/10 rounded border border-red-500/20">
                    <span className="text-xs text-muted-foreground">Breached</span>
                    <span className="text-xs font-bold text-red-400">
                      {ticketsReady ? `${breached.length} issues` : "—"}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};
