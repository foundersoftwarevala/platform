/**
 * Internal Support AI - Auto Issue Detection
 * Captured errors from error_events (client error listener and server
 * functions), grouped by the source that reported them.
 */

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Radar, Eye, AlertTriangle, Zap, Activity, CheckCircle2, Clock } from "lucide-react";
import { ERROR_EVENT_LIMIT, formatClock, isToday, useErrorEvents, type Row } from "../data";
import { QueryRows } from "../states";
import { useTranslation } from "@/lib/i18n/use-translation";

interface AutoIssueDetectionProps {
  activeView: string;
}

interface DetectionEvent {
  id: string;
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  timestamp: string;
  context: string;
  resolved: boolean;
}

const toSeverity = (value: unknown): DetectionEvent["severity"] => {
  const s = String(value ?? "").toLowerCase();
  if (s === "critical" || s === "fatal") return "critical";
  if (s === "error" || s === "high") return "high";
  if (s === "warning" || s === "warn" || s === "medium") return "medium";
  return "low";
};

const SOURCE_LABEL: Record<string, string> = {
  client: "Client Error Listener",
  server: "Server Function Errors",
};
const SOURCE_ICON: Record<string, React.ReactNode> = {
  client: <AlertTriangle className="w-4 h-4" />,
  server: <Zap className="w-4 h-4" />,
};

export const AutoIssueDetection: React.FC<AutoIssueDetectionProps> = ({ activeView }) => {
  const { t } = useTranslation();
  const query = useErrorEvents();
  const rows: Row[] = query.data ?? [];

  const events = useMemo<DetectionEvent[]>(
    () =>
      rows.map((r) => ({
        id: String(r.id),
        type: String(r.fn_name || r.message || "Error").slice(0, 80),
        severity: toSeverity(r.severity),
        timestamp: formatClock(r.occurred_at as string | null),
        context: String(r.route || r.source || "—"),
        resolved: r.resolved === true,
      })),
    [rows],
  );

  const capped = rows.length >= ERROR_EVENT_LIMIT;
  const loaded = !query.isLoading && !query.isError;
  const resolvedCount = rows.filter((r) => r.resolved === true).length;
  const detectionStats = {
    totalDetected: loaded ? `${rows.length}${capped ? "+" : ""}` : "—",
    resolved: loaded ? String(resolvedCount) : "—",
    pendingReview: loaded ? String(rows.length - resolvedCount) : "—",
  };

  const detectorTypes = useMemo(() => {
    const bySource = new Map<string, { today: number; last: string | null }>();
    for (const r of rows) {
      const key = String(r.source || "unknown");
      const entry = bySource.get(key) ?? { today: 0, last: null };
      if (isToday(r.occurred_at as string | null)) entry.today += 1;
      if (!entry.last || String(r.occurred_at) > entry.last) entry.last = String(r.occurred_at);
      bySource.set(key, entry);
    }
    return Array.from(bySource.entries()).map(([source, v]) => ({
      id: source,
      label: SOURCE_LABEL[source] ?? `${source} errors`,
      icon: SOURCE_ICON[source] ?? <Eye className="w-4 h-4" />,
      reporting: v.today > 0,
      events: v.today,
      last: v.last,
    }));
  }, [rows]);

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "high":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "medium":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "low":
        return "bg-muted/40 text-muted-foreground border-border";
      default:
        return "bg-muted/40 text-muted-foreground border-border";
    }
  };

  return (
    <div className="space-y-4">
      {/* Detection Stats */}
      <div className="grid grid-cols-5 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-600/5 border-cyan-500/20">
            <CardContent className="p-4 text-center">
              <Radar className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-cyan-400">{detectionStats.totalDetected}</p>
              <p className="text-[10px] text-muted-foreground">Total Detected</p>
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
              <p className="text-2xl font-bold text-emerald-400">{detectionStats.resolved}</p>
              <p className="text-[10px] text-muted-foreground">Resolved</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-gradient-to-br from-amber-500/10 to-orange-600/5 border-amber-500/20">
            <CardContent className="p-4 text-center">
              <Clock className="w-6 h-6 text-amber-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-amber-400">{detectionStats.pendingReview}</p>
              <p className="text-[10px] text-muted-foreground">Pending Review</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-gradient-to-br from-red-500/10 to-rose-600/5 border-red-500/20">
            <CardContent
              className="p-4 text-center"
              title={t("manager.support_ai.no_escalation_link")}
            >
              <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-red-400">—</p>
              <p className="text-[10px] text-muted-foreground">
                {t("manager.support_ai.escalated_not_tracked")}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="bg-gradient-to-br from-purple-500/10 to-indigo-600/5 border-purple-500/20">
            <CardContent
              className="p-4 text-center"
              title={t("manager.support_ai.no_detection_latency")}
            >
              <Activity className="w-6 h-6 text-purple-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-purple-400">—</p>
              <p className="text-[10px] text-muted-foreground">
                {t("manager.support_ai.avg_detection")}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Detector Status Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <Radar className="w-4 h-4 text-cyan-400 animate-pulse" />
              Active Detectors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <QueryRows
              query={query}
              source="error_events"
              rows={detectorTypes}
              empty="No detector has reported an error yet."
            >
              {(detectors) => (
                <div className="grid grid-cols-4 gap-3">
                  {detectors.map((detector) => (
                    <div
                      key={detector.id}
                      className="p-3 bg-card/60 rounded-lg border border-border hover:border-cyan-500/30 transition-all"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                          {detector.icon}
                        </div>
                        <div className="flex items-center gap-1">
                          <div
                            className={`w-2 h-2 rounded-full ${detector.reporting ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40"}`}
                          />
                          <span
                            className={`text-[9px] ${detector.reporting ? "text-emerald-400" : "text-muted-foreground"}`}
                          >
                            {detector.reporting ? "REPORTING" : "QUIET TODAY"}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-foreground font-medium">{detector.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {detector.events} events today · last{" "}
                        {detector.last ? new Date(detector.last).toLocaleString() : "—"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </QueryRows>
          </CardContent>
        </Card>
      </motion.div>

      {/* Real-time Detection Feed */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-foreground flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                Detection Feed
              </CardTitle>
              <Badge className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px]">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mr-1" />
                error_events
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              <QueryRows
                query={query}
                source="error_events"
                rows={events}
                empty="No errors have been captured."
              >
                {(list) =>
                  list.map((event, idx) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(idx, 10) * 0.05 }}
                      className="flex items-center justify-between p-3 bg-card/60 rounded-lg border border-border"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-mono text-muted-foreground">
                          {event.timestamp}
                        </span>
                        <Badge className={`${getSeverityBadge(event.severity)} border text-[9px]`}>
                          {event.severity.toUpperCase()}
                        </Badge>
                        <span className="text-xs text-foreground truncate max-w-80">
                          {event.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-muted-foreground max-w-48 truncate">
                          {event.context}
                        </span>
                        {event.resolved ? (
                          <div className="flex items-center gap-1 text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            <span className="text-[9px]">RESOLVED</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-amber-400">
                            <Clock className="w-3 h-3" />
                            <span className="text-[9px]">PENDING</span>
                          </div>
                        )}
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
