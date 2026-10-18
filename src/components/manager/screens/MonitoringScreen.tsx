import {
  AlertTriangle,
  Activity,
  TrendingUp,
  Shield,
  Bell,
  Database,
  Zap,
  Heart,
} from "lucide-react";
import {
  PageHeader,
  GlassCard,
  StatCard,
  StatusBadge,
  EmptyState,
  ErrorState,
  LoadingBlock,
  formatDateTime,
  num,
} from "../primitives";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useManyRecords, useUpdateRecord, type Row } from "@/lib/manager-queries";

/**
 * Monitoring & Health reads what the platform actually measures: the health
 * checks recorded on api_services, open security_alerts, incidents and the
 * last 24 hours of api_request_logs. Anything nobody measures (CPU, backups,
 * 7/30/90-day uptime history) is shown as not tracked rather than invented.
 */

const NOT_REPORTED = "This is not reported to this console.";
const DAY_MS = 24 * 60 * 60 * 1000;

function mean(values: number[]): number | null {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function durationLabel(start?: string | null, end?: string | null): string {
  if (!start) return "—";
  if (!end) return "ongoing";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const minutes = Math.round(ms / 60_000);
  return minutes < 1 ? `${Math.round(ms / 1000)} seconds` : `${minutes} minutes`;
}

export default function MonitoringScreen() {
  const since = new Date(Math.floor(Date.now() / 60_000) * 60_000 - DAY_MS).toISOString();
  const monthAgo = new Date(Math.floor(Date.now() / 60_000) * 60_000 - 30 * DAY_MS).toISOString();
  const many = useManyRecords([
    {
      table: "api_services",
      select: "id,name,status,health_status,uptime_pct,avg_latency_ms,last_checked_at",
      orderBy: "name",
      ascending: true,
      limit: 500,
    },
    {
      table: "security_alerts",
      select: "id,title,severity,status,detected_at",
      filters: [{ column: "status", value: "open" }],
      orderBy: "detected_at",
      limit: 200,
    },
    {
      table: "incidents",
      select: "id,title,severity,status,started_at,resolved_at",
      filters: [{ column: "started_at", op: "gte", value: monthAgo }],
      orderBy: "started_at",
      limit: 200,
    },
    {
      table: "api_request_logs",
      select: "id,status_code,latency_ms,occurred_at",
      filters: [{ column: "occurred_at", op: "gte", value: since }],
      orderBy: "occurred_at",
      limit: 5000,
    },
  ]);
  const acknowledge = useUpdateRecord("Alert acknowledged");

  if (many.isLoading) {
    return (
      <>
        <PageHeader
          title="Monitoring & Health"
          description="System health, uptime tracking, auto-healing, and performance metrics"
        />
        <LoadingBlock rows={6} />
      </>
    );
  }
  if (many.error) {
    return (
      <>
        <PageHeader
          title="Monitoring & Health"
          description="System health, uptime tracking, auto-healing, and performance metrics"
        />
        <ErrorState error={many.error} onRetry={() => many.refetch()} />
      </>
    );
  }

  const [allServices = [], alerts = [], incidents = [], requests = []] = many.data ?? [];
  // Only services somebody has actually checked carry a health measurement.
  const services = allServices.filter((s: Row) => s["last_checked_at"]);
  const healthy = services.filter((s) => s["health_status"] === "healthy").length;
  const health = services.length > 0 ? (healthy / services.length) * 100 : null;
  const uptime = mean(services.map((s) => Number(s["uptime_pct"])).filter(Number.isFinite));
  const serviceLatency = mean(
    services.map((s) => Number(s["avg_latency_ms"])).filter((v) => Number.isFinite(v) && v > 0),
  );
  const requestLatency = mean(
    requests.map((r) => Number(r["latency_ms"])).filter((v) => Number.isFinite(v) && v >= 0),
  );
  const failures = requests.filter((r) => Number(r["status_code"] ?? 0) >= 500).length;
  const capped = requests.length >= 5000;

  const pct = (v: number | null, digits = 1) => (v === null ? "—" : `${v.toFixed(digits)}%`);
  const ms = (v: number | null) => (v === null ? "—" : `${Math.round(v)}ms`);

  return (
    <>
      <PageHeader
        title="Monitoring & Health"
        description="System health, uptime tracking, auto-healing, and performance metrics"
      />

      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="System Health"
            value={pct(health)}
            tone="green"
            icon={<Heart className="h-4 w-4" />}
            change={`${num(healthy)} of ${num(services.length)} checked services healthy`}
          />
          <StatCard
            label="Uptime (recorded)"
            value={pct(uptime, 2)}
            tone="primary"
            icon={<Activity className="h-4 w-4" />}
            change={
              uptime === null ? "No health checks recorded" : "Average across checked services"
            }
          />
          <StatCard
            label="Avg Response"
            value={ms(requestLatency ?? serviceLatency)}
            tone="cyan"
            icon={<Zap className="h-4 w-4" />}
            change={
              requestLatency !== null
                ? "Requests, last 24h"
                : serviceLatency !== null
                  ? "Health checks"
                  : "No measurements"
            }
          />
          <StatCard
            label="Active Alerts"
            value={num(alerts.length)}
            tone="amber"
            icon={<AlertTriangle className="h-4 w-4" />}
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="health" className="space-y-4">
          <TabsList>
            <TabsTrigger value="health">
              <Heart className="mr-2 h-4 w-4" /> Health Status
            </TabsTrigger>
            <TabsTrigger value="uptime">
              <Activity className="mr-2 h-4 w-4" /> Uptime
            </TabsTrigger>
            <TabsTrigger value="performance">
              <TrendingUp className="mr-2 h-4 w-4" /> Performance
            </TabsTrigger>
            <TabsTrigger value="alerts">
              <Bell className="mr-2 h-4 w-4" /> Alerts
            </TabsTrigger>
            <TabsTrigger value="autoheal">
              <Shield className="mr-2 h-4 w-4" /> Auto-Healing
            </TabsTrigger>
            <TabsTrigger value="backup">
              <Database className="mr-2 h-4 w-4" /> Backup
            </TabsTrigger>
          </TabsList>

          {/* Health Status Tab */}
          <TabsContent value="health">
            <GlassCard title="Service Health Overview">
              {services.length === 0 ? (
                <EmptyState message="No service health checks have been recorded. Run a health check from the API Registry." />
              ) : (
                <div className="space-y-3">
                  {services.map((service) => (
                    <div
                      key={String(service["id"])}
                      className="flex items-center justify-between rounded-lg border border-border p-4"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{String(service["name"] ?? "—")}</p>
                        <div className="mt-1 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                          <p>
                            Uptime:{" "}
                            {service["uptime_pct"] == null
                              ? "—"
                              : `${Number(service["uptime_pct"]).toFixed(2)}%`}
                          </p>
                          <p>
                            Latency:{" "}
                            {Number(service["avg_latency_ms"]) > 0
                              ? `${Number(service["avg_latency_ms"])}ms`
                              : "—"}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Checked {formatDateTime(service["last_checked_at"] as string | null)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge value={String(service["health_status"] ?? "unknown")} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </TabsContent>

          {/* Uptime Tab */}
          <TabsContent value="uptime">
            <GlassCard title="Uptime Tracker">
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  {["Last 7 Days", "Last 30 Days", "Last 90 Days"].map((label) => (
                    <div key={label} className="rounded-lg bg-surface p-4">
                      <p className="text-sm text-muted-foreground">{label}</p>
                      <p className="text-2xl font-bold text-muted-foreground">—</p>
                      <p className="text-xs text-muted-foreground">
                        Not tracked: no uptime history is recorded
                      </p>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Incidents (Last 30 Days)</p>
                  {incidents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No incidents recorded in the last 30 days.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {incidents.map((incident) => (
                        <div
                          key={String(incident["id"])}
                          className="flex items-center justify-between text-sm"
                        >
                          <span>
                            {formatDateTime(incident["started_at"] as string | null)}:{" "}
                            {String(incident["title"] ?? "—")}
                          </span>
                          <Badge variant="outline">
                            {durationLabel(
                              incident["started_at"] as string | null,
                              incident["resolved_at"] as string | null,
                            )}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance">
            <GlassCard title="Performance Metrics">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg bg-surface p-4">
                  <p className="text-sm text-muted-foreground">Average Response Time</p>
                  <p className="mt-1 text-2xl font-bold">{ms(requestLatency)}</p>
                  <p className="text-xs text-muted-foreground">
                    {requests.length > 0
                      ? `${capped ? "≥" : ""}${num(requests.length)} logged requests, last 24h`
                      : "No requests logged in the last 24h"}
                  </p>
                </div>
                <div className="rounded-lg bg-surface p-4">
                  <p className="text-sm text-muted-foreground">Requests/sec</p>
                  <p className="mt-1 text-2xl font-bold">
                    {requests.length > 0
                      ? `${capped ? "≥" : ""}${(requests.length / 86_400).toFixed(3)}`
                      : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">Average over the last 24h</p>
                </div>
                <div className="rounded-lg bg-surface p-4">
                  <p className="text-sm text-muted-foreground">Error Rate</p>
                  <p className="mt-1 text-2xl font-bold text-status-success">
                    {requests.length > 0 ? pct((failures / requests.length) * 100, 2) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">5xx responses, last 24h</p>
                </div>
                <div className="rounded-lg bg-surface p-4">
                  <p className="text-sm text-muted-foreground">CPU Usage</p>
                  <p className="mt-1 text-2xl font-bold">—</p>
                  <p className="text-xs text-muted-foreground">Not tracked: {NOT_REPORTED}</p>
                </div>
              </div>
            </GlassCard>
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts">
            <GlassCard title="Alert Management">
              <div className="space-y-4">
                <div className="rounded-lg bg-surface p-4">
                  <p className="text-sm font-medium">Active Alerts: {num(alerts.length)}</p>
                </div>
                {alerts.length === 0 ? (
                  <EmptyState message="No open alerts." />
                ) : (
                  <div className="space-y-2">
                    {alerts.map((alert) => (
                      <div
                        key={String(alert["id"])}
                        className="flex items-start gap-3 rounded-lg border border-border p-3"
                      >
                        <AlertTriangle className="mt-1 h-4 w-4 text-status-warning" />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{String(alert["title"] ?? "—")}</p>
                          <p className="text-xs text-muted-foreground">
                            {String(alert["severity"] ?? "—")} ·{" "}
                            {formatDateTime(alert["detected_at"] as string | null)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={acknowledge.isPending}
                          onClick={() =>
                            acknowledge.mutate({
                              table: "security_alerts",
                              id: String(alert["id"]),
                              values: { status: "investigating" },
                            })
                          }
                        >
                          Acknowledge
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </GlassCard>
          </TabsContent>

          {/* Auto-Healing Tab */}
          <TabsContent value="autoheal">
            <GlassCard title="Auto-Healing Configuration">
              <div className="space-y-4">
                <div className="rounded-lg bg-surface p-4">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" disabled />
                    <span className="text-sm font-medium">Enable Auto-Healing</span>
                  </label>
                </div>
                <EmptyState message={`Self-healing status and rules: ${NOT_REPORTED}`} />
                <Button variant="outline" disabled title={NOT_REPORTED}>
                  Add Healing Rule
                </Button>
              </div>
            </GlassCard>
          </TabsContent>

          {/* Backup Tab */}
          <TabsContent value="backup">
            <GlassCard title="Backup & Recovery">
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg bg-surface p-4">
                    <p className="text-sm text-muted-foreground">Last Backup</p>
                    <p className="text-lg font-bold">—</p>
                    <p className="text-xs text-muted-foreground">Not tracked</p>
                  </div>
                  <div className="rounded-lg bg-surface p-4">
                    <p className="text-sm text-muted-foreground">Backup Frequency</p>
                    <p className="text-lg font-bold">—</p>
                    <p className="text-xs text-muted-foreground">Not tracked</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Backup History</p>
                  <p className="text-sm text-muted-foreground">{NOT_REPORTED}</p>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled title={NOT_REPORTED}>
                    Backup Now
                  </Button>
                  <Button size="sm" variant="outline" disabled title={NOT_REPORTED}>
                    Restore
                  </Button>
                </div>
              </div>
            </GlassCard>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
