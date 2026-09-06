import { useMemo, useState } from "react";
import { UserCheck, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { titleCase } from "@/lib/tm/format";
import { useAssignTask, useMembers, useTasks } from "@/lib/tm/hooks";
import { TM_ACTIVE_STATUSES } from "@/lib/tm/types";
import { PriorityBadge, SLABadge, StatusBadge, TMEmpty, TMLoading, TMPageHeader, TMPanel, TMRow, TaskCode } from "../shared";

export function TMAssignment({ onOpenTask }: { onOpenTask: (taskId: string) => void }) {
  const { data: tasks, isLoading } = useTasks();
  const { data: members } = useMembers();
  const assign = useAssignTask();
  const [draft, setDraft] = useState<Record<string, string>>({});

  const unassigned = (tasks ?? []).filter((t) => !t.assigned_to && t.status !== "completed" && t.status !== "cancelled");

  const workload = useMemo(() => {
    return (members ?? []).map((member) => {
      const active = (tasks ?? []).filter((t) => t.assigned_to === member.id && TM_ACTIVE_STATUSES.includes(t.status));
      const hours = active.reduce((sum, t) => sum + Number(t.estimated_hours), 0);
      return {
        member,
        activeCount: active.length,
        hours,
        load: member.capacity_hours > 0 ? Math.min(100, Math.round((hours / Number(member.capacity_hours)) * 100)) : 0,
      };
    });
  }, [members, tasks]);

  if (isLoading) return <TMLoading label="Loading assignment board" />;

  return (
    <div className="space-y-6">
      <TMPageHeader title="Task Assignment" subtitle="Route work by skill, role and live capacity" />

      <TMPanel title="Unassigned queue" icon={<UserCheck className="h-4 w-4" />} actions={<Badge variant="outline">{unassigned.length}</Badge>}>
        <div className="space-y-3">
          {unassigned.map((task) => (
            <TMRow key={task.id}>
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <TaskCode code={task.code} />
                  <StatusBadge status={task.status} />
                  <PriorityBadge priority={task.priority} />
                </div>
                <p className="truncate text-sm text-foreground">{task.title}</p>
                <p className="text-xs text-muted-foreground">
                  {titleCase(task.category)} • {task.estimated_hours}h est • <SLABadge task={task} />
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={draft[task.id] ?? ""} onValueChange={(value) => setDraft({ ...draft, [task.id]: value })}>
                  <SelectTrigger className="w-56"><SelectValue placeholder="Select owner" /></SelectTrigger>
                  <SelectContent>
                    {workload.map(({ member, load }) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.full_name} — {titleCase(member.role)} ({load}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  disabled={!draft[task.id] || assign.isPending}
                  onClick={() => {
                    const memberId = draft[task.id];
                    if (!memberId) return;
                    const member = (members ?? []).find((m) => m.id === memberId);
                    if (member) assign.mutate({ task, memberId, memberName: member.full_name });
                  }}
                >
                  Assign
                </Button>
                <Button size="sm" variant="outline" onClick={() => onOpenTask(task.id)}>Open</Button>
              </div>
            </TMRow>
          ))}
          {unassigned.length === 0 && <TMEmpty message="Every task has an owner" />}
        </div>
      </TMPanel>

      <TMPanel title="Team capacity" icon={<Users className="h-4 w-4" />}>
        <div className="grid gap-4 md:grid-cols-2">
          {workload.map(({ member, activeCount, hours, load }) => (
            <div key={member.id} className="space-y-2 rounded-lg border border-border bg-muted/40 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{member.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {titleCase(member.role)} • {titleCase(member.department)}
                  </p>
                </div>
                <Badge variant="outline">{activeCount} active</Badge>
              </div>
              <Progress value={load} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {hours}h committed of {member.capacity_hours}h • {load}% loaded
              </p>
              {member.skills.length > 0 && (
                <p className="text-xs text-muted-foreground">Skills: {member.skills.join(", ")}</p>
              )}
            </div>
          ))}
        </div>
      </TMPanel>
    </div>
  );
}
