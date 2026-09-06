import { useState } from "react";
import { ArrowUpCircle, Bell } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, titleCase } from "@/lib/tm/format";
import { useAcknowledgeBuzzer, useEscalations, useRaiseEscalation, useTasks, useUpdateEscalation } from "@/lib/tm/hooks";
import { StatusBadge, TMEmpty, TMLoading, TMPageHeader, TMPanel, TMRow, TaskCode } from "../shared";

export function TMEscalation({ onOpenTask }: { onOpenTask: (taskId: string) => void }) {
  const { data: escalations, isLoading } = useEscalations();
  const { data: tasks } = useTasks();
  const raise = useRaiseEscalation();
  const update = useUpdateEscalation();
  const acknowledge = useAcknowledgeBuzzer();

  const [taskId, setTaskId] = useState("");
  const [level, setLevel] = useState("1");
  const [reason, setReason] = useState("");
  const [raisedTo, setRaisedTo] = useState("task_manager");
  const [resolution, setResolution] = useState<Record<string, string>>({});

  if (isLoading) return <TMLoading label="Loading escalations" />;

  const open = (escalations ?? []).filter((e) => e.status === "open" || e.status === "acknowledged");
  const buzzers = (tasks ?? []).filter((t) => t.buzzer_active);

  return (
    <div className="space-y-6">
      <TMPageHeader title="Task Escalation" subtitle="Raise, route and resolve escalations with a full trail" actions={<Badge variant="outline">{open.length} open</Badge>} />

      {buzzers.length > 0 && (
        <TMPanel title="Active buzzers" icon={<Bell className="h-4 w-4 text-destructive" />}>
          <div className="space-y-2">
            {buzzers.map((task) => (
              <TMRow key={task.id} className="border-destructive/40 bg-destructive/10">
                <div>
                  <TaskCode code={task.code} />
                  <p className="text-sm text-foreground">{task.title}</p>
                  <p className="text-xs text-muted-foreground">Level {task.escalation_level}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => acknowledge.mutate(task.id)}>Acknowledge</Button>
              </TMRow>
            ))}
          </div>
        </TMPanel>
      )}

      <TMPanel title="Raise escalation" icon={<ArrowUpCircle className="h-4 w-4" />}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Task</Label>
            <Select value={taskId} onValueChange={setTaskId}>
              <SelectTrigger><SelectValue placeholder="Select task" /></SelectTrigger>
              <SelectContent>{(tasks ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.code} — {t.title}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Level</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">L1 — Team lead</SelectItem>
                <SelectItem value="2">L2 — Manager (buzzer)</SelectItem>
                <SelectItem value="3">L3 — Director (buzzer)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Raise to</Label>
            <Select value={raisedTo} onValueChange={setRaisedTo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="team_lead">Team lead</SelectItem>
                <SelectItem value="task_manager">Task manager</SelectItem>
                <SelectItem value="director">Director</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this needs escalation" />
          </div>
          <div>
            <Button
              disabled={!taskId || !reason.trim() || raise.isPending}
              onClick={() => {
                raise.mutate({ task_id: taskId, level: Number(level), reason: reason.trim(), raised_by: "Task Manager", raised_to: raisedTo });
                setReason("");
              }}
            >
              Raise escalation
            </Button>
          </div>
        </div>
      </TMPanel>

      <TMPanel title="Escalation register">
        <div className="space-y-3">
          {(escalations ?? []).map((esc) => (
            <TMRow key={esc.id} className="items-start">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <TaskCode code={esc.task?.code ?? "—"} />
                  {esc.task && <StatusBadge status={esc.task.status} />}
                  <Badge variant="outline">L{esc.level}</Badge>
                  <Badge variant="outline">{titleCase(esc.status)}</Badge>
                </div>
                <p className="truncate text-sm text-foreground">{esc.task?.title ?? "Unknown task"}</p>
                <p className="text-xs text-muted-foreground">
                  {esc.reason} • raised by {esc.raised_by} → {titleCase(esc.raised_to)} • {formatDateTime(esc.created_at)}
                </p>
                {esc.resolution && <p className="text-xs text-muted-foreground">Resolution: {esc.resolution}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {esc.status !== "resolved" && esc.status !== "closed" && (
                  <>
                    <Textarea
                      className="h-9 w-48 min-h-9"
                      placeholder="Resolution"
                      value={resolution[esc.id] ?? ""}
                      onChange={(e) => setResolution({ ...resolution, [esc.id]: e.target.value })}
                    />
                    <Button size="sm" variant="outline" onClick={() => update.mutate({ id: esc.id, status: "acknowledged" })}>Acknowledge</Button>
                    <Button size="sm" onClick={() => update.mutate({ id: esc.id, status: "resolved", resolution: resolution[esc.id] ?? "" })}>Resolve</Button>
                  </>
                )}
                {esc.task_id && <Button size="sm" variant="ghost" onClick={() => onOpenTask(esc.task_id)}>Open</Button>}
              </div>
            </TMRow>
          ))}
          {(escalations ?? []).length === 0 && <TMEmpty message="No escalations raised" />}
        </div>
      </TMPanel>
    </div>
  );
}
