import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Area
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
  RefreshCw
} from "lucide-react";

const DemoClickAnalytics = () => {
  const [timeRange, setTimeRange] = useState("7d");
  const [selectedDemo, setSelectedDemo] = useState("all");

  const clickTrends = [
    { date: "Mon", clicks: 1200, conversions: 48 },
    { date: "Tue", clicks: 1890, conversions: 75 },
    { date: "Wed", clicks: 1450, conversions: 58 },
    { date: "Thu", clicks: 2100, conversions: 84 },
    { date: "Fri", clicks: 1780, conversions: 71 },
    { date: "Sat", clicks: 980, conversions: 39 },
    { date: "Sun", clicks: 750, conversions: 30 },
  ];

  const regionData = [
    { name: "North America", value: 4250, color: "#00D9FF" },
    { name: "Europe", value: 3180, color: "#39FF14" },
    { name: "Asia Pacific", value: 2890, color: "#FF6B35" },
    { name: "Middle East", value: 1560, color: "#9B59B6" },
    { name: "Others", value: 967, color: "#95A5A6" },
  ];

  const deviceData = [
    { device: "Desktop", clicks: 7840, percentage: 62 },
    { device: "Mobile", clicks: 3920, percentage: 31 },
    { device: "Tablet", clicks: 887, percentage: 7 },
  ];

  const topResellers = [
    { name: "Reseller Alpha", clicks: 2340, conversions: 94, rate: "4.0%" },
    { name: "Franchise Beta", clicks: 1980, conversions: 79, rate: "4.0%" },
    { name: "Partner Gamma", clicks: 1650, conversions: 58, rate: "3.5%" },
    { name: "Reseller Delta", clicks: 1420, conversions: 51, rate: "3.6%" },
    { name: "Franchise Epsilon", clicks: 1180, conversions: 41, rate: "3.5%" },
  ];

  const demoPerformance = [
    { name: "CRM Enterprise", clicks: 3420 },
    { name: "E-Commerce Suite", clicks: 2890 },
    { name: "HR Management", clicks: 2456 },
    { name: "Inventory System", clicks: 1987 },
    { name: "Finance Portal", clicks: 1654 },
  ];

  const hourlyData = [
    { hour: "00", clicks: 120 }, { hour: "02", clicks: 80 }, { hour: "04", clicks: 45 },
    { hour: "06", clicks: 180 }, { hour: "08", clicks: 520 }, { hour: "10", clicks: 890 },
    { hour: "12", clicks: 1200 }, { hour: "14", clicks: 980 }, { hour: "16", clicks: 750 },
    { hour: "18", clicks: 620 }, { hour: "20", clicks: 450 }, { hour: "22", clicks: 280 },
  ];

  const metrics = [
    { label: "Total Clicks", value: "12,847", change: "+12.5%", icon: MousePointer, color: "text-primary" },
    { label: "Unique Visitors", value: "8,432", change: "+8.2%", icon: Users, color: "text-neon-teal" },
    { label: "Conversions", value: "405", change: "+15.3%", icon: Target, color: "text-neon-green" },
    { label: "Avg. Session", value: "4m 32s", change: "+5.1%", icon: Calendar, color: "text-orange-400" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Click Analytics</h1>
          <p className="text-muted-foreground">Track clicks per reseller, region, and device</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedDemo} onValueChange={setSelectedDemo}>
            <SelectTrigger className="w-[180px] bg-background/50 border-border">
              <SelectValue placeholder="All Demos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Demos</SelectItem>
              <SelectItem value="crm">CRM Enterprise</SelectItem>
              <SelectItem value="ecom">E-Commerce Suite</SelectItem>
              <SelectItem value="hr">HR Management</SelectItem>
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
          <Button variant="outline" size="icon" className="border-border">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="outline" className="border-border">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

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
                  <Badge variant="outline" className="text-xs bg-neon-green/10 text-neon-green border-neon-green/30">
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
                      <stop offset="5%" stopColor="#00D9FF" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#00D9FF" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="convGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#39FF14" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#39FF14" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Area type="monotone" dataKey="clicks" stroke="#00D9FF" fill="url(#clickGradient)" strokeWidth={2} />
                  <Area type="monotone" dataKey="conversions" stroke="#39FF14" fill="url(#convGradient)" strokeWidth={2} />
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
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                {regionData.map((region) => (
                  <div key={region.name} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: region.color }} />
                    <span className="text-muted-foreground">{region.name}</span>
                    <span className="ml-auto font-medium text-foreground">{region.value.toLocaleString()}</span>
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
                        <span className="text-sm text-muted-foreground ml-2">({device.clicks.toLocaleString()})</span>
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
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourlyData}>
                      <Bar dataKey="clicks" fill="#00D9FF" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
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
                {topResellers.map((reseller, index) => (
                  <div key={reseller.name} className="flex items-center justify-between p-3 rounded-lg bg-background/30 hover:bg-background/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                        {index + 1}
                      </span>
                      <span className="font-medium text-foreground">{reseller.name}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">{reseller.clicks.toLocaleString()} clicks</span>
                      <span className="text-muted-foreground">{reseller.conversions} conv.</span>
                      <Badge className="bg-neon-green/20 text-neon-green">{reseller.rate}</Badge>
                    </div>
                  </div>
                ))}
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
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={demoPerformance} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={120} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="clicks" fill="#00D9FF" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default DemoClickAnalytics;
