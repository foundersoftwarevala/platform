import { useMemo } from "react";
import { BarChart3, CheckCircle, Clock, Gauge, TrendingUp } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { computeSLA, formatMinutes, titleCase } from "@/lib/tm/format";
import { useMembers, useReviews, useSettings, useTasks } from "@/lib/tm/hooks";
import { TM_ACTIVE_STATUSES } from "@/lib/tm/types";
import { TMEmpty, TMLoading, TMPageHeader, TMPanel, TMStat } from "../shared";

export function TMAnalytics() {
  const { data: tasks, isLoading } = useTasks();
  const { data: members } = useMembers();
  const { data: reviews } = useReviews();
  const { data: settings } = useSettings();
  const warn = settings?.sla_warning_percent ?? 75;

  const metrics = useMemo(() => {
    const list = tasks ?? [];
    const closed = list.filter((t) => t.status === "completed");
    const withSla = closed.map((t) => computeSLA(t, warn));
    const met = withSla.filter((s) => s.state === "met").length;
    const scores = (reviews ?? []).map((r) => r.quality_score).filter((n) => n > 0);
    const byCategory = new Map<string, number>();
    for (const t of list) byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + 1);
    return {
      throughput: closed.length,
      slaCompliance: closed.length ? Math.round((met / closed.length) * 100) : 0,
      avgQuality: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      loggedMinutes: list.reduce((sum, t) => sum + t.actual_minutes, 0),
      byCategory: [...byCategory.entries()].sort((a, b) => b[1] - a[1]),
      total: list.length,
    };
  }, [tasks, reviews, warn]);

  const perMember = useMemo(
    () =>
      (members ?? [])
        .map((member) => {
          const owned = (tasks ?? []).filter((t) => t.assigned_to === member.id);
          const done = owned.filter((t) => t.status === "completed");
          return {
            member,
            owned: owned.length,
            done: done.length,
            active: owned.filter((t) => TM_ACTIVE_STATUSES.includes(t.status)).length,
            minutes: owned.reduce((sum, t) => sum + t.actual_minutes, 0),
          };
        })
        .sort((a, b) => b.done - a.done),
    [members, tasks],
  );

  if (isLoading) return <TMLoading label="Loading analytics" />;

  return (
    <div className="space-y-6">
      <TMPageHeader title="Task Analytics" subtitle="Throughput, SLA compliance and delivery quality" />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <TMStat label="Tasks delivered" value={metrics.throughput} icon={<CheckCircle />} tone="success" />
        <TMStat label="SLA compliance" value={`${metrics.slaCompliance}%`} icon={<Gauge />} tone="info" />
        <TMStat label="Avg quality score" value={metrics.avgQuality} icon={<TrendingUp />} />
        <TMStat label="Total time logged" value={formatMinutes(metrics.loggedMinutes)} icon={<Clock />} tone="warning" />
      </div>

      <TMPanel title="Volume by category" icon={<BarChart3 className="h-4 w-4" />}>
        <div className="space-y-3">
          {metrics.byCategory.map(([category, count]) => (
            <div key={category} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground">{titleCase(category)}</span>
                <span className="text-muted-foreground">{count}</span>
              </div>
              <Progress value={metrics.total ? (count / metrics.total) * 100 : 0} className="h-2" />
            </div>
          ))}
          {metrics.byCategory.length === 0 && <TMEmpty message="No tasks to analyse" />}
        </div>
      </TMPanel>

      <TMPanel title="Delivery by owner">
        <div className="space-y-2">
          {perMember.map(({ member, owned, done, active, minutes }) => (
            <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <span className="text-foreground">{member.full_name} <span className="text-xs text-muted-foreground">({titleCase(member.role)})</span></span>
              <span className="text-xs text-muted-foreground">
                {done} delivered • {active} active • {owned} total • {formatMinutes(minutes)} logged
              </span>
            </div>
          ))}
        </div>
      </TMPanel>
    </div>
  );
}
