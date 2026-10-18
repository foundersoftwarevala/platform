import { motion } from "framer-motion";
import { 
  BarChart3, 
  Users, 
  Globe, 
  Smartphone,
  Monitor,
  TrendingUp,
  Clock,
  Target,
  MousePointer,
  Eye
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDemoClickAnalytics } from "@/lib/marketplace-demo.functions";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

/**
 * Every figure on this screen was typed into this file.
 *
 * "E-Commerce Pro" with 5,678 visitors and a 24.5% conversion, "Banking Portal",
 * "Travel Booking" - none of them products this platform sells - alongside
 * 24.5K visitors, a 4m 32s average session and a 32% bounce rate. On an
 * operator screen that is not decoration; it is a number somebody could act on.
 *
 * demo_clicks records the real opens, with the device, the country and whether
 * the visit converted, and mm_demo_click_analytics aggregates them in SQL.
 *
 * Two things are deliberately not drawn any more. Bounce rate has no source -
 * nothing records a visit ending - and neither does demo completion, so both
 * read as unavailable rather than showing a figure. The palette below is kept
 * so the charts look exactly as they did.
 */
const SLICE_COLOURS = [
  "hsl(187, 100%, 50%)",
  "hsl(174, 100%, 45%)",
  "hsl(142, 76%, 50%)",
  "hsl(280, 100%, 65%)",
  "hsl(25, 95%, 53%)",
  "hsl(210, 90%, 60%)",
];

const DemoAnalytics = () => {
  const [days, setDays] = useState(7);

  const analytics = useQuery({
    queryKey: ["demo-click-analytics", days],
    queryFn: () => getDemoClickAnalytics({ data: { days } }),
    staleTime: 60_000,
  });

  const visitorData = analytics.data?.visitors ?? [];
  const regionData = (analytics.data?.regions ?? []).map((r, i) => ({
    ...r,
    color: SLICE_COLOURS[i % SLICE_COLOURS.length],
  }));
  /**
   * The device breakdown. The bar beside each one is drawn as a percentage and
   * the row renders device.icon as a component, so both have to be supplied -
   * leaving the icon off crashed this screen, because an undefined component
   * cannot be rendered.
   */
  const deviceRows = analytics.data?.devices ?? [];
  const deviceTotal = deviceRows.reduce((sum, d) => sum + d.value, 0);
  const deviceData = deviceRows.map((d) => ({
    name: d.name,
    value: deviceTotal > 0 ? Math.round((d.value * 100) / deviceTotal) : 0,
    opens: d.value,
    icon: /mobile|phone|android|ios/i.test(d.name) ? Smartphone : Monitor,
  }));
  const topDemos = analytics.data?.top_demos ?? [];
  const totals = analytics.data?.totals;

  const session = totals?.avg_session_seconds;
  const stats = [
    {
      label: "Demo Opens",
      value: String(totals?.opens ?? 0),
      icon: Users,
      color: "text-primary",
      change: `last ${days} days`,
    },
    {
      label: "Avg Session",
      value:
        session == null
          ? "—"
          : `${Math.floor(session / 60)}m ${String(Math.round(session % 60)).padStart(2, "0")}s`,
      icon: Clock,
      color: "text-neon-cyan",
      change: session == null ? "not recorded" : "measured",
    },
    {
      label: "Converted",
      value:
        totals && totals.opens > 0
          ? `${Math.round((totals.converted * 100) / totals.opens)}%`
          : "—",
      icon: Target,
      color: "text-neon-green",
      change: `${totals?.converted ?? 0} of ${totals?.opens ?? 0}`,
    },
    // No source exists for either of these, so neither invents one.
    { label: "Bounce Rate", value: "—", icon: TrendingUp, color: "text-neon-orange", change: "not tracked" },
    { label: "Demo Completion", value: "—", icon: Eye, color: "text-neon-teal", change: "not tracked" },
  ];


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-mono font-bold text-foreground">Demo Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">Comprehensive insights across all product demos</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-4">
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
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${stat.color}`} />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <div className={`text-2xl font-mono font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-neon-green mt-1">{stat.change} vs last week</div>
            </motion.div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Visitor Trend */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel p-4 col-span-2"
        >
          <h3 className="font-mono font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Visitor & Conversion Trend
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={visitorData}>
              <defs>
                <linearGradient id="visitorGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(187, 100%, 50%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(187, 100%, 50%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="conversionGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142, 76%, 50%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(142, 76%, 50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 18%)" />
              <XAxis dataKey="date" stroke="hsl(210, 20%, 55%)" fontSize={10} />
              <YAxis yAxisId="left" stroke="hsl(210, 20%, 55%)" fontSize={10} />
              <YAxis yAxisId="right" orientation="right" stroke="hsl(210, 20%, 55%)" fontSize={10} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(222, 47%, 8%)", 
                  border: "1px solid hsl(222, 30%, 18%)",
                  borderRadius: "8px"
                }}
              />
              <Area yAxisId="left" type="monotone" dataKey="visitors" stroke="hsl(187, 100%, 50%)" fill="url(#visitorGradient)" strokeWidth={2} />
              <Area yAxisId="right" type="monotone" dataKey="conversions" stroke="hsl(142, 76%, 50%)" fill="url(#conversionGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Region Distribution */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="glass-panel p-4"
        >
          <h3 className="font-mono font-semibold text-foreground mb-4 flex items-center gap-2">
            <Globe className="w-4 h-4 text-neon-teal" />
            Traffic by Region
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={regionData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {regionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(222, 47%, 8%)", 
                  border: "1px solid hsl(222, 30%, 18%)",
                  borderRadius: "8px"
                }}
                formatter={(value: number) => [`${value}%`, ""]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {regionData.slice(0, 4).map((item) => (
              <div key={item.name} className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-muted-foreground">{item.name}</span>
                <span className="ml-auto font-mono text-foreground">{item.value}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Device Breakdown */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="glass-panel p-4"
        >
          <h3 className="font-mono font-semibold text-foreground mb-4 flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-neon-cyan" />
            Device Breakdown
          </h3>
          <div className="space-y-4">
            {deviceData.map((device, index) => {
              const Icon = device.icon;
              return (
                <div key={device.name}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">{device.name}</span>
                    </div>
                    <span className="font-mono text-primary">{device.value}%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${device.value}%` }}
                      transition={{ duration: 1, delay: index * 0.2 }}
                      className="h-full bg-gradient-to-r from-primary to-neon-teal rounded-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Top Performing Demos */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="glass-panel p-4 col-span-2"
        >
          <h3 className="font-mono font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-neon-green" />
            Top Performing Demos
          </h3>
          <div className="space-y-3">
            {topDemos.map((demo, index) => (
              <motion.div
                key={demo.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-4 p-3 rounded-lg bg-secondary/30"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center font-mono font-bold text-primary">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-foreground">{demo.name}</div>
                </div>
                <div className="text-center px-3">
                  <div className="font-mono text-primary">{demo.visitors.toLocaleString()}</div>
                  <div className="text-[10px] text-muted-foreground">Visitors</div>
                </div>
                <div className="text-center px-3">
                  <div className="font-mono text-neon-green">{demo.conversion}%</div>
                  <div className="text-[10px] text-muted-foreground">Conversion</div>
                </div>
                <div className="text-center px-3">
                  <div className="font-mono text-neon-orange">{demo.bounce == null ? "—" : `${demo.bounce}%`}</div>
                  <div className="text-[10px] text-muted-foreground">Bounce</div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DemoAnalytics;
