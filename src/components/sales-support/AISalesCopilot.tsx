import { useState } from "react";
import { motion } from "framer-motion";
import { Bot, Sparkles, TrendingUp, Target, Lightbulb, Send, Loader2, CheckCircle, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useServerFn } from "@/lib/serverFn";
import { routeAiRequest } from "@/lib/ai-api.functions";

const AISalesCopilot = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [input, setInput] = useState("");
  const [answer, setAnswer] = useState("");
  const routeFn = useServerFn(routeAiRequest);

  const leadScores = [
    { lead: "Tech Solutions Ltd", score: 92, trend: "up", recommendation: "Schedule closing call" },
    { lead: "Healthcare Plus", score: 78, trend: "up", recommendation: "Send case studies" },
    { lead: "EduLearn Academy", score: 65, trend: "stable", recommendation: "Address pricing concerns" },
    { lead: "Retail Mart", score: 45, trend: "down", recommendation: "Re-engage with new offer" },
  ];

  const suggestions = [
    { type: "reply", content: "Based on their interest in integrations, mention our API documentation and support." },
    { type: "action", content: "Client viewed demo 3 times - ideal time to propose a trial period." },
    { type: "insight", content: "Similar companies converted after seeing ROI calculator. Consider sharing." },
  ];

  const handleAskCopilot = async () => {
    if (!input.trim()) return;
    setIsProcessing(true);
    setAnswer("");
    try {
      const result = await routeFn({
        data: {
          module: "sales-support-copilot",
          system: "You are a precise sales operations copilot. Give concise, practical next steps grounded in the supplied context.",
          prompt: input,
        },
      });
      setAnswer(result.text);
    } catch (error) {
      setAnswer(error instanceof Error ? error.message : "AI provider request failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyan-100">AI Sales Copilot</h2>
          <p className="text-muted-foreground">Intelligent sales assistance and lead scoring</p>
        </div>
        <Badge className="bg-gradient-to-r from-purple-500/20 to-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-4 py-2">
          <Bot className="w-4 h-4 mr-2" />
          Copilot Active
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-card/60 border-cyan-500/20">
          <CardHeader>
            <CardTitle className="text-cyan-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              Ask Copilot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything... e.g., 'How should I handle this pricing objection?' or 'What's the best approach for Tech Solutions Ltd?'"
              className="min-h-[100px] bg-card/60 border-border text-foreground placeholder:text-muted-foreground"
            />
            <Button 
              onClick={handleAskCopilot}
              disabled={isProcessing}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 text-foreground"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Thinking...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Ask Copilot
                </>
              )}
            </Button>

            {answer && (
              <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-foreground whitespace-pre-wrap">
                {answer}
              </div>
            )}

            <div className="space-y-3 mt-6">
              <h4 className="text-sm font-medium text-muted-foreground">Recent Suggestions</h4>
              {suggestions.map((suggestion, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 bg-card/60 rounded-lg border border-border"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      suggestion.type === "reply" ? "bg-cyan-500/20" :
                      suggestion.type === "action" ? "bg-emerald-500/20" : "bg-purple-500/20"
                    }`}>
                      {suggestion.type === "reply" && <Sparkles className="w-4 h-4 text-cyan-400" />}
                      {suggestion.type === "action" && <Target className="w-4 h-4 text-emerald-400" />}
                      {suggestion.type === "insight" && <Lightbulb className="w-4 h-4 text-purple-400" />}
                    </div>
                    <div className="flex-1">
                      <Badge className={`mb-2 ${
                        suggestion.type === "reply" ? "bg-cyan-500/20 text-cyan-300" :
                        suggestion.type === "action" ? "bg-emerald-500/20 text-emerald-300" : "bg-purple-500/20 text-purple-300"
                      }`}>
                        {suggestion.type.charAt(0).toUpperCase() + suggestion.type.slice(1)}
                      </Badge>
                      <p className="text-muted-foreground text-sm">{suggestion.content}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="text-cyan-400 hover:text-cyan-300">
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-card/60 border-cyan-500/20">
            <CardHeader>
              <CardTitle className="text-cyan-100 text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
                Lead Scoring
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {leadScores.map((lead, index) => (
                <motion.div
                  key={lead.lead}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-cyan-100">{lead.lead}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${
                        lead.score >= 80 ? "text-emerald-400" :
                        lead.score >= 60 ? "text-amber-400" : "text-red-400"
                      }`}>{lead.score}%</span>
                      <TrendingUp className={`w-3 h-3 ${
                        lead.trend === "up" ? "text-emerald-400" :
                        lead.trend === "stable" ? "text-amber-400" : "text-red-400 rotate-180"
                      }`} />
                    </div>
                  </div>
                  <Progress value={lead.score} className="h-2 bg-card/60" />
                  <p className="text-xs text-muted-foreground">{lead.recommendation}</p>
                </motion.div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-cyan-900/30 to-blue-900/30 border-cyan-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
                <div>
                  <div className="font-medium text-emerald-300">Conversion Prediction</div>
                  <div className="text-xs text-muted-foreground">Based on current pipeline</div>
                </div>
              </div>
              <div className="text-3xl font-bold text-cyan-100 mb-1">68%</div>
              <p className="text-sm text-muted-foreground">Predicted close rate this week</p>
              <div className="mt-3 text-xs text-cyan-400">
                <Sparkles className="w-3 h-3 inline mr-1" />
                3 leads ready for closing call
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AISalesCopilot;
