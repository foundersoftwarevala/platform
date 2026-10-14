import { motion } from "framer-motion";
import {
  TrendingUp,
  Globe,
  Zap,
  Target,
  ArrowUpRight,
  AlertCircle,
  CheckCircle,
  Clock,
  ExternalLink,
} from "lucide-react";
import { Card } from "@/components/rd-module/ui/card";
import { Badge } from "@/components/rd-module/ui/badge";
import { Button } from "@/components/rd-module/ui/button";

const trends = [
  {
    id: "1",
    title: "AI-Powered Development Tools",
    source: "Industry Analysis",
    impact: "high",
    relevance: 94,
    status: "emerging",
    competitors: ["GitHub Copilot", "Cursor", "Tabnine"],
    opportunity: "Integrate AI code completion with our unique workflow context",
    detectedAt: "2 hours ago",
  },
  {
    id: "2",
    title: "Low-Code Backend Solutions",
    source: "Market Research",
    impact: "medium",
    relevance: 78,
    status: "growing",
    competitors: ["Supabase", "Firebase", "PlanetScale"],
    opportunity: "Visual database designer with AI-generated schemas",
    detectedAt: "6 hours ago",
  },
  {
    id: "3",
    title: "Real-Time Collaboration Features",
    source: "User Feedback",
    impact: "high",
    relevance: 89,
    status: "established",
    competitors: ["Figma", "Linear", "Notion"],
    opportunity: "Multi-cursor editing with presence indicators",
    detectedAt: "1 day ago",
  },
];

const gaps = [
  {
    id: "1",
    gap: "No major player offers AI-driven project estimation",
    potential: "high",
    difficulty: "medium",
  },
  {
    id: "2",
    gap: "Limited visual debugging tools in market",
    potential: "medium",
    difficulty: "high",
  },
  {
    id: "3",
    gap: "Lack of unified analytics across dev lifecycle",
    potential: "high",
    difficulty: "low",
  },
];

const getImpactColor = (impact: string) => {
  switch (impact) {
    case "high":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/50";
    case "medium":
      return "bg-amber-500/20 text-amber-400 border-amber-500/50";
    case "low":
      return "bg-slate-500/20 text-slate-400 border-slate-500/50";
    default:
      return "bg-slate-500/20 text-slate-400 border-slate-500/50";
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "emerging":
      return <Zap className="w-3 h-3" />;
    case "growing":
      return <TrendingUp className="w-3 h-3" />;
    case "established":
      return <CheckCircle className="w-3 h-3" />;
    default:
      return <Clock className="w-3 h-3" />;
  }
};

export const TrendScanner = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
            Trend & Competitor Scanner
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            AI-powered market intelligence and opportunity detection
          </p>
        </div>
        <Button className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 gap-2">
          <Globe className="w-4 h-4" />
          Run Full Scan
        </Button>
      </div>

      {/* Live Scanner Status */}
      <Card className="p-4 bg-gradient-to-r from-amber-600/10 to-orange-600/10 border-amber-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              className="w-3 h-3 rounded-full bg-emerald-400"
              animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-sm text-slate-300">Scanner Active</span>
            <span className="text-xs text-slate-500">Last scan: 15 min ago</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-slate-400">
              Sources monitored: <span className="text-amber-400">47</span>
            </span>
            <span className="text-slate-400">
              Competitors tracked: <span className="text-amber-400">23</span>
            </span>
            <span className="text-slate-400">
              New insights: <span className="text-emerald-400">5</span>
            </span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        {/* Emerging Trends */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-400" />
            Emerging Trends
          </h3>

          {trends.map((trend, index) => (
            <motion.div
              key={trend.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="p-4 bg-slate-900/50 backdrop-blur-xl border-slate-700/50 hover:border-amber-500/30 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-white mb-1">{trend.title}</h4>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>{trend.source}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {trend.detectedAt}
                      </span>
                    </div>
                  </div>
                  <Badge className={getImpactColor(trend.impact)}>
                    {getStatusIcon(trend.status)}
                    <span className="ml-1">{trend.status}</span>
                  </Badge>
                </div>

                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-400">Relevance Score</span>
                    <span className="text-amber-400">{trend.relevance}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${trend.relevance}%` }}
                      transition={{ duration: 1, delay: index * 0.2 }}
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <p className="text-xs text-slate-500 mb-1">Competitors</p>
                  <div className="flex flex-wrap gap-1">
                    {trend.competitors.map((comp, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="bg-slate-800 text-slate-300 text-xs"
                      >
                        {comp}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-xs text-emerald-300 flex items-start gap-2">
                    <Target className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>Opportunity:</strong> {trend.opportunity}
                    </span>
                  </p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Market Gaps */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-400" />
            Gaps We Can Dominate
          </h3>

          {gaps.map((gap, index) => (
            <motion.div
              key={gap.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="p-4 bg-slate-900/50 backdrop-blur-xl border-slate-700/50 hover:border-emerald-500/30 transition-all">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/20">
                    <AlertCircle className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-white mb-2">{gap.gap}</p>
                    <div className="flex items-center gap-2">
                      <Badge className={getImpactColor(gap.potential)}>
                        Potential: {gap.potential}
                      </Badge>
                      <Badge
                        className={
                          gap.difficulty === "low"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : gap.difficulty === "medium"
                              ? "bg-amber-500/20 text-amber-400"
                              : "bg-red-500/20 text-red-400"
                        }
                      >
                        Difficulty: {gap.difficulty}
                      </Badge>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ArrowUpRight className="w-4 h-4 text-slate-400" />
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}

          {/* AI Insights */}
          <Card className="p-4 bg-gradient-to-r from-violet-600/10 to-cyan-600/10 border-violet-500/30">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-semibold text-violet-300">AI Market Insight</span>
            </div>
            <p className="text-sm text-slate-300 mb-3">
              Based on current trends, focusing on AI-driven project estimation could capture an
              underserved market segment with estimated 31% adoption rate within 6 months.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="text-violet-300 border-violet-500/50 hover:bg-violet-500/20"
            >
              <ExternalLink className="w-3 h-3 mr-2" />
              View Full Analysis
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
};
