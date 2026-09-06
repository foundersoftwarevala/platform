import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Brain,
  CheckCircle,
  Clock,
  Lightbulb,
  Send,
  TrendingUp,
  XCircle,
} from "lucide-react";

import {
  DegradedNotice,
  EmptyState,
  LoadingState,
  PageBanner,
  PageShell,
} from "@/components/ai-ceo/PageShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCEOSuggestions } from "@/hooks/useCEOSuggestions";

/**
 * The decision history the platform's AI agents have actually produced.
 *
 * This screen shipped with four hardcoded decisions — a franchise payout, a
 * bulk user creation, a permission escalation — none of which had ever
 * happened. They were labelled "Mock decisions data" in the source and rendered
 * as though they were a live queue awaiting the Boss.
 *
 * Every row below is a real `ai_decision_logs` record: the decision an agent
 * took, the confidence it scored, the input it saw, the output it produced,
 * and whether a human accepted or overrode it. The counters are counted from
 * the same rows rather than typed in.
 */

const getDecisionColor = (decision: string) => {
  switch (decision) {
    case "approve":
      return { bg: "bg-accent-emerald/20", text: "text-accent-emerald", border: "border-accent-emerald/30" };
    case "reject":
      return { bg: "bg-destructive/20", text: "text-destructive", border: "border-destructive/30" };
    case "delay":
      return { bg: "bg-accent-amber/20", text: "text-accent-amber", border: "border-accent-amber/30" };
    case "escalate":
      return { bg: "bg-accent-pink/20", text: "text-accent-pink", border: "border-accent-pink/30" };
    default:
      return { bg: "bg-muted/20", text: "text-muted-foreground", border: "border-muted/30" };
  }
};

const getDecisionIcon = (decision: string) => {
  switch (decision) {
    case "approve":
      return CheckCircle;
    case "reject":
      return XCircle;
    case "delay":
      return Clock;
    case "escalate":
      return Send;
    default:
      return AlertTriangle;
  }
};

/**
 * `ai_decision_logs.outcome` records what a human did with the agent's call.
 * The screen's vocabulary is approve / reject / delay / escalate, so the two
 * are mapped rather than one being bent to fit the other.
 */
const outcomeToDecision = (outcome: string): string => {
  const value = outcome.toLowerCase();
  if (value === "accepted") return "approve";
  if (value === "overridden" || value === "rejected") return "reject";
  if (value === "deferred" || value === "pending") return "delay";
  if (value === "escalated") return "escalate";
  return "review";
};

const OUTCOME_LABEL: Record<string, string> = {
  approve: "Accepted",
  reject: "Overridden",
  delay: "Deferred",
  escalate: "Escalated",
  review: "Recorded",
};

