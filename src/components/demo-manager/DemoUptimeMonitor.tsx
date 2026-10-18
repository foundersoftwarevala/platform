import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { 
  Activity, 
  Server, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Zap,
  Globe,
  RefreshCw
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Button } from "@/components/ui/button";
import { getDemoUptimeSeries, listDemoHealth } from "@/lib/marketplace-demo.functions";

/**
 * Everything on this screen used to be typed into this file: uptime at 99.99,
 * response times around 1.2s, an "Active Monitors: 47" that was never 47, and
 * incidents on demos named Restaurant POS and Banking Portal, which this
 * platform does not sell. It is an operator screen, so those numbers could have
 * been read as the state of the estate.
 *
 * The monitor has been writing real checks into demo_health all along - 1,538
 * of them - and mm_demo_uptime_series buckets them in SQL. Per-demo health
 * comes from mm_demo_health, which the status grid beside this already uses.
 * Nothing here is drawn unless it was measured.
 */
type HealthRow = {
  id: string;
  demo_name: string | null;
  url: string | null;
  uptime_percent: number | null;
  avg_response_ms: number | null;
  latest_result: string | null;
  last_checked_at: string | null;
};

const DemoUptimeMonitor = () => {
  const [hours, setHours] = useState(24);

  const series = useQuery({
    queryKey: ["demo-uptime-series", hours],
    queryFn: () => getDemoUptimeSeries({ data: { hours } }),
    staleTime: 60_000,
  });

  const health = useQuery<HealthRow[]>({
    queryKey: ["demo-health", "uptime-panel"],
    queryFn: () => listDemoHealth({ data: { days: 30 } }) as Promise<HealthRow[]>,
    staleTime: 60_000,
  });

  const uptimeData = series.data?.uptime ?? [];
  const responseTimeData = series.data?.response ?? [];
  const totals = series.data?.totals;
  const demos = health.data ?? [];

  /** One line per demo, which is what this platform actually monitors. */
  const healthChecks = demos.map((d) => ({
    name: d.demo_name ?? "Demo",
    status: d.latest_result === "working" ? "healthy" : d.latest_result ? "warning" : "unknown",
    value: d.avg_response_ms == null ? "—" : `${Math.round(d.avg_response_ms)}ms`,
  }));

  /** A demo whose last check did not come back clean. */
  const incidents = demos
    .filter((d) => d.latest_result && d.latest_result !== "working")
    .map((d, i) => ({
      id: d.id ?? String(i),
      demo: d.demo_name ?? "Demo",
      type: d.latest_result === "slow" ? "Slow response" : "Unreachable",
      start: d.last_checked_at ? new Date(d.last_checked_at).toLocaleString() : "unknown",
      duration: d.uptime_percent == null ? "—" : `${d.uptime_percent}% in 30 days`,
      status: "ongoing",
    }));

  const stats = [
    {
      label: "Overall Uptime",
      value: totals?.uptime_percent == null ? "—" : `${totals.uptime_percent}%`,
      icon: Activity,
      color: "text-neon-green",
      subtext: `${totals?.checks ?? 0} checks in ${hours}h`,
    },
    {
      label: "Avg Response",
      value: totals?.avg_response_ms == null ? "—" : `${(totals.avg_response_ms / 1000).toFixed(2)}s`,
      icon: Zap,
      color: "text-neon-cyan",
      subtext: "Across all demos",
    },
    {
      label: "Active Monitors",
      value: String(demos.length),
      icon: Server,
      color: "text-primary",
      subtext: "Demos being checked",
    },
    {
      label: "Open Incidents",
      value: String(incidents.length),
      icon: AlertTriangle,
      color: "text-neon-orange",
      subtext: incidents.length === 0 ? "All clear" : "Last check failed",
    },
  ];


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-mono font-bold text-foreground">Uptime Monitor</h1>
          <p className="text-muted-foreground text-sm mt-1">Real-time health monitoring and incident tracking</p>
        </div>
        <Button variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Run Health Check
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="glass-panel p-4"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <div className={`text-2xl font-mono font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                  <div className="text-[10px] text-muted-foreground">{stat.subtext}</div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        {/* Uptime Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel p-4"
        >
          <h3 className="font-mono font-semibold text-foreground mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-neon-green" />
            Uptime Percentage (24h)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={uptimeData}>
              <defs>
                <linearGradient id="uptimeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142, 76%, 50%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(142, 76%, 50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 18%)" />
              <XAxis dataKey="time" stroke="hsl(210, 20%, 55%)" fontSize={10} />
              <YAxis domain={[99.5, 100]} stroke="hsl(210, 20%, 55%)" fontSize={10} tickFormatter={(v) => `${v}%`} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(222, 47%, 8%)", 
                  border: "1px solid hsl(222, 30%, 18%)",
                  borderRadius: "8px"
                }}
              />
              <Area type="monotone" dataKey="uptime" stroke="hsl(142, 76%, 50%)" fill="url(#uptimeGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Response Time Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="glass-panel p-4"
        >
          <h3 className="font-mono font-semibold text-foreground mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-neon-cyan" />
            Response Time (24h)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={responseTimeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 18%)" />
              <XAxis dataKey="time" stroke="hsl(210, 20%, 55%)" fontSize={10} />
              <YAxis stroke="hsl(210, 20%, 55%)" fontSize={10} tickFormatter={(v) => `${v}s`} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(222, 47%, 8%)", 
                  border: "1px solid hsl(222, 30%, 18%)",
                  borderRadius: "8px"
                }}
              />
              <Line type="monotone" dataKey="avg" stroke="hsl(187, 100%, 50%)" strokeWidth={2} name="Average" />
              <Line type="monotone" dataKey="p95" stroke="hsl(280, 100%, 65%)" strokeWidth={2} strokeDasharray="5 5" name="P95" />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Health Checks & Incidents */}
      <div className="grid grid-cols-2 gap-6">
        {/* Health Checks */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="glass-panel"
        >
          <div className="p-4 border-b border-border/30">
            <h3 className="font-mono font-semibold text-foreground flex items-center gap-2">
              <Server className="w-4 h-4 text-primary" />
              Service Health
            </h3>
          </div>
          <div className="divide-y divide-border/30">
            {healthChecks.map((check, index) => (
              <motion.div
                key={check.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    check.status === "healthy" ? "bg-neon-green animate-pulse" : "bg-neon-orange animate-pulse"
                  }`} />
                  <span className="text-sm text-foreground">{check.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-sm text-primary">{check.value}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase ${
                    check.status === "healthy" 
                      ? "bg-neon-green/20 text-neon-green" 
                      : "bg-neon-orange/20 text-neon-orange"
                  }`}>
                    {check.status}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Recent Incidents */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="glass-panel"
        >
          <div className="p-4 border-b border-border/30">
            <h3 className="font-mono font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-neon-orange" />
              Recent Incidents
            </h3>
          </div>
          <div className="divide-y divide-border/30">
            {incidents.map((incident, index) => (
              <motion.div
                key={incident.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-medium text-foreground">{incident.demo}</div>
                    <div className="text-xs text-muted-foreground">{incident.type}</div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase ${
                    incident.status === "resolved" 
                      ? "bg-neon-green/20 text-neon-green" 
                      : "bg-neon-orange/20 text-neon-orange"
                  }`}>
                    {incident.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Started {incident.start}
                  </span>
                  <span>Duration: {incident.duration}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DemoUptimeMonitor;
