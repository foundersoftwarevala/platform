import { useMemo } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DataStateNotice from "./DataStateNotice";
import {
  Monitor,
  TrendingUp,
  Users,
  AlertTriangle,
  Clock,
  Globe,
  Smartphone,
  Activity,
  CheckCircle,
  XCircle,
  RefreshCw,
} from "lucide-react";

interface TopDemo {
  id: string;
  name: string;
  clicks: number;
  uptime: number;
  tech: string;
  status: string;
}

interface DistributionItem {
  label: string;
  clicks: number;
  percentage: number;
}

interface DashboardData {
  total: number;
  active: number;
  maintenance: number;
  down: number;
  totalClicks: number;
  uniqueVisitors: number;
  avgUptime: number;
  overallHealth: number;
  topDemos: TopDemo[];
  regions: DistributionItem[];
  devices: DistributionItem[];
}

const CLICK_WINDOW_DAYS = 30;

const toDistribution = (counts: Map<string, number>, total: number, limit: number): DistributionItem[] =>
  [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, clicks]) => ({
      label,
      clicks,
      percentage: total > 0 ? Math.round((clicks / total) * 100) : 0,
    }));

const DemoDashboard = () => {
  const { session } = useAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["demo-manager", "dashboard"],
    queryFn: async (): Promise<DashboardData> => {
      const { data: demos, error: demosError } = await supabase
        .from("demos")
        .select("id, title, status, uptime_percentage, health_score, tech_stack")
        .limit(500);
      if (demosError) throw demosError;

      const rows = demos ?? [];
      const since = new Date(Date.now() - CLICK_WINDOW_DAYS * 86_400_000).toISOString();
      const { data: clicks, error: clicksError } = await supabase
        .from("demo_clicks")
        .select("demo_id, region, country, device_type, user_id")
        .gte("clicked_at", since)
        .limit(10_000);
      if (clicksError) throw clicksError;

      const clickRows = clicks ?? [];
      const perDemo = new Map<string, number>();
      const regionCounts = new Map<string, number>();
      const deviceCounts = new Map<string, number>();
      const visitors = new Set<string>();

      clickRows.forEach((c) => {
        perDemo.set(c.demo_id, (perDemo.get(c.demo_id) ?? 0) + 1);
        const region = c.region ?? c.country ?? "Unknown";
        regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1);
        const device = c.device_type ?? "Unknown";
        deviceCounts.set(device, (deviceCounts.get(device) ?? 0) + 1);
        if (c.user_id) visitors.add(c.user_id);
      });

      const uptimes = rows.map((d) => Number(d.uptime_percentage ?? 0)).filter((n) => n > 0);
      const healthScores = rows.map((d) => Number(d.health_score ?? 0)).filter((n) => n > 0);

      const topDemos: TopDemo[] = rows
        .map((d) => ({
          id: d.id,
          name: d.title ?? "Untitled",
          clicks: perDemo.get(d.id) ?? 0,
          uptime: Number(d.uptime_percentage ?? 0),
          tech: Array.isArray(d.tech_stack) ? String(d.tech_stack[0]) : String(d.tech_stack ?? "—"),
          status: d.status ?? "inactive",
        }))
        .sort((a, b) => b.clicks - a.clicks || b.uptime - a.uptime)
        .slice(0, 5);

      return {
        total: rows.length,
        active: rows.filter((d) => d.status === "active").length,
        maintenance: rows.filter((d) => d.status === "maintenance").length,
        down: rows.filter((d) => d.status === "down" || d.status === "inactive").length,
        totalClicks: clickRows.length,
        uniqueVisitors: visitors.size,
        avgUptime: uptimes.length ? uptimes.reduce((a, b) => a + b, 0) / uptimes.length : 0,
        overallHealth: healthScores.length
          ? Math.round(healthScores.reduce((a, b) => a + b, 0) / healthScores.length)
          : rows.length
            ? Math.round((rows.filter((d) => d.status === "active").length / rows.length) * 100)
            : 0,
        topDemos,
        regions: toDistribution(regionCounts, clickRows.length, 5),
        devices: toDistribution(deviceCounts, clickRows.length, 3),
      };
    },
  });

  const stats = data;

  const metrics = useMemo(() => {
    if (!stats) return [];
    return [
      { label: "Total Demos", value: stats.total.toLocaleString(), sub: "registered", icon: Monitor, color: "text-neon-teal" },
      { label: "Active", value: stats.active.toLocaleString(), sub: "running", icon: Activity, color: "text-neon-green" },
      { label: `Clicks (${CLICK_WINDOW_DAYS}d)`, value: stats.totalClicks.toLocaleString(), sub: "tracked", icon: TrendingUp, color: "text-primary" },
      { label: "Signed-in Visitors", value: stats.uniqueVisitors.toLocaleString(), sub: `${CLICK_WINDOW_DAYS}d`, icon: Users, color: "text-neon-cyan" },
      { label: "Avg Uptime", value: stats.avgUptime ? `${stats.avgUptime.toFixed(1)}%` : "—", sub: "reported", icon: Clock, color: "text-emerald-400" },
      { label: "Down / Inactive", value: stats.down.toLocaleString(), sub: "needs action", icon: AlertTriangle, color: "text-orange-400" },
    ];
  }, [stats]);

  const demosByStatus = stats
    ? [
        { status: "Active", count: stats.active, color: "bg-neon-green/20 text-neon-green border-neon-green/30" },
        { status: "Maintenance", count: stats.maintenance, color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
        { status: "Down", count: stats.down, color: "bg-red-500/20 text-red-400 border-red-500/30" },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Demo Dashboard</h1>
          <p className="text-muted-foreground">Real-time demo performance overview</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-neon-green/20 text-neon-green border border-neon-green/30 animate-pulse">
            <Activity className="w-3 h-3 mr-1" />
            LIVE
          </Badge>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <DataStateNotice
        isLoading={isLoading}
        error={error}
        isEmpty={Boolean(stats && stats.total === 0)}
        hasSession={Boolean(session)}
        resource="demo performance data"
        loadingLabel="Aggregating live demo metrics…"
        emptyIcon={<Monitor className="w-8 h-8 text-muted-foreground" />}
        emptyTitle="No demos registered yet"
        emptyDescription="Add your first demo to start tracking clicks, uptime and health."
        onRetry={() => refetch()}
      >
        {stats && (
          <div className="space-y-6">
            {/* Main Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {metrics.map((metric, index) => (
                <motion.div
                  key={metric.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="glass-card border-border/50 hover:border-primary/50 transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <metric.icon className={`w-5 h-5 ${metric.color}`} />
                        <Badge variant="outline" className="text-xs bg-background/50">
                          {metric.sub}
                        </Badge>
                      </div>
                      <p className="text-2xl font-bold text-foreground">{metric.value}</p>
                      <p className="text-xs text-muted-foreground">{metric.label}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Status Overview & Top Demos */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                <Card className="glass-card border-border/50 h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Activity className="w-4 h-4 text-primary" />
                      Demo Status Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {demosByStatus.map((item) => (
                      <div key={item.status} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {item.status === "Active" ? (
                            <CheckCircle className="w-4 h-4 text-neon-green" />
                          ) : item.status === "Down" ? (
                            <XCircle className="w-4 h-4 text-red-400" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-orange-400" />
                          )}
                          <span className="text-sm text-foreground">{item.status}</span>
                        </div>
                        <Badge className={item.color}>{item.count}</Badge>
                      </div>
                    ))}

                    <div className="pt-4 border-t border-border/50">
                      <div className="flex justify-between text-xs text-muted-foreground mb-2">
                        <span>Overall Health</span>
                        <span>{stats.overallHealth}%</span>
                      </div>
                      <div className="h-2 bg-background rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-neon-green to-neon-teal rounded-full"
                          style={{ width: `${stats.overallHealth}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Top Performing Demos */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="lg:col-span-2"
              >
                <Card className="glass-card border-border/50 h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      Top Performing Demos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {stats.topDemos.map((demo, index) => (
                        <div
                          key={demo.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-background/30 hover:bg-background/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                              {index + 1}
                            </span>
                            <div>
                              <p className="text-sm font-medium text-foreground">{demo.name}</p>
                              <p className="text-xs text-muted-foreground">{demo.tech}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-sm font-medium text-foreground">{demo.clicks.toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">clicks</p>
                            </div>
                            <Badge
                              className={
                                demo.status === "active"
                                  ? "bg-neon-green/20 text-neon-green"
                                  : "bg-orange-500/20 text-orange-400"
                              }
                            >
                              {demo.uptime ? `${demo.uptime}%` : demo.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Region & Device Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                <Card className="glass-card border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Globe className="w-4 h-4 text-primary" />
                      Region Distribution
                      <span className="text-xs text-muted-foreground font-normal">
                        (last {CLICK_WINDOW_DAYS} days)
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {stats.regions.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No click events recorded in this window yet.
                      </p>
                    )}
                    {stats.regions.map((region) => (
                      <div key={region.label} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-foreground">{region.label}</span>
                          <span className="text-muted-foreground">
                            {region.clicks.toLocaleString()} ({region.percentage}%)
                          </span>
                        </div>
                        <div className="h-2 bg-background rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-primary to-neon-teal rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${region.percentage}%` }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                <Card className="glass-card border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-primary" />
                      Device Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {stats.devices.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No device data recorded in the last {CLICK_WINDOW_DAYS} days.
                      </p>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-4">
                          {stats.devices.map((device, index) => (
                            <motion.div
                              key={device.label}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.35 + index * 0.05 }}
                              className="text-center p-4 rounded-lg bg-background/30"
                            >
                              <Monitor className="w-8 h-8 mx-auto mb-2 text-primary" />
                              <p className="text-2xl font-bold text-foreground">{device.percentage}%</p>
                              <p className="text-xs text-muted-foreground capitalize">{device.label}</p>
                            </motion.div>
                          ))}
                        </div>

                        <div className="mt-6 h-4 rounded-full overflow-hidden flex">
                          {stats.devices.map((device, i) => (
                            <div
                              key={device.label}
                              className={
                                i === 0 ? "bg-primary h-full" : i === 1 ? "bg-neon-teal h-full" : "bg-neon-green h-full"
                              }
                              style={{ width: `${device.percentage}%` }}
                            />
                          ))}
                        </div>
                        <div className="flex justify-between mt-2 text-xs text-muted-foreground capitalize">
                          {stats.devices.map((device) => (
                            <span key={device.label}>{device.label}</span>
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        )}
      </DataStateNotice>
    </div>
  );
};

export default DemoDashboard;