const AICEODecisionEngine = () => {
  const { decisions, isLoading, degraded, lastRefresh } = useCEOSuggestions();

  const rows = useMemo(
    () =>
      decisions.map((d) => ({
        ...d,
        verdict: outcomeToDecision(d.outcome),
      })),
    [decisions],
  );

  /** Counted from the rows on screen, not typed in. */
  const stats = useMemo(() => {
    const tally = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.verdict] = (acc[r.verdict] ?? 0) + 1;
      return acc;
    }, {});
    return [
      { label: "Accepted", key: "approve", icon: CheckCircle, color: "text-accent-emerald" },
      { label: "Deferred", key: "delay", icon: Clock, color: "text-accent-amber" },
      { label: "Overridden", key: "reject", icon: XCircle, color: "text-destructive" },
      { label: "Escalated", key: "escalate", icon: Send, color: "text-accent-pink" },
    ].map((s) => ({ ...s, count: tally[s.key] ?? 0 }));
  }, [rows]);

  const averageConfidence = rows.length
    ? Math.round(rows.reduce((sum, r) => sum + r.confidence, 0) / rows.length)
    : 0;

  return (
    <PageShell>
      <PageBanner
        icon={Brain}
        title="Decision Engine"
        subtitle="Every decision the platform's AI agents have recorded, with the confidence they scored and what a human did about it."
        status={
          rows.length
            ? `${rows.length} recorded decisions · ${averageConfidence}% average confidence`
            : "No decisions recorded yet"
        }
      />

      <DegradedNotice sources={degraded} />

      {isLoading && !rows.length && <LoadingState label="Reading the decision log…" rows={2} />}

      {/* Counted from ai_decision_logs, over the window this screen loads. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="card3d premium-halo enter-soft rounded-2xl">
            <CardContent className="flex items-center gap-3 p-4">
              <stat.icon className={`h-5 w-5 ${stat.color}`} aria-hidden="true" />
              <div>
                <p className="text-lg font-bold text-foreground">{stat.count}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Lightbulb className="h-5 w-5 text-accent-pink" aria-hidden="true" />
            Recorded Decisions
            {lastRefresh && (
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                read {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!isLoading && !rows.length ? (
            <EmptyState
              icon={Brain}
              title="No AI decisions recorded"
              description="Nothing has been written to ai_decision_logs yet. Decisions appear here the moment an agent records one."
            />
          ) : (
            <ScrollArea className="h-[450px]">
              <div className="space-y-4">
                {rows.map((decision, i) => {
                  const colors = getDecisionColor(decision.verdict);
                  const Icon = getDecisionIcon(decision.verdict);

                  return (
                    <motion.div
                      key={decision.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i, 8) * 0.05 }}
                      className={`rounded-xl border bg-surface p-5 ${colors.border} transition-all hover:shadow-lg`}
                    >
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-4">
                          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${colors.bg}`}>
                            <Icon className={`h-6 w-6 ${colors.text}`} aria-hidden="true" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-medium text-foreground">{decision.decision}</h3>
                            <p className="text-sm text-muted-foreground">
                              {decision.agentName ?? "Unattributed agent"}
                              {decision.modelName ? ` · ${decision.modelName}` : ""}
                            </p>
                          </div>
                        </div>
                        <Badge className={`${colors.bg} ${colors.text} shrink-0 uppercase`}>
                          {OUTCOME_LABEL[decision.verdict] ?? decision.outcome}
                        </Badge>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground">AI Confidence:</span>
                          <div className="flex flex-1 items-center gap-2">
                            <Progress value={decision.confidence} className="h-2 flex-1" />
                            <span className={`text-sm font-medium ${colors.text}`}>
                              {decision.confidence.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        {(decision.inputSummary || decision.outputSummary) && (
                          <div className="rounded-lg border border-border bg-card p-3">
                            <p className="text-sm text-muted-foreground">
                              <Brain className="mr-2 inline h-4 w-4 text-accent-pink" aria-hidden="true" />
                              <strong className="text-accent-pink">Saw:</strong>{" "}
                              {decision.inputSummary ?? "not recorded"}
                            </p>
                            {decision.outputSummary && (
                              <p className="mt-1.5 text-sm text-muted-foreground">
                                <strong className="text-accent-pink">Produced:</strong>{" "}
                                {decision.outputSummary}
                              </p>
                            )}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <TrendingUp className="h-3 w-3" aria-hidden="true" />
                            {decision.tokens.toLocaleString()} tokens · $
                            {decision.costUsd.toFixed(4)}
                          </span>
                          <span>{new Date(decision.occurredAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <div className="rounded-lg border border-accent-pink/20 bg-accent-pink/5 p-4">
        <div className="flex items-center gap-3">
          <Brain className="h-5 w-5 shrink-0 text-accent-pink" aria-hidden="true" />
          <p className="text-sm text-accent-pink/80">
            <strong>Decision Engine Notice:</strong> This is the recorded history of decisions the
            platform's AI agents have already taken, read from ai_decision_logs. It is read-only —
            nothing on this screen executes or reverses a decision.
          </p>
        </div>
      </div>
    </PageShell>
  );
};

export default AICEODecisionEngine;
