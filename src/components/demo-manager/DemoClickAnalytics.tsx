import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { getDemoClickAnalytics } from "@/lib/marketplace-demo.functions";
import DataStateNotice from "./DataStateNotice";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import {
  TrendingUp,
  MousePointer,
  Globe,
  Smartphone,
  Monitor,
  Users,
  Target,
  Calendar,
  Download,
  RefreshCw,
} from "lucide-react";

/**
 * Every figure on this screen used to be typed into this file - 12,847 clicks,
 * "Reseller Alpha" with a 4.0% rate, "CRM Enterprise" with 3,420 opens - none
 * of it recorded anywhere.
 *
 * demo_clicks records the real opens (device, country, converted, session
 * length) and mm_demo_click_analytics(p_days integer) aggregates them in SQL.
 * Three panels have no source and say so instead of drawing a figure:
 *   - unique visitors: the function does not count distinct visitors
 *   - hourly distribution: the function buckets by day, not by hour
 *   - resellers / franchises: a demo open is not attributed to a reseller
 */
const SLICE_COLOURS = ["#00D9FF", "#39FF14", "#FF6B35", "#9B59B6", "#95A5A6", "#F1C40F"];

const RANGE_DAYS: Record<string, number> = { "24h": 1, "7d": 7, "30d": 30, "90d": 90 };

const NotTracked = ({ title, reason }: { title: string; reason: string }) => (
  <div className="flex flex-col items-center justify-center h-full py-8 text-center gap-1">
    <p className="text-sm font-medium text-muted-foreground">{title}</p>
    <p className="text-xs text-muted-foreground/80 max-w-xs">{reason}</p>
  </div>
);

const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

