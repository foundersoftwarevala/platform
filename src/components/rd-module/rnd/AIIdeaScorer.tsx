import { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/rd-module/ui/card";
import { Button } from "@/components/rd-module/ui/button";
import { Input } from "@/components/rd-module/ui/input";
import { Textarea } from "@/components/rd-module/ui/textarea";
import { Badge } from "@/components/rd-module/ui/badge";
import { Progress } from "@/components/rd-module/ui/progress";
import { ScrollArea } from "@/components/rd-module/ui/scroll-area";
import { useRnDAI } from "@/hooks/rd-module/useRnDAI";
import {
  Lightbulb,
  Brain,
  Target,
  TrendingUp,
  Shield,
  Users,
  Zap,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Sparkles,
  Plus,
} from "lucide-react";

interface IdeaScore {
  innovation: number;
  feasibility: number;
  marketPotential: number;
  resourceEfficiency: number;
  strategicFit: number;
  overall: number;
}

interface EvaluatedIdea {
  id: string;
  title: string;
  description: string;
  category: string;
  scores: IdeaScore;
  aiAnalysis: string;
  timestamp: Date;
}

export const AIIdeaScorer = () => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [evaluatedIdeas, setEvaluatedIdeas] = useState<EvaluatedIdea[]>([]);
  const [currentAnalysis, setCurrentAnalysis] = useState<string | null>(null);

  const { isLoading, evaluateIdea } = useRnDAI();

  const categories = [
    { id: "ai", label: "AI/ML", color: "violet" },
    { id: "uiux", label: "UI/UX", color: "pink" },
    { id: "devtools", label: "DevTools", color: "blue" },
    { id: "automation", label: "Automation", color: "emerald" },
    { id: "security", label: "Security", color: "orange" },
    { id: "infrastructure", label: "Infrastructure", color: "cyan" },
  ];

  const handleEvaluate = async () => {
    if (!title || !description) return;

    const response = await evaluateIdea(title, description, category || "General");

    if (response) {
      // Parse scores from response (simulated - in real app would parse from AI)
      const scores: IdeaScore = {
        innovation: Math.floor(Math.random() * 30) + 70,
        feasibility: Math.floor(Math.random() * 30) + 60,
        marketPotential: Math.floor(Math.random() * 30) + 65,
        resourceEfficiency: Math.floor(Math.random() * 30) + 55,
        strategicFit: Math.floor(Math.random() * 30) + 70,
        overall: 0,
      };
      scores.overall = Math.floor(
        (scores.innovation +
          scores.feasibility +
          scores.marketPotential +
          scores.resourceEfficiency +
          scores.strategicFit) /
          5,
      );

      const newIdea: EvaluatedIdea = {
        id: Date.now().toString(),
        title,
        description,
        category: category || "General",
        scores,
        aiAnalysis: response,
        timestamp: new Date(),
      };

      setEvaluatedIdeas((prev) => [newIdea, ...prev]);
      setCurrentAnalysis(response);
      setTitle("");
      setDescription("");
      setCategory("");
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-400";
    if (score >= 60) return "text-amber-400";
    return "text-red-400";
  };

  const getScoreGradient = (score: number) => {
    if (score >= 80) return "from-emerald-600 to-cyan-600";
    if (score >= 60) return "from-amber-600 to-orange-600";
    return "from-red-600 to-pink-600";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-yellow-600/30 to-amber-600/30 border border-yellow-500/30">
            <Lightbulb className="w-8 h-8 text-yellow-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-amber-400 bg-clip-text text-transparent">
              AI Idea Scoring Engine
            </h2>
            <p className="text-slate-400 text-sm">Multi-dimensional AI evaluation for R&D ideas</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left - Submit New Idea */}
        <div className="col-span-5">
          <Card className="bg-slate-900/50 border-violet-500/20 p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-violet-400" />
              Submit Idea for AI Evaluation
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Idea Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter a descriptive title..."
                  className="bg-slate-800/50 border-slate-700"
                />
              </div>

              <div>
                <label className="text-sm text-slate-400 mb-1 block">Category</label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <Button
                      key={cat.id}
                      variant="outline"
                      size="sm"
                      onClick={() => setCategory(cat.id)}
                      className={`${
                        category === cat.id
                          ? `bg-${cat.color}-500/20 border-${cat.color}-500/50 text-${cat.color}-400`
                          : "border-slate-700 text-slate-400"
                      }`}
                    >
                      {cat.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-400 mb-1 block">Description</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your idea in detail. Include the problem it solves, target users, and proposed approach..."
                  className="bg-slate-800/50 border-slate-700 min-h-[150px]"
                />
              </div>

              <Button
                onClick={handleEvaluate}
                disabled={isLoading || !title || !description}
                className="w-full bg-gradient-to-r from-violet-600 to-cyan-600"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4 mr-2" />
                    Evaluate with AI
                  </>
                )}
              </Button>
            </div>

            {/* Score Metrics Legend */}
            <div className="mt-6 pt-4 border-t border-slate-700">
              <p className="text-xs text-slate-500 mb-3">Evaluation Metrics:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 text-slate-400">
                  <Sparkles className="w-3 h-3 text-violet-400" />
                  <span>Innovation</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Target className="w-3 h-3 text-blue-400" />
                  <span>Feasibility</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                  <span>Market Potential</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>Resource Efficiency</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Users className="w-3 h-3 text-pink-400" />
                  <span>Strategic Fit</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right - Results */}
        <div className="col-span-7">
          {currentAnalysis && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className="bg-slate-900/50 border-violet-500/20 p-6 mb-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Brain className="w-5 h-5 text-violet-400" />
                  Latest Analysis
                </h3>

                {evaluatedIdeas[0] && (
                  <div className="space-y-4">
                    {/* Score Summary */}
                    <div className="grid grid-cols-6 gap-2">
                      {[
                        {
                          label: "Innovation",
                          score: evaluatedIdeas[0].scores.innovation,
                          icon: Sparkles,
                        },
                        {
                          label: "Feasibility",
                          score: evaluatedIdeas[0].scores.feasibility,
                          icon: Target,
                        },
                        {
                          label: "Market",
                          score: evaluatedIdeas[0].scores.marketPotential,
                          icon: TrendingUp,
                        },
                        {
                          label: "Resources",
                          score: evaluatedIdeas[0].scores.resourceEfficiency,
                          icon: Zap,
                        },
                        {
                          label: "Strategic",
                          score: evaluatedIdeas[0].scores.strategicFit,
                          icon: Users,
                        },
                        {
                          label: "Overall",
                          score: evaluatedIdeas[0].scores.overall,
                          icon: CheckCircle,
                        },
                      ].map((item, idx) => (
                        <Card
                          key={idx}
                          className={`bg-gradient-to-br ${getScoreGradient(item.score)}/10 border-slate-700 p-3 text-center`}
                        >
                          <item.icon
                            className={`w-4 h-4 mx-auto mb-1 ${getScoreColor(item.score)}`}
                          />
                          <p className={`text-2xl font-bold ${getScoreColor(item.score)}`}>
                            {item.score}
                          </p>
                          <p className="text-xs text-slate-500">{item.label}</p>
                        </Card>
                      ))}
                    </div>

                    {/* AI Analysis */}
                    <ScrollArea className="h-[300px]">
                      <Card className="bg-slate-800/50 border-slate-700 p-4">
                        <p className="text-sm text-slate-200 whitespace-pre-wrap">
                          {currentAnalysis}
                        </p>
                      </Card>
                    </ScrollArea>
                  </div>
                )}
              </Card>
            </motion.div>
          )}

          {/* Previous Evaluations */}
          <Card className="bg-slate-900/50 border-violet-500/20 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Evaluation History</h3>

            {evaluatedIdeas.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Lightbulb className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>No ideas evaluated yet. Submit your first idea!</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {evaluatedIdeas.map((idea, idx) => (
                    <motion.div
                      key={idea.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                    >
                      <Card className="bg-slate-800/50 border-slate-700 p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold text-white">{idea.title}</h4>
                            <p className="text-xs text-slate-500 mt-1">
                              {idea.category} • {idea.timestamp.toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div
                              className={`text-2xl font-bold ${getScoreColor(idea.scores.overall)}`}
                            >
                              {idea.scores.overall}
                            </div>
                            <Badge
                              className={`${
                                idea.scores.overall >= 80
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : idea.scores.overall >= 60
                                    ? "bg-amber-500/20 text-amber-400"
                                    : "bg-red-500/20 text-red-400"
                              }`}
                            >
                              {idea.scores.overall >= 80
                                ? "High Potential"
                                : idea.scores.overall >= 60
                                  ? "Promising"
                                  : "Needs Work"}
                            </Badge>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-5 gap-2">
                          {[
                            { label: "Inn", score: idea.scores.innovation },
                            { label: "Feas", score: idea.scores.feasibility },
                            { label: "Mkt", score: idea.scores.marketPotential },
                            { label: "Res", score: idea.scores.resourceEfficiency },
                            { label: "Str", score: idea.scores.strategicFit },
                          ].map((s, i) => (
                            <div key={i} className="text-center">
                              <p className={`text-sm font-bold ${getScoreColor(s.score)}`}>
                                {s.score}
                              </p>
                              <p className="text-xs text-slate-600">{s.label}</p>
                            </div>
                          ))}
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
