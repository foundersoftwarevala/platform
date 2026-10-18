/**
 * Internal Support AI - Escalation Manager
 * Escalations (support_escalations) joined to their tickets
 * (support_tickets) for priority and SLA position.
 */

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowUpCircle,
  Target,
  Users,
  Clock,
  AlertTriangle,
  Activity,
  FileText,
  CheckCircle2,
  Zap,
} from "lucide-react";
import {
  isOpenEscalation,
  pct,
  shortId,
  useSupportEscalations,
  useSupportTickets,
  type SupportTicketRow,
} from "../data";
import { EmptyRow, QueryRows } from "../states";
import { useTranslation } from "@/lib/i18n/use-translation";

interface EscalationManagerProps {
  activeView: string;
}

interface EscalatedIssue {
  id: string;
  originalIssueId: string;
  escalatedTo: string;
  priority: string;
  slaRemaining: string | null;
  slaBreached: boolean;
  status: string;
  userVisibleStatus: string;
  internalNotes: string;
}

const pad = (n: number) => String(Math.abs(n)).padStart(2, "0");
const slaClock = (minutes: number | null): string | null => {
  if (minutes === null) return null;
  const sign = minutes < 0 ? "-" : "";
  return `${sign}${pad(Math.trunc(minutes / 60))}:${pad(minutes % 60)}:00`;
};

const VISIBLE_STATUS: Record<string, string> = {
  open: "In escalation queue",
  pending: "In escalation queue",
  assigned: "Assigned to a specialist",
  in_progress: "Being reviewed by specialists",
  resolved: "Resolved",
  closed: "Closed",
};

