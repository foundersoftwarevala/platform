import { useState } from "react";
import { CheckCircle2, Circle, Clock, MessageSquare, Pause, Play, Plus, Square, Timer } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  formatDateTime,
  formatMinutes,
  liveMinutes,
  relativeTime,
  titleCase,
} from "@/lib/tm/format";
import { getAttachmentUrl } from "@/lib/tm/api";
import {
  useAddComment,
  useAddSubtask,
  useAssignTask,
  useChangeStatus,
  useMembers,
  useNow,
  useSetPriority,
  useSetProgress,
  useTask,
  useTimerAction,
  useToggleSubtask,
} from "@/lib/tm/hooks";
import { TM_PRIORITIES, TM_STATUSES } from "@/lib/tm/types";
import { PriorityBadge, SLABadge, StatusBadge, TMEmpty, TMLoading, TaskCode } from "./shared";

const ACTOR = { name: "Task Manager", role: "task_manager" };

export function TMTaskDetail({ taskId, onOpenChange }: { taskId: string | null; onOpenChange: (open: boolean) => void }) {
  const { data: task, isLoading } = useTask(taskId);
  const { data: members } = useMembers();
  const now = useNow();

  const changeStatus = useChangeStatus();
  const setPriority = useSetPriority();
  const setProgress = useSetProgress();
  const assign = useAssignTask();
  const timer = useTimerAction();
  const addComment = useAddComment();
  const toggleSubtask = useToggleSubtask();
  const addSubtask = useAddSubtask();

  const [message, setMessage] = useState("");
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [note, setNote] = useState("");
  const [progressDraft, setProgressDraft] = useState<number | null>(null);

  return (
    <Sheet open={Boolean(taskId)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-hidden p-0 sm:max-w-2xl">
        {isLoading || !task ? (
          <div className="p-6">
            <TMLoading label="Loading task" />
          </div>
        ) : (
          <>
            <SheetHeader className="border-b border-border p-6 pb-4 text-left">
              <div className="flex items-center gap-2">
                <TaskCode code={task.code} />
                <StatusBadge status={task.status} />
                <PriorityBadge priority={task.priority} />
              </div>
              <SheetTitle className="font-display text-lg">{task.title}</SheetTitle>
              <SheetDescription>
                {titleCase(task.category)}
                {task.module ? ` • ${task.module}` : ""}
                {task.client_name ? ` • ${task.client_name}` : ""}
              </SheetDescription>
            </SheetHeader>

            <ScrollArea className="h-[calc(100vh-9rem)]">
              <div className="space-y-6 p-6">
                <p className="text-sm text-muted-foreground">{task.description || "No description provided."}</p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-border bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">SLA</p>
                    <SLABadge task={task} />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Deadline {formatDateTime(task.deadline)} • {task.sla_hours}h target
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Time logged</p>
                    <p className="font-mono text-sm text-foreground">{formatMinutes(liveMinutes(task, now))}</p>
                    <p className="text-xs text-muted-foreground">Estimate {task.estimated_hours}h</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => timer.mutate({ task, action: task.timer_running ? "pause" : task.started_at ? "resume" : "start" })} disabled={timer.isPending}>
                    {task.timer_running ? <Pause className="mr-1 h-4 w-4" /> : <Play className="mr-1 h-4 w-4" />}
                    {task.timer_running ? "Pause timer" : task.started_at ? "Resume timer" : "Start timer"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => timer.mutate({ task, action: "stop" })} disabled={timer.isPending || !task.timer_running}>
                    <Square className="mr-1 h-4 w-4" />
                    Stop
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => changeStatus.mutate({ task, status: "completed" })} disabled={task.status === "completed"}>
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    Complete
                  </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={task.status} onValueChange={(status) => changeStatus.mutate({ task, status: status as typeof task.status, note: note || "" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TM_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={task.priority} onValueChange={(priority) => setPriority.mutate({ task, priority: priority as typeof task.priority })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TM_PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p}>{titleCase(p)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Assignee</Label>
                    <Select
                      value={task.assigned_to ?? ""}
                      onValueChange={(memberId) => {
                        const member = (members ?? []).find((m) => m.id === memberId);
                        if (member) assign.mutate({ task, memberId, memberName: member.full_name });
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                      <SelectContent>
                        {(members ?? []).map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.full_name} — {titleCase(m.role)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Status note / blocked reason</Label>
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note stored with the status change" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Progress</Label>
                    <span className="text-sm text-foreground">{progressDraft ?? task.progress}%</span>
                  </div>
                  <Slider
                    value={[progressDraft ?? task.progress]}
                    max={100}
                    step={5}
                    onValueChange={(v) => setProgressDraft(v[0] ?? 0)}
                    onValueCommit={(v) => {
                      setProgress.mutate({ task, progress: v[0] ?? 0 });
                      setProgressDraft(null);
                    }}
                  />
                  <Progress value={progressDraft ?? task.progress} className="h-2" />
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-sm font-semibold text-foreground">Checklist</h3>
                    <Badge variant="outline">
                      {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length}
                    </Badge>
                  </div>
                  {task.subtasks.map((subtask) => (
                    <button
                      key={subtask.id}
                      type="button"
                      onClick={() => toggleSubtask.mutate(subtask)}
                      className="flex w-full items-center gap-2 rounded-md p-2 text-left hover:bg-accent/40"
                    >
                      {subtask.completed ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={subtask.completed ? "text-sm text-muted-foreground line-through" : "text-sm text-foreground"}>
                        {subtask.title}
                      </span>
                    </button>
                  ))}
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!subtaskTitle.trim()) return;
                      addSubtask.mutate({ taskId: task.id, title: subtaskTitle.trim(), position: task.subtasks.length + 1 });
                      setSubtaskTitle("");
                    }}
                  >
                    <Input value={subtaskTitle} onChange={(e) => setSubtaskTitle(e.target.value)} placeholder="Add checklist item" />
                    <Button type="submit" size="icon" variant="outline"><Plus className="h-4 w-4" /></Button>
                  </form>
                </div>

                <Separator />

                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
                    <MessageSquare className="h-4 w-4" /> Task chat
                  </h3>
                  {task.comments.map((comment) => (
                    <div key={comment.id} className="rounded-lg bg-muted/40 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-foreground">
                          {comment.author_name} <span className="text-muted-foreground">({titleCase(comment.author_role)})</span>
                        </p>
                        <span className="text-xs text-muted-foreground">{relativeTime(comment.created_at)}</span>
                      </div>
                      <p className="mt-1 text-sm text-foreground">{comment.message}</p>
                    </div>
                  ))}
                  {task.comments.length === 0 && <TMEmpty message="No messages yet" />}
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!message.trim()) return;
                      addComment.mutate({ taskId: task.id, message: message.trim(), author: ACTOR });
                      setMessage("");
                    }}
                  >
                    <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write a message" />
                    <Button type="submit" disabled={addComment.isPending}>Send</Button>
                  </form>
                </div>

                <Separator />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <h3 className="font-display text-sm font-semibold text-foreground">Approvals</h3>
                    {task.approvals.map((a) => (
                      <p key={a.id} className="text-xs text-muted-foreground">
                        {titleCase(a.stage)} • {a.approver_name} • {titleCase(a.status)}
                      </p>
                    ))}
                    {task.approvals.length === 0 && <p className="text-xs text-muted-foreground">Not required</p>}
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-display text-sm font-semibold text-foreground">Reviews</h3>
                    {task.reviews.map((r) => (
                      <p key={r.id} className="text-xs text-muted-foreground">
                        {r.reviewer_name} • {titleCase(r.verdict)} • Q{r.quality_score}/T{r.timeliness_score}
                      </p>
                    ))}
                    {task.reviews.length === 0 && <p className="text-xs text-muted-foreground">No reviews yet</p>}
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-display text-sm font-semibold text-foreground">Escalations</h3>
                    {task.escalations.map((e) => (
                      <p key={e.id} className="text-xs text-muted-foreground">
                        L{e.level} • {titleCase(e.status)} • {e.reason}
                      </p>
                    ))}
                    {task.escalations.length === 0 && <p className="text-xs text-muted-foreground">None</p>}
                  </div>
                  <div className="space-y-2">
                    <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
                      <Timer className="h-4 w-4" /> Time logs
                    </h3>
                    {task.time_logs.slice(0, 5).map((log) => (
                      <p key={log.id} className="text-xs text-muted-foreground">
                        {titleCase(log.action)} • {formatDateTime(log.started_at)} • {formatMinutes(Math.round(log.seconds / 60))}
                      </p>
                    ))}
                    {task.time_logs.length === 0 && <p className="text-xs text-muted-foreground">No time logged</p>}
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  <p className="flex items-center gap-2"><Clock className="h-3 w-3" /> Created {formatDateTime(task.created_at)}</p>
                  <div className="space-y-1">
                    <p>Attachments: {task.attachments.length}</p>
                    {task.attachments.map((file) => (
                      <button
                        key={file.id}
                        type="button"
                        className="block text-left text-xs text-primary underline-offset-2 hover:underline"
                        onClick={async () => {
                          try {
                            const url = await getAttachmentUrl(file.url);
                            window.open(url, "_blank", "noopener");
                          } catch (error) {
                            toast.error((error as Error).message);
                          }
                        }}
                      >
                        {file.name} · {file.size_kb} KB
                      </button>
                    ))}
                  </div>
                  <p>Tags: {task.tags.length ? task.tags.join(", ") : "—"}</p>
                </div>
              </div>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
