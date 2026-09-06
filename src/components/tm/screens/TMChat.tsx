import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDateTime, initials, relativeTime, titleCase } from "@/lib/tm/format";
import { useAddComment, useTaskChat, useTasks } from "@/lib/tm/hooks";
import { StatusBadge, TMEmpty, TMLoading, TMPageHeader, TMPanel, TaskCode } from "../shared";

export function TMChat({ onOpenTask }: { onOpenTask: (taskId: string) => void }) {
  const { data: tasks, isLoading } = useTasks();
  const { data: comments } = useTaskChat();
  const addComment = useAddComment();
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const threads = useMemo(() => {
    const byTask = new Map<string, { count: number; last: string }>();
    for (const c of comments ?? []) {
      const current = byTask.get(c.task_id);
      byTask.set(c.task_id, { count: (current?.count ?? 0) + 1, last: current?.last ?? c.created_at });
    }
    return (tasks ?? [])
      .map((task) => ({ task, ...(byTask.get(task.id) ?? { count: 0, last: task.updated_at }) }))
      .sort((a, b) => new Date(b.last).getTime() - new Date(a.last).getTime());
  }, [tasks, comments]);

  const activeTaskId = selected ?? threads[0]?.task.id ?? null;
  const activeThread = threads.find((t) => t.task.id === activeTaskId);
  const messages = useMemo(
    () =>
      (comments ?? [])
        .filter((c) => c.task_id === activeTaskId)
        .slice()
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [comments, activeTaskId],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, activeTaskId]);

  if (isLoading) return <TMLoading label="Loading task chat" />;

  const send = () => {
    if (!message.trim() || !activeTaskId) return;
    addComment.mutate(
      { taskId: activeTaskId, message: message.trim(), author: { name: "Task Manager", role: "task_manager" } },
      { onSuccess: () => setMessage("") },
    );
  };

  return (
    <div className="space-y-6">
      <TMPageHeader title="Task Chat" subtitle="Task-linked conversation across every stakeholder, stored with the task" />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <TMPanel title="Threads" icon={<MessageSquare className="h-4 w-4" />}>
          <ScrollArea className="h-[520px] pr-2">
            <div className="space-y-1">
              {threads.map(({ task, count, last }) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => setSelected(task.id)}
                  className={`w-full space-y-1 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent/40 ${
                    task.id === activeTaskId ? "bg-accent/60" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <TaskCode code={task.code} />
                    <Badge variant="outline">{count}</Badge>
                  </div>
                  <p className="truncate text-sm text-foreground">{task.title}</p>
                  <p className="text-xs text-muted-foreground">{relativeTime(last)}</p>
                </button>
              ))}
              {threads.length === 0 && <TMEmpty message="No tasks yet" />}
            </div>
          </ScrollArea>
        </TMPanel>

        <TMPanel
          title={activeThread ? activeThread.task.title : "Conversation"}
          actions={
            activeThread ? (
              <div className="flex items-center gap-2">
                <StatusBadge status={activeThread.task.status} />
                <Button size="sm" variant="outline" onClick={() => onOpenTask(activeThread.task.id)}>
                  Open task
                </Button>
              </div>
            ) : null
          }
        >
          <div className="flex h-[520px] flex-col">
            <ScrollArea className="flex-1 pr-2">
              <div className="space-y-3">
                {messages.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-lg p-3 ${item.is_system ? "border border-dashed border-border bg-muted/30" : "bg-muted/50"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/15 text-[10px] font-medium text-primary">
                          {initials(item.author_name)}
                        </span>
                        <p className="text-sm font-medium text-foreground">{item.author_name}</p>
                        <Badge variant="outline">{titleCase(item.author_role)}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDateTime(item.created_at)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{item.message}</p>
                  </div>
                ))}
                {messages.length === 0 && <TMEmpty message="No messages on this task yet" />}
                <div ref={endRef} />
              </div>
            </ScrollArea>

            <div className="mt-3 flex items-center gap-2">
              <Input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    send();
                  }
                }}
                placeholder={activeTaskId ? "Message the task thread" : "Select a task"}
                disabled={!activeTaskId}
              />
              <Button onClick={send} disabled={!message.trim() || !activeTaskId || addComment.isPending}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </TMPanel>
      </div>
    </div>
  );
}
