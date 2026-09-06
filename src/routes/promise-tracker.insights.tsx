import { createFileRoute } from "@tanstack/react-router";

import { PTPageHeader, PTBadge } from "@/components/promise-tracker/PTPrimitives";
import {
  PromiseFilterBar,
  applyPromiseFilters,
  usePromiseFilters,
} from "@/components/promise-tracker/PromiseFilters";
import { Button } from "@/components/ui/button";
import { useApplyInsight, useDismissInsight, useInsights } from "@/hooks/usePromiseTracker";
import type { PromiseWithCategory } from "@/lib/promise-tracker/constants";

export const Route = createFileRoute("/promise-tracker/insights")({
  head: () => ({
    meta: [
      { title: "AI Insights — Promise Tracker" },
      {
        name: "description",
        content:
          "Delay-risk scoring and recommended actions for every open commitment tracked in Software Vala.",
      },
      { property: "og:title", content: "AI Insights — Promise Tracker" },
      {
        property: "og:description",
        content: "Delay-risk scores and recommended actions for open commitments.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PTInsights,
});

function riskTone(score: number) {
  if (score >= 70) return "bg-destructive/15 text-destructive border-destructive/30";
  if (score >= 40) return "bg-warning/15 text-warning border-warning/30";
  return "bg-success/15 text-success border-success/30";
}

function PTInsights() {
  const { data = [] } = useInsights();
  const { filters, update, reset } = usePromiseFilters();
  const applyInsight = useApplyInsight();
  const dismissInsight = useDismissInsight();
  const linkedPromises = data
    .map((insight) => insight.promises)
    .filter((promise): promise is PromiseWithCategory => promise !== null);
  const visibleIds = new Set(
    applyPromiseFilters(linkedPromises, filters).map((promise) => promise.id),
  );
  const filtered = data.filter(
    (insight) => insight.promises && visibleIds.has(insight.promises.id),
  );

  return (
    <div>
      <PTPageHeader
        title="AI Insights"
        description="Risk scoring across open commitments, with the recommended next action for each one."
      />

      <div className="mb-4">
        <PromiseFilterBar
          promises={linkedPromises}
          filters={filters}
          onChange={update}
          onReset={reset}
          resultCount={filtered.length}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((insight) => (
          <div key={insight.id} className="glass-panel p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {insight.promises?.title ?? "Unlinked insight"}
                </p>
                <p className="mono text-xs text-muted-foreground">
                  {insight.promises?.code ?? "—"}
                </p>
              </div>
              <PTBadge className={riskTone(Number(insight.delay_risk))}>
                {Number(insight.delay_risk)}% risk
              </PTBadge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{insight.escalation_advice}</p>
            <p className="mt-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <span className="font-medium">Recommended: </span>
              {insight.suggested_action}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Miss probability {Number(insight.miss_probability)}%
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={!insight.promises || applyInsight.isPending}
                onClick={() =>
                  insight.promises &&
                  applyInsight.mutate({ insight, promise: insight.promises })
                }
              >
                Apply suggestion
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={dismissInsight.isPending}
                onClick={() =>
                  dismissInsight.mutate({ insight, promise: insight.promises ?? null })
                }
              >
                Dismiss
              </Button>
            </div>
          </div>
        ))}
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No insights match the current filters.</p>
        ) : null}
      </div>
    </div>
  );
}
