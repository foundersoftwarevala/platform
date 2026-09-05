import { useState } from "react";
import { motion } from "framer-motion";
import { Bot, TrendingUp, TrendingDown, AlertTriangle, Lightbulb, Target, Users, Clock, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { useServerFn } from "@/lib/serverFn";
import { routeAiRequest } from "@/lib/ai-api.functions";

interface AIInsight {
  id: string;
  type: "prediction" | "alert" | "suggestion" | "pattern";
  title: string;
  description: string;
  confidence: number;
  impact: "low" | "medium" | "high" | "critical";
  actionable: boolean;
  suggestedAction: string;
  relatedEntity: string;
  timestamp: string;
  acknowledged: boolean;
}

const AIInsightsModule = () => {
  const routeFn = useServerFn(routeAiRequest);
  const [insights, setInsights] = useState<AIInsight[]>([
    { id: "AI-001", type: "prediction", title: "SLA Breach Risk - TKT-001", description: "Based on current response patterns, ticket TKT-001 has 85% probability of SLA breach within 30 minutes", confidence: 85, impact: "critical", actionable: true, suggestedAction: "Assign additional resource immediately", relatedEntity: "TKT-001", timestamp: "2 min ago", acknowledged: false },
    { id: "AI-002", type: "alert", title: "Unhappy Customer Detected", description: "Sentiment analysis indicates Global Logistics showing signs of churn risk based on recent interactions", confidence: 78, impact: "high", actionable: true, suggestedAction: "Schedule manager call within 24 hours", relatedEntity: "CUS-005", timestamp: "15 min ago", acknowledged: false },
    { id: "AI-003", type: "pattern", title: "Recurring Staff Issues - Mumbai Branch", description: "This franchise shows recurring staff-related complaints (5 in 30 days)", confidence: 92, impact: "medium", actionable: true, suggestedAction: "Conduct HR review and training assessment", relatedEntity: "FRAN-MUM-001", timestamp: "1 hour ago", acknowledged: true },
    { id: "AI-004", type: "prediction", title: "Sales Close Probability - LD-002", description: "Healthcare Plus lead has 85% probability of closing within 7 days based on engagement patterns", confidence: 85, impact: "high", actionable: true, suggestedAction: "Prepare contract and schedule final call", relatedEntity: "LD-002", timestamp: "2 hours ago", acknowledged: true },
    { id: "AI-005", type: "suggestion", title: "Resource Optimization", description: "Chat volume peaks 2-4 PM. Consider shifting 2 agents from email to chat during this window", confidence: 88, impact: "medium", actionable: true, suggestedAction: "Adjust shift schedule", relatedEntity: "Scheduling", timestamp: "3 hours ago", acknowledged: false },
    { id: "AI-006", type: "alert", title: "Revenue Drop Risk", description: "Retail Mart account shows 72% probability of revenue drop in next 30 days due to declining engagement", confidence: 72, impact: "critical", actionable: true, suggestedAction: "Initiate retention campaign", relatedEntity: "CUS-003", timestamp: "4 hours ago", acknowledged: false },
  ]);

  const handleAcknowledge = (insightId: string) => {
    toast.loading("Acknowledging insight...", { id: `ack-${insightId}` });
    setTimeout(() => {
      setInsights(insights.map(i => i.id === insightId ? { ...i, acknowledged: true } : i));
      toast.success("Insight acknowledged", { id: `ack-${insightId}` });
    }, 400);
  };

  const handleTakeAction = async (insightId: string) => {
    const insight = insights.find(i => i.id === insightId);
    toast.loading("Taking action...", { id: `action-${insightId}` });
    try {
      const result = await routeFn({
        data: {
          module: "sales-support-insights",
          system: "You are a Sales & Support risk analyst. Return a concise action plan with explicit assumptions and no fabricated facts.",
          prompt: `${insight?.title}\n${insight?.description}\nSuggested action: ${insight?.suggestedAction}`,
        },
      });
      setInsights(insights.map(i => i.id === insightId ? { ...i, acknowledged: true } : i));
      toast.success("AI action plan generated", { id: `action-${insightId}`, description: result.text.slice(0, 160) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI provider request failed", { id: `action-${insightId}` });
    }
  };

  const handleDismiss = (insightId: string) => {
    toast.info("Insight dismissed");
    setInsights(insights.filter(i => i.id !== insightId));
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "prediction": return TrendingUp;
      case "alert": return AlertTriangle;
      case "suggestion": return Lightbulb;
      case "pattern": return Target;
      default: return Bot;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "prediction": return "bg-purple-500/20 text-purple-300";
      case "alert": return "bg-red-500/20 text-red-300";
      case "suggestion": return "bg-cyan-500/20 text-cyan-300";
      case "pattern": return "bg-amber-500/20 text-amber-300";
      default: return "bg-muted/40 text-muted-foreground";
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "critical": return "bg-red-500/20 text-red-300";
      case "high": return "bg-amber-500/20 text-amber-300";
      case "medium": return "bg-blue-500/20 text-blue-300";
      default: return "bg-muted/40 text-muted-foreground";
    }
  };

  const criticalInsights = insights.filter(i => i.impact === "critical" && !i.acknowledged).length;
  const actionableInsights = insights.filter(i => i.actionable && !i.acknowledged).length;
  const avgConfidence = Math.round(insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyan-100">AI Insights</h2>
          <p className="text-muted-foreground">AI-powered predictions, alerts, and suggestions</p>
        </div>
        <Badge className="bg-purple-500/20 text-purple-300 text-sm px-3 py-1">
          <Bot className="w-4 h-4 mr-2" />
          AI Advisor Mode: Active
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/60 border-cyan-500/20">
          <CardContent className="p-4 text-center">
            <Bot className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-cyan-100">{insights.length}</div>
            <div className="text-xs text-muted-foreground">Total Insights</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-red-500/20">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-red-100">{criticalInsights}</div>
            <div className="text-xs text-muted-foreground">Critical Unread</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-emerald-500/20">
          <CardContent className="p-4 text-center">
            <Lightbulb className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-emerald-100">{actionableInsights}</div>
            <div className="text-xs text-muted-foreground">Actionable</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-purple-500/20">
          <CardContent className="p-4 text-center">
            <Target className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-purple-100">{avgConfidence}%</div>
            <div className="text-xs text-muted-foreground">Avg Confidence</div>
          </CardContent>
        </Card>
      </div>

      {/* Insights List */}
      <Card className="bg-card/60 border-cyan-500/20">
        <CardHeader>
          <CardTitle className="text-cyan-100 flex items-center gap-2">
            <Bot className="w-5 h-5 text-purple-400" />
            AI Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {insights.map((insight, index) => {
              const TypeIcon = getTypeIcon(insight.type);
              return (
                <motion.div
                  key={insight.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`p-4 bg-card/60 rounded-lg hover:bg-card/60 transition-colors ${!insight.acknowledged && insight.impact === "critical" ? "border-l-4 border-red-500" : ""} ${insight.acknowledged ? "opacity-70" : ""}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${getTypeColor(insight.type).replace('text-', 'bg-').replace('-300', '-500/30')} flex items-center justify-center`}>
                        <TypeIcon className={`w-5 h-5 ${getTypeColor(insight.type).split(' ')[1]}`} />
                      </div>
                      <div>
                        <span className="font-mono text-cyan-400 text-sm">{insight.id}</span>
                        <Badge className={`ml-2 ${getTypeColor(insight.type)}`}>{insight.type}</Badge>
                        <Badge className={`ml-1 ${getImpactColor(insight.impact)}`}>{insight.impact}</Badge>
                        {insight.acknowledged && <Badge className="ml-1 bg-emerald-500/20 text-emerald-300">Reviewed</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      {insight.timestamp}
                    </div>
                  </div>

                  <div className="mb-3">
                    <h4 className="font-medium text-foreground">{insight.title}</h4>
                    <p className="text-sm text-muted-foreground">{insight.description}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-sm text-muted-foreground">Related: <span className="text-cyan-400">{insight.relatedEntity}</span></span>
                      <span className="text-sm text-muted-foreground">Confidence: <span className="text-purple-400">{insight.confidence}%</span></span>
                    </div>
                  </div>

                  <div className="mb-3">
                    <Progress value={insight.confidence} className="h-1" />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Lightbulb className="w-4 h-4 text-amber-400" />
                      <span className="text-amber-300/80 italic">{insight.suggestedAction}</span>
                    </div>

                    {!insight.acknowledged && (
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => handleDismiss(insight.id)} className="text-muted-foreground">
                          Dismiss
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleAcknowledge(insight.id)} className="border-border">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Acknowledge
                        </Button>
                        {insight.actionable && (
                          <Button size="sm" onClick={() => handleTakeAction(insight.id)} className="bg-purple-500 hover:bg-purple-600">
                            Take Action
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* AI Advisor Note */}
      <Card className="bg-linear-to-r from-purple-900/30 to-cyan-900/30 border-purple-500/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Bot className="w-6 h-6 text-purple-400" />
            <div>
              <h3 className="font-medium text-purple-100">AI Advisor Mode</h3>
              <p className="text-sm text-muted-foreground">AI provides suggestions only. Manager retains final decision authority on all actions.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AIInsightsModule;
