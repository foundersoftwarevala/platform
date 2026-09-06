import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime, formatMinutes, titleCase } from "@/lib/tm/format";
import { useTasks } from "@/lib/tm/hooks";
import { PriorityBadge, SLABadge, StatusBadge, TMEmpty, TMLoading, TMPageHeader, TMPanel, TMRow, TaskCode } from "../shared";

export function TMHistory({ onOpenTask }: { onOpenTask: (taskId: string) => void }) {
  const { data: tasks, isLoading } = useTasks();
  const [query, setQuery] = useState("");

  const closed = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (tasks ?? [])
      .filter((t) => t.status === "completed" || t.status === "cancelled")
      .filter((t) => !term || t.title.toLowerCase().includes(term) || t.code.toLowerCase().includes(term) || (t.client_name ?? "").toLowerCase().includes(term));
  }, [tasks, query]);

  if (isLoading) return <TMLoading label="Loading history" />;

  return (
    <div className="space-y-6">
      <TMPageHeader title="Task History" subtitle="Closed and cancelled work with delivery outcomes" />

      <TMPanel title="Search closed tasks">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by code, title or client" />
        </div>
      </TMPanel>

      <TMPanel title={`${closed.length} closed tasks`}>
        <div className="space-y-3">
          {closed.map((task) => (
            <TMRow key={task.id}>
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <TaskCode code={task.code} />
                  <StatusBadge status={task.status} />
                  <PriorityBadge priority={task.priority} />
                  <SLABadge task={task} />
                </div>
                <p className="truncate text-sm text-foreground">{task.title}</p>
                <p className="text-xs text-muted-foreground">
                  {task.assignee?.full_name ?? "Unassigned"} • {titleCase(task.category)} • closed {formatDateTime(task.completed_at ?? task.updated_at)} •{" "}
                  {formatMinutes(task.actual_minutes)} logged{task.quality_score !== null ? ` • quality ${task.quality_score}` : ""}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => onOpenTask(task.id)}>Open</Button>
            </TMRow>
          ))}
          {closed.length === 0 && <TMEmpty message="No closed tasks yet" />}
        </div>
      </TMPanel>
    </div>
  );
}
