import { useState } from "react";
import {
  AlertTriangle,
  Activity,
  TrendingUp,
  Shield,
  Settings,
  Bell,
  Database,
  BarChart3,
  Check,
  X,
  Clock,
  Zap,
  Heart,
  HardDrive,
  Cpu,
} from "lucide-react";
import { PageHeader, GlassCard, StatCard, StatusBadge } from "../primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export default function MonitoringScreen() {
  const [alerts, setAlerts] = useState<any[]>([
    {
      id: 1,
      message: "API response time exceeded 500ms",
      severity: "warning",
      time: "5 minutes ago",
    },
    {
      id: 2,
      message: "Database connection pool at 85%",
      severity: "warning",
      time: "12 minutes ago",
    },
  ]);

  const [services, setServices] = useState<any[]>([
    { name: "API Server", status: "healthy", uptime: "99.98%", latency: "45ms" },
    { name: "Database", status: "healthy", uptime: "99.99%", latency: "12ms" },
    { name: "Cache Layer", status: "healthy", uptime: "99.97%", latency: "8ms" },
    { name: "Payment Processor", status: "warning", uptime: "99.85%", latency: "320ms" },
  ]);

  const stats = [
    { label: "System Health", value: "98.2%", tone: "green" },
    { label: "Uptime (30d)", value: "99.98%", tone: "primary" },
    { label: "Avg Response", value: "87ms", tone: "cyan" },
    { label: "Active Alerts", value: 2, tone: "amber" },
  ];

  return (
    <>
      <PageHeader
        title="Monitoring & Health"
        description="System health, uptime tracking, auto-healing, and performance metrics"
      />

      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s, i) => (
            <StatCard
              key={i}
              label={s.label}
              value={s.value}
              tone={s.tone as any}
              icon={
                [
                  <Heart className="h-4 w-4" />,
                  <Activity className="h-4 w-4" />,
                  <Zap className="h-4 w-4" />,
                  <AlertTriangle className="h-4 w-4" />,
                ][i]
              }
            />
          ))}
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
              <div className="space-y-3">
                {services.map((service, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-border p-4"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{service.name}</p>
                      <div className="mt-1 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <p>Uptime: {service.uptime}</p>
                        <p>Latency: {service.latency}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge value={service.status} />
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </TabsContent>

          {/* Uptime Tab */}
          <TabsContent value="uptime">
            <GlassCard title="Uptime Tracker">
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg bg-surface p-4">
                    <p className="text-sm text-muted-foreground">Last 7 Days</p>
                    <p className="text-2xl font-bold text-status-success">99.98%</p>
                  </div>
                  <div className="rounded-lg bg-surface p-4">
                    <p className="text-sm text-muted-foreground">Last 30 Days</p>
                    <p className="text-2xl font-bold text-status-success">99.97%</p>
                  </div>
                  <div className="rounded-lg bg-surface p-4">
                    <p className="text-sm text-muted-foreground">Last 90 Days</p>
                    <p className="text-2xl font-bold text-status-success">99.96%</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Downtime Events (Last 30 Days)</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>March 15 - 8:32 AM: API Maintenance</span>
                      <Badge variant="outline">2 minutes</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>March 8 - 3:15 PM: Database Failover</span>
                      <Badge variant="outline">45 seconds</Badge>
                    </div>
                  </div>
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
                  <p className="mt-1 text-2xl font-bold">87ms</p>
                  <p className="text-xs text-muted-foreground">↓ 12% from yesterday</p>
                </div>
                <div className="rounded-lg bg-surface p-4">
                  <p className="text-sm text-muted-foreground">Requests/sec</p>
                  <p className="mt-1 text-2xl font-bold">4,240</p>
                  <p className="text-xs text-muted-foreground">↑ 8% from yesterday</p>
                </div>
                <div className="rounded-lg bg-surface p-4">
                  <p className="text-sm text-muted-foreground">Error Rate</p>
                  <p className="mt-1 text-2xl font-bold text-status-success">0.02%</p>
                  <p className="text-xs text-muted-foreground">✓ Within SLA</p>
                </div>
                <div className="rounded-lg bg-surface p-4">
                  <p className="text-sm text-muted-foreground">CPU Usage</p>
                  <p className="mt-1 text-2xl font-bold">42%</p>
                  <p className="text-xs text-muted-foreground">Health: Optimal</p>
                </div>
              </div>
            </GlassCard>
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts">
            <GlassCard title="Alert Management">
              <div className="space-y-4">
                <div className="rounded-lg bg-surface p-4">
                  <p className="text-sm font-medium">Active Alerts: {alerts.length}</p>
                </div>
                <div className="space-y-2">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-start gap-3 rounded-lg border border-border p-3"
                    >
                      <AlertTriangle className="mt-1 h-4 w-4 text-status-warning" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{alert.message}</p>
                        <p className="text-xs text-muted-foreground">{alert.time}</p>
                      </div>
                      <Button size="sm" variant="outline">
                        Acknowledge
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </GlassCard>
          </TabsContent>

          {/* Auto-Healing Tab */}
          <TabsContent value="autoheal">
            <GlassCard title="Auto-Healing Configuration">
              <div className="space-y-4">
                <div className="rounded-lg bg-surface p-4">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked />
                    <span className="text-sm font-medium">Enable Auto-Healing</span>
                  </label>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Healing Rules</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-status-success" />
                      <span className="text-sm">
                        Restart service if CPU exceeds 90% for 5 minutes
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-status-success" />
                      <span className="text-sm">
                        Failover database if latency exceeds 1000ms
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-status-success" />
                      <span className="text-sm">
                        Clear cache if memory usage exceeds 80%
                      </span>
                    </div>
                  </div>
                </div>

                <Button variant="outline">Add Healing Rule</Button>
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
                    <p className="text-lg font-bold">Today, 2:30 AM</p>
                    <p className="text-xs text-muted-foreground">Status: Success</p>
                  </div>
                  <div className="rounded-lg bg-surface p-4">
                    <p className="text-sm text-muted-foreground">Backup Frequency</p>
                    <p className="text-lg font-bold">Hourly</p>
                    <p className="text-xs text-muted-foreground">Retention: 30 days</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Backup History</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Today, 2:30 AM</span>
                      <Badge variant="outline">2.3 GB</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Today, 1:30 AM</span>
                      <Badge variant="outline">2.3 GB</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Today, 12:30 AM</span>
                      <Badge variant="outline">2.3 GB</Badge>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline">
                    Backup Now
                  </Button>
                  <Button size="sm" variant="outline">
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
