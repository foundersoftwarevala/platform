import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, FileText, AlertTriangle, GitCompare, Globe, Lightbulb, Eye, Edit, Lock, CheckCircle, History, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useLegalRecords } from "@/lib/legal-data";
import { useLegalAI } from "@/hooks/useLegalAI";
import type { LegalAIType } from "@/lib/legal-ai.server";

interface LMAILegalIntelligenceProps {
  activeSubSection: string;
}

const AI_TASKS: Record<string, { type: LegalAIType; placeholder: string }> = {
  "Auto Draft Agreements": { type: "contract_draft", placeholder: "Describe the agreement to draft (parties, scope, term, jurisdiction)..." },
  "Auto Risk Detection": { type: "risk_analysis", placeholder: "Paste the clause, contract or scenario to analyse for risk..." },
  "Clause Conflict Detection": { type: "clause_suggest", placeholder: "Paste the clauses to check for conflicts or gaps..." },
  "Country Law Mismatch": { type: "compliance_check", placeholder: "Describe the product/operation and the countries involved..." },
  "Auto Update Suggestions": { type: "clause_suggest", placeholder: "Paste the policy or contract text needing update suggestions..." },
  "NDA Review": { type: "nda_review", placeholder: "Paste the NDA text to review..." },
};

const LMAILegalIntelligence = ({ activeSubSection }: LMAILegalIntelligenceProps) => {
  const { data: aiFeatures = [] } = useLegalRecords("ai_feature");
  const { callLegalAI, isLoading } = useLegalAI();
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const runAI = async (item: string) => {
    if (!input.trim()) {
      toast.error("Enter the details for the AI to work on");
      return;
    }
    const task = AI_TASKS[item] ?? { type: "legal_chat" as LegalAIType, placeholder: "" };
    const res = await callLegalAI(task.type, input.trim());
    if (res) setResult(res);
  };

  const handleAction = (action: string, item: string) => {
    if (action === "run") {
      setOpenTask(item);
      setInput("");
      setResult(null);
      return;
    }
    const toastMap: Record<string, () => void> = {
      view: () => toast.info(`Viewing: ${item}`),
      edit: () => toast.info(`Editing: ${item}`),
      train: () => toast.info(`Training AI: ${item}`),
      history: () => toast.info(`Viewing history: ${item}`),
    };
    toastMap[action]?.();
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-600 to-pink-800 flex items-center justify-center shadow-lg">
          <Brain className="w-7 h-7 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Legal Intelligence</h1>
          <p className="text-muted-foreground">AI-powered legal analysis and automation</p>
        </div>
        <Badge className="bg-pink-500/20 text-pink-400 border-pink-500/50 ml-auto">HUMAN REVIEW REQUIRED</Badge>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { icon: FileText, label: "Auto Draft", onClick: () => handleAction("run", "Auto Draft Agreements") },
          { icon: AlertTriangle, label: "Risk Detection", onClick: () => handleAction("run", "Auto Risk Detection") },
          { icon: GitCompare, label: "Clause Conflict", onClick: () => handleAction("run", "Clause Conflict Detection") },
          { icon: Globe, label: "Law Mismatch", onClick: () => handleAction("run", "Country Law Mismatch") },
          { icon: Lightbulb, label: "Suggestions", onClick: () => handleAction("run", "Auto Update Suggestions") },
        ].map((action, index) => (
          <motion.div
            key={action.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card 
              className="cursor-pointer hover:scale-105 transition-transform bg-pink-500/10 border-pink-500/30"
              onClick={action.onClick}
            >
              <CardContent className="p-4 text-center">
                <action.icon className="w-8 h-8 text-pink-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">{action.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* AI Features */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-pink-400" />
            AI Features
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {aiFeatures.map((feature) => (
              <motion.div
                key={feature.id}
                whileHover={{ scale: 1.01 }}
                className="flex items-center justify-between p-4 rounded-lg bg-surface/50 border border-border"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-pink-600/20 flex items-center justify-center">
                    <Brain className="w-5 h-5 text-pink-400" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{feature.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">{feature.type}</Badge>
                      <span className="text-xs text-pink-400">Accuracy: {feature.accuracy}</span>
                      <span className="text-xs text-muted-foreground">{feature.uses} uses</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-500/20 text-emerald-400">{feature.status}</Badge>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleAction("view", feature.name)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleAction("run", feature.name)}>
                      <Sparkles className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleAction("edit", feature.name)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleAction("history", feature.name)}>
                      <History className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={openTask !== null} onOpenChange={(o) => !o && setOpenTask(null)}>
        <DialogContent className="max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-pink-400">
              <Sparkles className="w-5 h-5" />
              {openTask}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={(openTask && AI_TASKS[openTask]?.placeholder) || "Describe what you need the legal AI to do..."}
            className="min-h-28 bg-surface/60 border-border"
          />
          <Button
            onClick={() => openTask && runAI(openTask)}
            disabled={isLoading}
            className="bg-pink-600 hover:bg-pink-700 text-primary-foreground"
          >
            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Brain className="w-4 h-4 mr-2" />}
            {isLoading ? "Analysing..." : "Run AI"}
          </Button>
          {result && (
            <ScrollArea className="max-h-72 rounded-lg border border-border bg-surface/40 p-4">
              <p className="text-sm text-foreground whitespace-pre-wrap">{result}</p>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>

  );
};

export default LMAILegalIntelligence;
