import { Pause, Play, Square } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatMinutes, liveMinutes, titleCase } from "@/lib/tm/format";
import { useChangeStatus, useNow, useTasks, useTimeLogs, useTimerAction } from "@/lib/tm/hooks";
import { PriorityBadge, SLABadge, StatusBadge, TMEmpty, TMLoading, TMPageHeader, TMPanel, TMRow, TaskCode } from "../shared";

export function TMExecution({ onOpenTask }: { onOpenTask: (taskId: string) => void }) {
  const { data: tasks, isLoading } = useTasks();
  const { data: timeLogs } = useTimeLogs();
  const timer = useTimerAction();
  const changeStatus = useChangeStatus();
  const now = useNow();

  const inFlight = (tasks ?? []).filter((t) =>
    ["assigned", "accepted", "in_progress", "testing", "ai_review", "blocked", "on_hold", "waiting_client"].includes(t.status),
  );
  const running = inFlight.filter((t) => t.timer_running);

  if (isLoading) return <TMLoading label="Loading execution board" />;

  return (
    <div className="space-y-6">
      <TMPageHeader
        title="Task Execution"
        subtitle="Live timers, progress and blockers across every in-flight task"
        actions={<Badge variant="outline">{running.length} timers running</Badge>}
      />

      <TMPanel title="In-flight tasks">
        <div className="space-y-3">
          {inFlight.map((task) => (
            <TMRow key={task.id} className="items-start">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <TaskCode code={task.code} />
                  <StatusBadge status={task.status} />
                  <PriorityBadge priority={task.priority} />
                  <SLABadge task={task} />
                </div>
                <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                <p className="text-xs text-muted-foreground">
                  {task.assignee?.full_name ?? "Unassigned"} • {titleCase(task.category)} •{" "}
                  <span className="font-mono">{formatMinutes(liveMinutes(task, now))}</span> logged of {task.estimated_hours}h
                </p>
                {task.blocked_reason && <p className="text-xs text-destructive">Blocked: {task.blocked_reason}</p>}
                <Progress value={task.progress} className="h-2 max-w-md" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={timer.isPending}
                  onClick={() => timer.mutate({ task, action: task.timer_running ? "pause" : task.started_at ? "resume" : "start" })}
                >
                  {task.timer_running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button size="sm" variant="outline" disabled={!task.timer_running || timer.isPending} onClick={() => timer.mutate({ task, action: "stop" })}>
                  <Square className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => changeStatus.mutate({ task, status: "completed" })}>
                  Complete
                </Button>
                <Button size="sm" onClick={() => onOpenTask(task.id)}>Open</Button>
              </div>
            </TMRow>
          ))}
          {inFlight.length === 0 && <TMEmpty message="No tasks in flight" />}
        </div>
      </TMPanel>

      <TMPanel title="Recent time logs">
        <div className="space-y-2">
          {(timeLogs ?? []).slice(0, 12).map((log) => (
            <div key={log.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs">
              <span className="text-foreground">
                {log.task?.code ?? "—"} • {titleCase(log.action)} • {log.member?.full_name ?? "System"}
              </span>
              <span className="font-mono text-muted-foreground">{formatMinutes(Math.round(log.seconds / 60))}</span>
            </div>
          ))}
          {(timeLogs ?? []).length === 0 && <TMEmpty message="No time logged yet" />}
        </div>
      </TMPanel>
    </div>
  );
}
