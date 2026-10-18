import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useHealthCheck } from "@/hooks/useHealthCheck";
import { listDemoHealth } from "@/lib/marketplace-demo.functions";
import {
  AlertTriangle,
  Bell,
  BellRing,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  RefreshCw,
  Shield,
  Zap,
  Volume2,
  VolumeX,
  Eye,
  Server,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import DataStateNotice from "./DataStateNotice";
import { useTranslation } from "@/lib/i18n/use-translation";
import {
  demoAlertsKey,
  demoHealthLogKey,
  fetchDemoAlerts,
  fetchDemoHealthLog,
  relativeTime,
  resolveDemoAlert,
} from "./demoAlertsSource";

/**
 * Every alert, uptime row, health log and stat on this screen used to be typed
 * into this file - "Finance Portal" timing out, "HR Management" at 87.2%, a
 * 182ms average - none of them demos this platform runs.
 *
 *   alerts       demo_alerts, written by the monitor; acknowledging resolves the row
 *   uptime rows  mm_demo_health (30 days), counted in SQL from monitor checks
 *   health logs  the latest demo_health checks, re-read every 30 seconds
 *   run check    the Demo Manager's own check over every active demo URL
 */
interface Alert {
  id: string;
  demoName: string;
  type: "downtime" | "high_traffic" | "backup_activated" | "other";
  message: string;
  severity: "critical" | "warning" | "info";
  timestamp: string;
  requiresAction: boolean;
  acknowledged: boolean;
}

type HealthRow = {
  id: string;
  demo_name: string | null;
  checks: number | null;
  uptime_percent: number | null;
  avg_response_ms: number | null;
  latest_result: string | null;
  last_checked_at: string | null;
};

const toAlertType = (t: string): Alert["type"] => {
  const v = t.toLowerCase();
  if (v.includes("offline") || v.includes("down") || v.includes("timeout")) return "downtime";
  if (v.includes("traffic")) return "high_traffic";
  if (v.includes("backup")) return "backup_activated";
  return "other";
};

const toSeverity = (s: string): Alert["severity"] =>
  s === "critical" ? "critical" : s === "warning" ? "warning" : "info";

/** The monitor's last word on a demo; null means it has not been checked. */
const toUptimeStatus = (result: string | null): string => {
  if (result === "working") return "healthy";
  if (result === "offline") return "down";
  if (result === "slow") return "slow";
  return result ? result : "unchecked";
};

const DemoUptimeAlerts = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { runHealthCheck: runDemoHealthCheck, isChecking } = useHealthCheck();
  const [buzzerActive, setBuzzerActive] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);

  const alertsQuery = useQuery({
    queryKey: demoAlertsKey,
    queryFn: () => fetchDemoAlerts(50),
    staleTime: 30_000,
    retry: 1,
  });

  const healthQuery = useQuery<HealthRow[]>({
    queryKey: ["demo-health", "uptime-alerts"],
    queryFn: () => listDemoHealth({ data: { days: 30 } }) as Promise<HealthRow[]>,
    staleTime: 60_000,
    retry: 1,
  });

  const logQuery = useQuery({
    queryKey: demoHealthLogKey,
    queryFn: () => fetchDemoHealthLog(25),
    refetchInterval: 30_000,
    retry: 1,
  });

  const alerts: Alert[] = (alertsQuery.data ?? []).map((a) => {
    const severity = toSeverity(a.severity);
    return {
      id: a.id,
      demoName: a.demoName,
      type: toAlertType(a.alert_type),
      message: a.message,
      severity,
      timestamp: relativeTime(a.created_at),
      requiresAction: severity === "critical",
      acknowledged: a.is_resolved,
    };
  });

  const healthRows = healthQuery.data ?? [];
  const uptimeStats = healthRows.map((d) => ({
    name: d.demo_name ?? "Unnamed demo",
    uptime: d.uptime_percent,
    responseTime: d.avg_response_ms ?? 0,
    status: toUptimeStatus(d.latest_result),
    lastCheck: relativeTime(d.last_checked_at),
  }));

  const healthyCount = uptimeStats.filter((d) => d.status === "healthy").length;
  const downCount = uptimeStats.filter((d) => d.status === "down").length;
  // Weighted by checks, so a demo checked once does not count as much as one checked a thousand times.
  const weighted = healthRows.reduce(
    (acc, d) => {
      if (d.avg_response_ms == null || !d.checks) return acc;
      return { sum: acc.sum + d.avg_response_ms * d.checks, n: acc.n + d.checks };
    },
    { sum: 0, n: 0 },
  );
  const avgResponse = weighted.n > 0 ? `${Math.round(weighted.sum / weighted.n)}ms` : "—";

  const healthLogs = (logQuery.data ?? []).map((log) => ({
    id: log.id,
    time: new Date(log.checked_at).toLocaleTimeString([], { hour12: false }),
    demo: log.demoName,
    event:
      log.status === "active"
        ? `Health check passed${log.response_time != null ? ` (${log.response_time}ms)` : ""}`
        : log.error_message ||
          (log.status === "maintenance" ? "In maintenance" : "Health check failed"),
    status: log.status === "active" ? "success" : log.status === "down" ? "error" : "warning",
  }));

  const criticalAlerts = alerts.filter((a) => a.severity === "critical" && !a.acknowledged);

  const resolveMutation = useMutation({
    mutationFn: ({ id, action, demoName }: { id: string; action?: string; demoName?: string }) =>
      resolveDemoAlert(id, action, demoName),
    onSuccess: (result) => {
      toast({
        title: t("demo.alerts.resolved_title"),
        description: result.noteSaved
          ? t("demo.alerts.resolved_with_note")
          : t("demo.alerts.resolved"),
      });
      setIsActionDialogOpen(false);
      setActionNote("");
      setSelectedAlert(null);
      void queryClient.invalidateQueries({ queryKey: demoAlertsKey });
    },
    onError: (error: unknown) => {
      toast({
        title: t("demo.alerts.resolve_failed"),
        description: error instanceof Error ? error.message : t("demo.alerts.update_refused"),
        variant: "destructive",
      });
      // The alert itself may have been resolved even if the note could not be saved.
      void queryClient.invalidateQueries({ queryKey: demoAlertsKey });
    },
  });

  const handleAcknowledge = (alert: Alert) => {
    if (alert.requiresAction) {
      setSelectedAlert(alert);
      setIsActionDialogOpen(true);
    } else {
      acknowledgeAlert(alert.id, undefined, alert.demoName);
    }
  };

  const acknowledgeAlert = (alertId: string, action?: string, demoName?: string) => {
    if (!alertId) return;
    resolveMutation.mutate({ id: alertId, action, demoName });
  };

  const runHealthCheck = async () => {
    await runDemoHealthCheck();
    void queryClient.invalidateQueries({ queryKey: ["demo-health"] });
    void queryClient.invalidateQueries({ queryKey: demoHealthLogKey });
    void queryClient.invalidateQueries({ queryKey: demoAlertsKey });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-neon-green/20 text-neon-green border-neon-green/30";
      case "down":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "backup":
      case "slow":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      default:
        return "bg-gray-500/20 text-gray-400";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "warning":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "info":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default:
        return "bg-gray-500/20 text-gray-400";
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "downtime":
        return <XCircle className="w-5 h-5 text-red-400" />;
      case "high_traffic":
        return <Zap className="w-5 h-5 text-orange-400" />;
      case "backup_activated":
        return <Shield className="w-5 h-5 text-blue-400" />;
      default:
        return <AlertTriangle className="w-5 h-5" />;
    }
  };

  const fmt = (n: number, loading: boolean, failed: boolean) =>
    loading ? "…" : failed ? "—" : String(n);

  return (
    <div className="space-y-6">
      {/* Critical Alert Banner */}
      <AnimatePresence>
        {criticalAlerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-4 rounded-lg border-2 ${buzzerActive ? "border-red-500 bg-red-500/10 animate-pulse" : "border-red-500/50 bg-red-500/5"}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BellRing
                  className={`w-6 h-6 text-red-400 ${buzzerActive ? "animate-bounce" : ""}`}
                />
                <div>
                  <p className="font-bold text-red-400">CRITICAL ALERT</p>
                  <p className="text-sm text-red-300">
                    {criticalAlerts.length} demo(s) require immediate attention
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBuzzerActive(!buzzerActive)}
                  className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                >
                  {buzzerActive ? (
                    <Volume2 className="w-4 h-4 mr-1" />
                  ) : (
                    <VolumeX className="w-4 h-4 mr-1" />
                  )}
                  {buzzerActive ? "Mute" : "Unmute"}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Uptime & Alerts</h1>
          <p className="text-muted-foreground">Real-time monitoring with buzzer alerts</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-neon-green/20 text-neon-green border border-neon-green/30">
            <Activity className="w-3 h-3 mr-1 animate-pulse" />
            LIVE MONITORING
          </Badge>
          <Button
            onClick={() => void runHealthCheck()}
            disabled={isChecking}
            className="bg-primary hover:bg-primary/90"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isChecking ? "animate-spin" : ""}`} />
            {isChecking ? t("demo.alerts.checking") : t("demo.alerts.run_health_check")}
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="w-5 h-5 text-neon-green" />
              <Badge className="bg-neon-green/20 text-neon-green text-xs">Online</Badge>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {fmt(healthyCount, healthQuery.isLoading, !!healthQuery.error)}
            </p>
            <p className="text-xs text-muted-foreground">Healthy Demos</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <XCircle className="w-5 h-5 text-red-400" />
              <Badge className="bg-red-500/20 text-red-400 text-xs">Down</Badge>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {fmt(downCount, healthQuery.isLoading, !!healthQuery.error)}
            </p>
            <p className="text-xs text-muted-foreground">Down Demos</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
              <Badge className="bg-orange-500/20 text-orange-400 text-xs">Pending</Badge>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {fmt(
                alerts.filter((a) => !a.acknowledged).length,
                alertsQuery.isLoading,
                !!alertsQuery.error,
              )}
            </p>
            <p className="text-xs text-muted-foreground">Active Alerts</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-5 h-5 text-primary" />
              <Badge className="bg-primary/20 text-primary text-xs">Avg</Badge>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {healthQuery.isLoading ? "…" : avgResponse}
            </p>
            <p className="text-xs text-muted-foreground">Response Time</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Alerts */}
        <Card className="glass-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              Active Alerts
              {alerts.filter((a) => !a.acknowledged).length > 0 && (
                <Badge className="bg-red-500/20 text-red-400 ml-auto">
                  {alerts.filter((a) => !a.acknowledged).length} pending
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DataStateNotice
              isLoading={alertsQuery.isLoading}
              error={alertsQuery.error}
              isEmpty={alerts.length === 0}
              resource="demo alerts"
              emptyTitle="No alerts recorded"
              emptyDescription="The monitor has not raised any demo alerts."
              emptyIcon={<Bell className="w-8 h-8 text-muted-foreground" />}
              onRetry={() => void alertsQuery.refetch()}
            >
              {alerts.map((alert, index) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-4 rounded-lg border ${
                    alert.acknowledged
                      ? "bg-background/30 border-border/50 opacity-60"
                      : alert.severity === "critical"
                        ? "bg-red-500/5 border-red-500/30"
                        : "bg-background/50 border-border"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {getAlertIcon(alert.type)}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{alert.demoName}</p>
                          <Badge className={getSeverityColor(alert.severity)}>
                            {alert.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">{alert.timestamp}</p>
                      </div>
                    </div>
                    {!alert.acknowledged && (
                      <Button
                        size="sm"
                        onClick={() => handleAcknowledge(alert)}
                        disabled={resolveMutation.isPending}
                        className={
                          alert.requiresAction
                            ? "bg-red-500 hover:bg-red-600"
                            : "bg-primary hover:bg-primary/90"
                        }
                      >
                        {alert.requiresAction ? "Take Action" : "Acknowledge"}
                      </Button>
                    )}
                    {alert.acknowledged && (
                      <Badge variant="outline" className="text-neon-green border-neon-green/30">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Resolved
                      </Badge>
                    )}
                  </div>
                </motion.div>
              ))}
            </DataStateNotice>
          </CardContent>
        </Card>

        {/* Uptime Status */}
        <Card className="glass-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Server className="w-4 h-4 text-primary" />
              Demo Uptime Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DataStateNotice
              isLoading={healthQuery.isLoading}
              error={healthQuery.error}
              isEmpty={uptimeStats.length === 0}
              resource="demo health"
              emptyTitle="No demos monitored"
              emptyDescription="No demo URLs exist for the monitor to check."
              emptyIcon={<Server className="w-8 h-8 text-muted-foreground" />}
              onRetry={() => void healthQuery.refetch()}
            >
              {uptimeStats.map((demo, index) => (
                <motion.div
                  key={`${demo.name}-${index}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{demo.name}</span>
                      <Badge className={getStatusColor(demo.status)}>{demo.status}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{demo.responseTime > 0 ? `${demo.responseTime}ms` : "--"}</span>
                      <span className="text-xs">{demo.lastCheck}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={demo.uptime ?? 0} className="flex-1 h-2" />
                    <span
                      className={`text-sm font-medium ${demo.uptime == null ? "text-muted-foreground" : demo.uptime >= 99 ? "text-neon-green" : demo.uptime >= 90 ? "text-orange-400" : "text-red-400"}`}
                    >
                      {demo.uptime == null ? t("demo.alerts.not_checked") : `${demo.uptime}%`}
                    </span>
                  </div>
                </motion.div>
              ))}
            </DataStateNotice>
          </CardContent>
        </Card>
      </div>

      {/* Health Check Logs */}
      <Card className="glass-card border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" />
            Real-time Health Logs
            <Badge variant="outline" className="ml-auto text-xs">
              Auto-refresh: 30s
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataStateNotice
            isLoading={logQuery.isLoading}
            error={logQuery.error}
            isEmpty={healthLogs.length === 0}
            resource="demo health checks"
            emptyTitle="No health checks recorded"
            emptyDescription="The monitor has not written any checks yet."
            emptyIcon={<Eye className="w-8 h-8 text-muted-foreground" />}
            onRetry={() => void logQuery.refetch()}
          >
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {healthLogs.map((log, index) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-4 p-2 rounded-lg hover:bg-background/50 transition-colors"
                >
                  <span className="text-xs text-muted-foreground font-mono">{log.time}</span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      log.status === "success"
                        ? "bg-neon-green"
                        : log.status === "error"
                          ? "bg-red-400"
                          : "bg-orange-400"
                    }`}
                  />
                  <span className="font-medium text-foreground text-sm">{log.demo}</span>
                  <span className="text-sm text-muted-foreground">{log.event}</span>
                </motion.div>
              ))}
            </div>
          </DataStateNotice>
        </CardContent>
      </Card>

      {/* Action Required Dialog */}
      <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Action Required
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
              <p className="font-medium text-foreground">{selectedAlert?.demoName}</p>
              <p className="text-sm text-muted-foreground mt-1">{selectedAlert?.message}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Describe the action taken:</p>
              <Textarea
                placeholder="e.g., Restarted server, Switched to backup, Contacted hosting provider..."
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                className="bg-background border-border min-h-[100px]"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsActionDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  acknowledgeAlert(selectedAlert?.id || "", actionNote, selectedAlert?.demoName)
                }
                disabled={!actionNote.trim() || resolveMutation.isPending}
                className="bg-red-500 hover:bg-red-600"
              >
                {resolveMutation.isPending
                  ? t("demo.alerts.saving")
                  : t("demo.alerts.confirm_action")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DemoUptimeAlerts;
