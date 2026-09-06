import { useState } from "react";
import { GitBranch, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { titleCase } from "@/lib/tm/format";
import { useCreateDependency, useDeleteDependency, useDependencies, useTasks, useUpdateDependency } from "@/lib/tm/hooks";
import { StatusBadge, TMEmpty, TMLoading, TMPageHeader, TMPanel, TMRow, TaskCode } from "../shared";

const TYPES = ["blocks", "blocked_by", "relates_to", "duplicates"] as const;
const STATUSES = ["pending", "satisfied", "waived"] as const;

export function TMDependency({ onOpenTask }: { onOpenTask: (taskId: string) => void }) {
  const { data: dependencies, isLoading } = useDependencies();
  const { data: tasks } = useTasks();
  const create = useCreateDependency();
  const update = useUpdateDependency();
  const remove = useDeleteDependency();

  const [taskId, setTaskId] = useState("");
  const [dependsOn, setDependsOn] = useState("");
  const [type, setType] = useState<string>("blocks");

  if (isLoading) return <TMLoading label="Loading dependency graph" />;

  const blocking = (dependencies ?? []).filter((d) => d.status === "pending");

  return (
    <div className="space-y-6">
      <TMPageHeader
        title="Task Dependency"
        subtitle="Link blockers across tasks and clear the critical path"
        actions={<Badge variant="outline">{blocking.length} unresolved links</Badge>}
      />

      <TMPanel title="Link a dependency" icon={<GitBranch className="h-4 w-4" />}>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2 md:col-span-1">
            <Label>Task</Label>
            <Select value={taskId} onValueChange={setTaskId}>
              <SelectTrigger><SelectValue placeholder="Select task" /></SelectTrigger>
              <SelectContent>
                {(tasks ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.code} — {t.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Relationship</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{titleCase(t)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Depends on</Label>
            <Select value={dependsOn} onValueChange={setDependsOn}>
              <SelectTrigger><SelectValue placeholder="Select task" /></SelectTrigger>
              <SelectContent>
                {(tasks ?? []).filter((t) => t.id !== taskId).map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.code} — {t.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              className="w-full"
              disabled={!taskId || !dependsOn || create.isPending}
              onClick={() => {
                create.mutate({ task_id: taskId, depends_on_task_id: dependsOn, dependency_type: type });
                setDependsOn("");
              }}
            >
              Link
            </Button>
          </div>
        </div>
      </TMPanel>

      <TMPanel title="Dependency map">
        <div className="space-y-3">
          {(dependencies ?? []).map((dep) => (
            <TMRow key={dep.id}>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-sm text-foreground">
                  <TaskCode code={dep.task?.code ?? "—"} />
                  <span className="truncate">{dep.task?.title ?? "Unknown task"}</span>
                  {dep.task && <StatusBadge status={dep.task.status} />}
                </div>
                <p className="text-xs text-muted-foreground">
                  {titleCase(dep.dependency_type)} → {dep.depends_on?.code ?? "—"} {dep.depends_on?.title ?? ""}
                  {dep.depends_on ? ` (${dep.depends_on.status})` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={dep.status} onValueChange={(status) => update.mutate({ id: dep.id, status })}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>)}</SelectContent>
                </Select>
                {dep.task_id && (
                  <Button size="sm" variant="outline" onClick={() => onOpenTask(dep.task_id)}>Open</Button>
                )}
                <Button size="icon" variant="ghost" onClick={() => remove.mutate(dep.id)} aria-label="Remove dependency">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </TMRow>
          ))}
          {(dependencies ?? []).length === 0 && <TMEmpty message="No dependencies linked" />}
        </div>
      </TMPanel>
    </div>
  );
}
