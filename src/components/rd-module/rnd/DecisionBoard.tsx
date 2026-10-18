import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  Pause,
  ArrowRight,
  Clock,
  User,
  MessageSquare,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { Card } from "@/components/rd-module/ui/card";
import { Button } from "@/components/rd-module/ui/button";
import { Badge } from "@/components/rd-module/ui/badge";

const decisions = [
  {
    id: "1",
    title: "AI Code Review Assistant",
    type: "feature",
    status: "pending",
    submittedBy: "vala(rnd)2341",
    submittedAt: "2 days ago",
    aiScore: 92,
    votes: { approve: 5, reject: 1, hold: 0 },
    estimatedCost: "$12,500",
    estimatedTime: "3 weeks",
    priority: "high",
  },
  {
    id: "2",
    title: "Holographic Dashboard Widgets",
    type: "enhancement",
    status: "pending",
    submittedBy: "vala(design)8892",
    submittedAt: "4 days ago",
    aiScore: 72,
    votes: { approve: 3, reject: 2, hold: 1 },
    estimatedCost: "$28,000",
    estimatedTime: "6 weeks",
    priority: "medium",
  },
  {
    id: "3",
    title: "One-Click Deployment Pipeline",
    type: "feature",
    status: "approved",
    submittedBy: "vala(devops)3341",
    submittedAt: "1 week ago",
    aiScore: 94,
    votes: { approve: 6, reject: 0, hold: 0 },
    estimatedCost: "$8,200",
    estimatedTime: "2 weeks",
    priority: "critical",
  },
  {
    id: "4",
    title: "Legacy API Deprecation",
    type: "technical",
    status: "on_hold",
    submittedBy: "vala(dev)4412",
    submittedAt: "3 days ago",
    aiScore: 65,
    votes: { approve: 2, reject: 1, hold: 3 },
    estimatedCost: "$4,500",
    estimatedTime: "1 week",
    priority: "low",
  },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case "approved":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/50";
    case "rejected":
      return "bg-red-500/20 text-red-400 border-red-500/50";
    case "on_hold":
      return "bg-amber-500/20 text-amber-400 border-amber-500/50";
    case "pending":
      return "bg-violet-500/20 text-violet-400 border-violet-500/50";
    default:
      return "bg-slate-500/20 text-slate-400 border-slate-500/50";
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "critical":
      return "text-red-400";
    case "high":
      return "text-orange-400";
    case "medium":
      return "text-amber-400";
    case "low":
      return "text-slate-400";
    default:
      return "text-slate-400";
  }
};

export const DecisionBoard = () => {
  const [selectedDecision, setSelectedDecision] = useState<string | null>(null);

  const pendingDecisions = decisions.filter((d) => d.status === "pending");
  const approvedDecisions = decisions.filter((d) => d.status === "approved");
  const holdDecisions = decisions.filter((d) => d.status === "on_hold");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
          Decision Board
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Review and approve R&D proposals for development
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Pending Review", value: pendingDecisions.length, color: "violet", icon: Clock },
          {
            label: "Approved",
            value: approvedDecisions.length,
            color: "emerald",
            icon: CheckCircle,
          },
          { label: "On Hold", value: holdDecisions.length, color: "amber", icon: Pause },
          { label: "Total Budget", value: "$53.2K", color: "cyan", icon: Sparkles },
        ].map((stat, i) => (
          <Card key={i} className="p-4 bg-slate-900/50 backdrop-blur-xl border-slate-700/50">
            <div className="flex items-center justify-between mb-2">
              <stat.icon className={`w-5 h-5 text-${stat.color}-400`} />
            </div>
            <p className={`text-2xl font-bold text-${stat.color}-400`}>{stat.value}</p>
            <p className="text-xs text-slate-400">{stat.label}</p>
          </Card>
        ))}
      </div>

      {/* Decision Pipeline */}
      <div className="grid grid-cols-3 gap-6">
        {/* Pending */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-violet-500" />
            <h3 className="font-semibold text-white">Pending Review</h3>
            <Badge className="bg-violet-500/20 text-violet-400">{pendingDecisions.length}</Badge>
          </div>

          <AnimatePresence>
            {pendingDecisions.map((decision, index) => (
              <motion.div
                key={decision.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="p-4 bg-slate-900/50 backdrop-blur-xl border-violet-500/30 hover:border-violet-500/50 transition-all cursor-pointer">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-white text-sm">{decision.title}</h4>
                      <p className="text-xs text-slate-400">{decision.type}</p>
                    </div>
                    <div className={`text-xs font-semibold ${getPriorityColor(decision.priority)}`}>
                      {decision.priority}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-3 text-xs text-slate-400">
                    <User className="w-3 h-3" />
                    <span>{decision.submittedBy}</span>
                    <span>•</span>
                    <span>{decision.submittedAt}</span>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-violet-400" />
                      <span className="text-xs text-violet-400">AI Score: {decision.aiScore}%</span>
                    </div>
                    <span className="text-xs text-slate-400">{decision.estimatedCost}</span>
                  </div>

                  {/* Vote Buttons */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/50"
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      {decision.votes.approve}
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 border border-amber-500/50"
                    >
                      <Pause className="w-3 h-3 mr-1" />
                      {decision.votes.hold}
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/50"
                    >
                      <XCircle className="w-3 h-3 mr-1" />
                      {decision.votes.reject}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Approved */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <h3 className="font-semibold text-white">Approved</h3>
            <Badge className="bg-emerald-500/20 text-emerald-400">{approvedDecisions.length}</Badge>
          </div>

          {approvedDecisions.map((decision, index) => (
            <motion.div
              key={decision.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="p-4 bg-slate-900/50 backdrop-blur-xl border-emerald-500/30">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-white text-sm">{decision.title}</h4>
                    <p className="text-xs text-slate-400">{decision.type}</p>
                  </div>
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                  <span>{decision.estimatedTime}</span>
                  <span>{decision.estimatedCost}</span>
                </div>

                <Button
                  size="sm"
                  className="w-full bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/50"
                >
                  <ArrowRight className="w-3 h-3 mr-2" />
                  Forward to Dev Queue
                </Button>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* On Hold */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <h3 className="font-semibold text-white">On Hold</h3>
            <Badge className="bg-amber-500/20 text-amber-400">{holdDecisions.length}</Badge>
          </div>

          {holdDecisions.map((decision, index) => (
            <motion.div
              key={decision.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="p-4 bg-slate-900/50 backdrop-blur-xl border-amber-500/30">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-white text-sm">{decision.title}</h4>
                    <p className="text-xs text-slate-400">{decision.type}</p>
                  </div>
                  <Pause className="w-5 h-5 text-amber-400" />
                </div>

                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-3">
                  <p className="text-xs text-amber-300 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Awaiting additional research
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-violet-600/20 text-violet-400 hover:bg-violet-600/30 border border-violet-500/50"
                  >
                    <MessageSquare className="w-3 h-3 mr-1" />
                    Discuss
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/50"
                  >
                    Re-evaluate
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