const DemoClickAnalytics = () => {
  const { t } = useTranslation();
  const [timeRange, setTimeRange] = useState("7d");
  const [selectedDemo, setSelectedDemo] = useState("all");
  const days = RANGE_DAYS[timeRange] ?? 7;

  const analytics = useQuery({
    queryKey: ["demo-click-analytics", days],
    queryFn: () => getDemoClickAnalytics({ data: { days } }),
    staleTime: 60_000,
    retry: 1,
  });

  const data = analytics.data;
  const totals = data?.totals;
  const windowLabel = timeRange === "24h" ? "last 24h" : `last ${days} days`;

  const clickTrends = (data?.visitors ?? []).map((v) => ({
    date: v.date,
    clicks: v.visitors,
    conversions: v.conversions,
  }));

  const regionData = (data?.regions ?? []).map((r, i) => ({
    name: r.name,
    value: r.value,
    color: SLICE_COLOURS[i % SLICE_COLOURS.length],
  }));

  const deviceRows = data?.devices ?? [];
  const deviceTotal = deviceRows.reduce((sum, d) => sum + d.value, 0);
  const deviceData = deviceRows.map((d) => ({
    device: d.name,
    clicks: d.value,
    percentage: deviceTotal > 0 ? Math.round((d.value * 100) / deviceTotal) : 0,
  }));

  const demoPerformance = (data?.top_demos ?? []).map((d) => ({
    name: d.name,
    clicks: d.visitors,
  }));

  const session = totals?.avg_session_seconds ?? null;
  const metrics = [
    {
      label: "Total Clicks",
      value: totals ? totals.opens.toLocaleString() : "—",
      change: windowLabel,
      icon: MousePointer,
      color: "text-primary",
    },
    {
      label: "Unique Visitors",
      value: "—",
      change: "not tracked",
      icon: Users,
      color: "text-neon-teal",
    },
    {
      label: "Conversions",
      value: totals ? totals.converted.toLocaleString() : "—",
      change: windowLabel,
      icon: Target,
      color: "text-neon-green",
    },
    {
      label: "Avg. Session",
      value:
        session == null
          ? "—"
          : `${Math.floor(session / 60)}m ${String(Math.round(session % 60)).padStart(2, "0")}s`,
      change: session == null ? "not recorded" : "measured",
      icon: Calendar,
      color: "text-orange-400",
    },
  ];

  /** Downloads exactly what the function returned for this window. */
  const handleExport = () => {
    if (!data) return;
    const lines: string[] = [];
    lines.push(`Demo click analytics,${csvCell(windowLabel)}`);
    lines.push("");
    lines.push("Day,Opens,Conversions");
    data.visitors.forEach((v) =>
      lines.push([v.date, v.visitors, v.conversions].map(csvCell).join(",")),
    );
    lines.push("");
    lines.push("Country,Opens");
    data.regions.forEach((r) => lines.push([r.name, r.value].map(csvCell).join(",")));
    lines.push("");
    lines.push("Device,Opens");
    data.devices.forEach((d) => lines.push([d.name, d.value].map(csvCell).join(",")));
    lines.push("");
    lines.push("Demo,Opens,Conversion %");
    data.top_demos.forEach((d) =>
      lines.push([d.name, d.visitors, d.conversion ?? ""].map(csvCell).join(",")),
    );
    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `demo-click-analytics-${timeRange}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Click Analytics</h1>
          <p className="text-muted-foreground">Track clicks per reseller, region, and device</p>
        </div>
        <div className="flex items-center gap-3">
          {/* mm_demo_click_analytics aggregates across every demo; it takes no demo filter. */}
          <Select value={selectedDemo} onValueChange={setSelectedDemo} disabled>
            <SelectTrigger
              className="w-[180px] bg-background/50 border-border"
              title={t("demo.clicks.no_demo_filter")}
            >
              <SelectValue placeholder="All Demos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Demos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[120px] bg-background/50 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="border-border"
            onClick={() => void analytics.refetch()}
            disabled={analytics.isFetching}
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${analytics.isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button
            variant="outline"
            className="border-border"
            onClick={handleExport}
            disabled={!data}
            title={data ? t("demo.clicks.export_csv") : t("demo.clicks.nothing_to_export")}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <DataStateNotice
        isLoading={analytics.isLoading}
        error={analytics.error}
        resource="demo click analytics"
        loadingLabel="Loading demo opens…"
        onRetry={() => void analytics.refetch()}
      >
        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {metrics.map((metric, index) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="glass-card border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <metric.icon className={`w-5 h-5 ${metric.color}`} />
                    <Badge
                      variant="outline"
                      className={`text-xs ${metric.value === "—" ? "bg-muted/20 text-muted-foreground border-border" : "bg-neon-green/10 text-neon-green border-neon-green/30"}`}
                    >
                      {metric.change}
                    </Badge>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{metric.value}</p>
                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Click Trends Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="glass-card border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Click & Conversion Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={clickTrends}>
                    <defs>
                      <linearGradient id="clickGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00D9FF" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#00D9FF" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="convGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#39FF14" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#39FF14" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="clicks"
                      stroke="#00D9FF"
                      fill="url(#clickGradient)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="conversions"
                      stroke="#39FF14"
                      fill="url(#convGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#00D9FF]" />
                  <span className="text-sm text-muted-foreground">Clicks</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#39FF14]" />
                  <span className="text-sm text-muted-foreground">Conversions</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Region & Device Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Region Distribution */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="glass-card border-border/50 h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  Region Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  {regionData.length === 0 ? (
                    <NotTracked
                      title={t("demo.clicks.no_opens")}
                      reason={`Nothing was recorded in demo_clicks for the ${windowLabel}.`}
                    />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={regionData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {regionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {regionData.map((region) => (
                    <div key={region.name} className="flex items-center gap-2 text-sm">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: region.color }}
                      />
                      <span className="text-muted-foreground">{region.name}</span>
                      <span className="ml-auto font-medium text-foreground">
                        {region.value.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Device Breakdown */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="glass-card border-border/50 h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-primary" />
                  Device Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {deviceData.length === 0 && (
                    <NotTracked
                      title={t("demo.clicks.no_opens")}
                      reason="Device breakdown appears once demos are opened."
                    />
                  )}
                  {deviceData.map((device, index) => (
                    <motion.div
                      key={device.device}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + index * 0.1 }}
                      className="space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {device.device === "Desktop" ? (
                            <Monitor className="w-5 h-5 text-primary" />
                          ) : device.device === "Mobile" ? (
                            <Smartphone className="w-5 h-5 text-neon-teal" />
                          ) : (
                            <Monitor className="w-5 h-5 text-neon-green" />
                          )}
                          <span className="font-medium text-foreground">{device.device}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-foreground">{device.percentage}%</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            ({device.clicks.toLocaleString()})
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-background rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-neon-teal"
                          initial={{ width: 0 }}
                          animate={{ width: `${device.percentage}%` }}
                          transition={{ delay: 0.5 + index * 0.1, duration: 0.5 }}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Hourly Distribution */}
                <div className="mt-6 pt-6 border-t border-border">
                  <p className="text-sm font-medium text-foreground mb-4">Hourly Distribution</p>
                  <div className="h-[100px]">
                    <NotTracked
                      title="Not tracked"
                      reason="Demo opens are aggregated by day, not by hour, so there is no hourly breakdown to draw."
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Top Resellers & Demo Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Resellers/Franchises */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="glass-card border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Top Resellers / Franchises
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <NotTracked
                    title="Not tracked"
                    reason="A demo open is not attributed to a reseller or franchise, so no per-partner ranking can be computed."
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Demo Performance */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="glass-card border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  Demo Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  {demoPerformance.length === 0 ? (
                    <NotTracked
                      title={t("demo.clicks.no_opens")}
                      reason={`No demo was opened in the ${windowLabel}.`}
                    />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={demoPerformance} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis
                          dataKey="name"
                          type="category"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          width={120}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Bar dataKey="clicks" fill="#00D9FF" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </DataStateNotice>
    </div>
  );
};

export default DemoClickAnalytics;
