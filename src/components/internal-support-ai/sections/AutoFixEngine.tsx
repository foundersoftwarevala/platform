/**
 * Internal Support AI - Auto-Fix Engine
 * Safe Fix Queue, recovery attempts and engine state, read from the
 * self-healing views (founder_healing_totals / _self_check / _timeline).
 */

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Wrench,
  CheckCircle2,
  RefreshCw,
  Lock,
  Database,
  Wifi,
  Zap,
  RotateCcw,
  Play,
  Pause,
  AlertTriangle,
  Clock,
  Shield,
} from "lucide-react";
import { attemptSucceeded, formatClock, pct, shortId, useHealing, type TimelineRow } from "../data";
import { EmptyRow, ErrorRow, LoadingRow } from "../states";
import { useTranslation } from "@/lib/i18n/use-translation";

interface AutoFixEngineProps {
  activeView: string;
}

interface FixAction {
  id: string;
  type: string;
  description: string;
  status: "queued" | "running" | "success" | "failed";
  issueId: string;
  startedAt: string | null;
}

const RUNNING_STATES = new Set(["DIAGNOSING", "RECOVERING", "VERIFYING"]);
const QUEUED_STATES = new Set(["DETECTED", "ELIGIBLE", "RETRY_PENDING"]);
const FAILED_STATES = new Set(["FAILED", "CIRCUIT_OPEN", "ESCALATED", "CONTAINED"]);

const toStatus = (finalState: string): FixAction["status"] => {
  const s = finalState.toUpperCase();
  if (s === "RESOLVED") return "success";
  if (RUNNING_STATES.has(s)) return "running";
  if (QUEUED_STATES.has(s)) return "queued";
  if (FAILED_STATES.has(s)) return "failed";
  return "queued";
};

const CLASS_ICON: Record<string, React.ReactNode> = {
  TRANSIENT: <RefreshCw className="w-4 h-4" />,
  CONFIGURATION: <RefreshCw className="w-4 h-4" />,
  DATA: <Database className="w-4 h-4" />,
  WORKFLOW: <CheckCircle2 className="w-4 h-4" />,
  DEPENDENCY: <Wifi className="w-4 h-4" />,
  PERFORMANCE: <Zap className="w-4 h-4" />,
  SECURITY: <Lock className="w-4 h-4" />,
  UNKNOWN: <AlertTriangle className="w-4 h-4" />,
};
const CLASS_COLOR: Record<string, string> = {
  TRANSIENT: "cyan",
  CONFIGURATION: "blue",
  DATA: "amber",
  WORKFLOW: "emerald",
  DEPENDENCY: "orange",
  PERFORMANCE: "purple",
  SECURITY: "red",
  UNKNOWN: "cyan",
};

const label = (value: string) =>
  value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());

const ROLLBACK_REASON =
  "Rollback is not available: the recovery executor records no reversible snapshot to restore.";
const QUEUE_TOGGLE_REASON =
  "The healing engine is enabled or disabled in founder_healing_control by the platform operator; it cannot be paused from this screen.";

