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

const uptimeData = [
  { time: "00:00", uptime: 99.99 },
  { time: "04:00", uptime: 99.98 },
  { time: "08:00", uptime: 99.99 },
  { time: "12:00", uptime: 99.97 },
  { time: "16:00", uptime: 99.99 },
  { time: "20:00", uptime: 99.98 },
  { time: "Now", uptime: 99.99 },
];

const responseTimeData = [
  { time: "00:00", avg: 1.2, p95: 2.1 },
  { time: "04:00", avg: 1.1, p95: 1.8 },
  { time: "08:00", avg: 1.4, p95: 2.5 },
  { time: "12:00", avg: 1.6, p95: 2.8 },
  { time: "16:00", avg: 1.3, p95: 2.2 },
  { time: "20:00", avg: 1.2, p95: 2.0 },
  { time: "Now", avg: 1.1, p95: 1.9 },
];

const incidents = [
  { id: 1, demo: "Restaurant POS", type: "Scheduled Maintenance", start: "2 hours ago", duration: "45 min", status: "ongoing" },
  { id: 2, demo: "Inventory System", type: "Server Error", start: "3 hours ago", duration: "12 min", status: "resolved" },
  { id: 3, demo: "Banking Portal", type: "High Load", start: "5 hours ago", duration: "8 min", status: "resolved" },
];

const healthChecks = [
  { name: "API Response", status: "healthy", value: "42ms" },
  { name: "Database", status: "healthy", value: "12ms" },
  { name: "CDN", status: "healthy", value: "8ms" },
  { name: "Auth Service", status: "healthy", value: "28ms" },
  { name: "Storage", status: "warning", value: "156ms" },
  { name: "Email Service", status: "healthy", value: "95ms" },
];

const DemoUptimeMonitor = () => {
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
        {[
          { label: "Overall Uptime", value: "99.97%", icon: Activity, color: "text-neon-green", subtext: "30 day average" },
          { label: "Avg Response", value: "1.2s", icon: Zap, color: "text-neon-cyan", subtext: "Across all demos" },
          { label: "Active Monitors", value: "47", icon: Server, color: "text-primary", subtext: "All regions" },
          { label: "Incidents Today", value: "2", icon: AlertTriangle, color: "text-neon-orange", subtext: "1 resolved" },
        ].map((stat, index) => {
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
