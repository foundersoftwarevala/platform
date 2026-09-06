import { useMemo, useState } from "react";
import { Filter, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { computeSLA, formatDateTime, titleCase } from "@/lib/tm/format";
import { useMembers, useSettings, useTasks } from "@/lib/tm/hooks";
import { TM_ACTIVE_STATUSES, TM_PRIORITIES } from "@/lib/tm/types";
import type { TMTaskWithPeople } from "@/lib/tm/types";
import { PriorityBadge, SLABadge, StatusBadge, TMEmpty, TMLoading, TMPageHeader, TMPanel, TMRow, TaskCode } from "../shared";

type Bucket = "all" | "new" | "active" | "waiting" | "blocked" | "completed" | "overdue";

const BUCKETS: Array<{ id: Bucket; label: string }> = [
  { id: "all", label: "All" },
  { id: "new", label: "New Queue" },
  { id: "active", label: "Active" },
  { id: "waiting", label: "Waiting" },
  { id: "blocked", label: "Blocked" },
  { id: "overdue", label: "Overdue" },
  { id: "completed", label: "Closed" },
];

export function TMInbox({ onOpenTask }: { onOpenTask: (taskId: string) => void }) {
  const { data: tasks, isLoading } = useTasks();
  const { data: members } = useMembers();
  const { data: settings } = useSettings();
  const [bucket, setBucket] = useState<Bucket>("all");
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<string>("all");
  const [assignee, setAssignee] = useState<string>("all");

  const warn = settings?.sla_warning_percent ?? 75;

  const inBucket = (task: TMTaskWithPeople, id: Bucket) => {
    switch (id) {
      case "new":
        return task.status === "new";
      case "active":
        return ["assigned", "accepted", "in_progress", "testing", "ai_review"].includes(task.status);
      case "waiting":
        return task.status === "waiting_client" || task.status === "on_hold";
      case "blocked":
        return task.status === "blocked";
      case "completed":
        return task.status === "completed" || task.status === "cancelled";
      case "overdue":
        return computeSLA(task, warn).state === "breached";
      default:
        return true;
    }
  };

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (tasks ?? []).filter((task) => {
      if (!inBucket(task, bucket)) return false;
      if (priority !== "all" && task.priority !== priority) return false;
      if (assignee !== "all" && task.assigned_to !== assignee) return false;
      if (!term) return true;
      return (
        task.title.toLowerCase().includes(term) ||
        task.code.toLowerCase().includes(term) ||
        (task.client_name ?? "").toLowerCase().includes(term) ||
        (task.module ?? "").toLowerCase().includes(term) ||
        task.tags.join(" ").toLowerCase().includes(term)
      );
    });
  }, [tasks, bucket, query, priority, assignee, warn]);

  const counts = useMemo(() => {
    const map = {} as Record<Bucket, number>;
    for (const b of BUCKETS) map[b.id] = (tasks ?? []).filter((t) => inBucket(t, b.id)).length;
    return map;
  }, [tasks, warn]);

  if (isLoading) return <TMLoading label="Loading inbox" />;

  return (
    <div className="space-y-6">
      <TMPageHeader
        title="Task Inbox"
        subtitle={`${(tasks ?? []).filter((t) => TM_ACTIVE_STATUSES.includes(t.status)).length} live tasks in the pipeline`}
      />

      <TMPanel title="Filters" icon={<Filter className="h-4 w-4" />}>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search code, title, client, module, tag" />
          </div>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {TM_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{titleCase(p)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger><SelectValue placeholder="Assignee" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All assignees</SelectItem>
              {(members ?? []).map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </TMPanel>

      <Tabs value={bucket} onValueChange={(v) => setBucket(v as Bucket)}>
        <TabsList className="flex flex-wrap">
          {BUCKETS.map((b) => (
            <TabsTrigger key={b.id} value={b.id}>
              {b.label} ({counts[b.id] ?? 0})
            </TabsTrigger>
          ))}
        </TabsList>

        {BUCKETS.map((b) => (
          <TabsContent key={b.id} value={b.id} className="mt-4 space-y-3">
            {filtered.map((task) => (
              <TMRow key={task.id}>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <TaskCode code={task.code} />
                    <StatusBadge status={task.status} />
                    <PriorityBadge priority={task.priority} />
                    {task.buzzer_active && <span className="text-xs font-medium text-destructive">BUZZER</span>}
                  </div>
                  <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {task.assignee?.full_name ?? "Unassigned"} • {titleCase(task.category)}
                    {task.client_name ? ` • ${task.client_name}` : ""} • due {formatDateTime(task.deadline)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <SLABadge task={task} warningPercent={warn} />
                    <p className="text-xs text-muted-foreground">{task.progress}% done</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => onOpenTask(task.id)}>Open</Button>
                </div>
              </TMRow>
            ))}
            {filtered.length === 0 && <TMEmpty message="No tasks match this view" />}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
