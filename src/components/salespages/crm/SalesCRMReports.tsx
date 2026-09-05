import { motion } from "framer-motion";
import { 
  TrendingUp, 
  TrendingDown,
  Calendar,
  Download,
  BarChart3,
  PieChart,
  Target,
  Users
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

const monthlyData = [
  { month: "Aug", sales: 420000, target: 500000 },
  { month: "Sep", sales: 580000, target: 500000 },
  { month: "Oct", sales: 490000, target: 550000 },
  { month: "Nov", sales: 720000, target: 600000 },
  { month: "Dec", sales: 650000, target: 700000 },
  { month: "Jan", sales: 840000, target: 800000 },
];

const conversionData = [
  { stage: "Lead → Contacted", rate: 78, color: "bg-blue-500" },
  { stage: "Contacted → Qualified", rate: 55, color: "bg-indigo-500" },
  { stage: "Qualified → Proposal", rate: 52, color: "bg-purple-500" },
  { stage: "Proposal → Closed", rate: 43, color: "bg-green-500" },
];

const topPerformers = [
  { name: "Rahul Sharma", deals: 12, value: "₹28,50,000", avatar: "RS" },
  { name: "Priya Patel", deals: 10, value: "₹22,30,000", avatar: "PP" },
  { name: "Amit Kumar", deals: 8, value: "₹18,75,000", avatar: "AK" },
  { name: "Sneha Gupta", deals: 7, value: "₹15,20,000", avatar: "SG" },
];

const sourceAnalysis = [
  { source: "Website", leads: 156, converted: 28, rate: 18 },
  { source: "WhatsApp", leads: 98, converted: 22, rate: 22 },
  { source: "Phone Calls", leads: 67, converted: 18, rate: 27 },
  { source: "Referrals", leads: 45, converted: 15, rate: 33 },
];

const SalesCRMReports = () => {
  const maxSales = Math.max(...monthlyData.map(d => Math.max(d.sales, d.target)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">Track your sales performance</p>
        </div>
        <div className="flex gap-3">
          <Select defaultValue="thisMonth">
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="thisWeek">This Week</SelectItem>
              <SelectItem value="thisMonth">This Month</SelectItem>
              <SelectItem value="lastMonth">Last Month</SelectItem>
              <SelectItem value="thisQuarter">This Quarter</SelectItem>
              <SelectItem value="thisYear">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Sales</p>
                <p className="text-2xl font-bold text-foreground mt-1">₹84.0L</p>
              </div>
              <div className="flex items-center text-green-600 text-sm font-medium">
                <TrendingUp className="w-4 h-4 mr-1" />
                +12%
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Deals Closed</p>
                <p className="text-2xl font-bold text-foreground mt-1">48</p>
              </div>
              <div className="flex items-center text-green-600 text-sm font-medium">
                <TrendingUp className="w-4 h-4 mr-1" />
                +8%
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Deal Size</p>
                <p className="text-2xl font-bold text-foreground mt-1">₹1.75L</p>
              </div>
              <div className="flex items-center text-red-600 text-sm font-medium">
                <TrendingDown className="w-4 h-4 mr-1" />
                -3%
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Win Rate</p>
                <p className="text-2xl font-bold text-foreground mt-1">24.5%</p>
              </div>
              <div className="flex items-center text-green-600 text-sm font-medium">
                <TrendingUp className="w-4 h-4 mr-1" />
                +5%
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales by Month */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              Sales vs Target
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {monthlyData.map((data, index) => (
                <motion.div
                  key={data.month}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{data.month}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-blue-600">₹{(data.sales/100000).toFixed(1)}L</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-muted-foreground">₹{(data.target/100000).toFixed(1)}L</span>
                    </div>
                  </div>
                  <div className="relative h-6 bg-surface-2 rounded-lg overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(data.target / maxSales) * 100}%` }}
                      transition={{ duration: 0.8, delay: index * 0.1 }}
                      className="absolute h-full bg-surface-3"
                    />
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(data.sales / maxSales) * 100}%` }}
                      transition={{ duration: 0.8, delay: index * 0.1 + 0.2 }}
                      className={`absolute h-full ${
                        data.sales >= data.target ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="flex items-center gap-6 mt-6 pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-blue-500" />
                <span className="text-sm text-muted-foreground">Actual Sales</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-surface-3" />
                <span className="text-sm text-muted-foreground">Target</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Conversion Rates */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Target className="w-5 h-5 text-blue-500" />
              Conversion Rates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {conversionData.map((data, index) => (
                <motion.div
                  key={data.stage}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-foreground">{data.stage}</span>
                    <span className="text-lg font-bold text-foreground">{data.rate}%</span>
                  </div>
                  <Progress value={data.rate} className="h-3" />
                </motion.div>
              ))}
            </div>
            <div className="mt-6 p-4 rounded-xl bg-blue-50 border border-blue-100">
              <p className="text-sm text-blue-800">
                <strong>Overall Conversion:</strong> Lead to Close rate is <strong>9.7%</strong>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performers */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Users className="w-5 h-5 text-blue-500" />
              Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topPerformers.map((performer, index) => (
                <motion.div
                  key={performer.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-4 p-4 rounded-xl bg-surface"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-foreground font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-foreground font-medium">
                    {performer.avatar}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{performer.name}</p>
                    <p className="text-sm text-muted-foreground">{performer.deals} deals closed</p>
                  </div>
                  <p className="font-bold text-green-600">{performer.value}</p>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Lead Source Analysis */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <PieChart className="w-5 h-5 text-blue-500" />
              Lead Source Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sourceAnalysis.map((source, index) => (
                <motion.div
                  key={source.source}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 rounded-xl bg-surface"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-foreground">{source.source}</span>
                    <span className="text-sm px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">
                      {source.rate}% conversion
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{source.leads} leads</span>
                    <span>•</span>
                    <span>{source.converted} converted</span>
                  </div>
                  <Progress value={source.rate} className="h-2 mt-2" />
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SalesCRMReports;
