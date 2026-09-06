import { useMemo, useState } from "react";
import { Columns3, Clock, Play, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { formatMinutes, liveMinutes, titleCase } from "@/lib/tm/format";
import { useChangeStatus, useNow, useSettings, useTasks } from "@/lib/tm/hooks";
import { TM_STATUSES } from "@/lib/tm/types";
import type { TMTaskStatus, TMTaskWithPeople } from "@/lib/tm/types";
import { PriorityBadge, SLABadge, TMEmpty, TMLoading, TMPageHeader, TMPanel, TaskCode } from "../shared";
import { STATUS_LABELS } from "@/lib/tm/format";

const NEXT_STATUS: Partial<Record<TMTaskStatus, TMTaskStatus>> = {
  new: "assigned",
  assigned: "accepted",
  accepted: "in_progress",
  in_progress: "ai_review",
  ai_review: "testing",
  testing: "completed",
  waiting_client: "in_progress",
  blocked: "in_progress",
  on_hold: "in_progress",
};

export function TMPipeline({ onOpenTask }: { onOpenTask: (taskId: string) => void }) {
  const { data: tasks, isLoading } = useTasks();
  const { data: settings } = useSettings();
  const changeStatus = useChangeStatus();
  const now = useNow(1000);
  const [dragging, setDragging] = useState<TMTaskWithPeople | null>(null);
  const warn = settings?.sla_warning_percent ?? 75;

  const columns = useMemo(
    () =>
      TM_STATUSES.map((status) => ({
        status,
        items: (tasks ?? []).filter((t) => t.status === status),
      })),
    [tasks],
  );

  if (isLoading) return <TMLoading label="Loading task pipeline" />;

  const move = (task: TMTaskWithPeople, status: TMTaskStatus) => {
    if (task.status === status) return;
    changeStatus.mutate({ task, status, note: "Moved on pipeline board" });
  };

  return (
    <div className="space-y-6">
      <TMPageHeader
        title="Task Pipeline"
        subtitle="Kanban flow across every stage • drag a card to move it, real status writes"
      />

      <TMPanel title="Live board" icon={<Columns3 className="h-4 w-4" />}>
        <ScrollArea className="w-full">
          <div className="flex gap-4 pb-4">
            {columns.map(({ status, items }) => (
              <div
                key={status}
                className="flex w-72 shrink-0 flex-col rounded-lg border border-border bg-muted/30"
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragging) move(dragging, status);
                  setDragging(null);
                }}
              >
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <p className="font-display text-xs font-semibold uppercase tracking-wider text-foreground">
                    {STATUS_LABELS[status]}
                  </p>
                  <Badge variant="outline">{items.length}</Badge>
                </div>
                <div className="space-y-2 p-3">
                  {items.map((task) => {
                    const next = NEXT_STATUS[task.status];
                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={() => setDragging(task)}
                        onDragEnd={() => setDragging(null)}
                        className="cursor-grab space-y-2 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <TaskCode code={task.code} />
                          <PriorityBadge priority={task.priority} />
                        </div>
                        <button
                          type="button"
                          className="block w-full text-left text-sm text-foreground hover:underline"
                          onClick={() => onOpenTask(task.id)}
                        >
                          {task.title}
                        </button>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          {task.assignee?.full_name ?? "Unassigned"}
                        </p>
                        <Progress value={task.progress} className="h-1.5" />
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatMinutes(liveMinutes(task, now))}
                          </span>
                          <SLABadge task={task} warningPercent={warn} />
                        </div>
                        <div className="flex items-center gap-2">
                          {next && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 flex-1 text-xs"
                              disabled={changeStatus.isPending}
                              onClick={() => move(task, next)}
                            >
                              <Play className="mr-1 h-3 w-3" /> {titleCase(next)}
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onOpenTask(task.id)}>
                            Open
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {items.length === 0 && <TMEmpty message="Empty" />}
                </div>
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </TMPanel>
    </div>
  );
}