export const EscalationManager: React.FC<EscalationManagerProps> = ({ activeView }) => {
  const { t } = useTranslation();
  const escalationsQ = useSupportEscalations();
  const ticketsQ = useSupportTickets();
  const escalations = escalationsQ.data ?? [];

  const ticketById = useMemo(() => {
    const map = new Map<string, SupportTicketRow>();
    for (const t of ticketsQ.data ?? []) map.set(t.id, t);
    return map;
  }, [ticketsQ.data]);

  const escalatedIssues = useMemo<EscalatedIssue[]>(
    () =>
      escalations.filter(isOpenEscalation).map((e) => {
        const ticket = e.ticket_id ? ticketById.get(e.ticket_id) : undefined;
        const status = (e.status ?? "open").toLowerCase();
        return {
          id: e.reference ?? shortId(e.id),
          originalIssueId: ticket?.reference ?? shortId(e.ticket_id),
          escalatedTo: e.level !== null ? `Level ${e.level}` : "—",
          priority: (ticket?.priority ?? "unknown").toLowerCase(),
          slaRemaining: slaClock(ticket?.sla_minutes_remaining ?? null),
          slaBreached: ticket?.sla_breached === true || (ticket?.sla_minutes_remaining ?? 1) <= 0,
          status,
          userVisibleStatus: VISIBLE_STATUS[status] ?? status.replace(/_/g, " "),
          internalNotes: e.reason ?? e.resolution_notes ?? "—",
        };
      }),
    [escalations, ticketById],
  );

  const ready = !escalationsQ.isLoading && !escalationsQ.isError;
  const count = (s: string) =>
    escalations.filter((e) => (e.status ?? "").toLowerCase() === s).length;
  const withTicket = escalations
    .map((e) => (e.ticket_id ? ticketById.get(e.ticket_id) : undefined))
    .filter((t): t is SupportTicketRow => Boolean(t));
  const slaCompliance = ticketsQ.isError
    ? null
    : pct(withTicket.filter((t) => t.sla_breached !== true).length, withTicket.length);

  const escalationStats = {
    totalEscalated: ready ? String(escalations.length) : "—",
    resolved: ready ? String(count("resolved") + count("closed")) : "—",
    pending: ready ? String(count("open") + count("pending")) : "—",
    inProgress: ready ? String(count("in_progress") + count("assigned")) : "—",
    slaCompliance: ready && slaCompliance !== null ? `${slaCompliance}%` : "—",
  };

  // Open escalations per escalation level. Teams, response times and
  // capacity are not recorded, so they are not shown as figures.
  const teamRouting = useMemo(() => {
    const levels = new Map<number, number>();
    for (const e of escalations) {
      if (!isOpenEscalation(e) || e.level === null) continue;
      levels.set(e.level, (levels.get(e.level) ?? 0) + 1);
    }
    return Array.from(levels.entries())
      .sort(([a], [b]) => a - b)
      .map(([level, activeCount]) => ({ team: `Level ${level}`, activeCount }));
  }, [escalations]);

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "high":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "medium":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      default:
        return "bg-muted/40 text-muted-foreground border-border";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "in_progress":
        return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
      case "assigned":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "open":
      case "pending":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "resolved":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      default:
        return "bg-muted/40 text-muted-foreground border-border";
    }
  };

  return (
    <div className="space-y-4">
      {/* Escalation Stats */}
      <div className="grid grid-cols-6 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-600/5 border-cyan-500/20">
            <CardContent className="p-4 text-center">
              <ArrowUpCircle className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-cyan-400">{escalationStats.totalEscalated}</p>
              <p className="text-[10px] text-muted-foreground">Total Escalated</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="bg-gradient-to-br from-emerald-500/10 to-green-600/5 border-emerald-500/20">
            <CardContent className="p-4 text-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-emerald-400">{escalationStats.resolved}</p>
              <p className="text-[10px] text-muted-foreground">Resolved</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-gradient-to-br from-amber-500/10 to-orange-600/5 border-amber-500/20">
            <CardContent className="p-4 text-center">
              <Clock className="w-6 h-6 text-amber-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-amber-400">{escalationStats.pending}</p>
              <p className="text-[10px] text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="bg-gradient-to-br from-blue-500/10 to-indigo-600/5 border-blue-500/20">
            <CardContent className="p-4 text-center">
              <Activity className="w-6 h-6 text-blue-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-blue-400">{escalationStats.inProgress}</p>
              <p className="text-[10px] text-muted-foreground">In Progress</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-gradient-to-br from-purple-500/10 to-violet-600/5 border-purple-500/20">
            <CardContent
              className="p-4 text-center"
              title={t("manager.support_ai.no_resolution_timestamp")}
            >
              <Zap className="w-6 h-6 text-purple-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-purple-400">—</p>
              <p className="text-[10px] text-muted-foreground">
                {t("manager.support_ai.avg_resolution")}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Card className="bg-gradient-to-br from-teal-500/10 to-cyan-600/5 border-teal-500/20">
            <CardContent
              className="p-4 text-center"
              title={t("manager.support_ai.sla_compliance_note")}
            >
              <Target className="w-6 h-6 text-teal-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-teal-400">{escalationStats.slaCompliance}</p>
              <p className="text-[10px] text-muted-foreground">
                {t("manager.support_ai.sla_compliance")}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Team Routing Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              {t("manager.support_ai.levels_capacity")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <QueryRows
              query={escalationsQ}
              source="support_escalations"
              rows={teamRouting}
              empty={t("manager.support_ai.no_open_levels")}
            >
              {(levels) => (
                <div className="grid grid-cols-5 gap-3">
                  {levels.map((team) => (
                    <div key={team.team} className="p-3 bg-card/60 rounded-lg border border-border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-foreground font-medium">{team.team}</span>
                        <Badge className="bg-cyan-500/20 text-cyan-400 text-[9px]">
                          {t("manager.support_ai.active_count", { count: team.activeCount })}
                        </Badge>
                      </div>
                      <div className="space-y-2" title={t("manager.support_ai.capacity_reason")}>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-muted-foreground">
                            {t("manager.support_ai.avg_response")}
                          </span>
                          <span className="text-muted-foreground">
                            {t("manager.console.not_tracked")}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="text-muted-foreground">
                              {t("manager.support_ai.capacity")}
                            </span>
                            <span className="text-muted-foreground">
                              {t("manager.console.not_tracked")}
                            </span>
                          </div>
                          <Progress value={0} className="h-1.5" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </QueryRows>
          </CardContent>
        </Card>
      </motion.div>

      {/* Active Escalations */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Active Escalations
              </CardTitle>
              <Badge className="bg-red-500/20 text-red-400 border border-red-500/30 text-[10px]">
                {ready ? escalatedIssues.length : "—"} Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {ticketsQ.isError && ready && (
                <EmptyRow>{t("manager.support_ai.ticket_details_failed")}</EmptyRow>
              )}
              <QueryRows
                query={escalationsQ}
                source="support_escalations"
                rows={escalatedIssues}
                empty={t("manager.support_ai.no_active_escalations")}
              >
                {(rows) =>
                  rows.map((issue, idx) => (
                    <motion.div
                      key={issue.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="p-4 bg-card/60 rounded-lg border border-border"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-cyan-400">{issue.id}</span>
                          <Badge
                            className={`${getPriorityBadge(issue.priority)} border text-[9px]`}
                          >
                            {issue.priority.toUpperCase()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            → {issue.escalatedTo}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            Ticket: {issue.originalIssueId}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex items-center gap-1 ${issue.slaBreached ? "text-red-400" : "text-amber-400"}`}
                            title={t("manager.support_ai.sla_minutes_note")}
                          >
                            <Clock className="w-3 h-3" />
                            <span className="text-xs font-mono">{issue.slaRemaining ?? "—"}</span>
                          </div>
                          <Badge className={`${getStatusBadge(issue.status)} border text-[9px]`}>
                            {issue.status.replace("_", " ").toUpperCase()}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {/* User Visible Status */}
                        <div className="p-2 bg-card/60 rounded border border-border">
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                            <Activity className="w-3 h-3" />
                            User-visible Progress
                          </div>
                          <p className="text-xs text-foreground">{issue.userVisibleStatus}</p>
                        </div>

                        {/* Internal Notes (Hidden from user) */}
                        <div className="p-2 bg-red-500/5 rounded border border-red-500/10">
                          <div className="flex items-center gap-1 text-[10px] text-red-400 mb-1">
                            <FileText className="w-3 h-3" />
                            Internal Notes (Hidden)
                          </div>
                          <p className="text-xs text-muted-foreground">{issue.internalNotes}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))
                }
              </QueryRows>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