export const AutoFixEngine: React.FC<AutoFixEngineProps> = ({ activeView }) => {
  const { t } = useTranslation();
  const healing = useHealing();
  const board = healing.data;
  const totals = board?.totals ?? null;
  const selfCheck = board?.selfCheck ?? null;
  const timeline: TimelineRow[] = board?.timeline ?? [];

  // Latest attempt per incident, newest incident first.
  const fixQueue = useMemo<FixAction[]>(() => {
    const byIncident = new Map<string, TimelineRow>();
    for (const row of timeline) {
      const prev = byIncident.get(row.incidentId);
      if (!prev || (row.attemptNumber ?? 0) > (prev.attemptNumber ?? 0))
        byIncident.set(row.incidentId, row);
    }
    return Array.from(byIncident.values()).map((row) => ({
      id: `INC-${shortId(row.incidentId)}`,
      type: row.actionTaken ? label(row.actionTaken) : label(row.whyClassified || "UNKNOWN"),
      description: row.whatFailed || "—",
      status: toStatus(row.finalState),
      issueId: row.correlationKey ?? shortId(row.incidentId),
      startedAt: row.attemptStartedAt ?? row.detectedAt,
    }));
  }, [timeline]);

  const fixTypes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of timeline) {
      if (row.attemptNumber === null) continue;
      const key = (row.whyClassified || "UNKNOWN").toUpperCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([key, count]) => ({
      id: key,
      label: label(key),
      icon: CLASS_ICON[key] ?? <Wrench className="w-4 h-4" />,
      count,
      color: CLASS_COLOR[key] ?? "cyan",
    }));
  }, [timeline]);

  const engineStats = {
    totalFixes: totals ? String(totals.attempts) : "—",
    successRate: totals ? pct(totals.autoRecovered, totals.incidents) : null,
    queueDepth: selfCheck ? String(selfCheck.awaitingRecovery) : "—",
  };
  const attemptsInView = timeline.filter((r) => r.attemptNumber !== null);
  const engineEnabled = selfCheck?.enabled ?? null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "running":
        return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
      case "queued":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "success":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "failed":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-muted/40 text-muted-foreground border-border";
    }
  };

  return (
    <div className="space-y-4">
      {/* Engine Stats */}
      <div className="grid grid-cols-5 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-600/5 border-cyan-500/20">
            <CardContent className="p-4 text-center">
              <Wrench className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-cyan-400">{engineStats.totalFixes}</p>
              <p className="text-[10px] text-muted-foreground">
                {t("manager.support_ai.total_fix_attempts")}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-gradient-to-br from-emerald-500/10 to-green-600/5 border-emerald-500/20">
            <CardContent className="p-4 text-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-emerald-400">
                {engineStats.successRate === null ? "—" : `${engineStats.successRate}%`}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {t("manager.support_ai.auto_recovered")}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-gradient-to-br from-purple-500/10 to-indigo-600/5 border-purple-500/20">
            <CardContent
              className="p-4 text-center"
              title={t("manager.support_ai.fix_time_reason")}
            >
              <Clock className="w-6 h-6 text-purple-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-purple-400">—</p>
              <p className="text-[10px] text-muted-foreground">
                {t("manager.support_ai.avg_fix_time")}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-gradient-to-br from-orange-500/10 to-red-600/5 border-orange-500/20">
            <CardContent
              className="p-4 text-center"
              title={t("manager.support_ai.rollbacks_reason")}
            >
              <RotateCcw className="w-6 h-6 text-orange-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-orange-400">—</p>
              <p className="text-[10px] text-muted-foreground">
                {t("manager.support_ai.rollbacks")}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="bg-gradient-to-br from-amber-500/10 to-yellow-600/5 border-amber-500/20">
            <CardContent className="p-4 text-center">
              <Shield className="w-6 h-6 text-amber-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-amber-400">{engineStats.queueDepth}</p>
              <p className="text-[10px] text-muted-foreground">
                {t("manager.support_ai.awaiting_recovery")}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Fix Types Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <Wrench className="w-4 h-4 text-cyan-400" />
              {t("manager.support_ai.fix_types")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {healing.isLoading ? (
              <LoadingRow />
            ) : healing.isError ? (
              <ErrorRow
                error={healing.error}
                source="self-healing timeline"
                onRetry={() => void healing.refetch()}
              />
            ) : fixTypes.length === 0 ? (
              <EmptyRow>{t("manager.support_ai.no_attempts")}</EmptyRow>
            ) : (
              <div className="grid grid-cols-7 gap-2">
                {fixTypes.map((type) => (
                  <div
                    key={type.id}
                    className={`p-3 bg-${type.color}-500/10 rounded-lg border border-${type.color}-500/20 text-center hover:border-${type.color}-500/40 transition-all`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg bg-${type.color}-500/20 flex items-center justify-center mx-auto mb-2 text-${type.color}-400`}
                    >
                      {type.icon}
                    </div>
                    <p className="text-xs text-foreground font-medium">{type.count}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{type.label}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Active Fix Queue */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                {t("manager.support_ai.safe_fix_queue")}
              </CardTitle>
              <div className="flex items-center gap-2">
                <span title={QUEUE_TOGGLE_REASON}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-border"
                    disabled
                  >
                    {engineEnabled === false ? (
                      <Play className="w-3 h-3 mr-1" />
                    ) : (
                      <Pause className="w-3 h-3 mr-1" />
                    )}
                    {engineEnabled === false ? "Resume Queue" : "Pause Queue"}
                  </Button>
                </span>
                <Badge
                  className={`${
                    engineEnabled === null
                      ? "bg-muted/40 text-muted-foreground border-border"
                      : engineEnabled
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                  } border text-[10px]`}
                >
                  {engineEnabled === null
                    ? "ENGINE STATE UNKNOWN"
                    : engineEnabled
                      ? "ENGINE ACTIVE"
                      : "ENGINE PAUSED"}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {healing.isLoading ? (
                <LoadingRow />
              ) : healing.isError ? (
                <ErrorRow
                  error={healing.error}
                  source="self-healing timeline"
                  onRetry={() => void healing.refetch()}
                />
              ) : fixQueue.length === 0 ? (
                <EmptyRow>{t("manager.support_ai.queue_empty")}</EmptyRow>
              ) : (
                fixQueue.map((fix, idx) => (
                  <motion.div
                    key={fix.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex items-center justify-between p-3 bg-card/60 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-cyan-400">{fix.id}</span>
                      <div className="w-8 h-8 rounded-lg bg-muted/40 flex items-center justify-center">
                        {fix.status === "running" ? (
                          <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
                        ) : fix.status === "success" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : fix.status === "failed" ? (
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                        ) : (
                          <Clock className="w-4 h-4 text-amber-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-foreground">{fix.type}</p>
                        <p className="text-[10px] text-muted-foreground">{fix.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-muted-foreground">
                        {formatClock(fix.startedAt)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Issue: {fix.issueId}
                      </span>
                      <Badge className={`${getStatusBadge(fix.status)} border text-[9px]`}>
                        {fix.status.toUpperCase()}
                      </Badge>
                      {fix.status === "success" && (
                        <span title={ROLLBACK_REASON}>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] text-orange-400 hover:text-orange-300"
                            disabled
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Rollback
                          </Button>
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Engine Health */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              Engine Health & Safety
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Healing Engine</span>
                  <Badge className="bg-emerald-500/20 text-emerald-400 text-[9px]">
                    {engineEnabled === null ? "—" : engineEnabled ? "ENABLED" : "DISABLED"}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {engineEnabled === null
                    ? "Engine state could not be read"
                    : (selfCheck?.disabledReason ??
                      "Autonomous recovery runs within per-class budgets")}
                </p>
              </div>
              <div className="p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Verified Attempts</span>
                  <Badge className="bg-cyan-500/20 text-cyan-400 text-[9px]">
                    {totals ? `${totals.verifiedAttempts}/${totals.attempts}` : "—"}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Attempts confirmed by a follow-up check
                  {attemptsInView.length > 0 &&
                    ` · ${attemptsInView.filter(attemptSucceeded).length} of last ${attemptsInView.length} succeeded`}
                </p>
              </div>
              <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Circuits Open</span>
                  <Badge className="bg-purple-500/20 text-purple-400 text-[9px]">
                    {totals ? totals.circuitsOpen : "—"}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Incidents halted after repeated failed recovery
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
