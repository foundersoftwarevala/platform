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
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

const visitorData = [
  { date: "Mon", visitors: 1234, conversions: 89 },
  { date: "Tue", visitors: 1456, conversions: 102 },
  { date: "Wed", visitors: 1678, conversions: 123 },
  { date: "Thu", visitors: 1890, conversions: 145 },
  { date: "Fri", visitors: 2123, conversions: 167 },
  { date: "Sat", visitors: 1567, conversions: 98 },
  { date: "Sun", visitors: 1345, conversions: 78 },
];

const regionData = [
  { name: "India", value: 35, color: "hsl(187, 100%, 50%)" },
  { name: "USA", value: 25, color: "hsl(174, 100%, 45%)" },
  { name: "Europe", value: 20, color: "hsl(142, 76%, 50%)" },
  { name: "UAE", value: 12, color: "hsl(280, 100%, 65%)" },
  { name: "Others", value: 8, color: "hsl(25, 95%, 53%)" },
];

const deviceData = [
  { name: "Desktop", value: 45, icon: Monitor },
  { name: "Mobile", value: 42, icon: Smartphone },
  { name: "Tablet", value: 13, icon: Monitor },
];

const topDemos = [
  { name: "E-Commerce Pro", visitors: 5678, conversion: 24.5, bounce: 32 },
  { name: "Food Delivery", visitors: 4567, conversion: 28.3, bounce: 28 },
  { name: "Banking Portal", visitors: 3456, conversion: 31.2, bounce: 25 },
  { name: "Travel Booking", visitors: 2345, conversion: 22.8, bounce: 35 },
  { name: "School ERP", visitors: 1890, conversion: 19.5, bounce: 38 },
];

const DemoAnalytics = () => {
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
        {[
          { label: "Total Visitors", value: "24.5K", icon: Users, color: "text-primary", change: "+12%" },
          { label: "Avg Session", value: "4m 32s", icon: Clock, color: "text-neon-cyan", change: "+8%" },
          { label: "Conversion Rate", value: "24.8%", icon: Target, color: "text-neon-green", change: "+3.2%" },
          { label: "Bounce Rate", value: "32%", icon: TrendingUp, color: "text-neon-orange", change: "-5%" },
          { label: "Demo Completion", value: "68%", icon: Eye, color: "text-neon-teal", change: "+4%" },
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
                  <div className="font-mono text-neon-orange">{demo.bounce}%</div>
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
