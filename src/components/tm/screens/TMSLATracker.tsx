import { useMemo } from "react";
import { Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { computeSLA, formatDateTime, titleCase } from "@/lib/tm/format";
import { useSettings, useTasks } from "@/lib/tm/hooks";
import { PriorityBadge, StatusBadge, TMEmpty, TMLoading, TMPageHeader, TMPanel, TMRow, TMStat, TaskCode } from "../shared";

export function TMSLATracker({ onOpenTask }: { onOpenTask: (taskId: string) => void }) {
  const { data: tasks, isLoading } = useTasks();
  const { data: settings } = useSettings();
  const warn = settings?.sla_warning_percent ?? 75;

  const rows = useMemo(
    () =>
      (tasks ?? [])
        .map((task) => ({ task, sla: computeSLA(task, warn) }))
        .sort((a, b) => b.sla.percent - a.sla.percent),
    [tasks, warn],
  );

  if (isLoading) return <TMLoading label="Loading SLA tracker" />;

  const count = (state: string) => rows.filter((r) => r.sla.state === state).length;

  return (
    <div className="space-y-6">
      <TMPageHeader title="Task SLA Tracker" subtitle={`Warning threshold at ${warn}% of the SLA window`} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <TMStat label="On track" value={count("on_track")} icon={<Clock />} tone="success" />
        <TMStat label="At risk" value={count("at_risk")} icon={<Clock />} tone="warning" />
        <TMStat label="Breached" value={count("breached")} icon={<Clock />} tone="danger" />
        <TMStat label="Met" value={count("met")} icon={<Clock />} tone="info" />
        <TMStat label="Missed" value={count("missed")} icon={<Clock />} tone="danger" />
      </div>

      <TMPanel title="SLA position by task">
        <div className="space-y-3">
          {rows.map(({ task, sla }) => (
            <TMRow key={task.id} className="items-start">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <TaskCode code={task.code} />
                  <StatusBadge status={task.status} />
                  <PriorityBadge priority={task.priority} />
                  <span className={`text-xs font-medium ${sla.className}`}>{sla.label}</span>
                </div>
                <p className="truncate text-sm text-foreground">{task.title}</p>
                <Progress value={Math.min(100, sla.percent)} className="h-2 max-w-md" />
                <p className="text-xs text-muted-foreground">
                  {titleCase(task.category)} • {task.sla_hours}h SLA • deadline {formatDateTime(task.deadline)} • {sla.percent}% used
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => onOpenTask(task.id)}>Open</Button>
            </TMRow>
          ))}
          {rows.length === 0 && <TMEmpty message="No tasks to track" />}
        </div>
      </TMPanel>
    </div>
  );
}
