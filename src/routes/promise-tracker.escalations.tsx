import { createFileRoute } from "@tanstack/react-router";

import {
  EscalationBadge,
  MetricCard,
  PTPageHeader,
} from "@/components/promise-tracker/PTPrimitives";
import {
  PromiseFilterBar,
  applyPromiseFilters,
  usePromiseFilters,
} from "@/components/promise-tracker/PromiseFilters";
import { Button } from "@/components/ui/button";
import { useEscalatePromise, usePromises, useResolveEscalation } from "@/hooks/usePromiseTracker";
import { ESCALATION_LEVELS, formatDateTime } from "@/lib/promise-tracker/constants";

export const Route = createFileRoute("/promise-tracker/escalations")({
  head: () => ({
    meta: [
      { title: "Escalations — Promise Tracker" },
      {
        name: "description",
        content:
          "Four-level escalation ladder for overdue Software Vala commitments, from reminder through manager and admin alerts to legal penalty.",
      },
      { property: "og:title", content: "Escalations — Promise Tracker" },
      {
        property: "og:description",
        content: "Track and resolve the four-level escalation ladder for overdue commitments.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PTEscalations,
});

function PTEscalations() {
  const { data = [] } = usePromises();
  const { filters, update, reset } = usePromiseFilters();
  const escalate = useEscalatePromise();
  const resolve = useResolveEscalation();
  const escalated = data.filter((row) => row.escalation_level > 0);
  const filtered = applyPromiseFilters(escalated, filters);

  return (
    <div>
      <PTPageHeader
        title="Escalations"
        description="Overdue commitments climb a four-level ladder. Each step notifies a wider audience and is written to the audit log."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ESCALATION_LEVELS.map((level) => (
          <MetricCard
            key={level.level}
            label={`Level ${level.level} · ${level.label}`}
            value={escalated.filter((row) => row.escalation_level === level.level).length}
            hint="Open escalations at this level"
          />
        ))}
      </div>

      <div className="mb-4">
        <PromiseFilterBar
          promises={escalated}
          filters={filters}
          onChange={update}
          onReset={reset}
          resultCount={filtered.length}
        />
      </div>

      <div className="glass-panel divide-y divide-border">
        {filtered.map((row) => (
          <div key={row.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="min-w-64">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{row.title}</p>
                <span className="mono text-xs text-muted-foreground">{row.code}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {row.escalation_reason ?? "No reason recorded"} · {formatDateTime(row.escalated_at)}
              </p>
              <p className="text-xs text-muted-foreground">
                Owner {row.owner} · Receiver {row.receiver}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <EscalationBadge level={row.escalation_level} />
              <span className="rounded-full border border-border px-2.5 py-0.5 text-xs capitalize text-muted-foreground">
                {row.escalation_status ?? "pending"}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={row.escalation_level >= 4}
                onClick={() =>
                  escalate.mutate({ promise: row, reason: "Escalated from escalation console" })
                }
              >
                Escalate
              </Button>
              <Button
                size="sm"
                onClick={() => resolve.mutate({ promise: row, status: "resolved" })}
              >
                Resolve
              </Button>
            </div>
          </div>
        ))}
        {filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No open escalations.</p>
        ) : null}
      </div>
    </div>
  );
}
