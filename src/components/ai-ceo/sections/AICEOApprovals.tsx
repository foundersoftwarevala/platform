import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckSquare,
  Clock,
  Eye,
  RefreshCw,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  User,
} from "lucide-react";

import {
  DegradedNotice,
  EmptyState,
  LoadingState,
  PageBanner,
  PageShell,
} from "@/components/ai-ceo/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCEOSuggestions, type CEOSuggestion } from "@/hooks/useCEOSuggestions";

/**
 * The Boss approval queue, and the place a decision is actually made.
 *
 * This screen shipped with five invented requests — a production database
 * access request, a 15% discount override — and no way to act on any of them:
 * there were no Approve or Reject controls at all, only the words "Awaiting
 * Boss approval". It looked like a queue and was a picture of one.
 *
 * It now reads the real queue: suggestions forwarded from the AI CEO dashboard,
 * stored in the database. Approve and Reject write the decision, and the row
 * leaves the queue because the stored record changed — not because the screen
 * hid it.
 */

const getRiskStyle = (impact: CEOSuggestion["impact"]) => {
  switch (impact) {
    case "high":
      return "bg-destructive/20 text-destructive border-destructive/30";
    case "medium":
      return "bg-accent-amber/20 text-accent-amber border-accent-amber/30";
    default:
      return "bg-accent-emerald/20 text-accent-emerald border-accent-emerald/30";
  }
};

/** The engine's own steer, read from the confidence it recorded. */
const recommendationFor = (suggestion: CEOSuggestion) => {
  if (suggestion.confidence >= 90) return { label: "approve", style: "bg-accent-emerald/20 text-accent-emerald" };
  if (suggestion.confidence >= 80) return { label: "review", style: "bg-accent-amber/20 text-accent-amber" };
  return { label: "scrutinise", style: "bg-destructive/20 text-destructive" };
};

const AICEOApprovals = () => {
  const { getBossSuggestions, acknowledgeSuggestion, isDeciding, degraded, suggestions } =
    useCEOSuggestions();

  const [queue, setQueue] = useState<CEOSuggestion[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const rows = await getBossSuggestions();
    setQueue(rows);
  }, [getBossSuggestions]);

  useEffect(() => {
    void load();
  }, [load, suggestions]);

  const decide = async (id: string, decision: "approved" | "rejected") => {
    setBusyId(id);
    const ok = await acknowledgeSuggestion(id, decision);
    if (ok) await load();
    setBusyId(null);
  };

  const isLoading = queue === null;
  const rows = queue ?? [];

  const stats = useMemo(
    () => [
      { label: "Awaiting decision", count: rows.length, icon: Clock },
      { label: "High impact", count: rows.filter((s) => s.impact === "high").length, icon: AlertTriangle },
      {
        label: "Approved",
        count: suggestions.filter((s) => s.status === "approved").length,
        icon: ThumbsUp,
      },
      {
        label: "Rejected",
        count: suggestions.filter((s) => s.status === "rejected").length,
        icon: ThumbsDown,
      },
    ],
    [rows, suggestions],
  );

  return (
    <PageShell>
      <PageBanner
        icon={CheckSquare}
        title="Approvals"
        subtitle="Suggestions the AI CEO has forwarded for a decision. Approving or rejecting here writes the decision to the database."
        status={rows.length ? `${rows.length} awaiting a decision` : "Queue is clear"}
        actions={
          <Button size="sm" variant="secondary" onClick={() => void load()} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Reload queue
          </Button>
        }
      />

      <DegradedNotice sources={degraded} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="card3d premium-halo enter-soft rounded-2xl">
            <CardContent className="flex items-center gap-3 p-4">
              <stat.icon className="h-5 w-5 text-primary-glow" aria-hidden="true" />
              <div>
                <p className="text-lg font-bold text-foreground">{stat.count}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading && <LoadingState label="Reading the approval queue…" rows={1} />}

      <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <ShieldCheck className="h-5 w-5 text-accent-emerald" aria-hidden="true" />
            Pending Approvals
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!isLoading && !rows.length ? (
            <EmptyState
              icon={CheckSquare}
              title="Nothing waiting for you"
              description="Suggestions appear here when they are sent from the AI CEO dashboard. Open the dashboard and use 'Send to Boss' to queue one."
            />
          ) : (
            <ScrollArea className="h-[460px]">
              <div className="space-y-4">
                {rows.map((suggestion, i) => {
                  const recommendation = recommendationFor(suggestion);
                  const busy = busyId === suggestion.id || isDeciding;
                  return (
                    <motion.div
                      key={suggestion.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i, 8) * 0.05 }}
                      className="rounded-xl border border-border bg-surface p-5 transition-all hover:shadow-lg"
                    >
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-4">
                          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10">
                            <User className="h-5 w-5 text-primary-glow" aria-hidden="true" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-medium text-foreground">{suggestion.title}</h3>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span className="text-sm text-muted-foreground">
                                {suggestion.impactArea}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {suggestion.type}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <Badge className={getRiskStyle(suggestion.impact)}>
                          {suggestion.impact} impact
                        </Badge>
                      </div>

                      <p className="mb-3 text-sm text-muted-foreground">{suggestion.description}</p>

                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-sm text-muted-foreground">Confidence:</span>
                          <div className="flex min-w-[160px] flex-1 items-center gap-2">
                            <Progress value={suggestion.confidence} className="h-2 flex-1" />
                            <span className="text-sm font-medium text-primary-glow">
                              {suggestion.confidence}%
                            </span>
                          </div>
                          <Badge className={`${recommendation.style} uppercase`}>
                            {recommendation.label}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
                          <span className="mr-auto text-xs text-muted-foreground">
                            Raised {new Date(suggestion.createdAt).toLocaleDateString()} ·{" "}
                            {suggestion.source === "seed" ? "shipped with the module" : suggestion.source}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void decide(suggestion.id, "rejected")}
                            className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
                          >
                            <ThumbsDown className="h-3.5 w-3.5" /> Reject
                          </Button>
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => void decide(suggestion.id, "approved")}
                            className="gap-1.5 bg-accent-emerald/90 text-background hover:bg-accent-emerald"
                          >
                            <ThumbsUp className="h-3.5 w-3.5" />
                            {busy ? "Saving…" : "Approve"}
                          </Button>
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

      <div className="rounded-lg border border-accent-emerald/20 bg-accent-emerald/5 p-4">
        <div className="flex items-center gap-3">
          <Eye className="h-5 w-5 shrink-0 text-accent-emerald" aria-hidden="true" />
          <p className="text-sm text-accent-emerald/80">
            <strong>Approval Notice:</strong> a decision made here is written to the database and
            recorded against the suggestion. It records the decision — it does not itself carry out
            whatever the suggestion proposes.
          </p>
        </div>
      </div>
    </PageShell>
  );
};

export default AICEOApprovals;
