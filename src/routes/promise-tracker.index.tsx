import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Coins,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";

import { MetricCard, PTPageHeader, StatusBadge } from "@/components/promise-tracker/PTPrimitives";
import { PromiseTable } from "@/components/promise-tracker/PromiseTable";
import { Button } from "@/components/ui/button";
import { useAuditLogs, useTrackerMetrics } from "@/hooks/usePromiseTracker";
import { formatCurrency, formatDateTime } from "@/lib/promise-tracker/constants";

export const Route = createFileRoute("/promise-tracker/")({
  head: () => ({
    meta: [
      { title: "Promise Tracker Overview — Software Vala" },
      {
        name: "description",
        content:
          "Live command overview of every commitment tracked in Software Vala: active promises, escalations, fines, tips and on-time delivery rate.",
      },
      { property: "og:title", content: "Promise Tracker Overview — Software Vala" },
      {
        property: "og:description",
        content:
          "Live overview of commitments, escalations and accountability across Software Vala.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PTOverview,
});

function PTOverview() {
  const { metrics, promises, isLoading } = useTrackerMetrics();
  const { data: logs = [] } = useAuditLogs();

  const attention = promises
    .filter(
      (row) => row.status === "delayed" || row.status === "broken" || row.escalation_level > 0,
    )
    .slice(0, 8);

  return (
    <div>
      <PTPageHeader
        title="Promise Tracker Overview"
        description="Every commitment made across Software Vala, tracked live from creation to fulfilment."
        actions={
          <Button asChild>
            <Link to="/promise-tracker/create">New promise</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total promises"
          value={metrics.total}
          hint={`${metrics.pending} pending activation`}
          icon={<Activity className="size-4" />}
        />
        <MetricCard
          label="Active"
          value={metrics.active}
          hint={`${metrics.overdue} past deadline`}
          tone="info"
          icon={<Clock className="size-4" />}
        />
        <MetricCard
          label="Delayed"
          value={metrics.delayed}
          hint={`${metrics.escalated} escalated`}
          tone="warning"
          icon={<AlertTriangle className="size-4" />}
        />
        <MetricCard
          label="Broken"
          value={metrics.broken}
          hint="Commitments breached"
          tone="danger"
          icon={<ShieldAlert className="size-4" />}
        />
        <MetricCard
          label="Fulfilled"
          value={metrics.fulfilled}
          hint="Closed and locked"
          tone="success"
          icon={<CheckCircle2 className="size-4" />}
        />
        <MetricCard
          label="On-time rate"
          value={`${metrics.onTimeRate}%`}
          hint="Fulfilled before deadline"
          tone="success"
          icon={<TrendingUp className="size-4" />}
        />
        <MetricCard
          label="Fines applied"
          value={formatCurrency(metrics.totalFines)}
          hint="Across all breached promises"
          tone="danger"
          icon={<Coins className="size-4" />}
        />
        <MetricCard
          label="Tips released"
          value={formatCurrency(metrics.totalTips)}
          hint="Rewarded for early delivery"
          tone="success"
          icon={<Coins className="size-4" />}
        />
      </div>

      <section className="mt-8 grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <h2 className="mb-3 font-display text-lg font-semibold">Needs attention</h2>
          <PromiseTable
            promises={attention}
            isLoading={isLoading}
            showFilters={false}
            emptyTitle="Everything is on track"
            emptyDescription="No delayed, broken or escalated promises right now."
          />
        </div>

        <div>
          <h2 className="mb-3 font-display text-lg font-semibold">Recent activity</h2>
          <div className="glass-panel divide-y divide-border">
            {logs.slice(0, 10).map((log) => (
              <div key={log.id} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{log.action}</p>
                  {log.promise_code ? (
                    <span className="mono text-xs text-muted-foreground">{log.promise_code}</span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{log.details}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {log.actor} · {formatDateTime(log.created_at)}
                </p>
              </div>
            ))}
            {logs.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No activity recorded yet.</p>
            ) : null}
          </div>

          <h2 className="mb-3 mt-6 font-display text-lg font-semibold">Closing next</h2>
          <div className="glass-panel divide-y divide-border">
            {promises
              .filter((row) => row.status === "active" || row.status === "pending")
              .slice(0, 6)
              .map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(row.deadline)} · {row.owner}
                    </p>
                  </div>
                  <StatusBadge status={row.status} />
                </div>
              ))}
          </div>
        </div>
      </section>
    </div>
  );
}
