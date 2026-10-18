import { motion } from "framer-motion";
import { useTranslation } from "@/lib/i18n/use-translation";
import {
  DegradedNotice,
  EmptyState,
  ErrorState,
  LoadingState,
  PageBanner,
  PageShell,
} from "@/components/ai-ceo/PageShell";
import {
  useFounderLearning,
  type DecisionMemory,
  type LearningTotals,
} from "@/hooks/useFounderBrain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Database,
  Brain,
  CheckCircle,
  XCircle,
  HelpCircle,
  TrendingUp,
  Clock,
  Zap,
  GraduationCap,
} from "lucide-react";

/**
 * What the company actually decided, and what happened next.
 *
 * This screen carried four entries written into the component under a
 * comment reading "Mock learning log data", each with an outcome and a
 * saving that had never happened. The rows now come from the decision
 * record: the observation is the decision, the suggestion is what the AI
 * recommended, and the outcome is what somebody recorded afterwards.
 *
 * Nothing here says a model learned anything. A decision with a recorded
 * outcome has produced a learning record; one without has not yet.
 */

/** How a person answered: accepted, overridden, refused, or not yet. */
const answerOf = (memory: DecisionMemory): string => {
  if (memory.overridden) return "overridden";
  if (memory.recommendationAccepted === true) return "approved";
  if (memory.recommendationAccepted === false) return "rejected";
  return "awaiting a decision";
};

const whenOf = (value: string): string => {
  const at = new Date(value);
  return Number.isFinite(at.getTime()) ? at.toISOString().slice(0, 10) : value;
};

/**
 * The four headline figures.
 *
 * These were four constants written into this file — 12,847 observations,
 * 94.2% accuracy, +2.1% this month, 3,421 decisions analysed — none of which
 * had ever been counted. They now come from founder_learning_totals, which
 * counts in SQL rather than measuring the page of rows this screen happened
 * to fetch.
 *
 * A figure that could not be counted is shown as "—". It is not shown as 0,
 * because "we could not count" and "there are none" are different answers.
 */
const UNKNOWN = "—";

const shown = (value: number | undefined): string =>
  typeof value === "number" ? value.toLocaleString() : UNKNOWN;

/** The accepted share, stated only of the requests a person actually answered. */
const acceptedShare = (totals: LearningTotals | null): string => {
  if (!totals || totals.recommendationsAnswered === 0) return UNKNOWN;
  return `${Math.round((totals.recommendationsAccepted / totals.recommendationsAnswered) * 100)}%`;
};

const getDecisionStyle = (decision: string) => {
  switch (decision) {
    case "approved":
      return { bg: "bg-accent-emerald/20", text: "text-accent-emerald", icon: CheckCircle };
    case "overridden":
      return { bg: "bg-accent-amber/20", text: "text-accent-amber", icon: HelpCircle };
    case "partially_approved":
      return { bg: "bg-primary/20", text: "text-primary-glow", icon: CheckCircle };
    default:
      return { bg: "bg-destructive/20", text: "text-destructive", icon: XCircle };
  }
};

const AICEOLearning = () => {
  const { t } = useTranslation();
  const { memories, patterns, totals, degraded, isLoading, failed, refetch } = useFounderLearning();

  if (isLoading) {
    return (
      <PageShell>
        <PageBanner icon={GraduationCap} title={t("ceo.learning_title")} />
        <LoadingState label={t("ceo.learning_loading")} />
      </PageShell>
    );
  }

  if (failed) {
    return (
      <PageShell>
        <PageBanner icon={GraduationCap} title={t("ceo.learning_title")} />
        <ErrorState
          title={t("ceo.learning_failed")}
          description="The decision record could not be read, so this screen cannot say what was decided or what followed."
          onRetry={() => void refetch()}
        />
      </PageShell>
    );
  }
  return (
    <PageShell>
      <PageBanner
        icon={Database}
        title={t("ceo.learning_title")}
        subtitle="Every observation, recommendation, human decision and recorded outcome, read from the decision record."
        status={
          patterns.length > 0
            ? `${patterns.length} pattern(s) identified`
            : "No pattern identified yet"
        }
      />

      {degraded.length > 0 && <DegradedNotice sources={degraded} />}

      {/* Learning Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="card3d premium-halo enter-soft rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-primary-glow" />
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {shown(totals?.learningRecords)}
                </p>
                <p className="text-xs text-muted-foreground">Learning Records</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card3d premium-halo enter-soft rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-accent-emerald" />
              <div>
                <p className="text-2xl font-bold text-accent-emerald">{acceptedShare(totals)}</p>
                <p className="text-xs text-muted-foreground">
                  Recommendations Accepted
                  {totals ? ` (of ${totals.recommendationsAnswered} answered)` : ""}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card3d premium-halo enter-soft rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-accent-amber" />
              <div>
                <p className="text-2xl font-bold text-accent-amber">{shown(totals?.overridden)}</p>
                <p className="text-xs text-muted-foreground">Overridden</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card3d premium-halo enter-soft rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Brain className="w-5 h-5 text-accent-pink" />
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {shown(totals?.decisionsOnRecord)}
                </p>
                <p className="text-xs text-muted-foreground">Decisions On Record</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Learning History */}
      <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Database className="w-5 h-5 text-accent-pink" />
            Learning History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[450px]">
            <div className="space-y-4">
              {memories.length === 0 && (
                <EmptyState
                  icon={GraduationCap}
                  title={t("ceo.learning_empty")}
                  description="This log is built from the decision record. It fills as decisions are raised, answered and their outcomes recorded — nothing here is simulated."
                />
              )}
              {memories.map((log: DecisionMemory, i: number) => {
                const answer = answerOf(log);
                const decisionStyle = getDecisionStyle(answer);
                const DecisionIcon = decisionStyle.icon;

                return (
                  <motion.div
                    key={log.decisionId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="p-5 rounded-xl bg-surface border border-border hover:border-accent-pink/30 transition-all"
                  >
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                      {/* Observation */}
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">AI Observed</p>
                        <p className="text-sm text-foreground">{log.observation}</p>
                      </div>

                      {/* Suggestion */}
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">AI Suggested</p>
                        <p className="text-sm text-primary-glow">
                          {log.aiRecommendation ?? t("ceo.no_recommendation")}
                        </p>
                      </div>

                      {/* Boss Decision */}
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Boss Decided</p>
                        <Badge className={`${decisionStyle.bg} ${decisionStyle.text}`}>
                          <DecisionIcon className="w-3 h-3 mr-1" />
                          {answer}
                        </Badge>
                      </div>

                      {/* Outcome */}
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Outcome</p>
                        <p className="text-sm text-accent-emerald">{log.outcome}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {whenOf(log.createdAt)}
                        </span>
                      </div>
                      {Boolean(log.outcome) && (
                        <Badge className="bg-accent-pink/20 text-accent-pink">
                          <Brain className="w-3 h-3 mr-1" />
                          Outcome Recorded
                        </Badge>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* AI Notice */}
      <div className="p-4 rounded-lg bg-accent-pink/5 border border-accent-pink/20">
        <div className="flex items-center gap-3">
          <Brain className="w-5 h-5 text-accent-pink" />
          <p className="text-sm text-accent-pink/80">
            <strong>{t("ceo.learning_note_label")}</strong> {t("ceo.learning_note")}
          </p>
        </div>
      </div>
    </PageShell>
  );
};

export default AICEOLearning;
