import { motion } from "framer-motion";
import {
  Activity,
  TrendingUp,
  AlertTriangle,
  Users,
  Cpu,
  Wrench,
  DollarSign,
  BarChart3,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/rd-module/ui/card";
import { Badge } from "@/components/rd-module/ui/badge";
import { Progress } from "@/components/rd-module/ui/progress";

const analysisData = [
  {
    id: "1",
    feature: "AI-Powered Code Review",
    revenueImpact: "high",
    effortLevel: "medium",
    technicalRisk: "low",
    userDemand: 89,
    performanceLoad: 34,
    maintenanceCost: "low",
    aiRecommendation: "Strongly recommended. High ROI with manageable effort.",
    scores: { revenue: 92, effort: 65, risk: 23, demand: 89 },
  },
  {
    id: "2",
    feature: "Holographic Dashboard",
    revenueImpact: "medium",
    effortLevel: "high",
    technicalRisk: "medium",
    userDemand: 67,
    performanceLoad: 78,
    maintenanceCost: "medium",
    aiRecommendation: "Consider phased implementation. Visual appeal may drive adoption.",
    scores: { revenue: 68, effort: 85, risk: 56, demand: 67 },
  },
  {
    id: "3",
    feature: "One-Click Deployment",
    revenueImpact: "high",
    effortLevel: "low",
    technicalRisk: "low",
    userDemand: 95,
    performanceLoad: 12,
    maintenanceCost: "low",
    aiRecommendation: "Priority implementation. Developer productivity boost confirmed.",
    scores: { revenue: 88, effort: 35, risk: 18, demand: 95 },
  },
];

const getImpactColor = (level: string) => {
  switch (level) {
    case "high":
      return "text-emerald-400 bg-emerald-500/20";
    case "medium":
      return "text-amber-400 bg-amber-500/20";
    case "low":
      return "text-slate-400 bg-slate-500/20";
    default:
      return "text-slate-400 bg-slate-500/20";
  }
};

const getRiskColor = (level: string) => {
  switch (level) {
    case "high":
      return "text-red-400 bg-red-500/20";
    case "medium":
      return "text-amber-400 bg-amber-500/20";
    case "low":
      return "text-emerald-400 bg-emerald-500/20";
    default:
      return "text-slate-400 bg-slate-500/20";
  }
};

export const ImpactAnalyzer = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          Impact Analyzer
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          AI-powered evaluation of feature viability and impact
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Avg Revenue Impact", value: "82%", icon: DollarSign, color: "emerald" },
          { label: "Avg Effort Required", value: "62%", icon: Wrench, color: "amber" },
          { label: "Risk Level", value: "Low", icon: AlertTriangle, color: "cyan" },
          { label: "User Demand", value: "84%", icon: Users, color: "violet" },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="p-4 bg-slate-900/50 backdrop-blur-xl border-slate-700/50">
              <div className="flex items-center justify-between mb-2">
                <stat.icon className={`w-5 h-5 text-${stat.color}-400`} />
                <span className={`text-2xl font-bold text-${stat.color}-400`}>{stat.value}</span>
              </div>
              <p className="text-xs text-slate-400">{stat.label}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Analysis Cards */}
      <div className="space-y-4">
        {analysisData.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="p-6 bg-slate-900/50 backdrop-blur-xl border-slate-700/50 hover:border-emerald-500/30 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">{item.feature}</h3>
                  <div className="flex items-center gap-2">
                    <Badge className={getImpactColor(item.revenueImpact)}>
                      <DollarSign className="w-3 h-3 mr-1" />
                      Revenue: {item.revenueImpact}
                    </Badge>
                    <Badge className={getImpactColor(item.effortLevel)}>
                      <Wrench className="w-3 h-3 mr-1" />
                      Effort: {item.effortLevel}
                    </Badge>
                    <Badge className={getRiskColor(item.technicalRisk)}>
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Risk: {item.technicalRisk}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/30">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  <span className="text-xs text-violet-300">AI Analyzed</span>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-400">Revenue Potential</span>
                    <span className="text-emerald-400">{item.scores.revenue}%</span>
                  </div>
                  <Progress value={item.scores.revenue} className="h-2 bg-slate-700" />
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-400">Development Effort</span>
                    <span className="text-amber-400">{item.scores.effort}%</span>
                  </div>
                  <Progress value={item.scores.effort} className="h-2 bg-slate-700" />
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-400">Technical Risk</span>
                    <span className="text-red-400">{item.scores.risk}%</span>
                  </div>
                  <Progress value={item.scores.risk} className="h-2 bg-slate-700" />
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-400">User Demand</span>
                    <span className="text-cyan-400">{item.scores.demand}%</span>
                  </div>
                  <Progress value={item.scores.demand} className="h-2 bg-slate-700" />
                </div>
              </div>

              {/* AI Recommendation */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-r from-violet-600/10 to-cyan-600/10 border border-violet-500/20">
                <Activity className="w-5 h-5 text-violet-400 mt-0.5" />
                <div>
                  <p className="text-xs text-violet-300 mb-1">AI Recommendation</p>
                  <p className="text-sm text-slate-300">{item.aiRecommendation}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
