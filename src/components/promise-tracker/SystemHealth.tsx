import { AlertTriangle, Activity, ShieldCheck } from "lucide-react";

import { MetricCard, PTBadge, EmptyState, LoadingRows } from "./PTPrimitives";
import { useHealthEvents } from "@/hooks/usePromiseTracker";
import { HEALTH_LEVEL_META } from "@/lib/promise-tracker/monitoring";
import { formatDateTime } from "@/lib/promise-tracker/constants";

const SOURCE_LABEL: Record<string, string> = {
  realtime: "Realtime",
  mutation: "Backend mutation",
  "audit-log": "Audit log",
  query: "Data fetch",
};

/**
 * Production monitoring surface: shows failures recorded for realtime
 * subscriptions, backend mutations and audit-log writes.
 */
export function SystemHealthPanel() {
  const { data: events = [], isLoading } = useHealthEvents(50);

  const last24h = events.filter(
    (event) => Date.now() - new Date(event.created_at).getTime() < 86400000,
  );
  const errors = last24h.filter((event) => event.level === "error");
  const realtimeIssues = last24h.filter((event) => event.source === "realtime");
  const auditIssues = last24h.filter((event) => event.source === "audit-log");

  return (
    <section className="mt-8" aria-labelledby="system-health">
      <h2 id="system-health" className="font-display text-lg font-semibold">
        System health
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Alerting feed for realtime updates, backend mutations and audit-log writes. Errors are
        recorded automatically and kept for 14 days.
      </p>

      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <MetricCard
          label="Realtime"
          value={realtimeIssues.length > 0 ? "Degraded" : "Healthy"}
          tone={realtimeIssues.length > 0 ? "warning" : "success"}
          hint="Based on incidents recorded in the last 24 hours"
          icon={<Activity className="size-4" />}
        />
        <MetricCard
          label="Errors (24h)"
          value={errors.length}
          tone={errors.length > 0 ? "danger" : "success"}
          icon={<AlertTriangle className="size-4" />}
        />
        <MetricCard
          label="Realtime drops (24h)"
          value={realtimeIssues.length}
          tone={realtimeIssues.length > 0 ? "warning" : "success"}
        />
        <MetricCard
          label="Audit write failures (24h)"
          value={auditIssues.length}
          tone={auditIssues.length > 0 ? "danger" : "success"}
          icon={<ShieldCheck className="size-4" />}
        />
      </div>

      {isLoading ? (
        <LoadingRows rows={3} />
      ) : events.length === 0 ? (
        <EmptyState
          title="No incidents recorded"
          description="Realtime, mutations and audit-log writes have all succeeded."
        />
      ) : (
        <div className="glass-panel divide-y divide-border">
          {events.map((event) => (
            <div key={event.id} className="flex flex-wrap items-start gap-3 p-4">
              <PTBadge
                className={
                  HEALTH_LEVEL_META[event.level]?.className ?? HEALTH_LEVEL_META["error"]!.className
                }
              >
                {HEALTH_LEVEL_META[event.level]?.label ?? event.level}
              </PTBadge>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {SOURCE_LABEL[event.source] ?? event.source} · {event.event}
                </p>
                <p className="break-words text-xs text-muted-foreground">{event.message}</p>
              </div>
              <span className="mono text-xs text-muted-foreground">
                {formatDateTime(event.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
