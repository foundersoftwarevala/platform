import { useMemo, useState } from "react";
import { AlertTriangle, Calendar, CheckCircle, ChevronLeft, ChevronRight, GitBranch } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { computeSLA, formatDate, titleCase } from "@/lib/tm/format";
import { useDependencies, useSettings, useTasks } from "@/lib/tm/hooks";
import { TMEmpty, TMLoading, TMPageHeader, TMPanel, TaskCode } from "../shared";

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 21;

function startOfDay(ms: number) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const TONE: Record<string, string> = {
  completed: "bg-success/70",
  on_track: "bg-primary/70",
  at_risk: "bg-warning/70",
  breached: "bg-destructive/70",
};

export function TMGantt({ onOpenTask }: { onOpenTask: (taskId: string) => void }) {
  const { data: tasks, isLoading } = useTasks();
  const { data: dependencies } = useDependencies();
  const { data: settings } = useSettings();
  const warn = settings?.sla_warning_percent ?? 75;
  const [offsetWeeks, setOffsetWeeks] = useState(0);

  const windowStart = useMemo(
    () => startOfDay(Date.now()) - 7 * DAY_MS + offsetWeeks * 7 * DAY_MS,
    [offsetWeeks],
  );
  const days = useMemo(
    () => Array.from({ length: WINDOW_DAYS }, (_, i) => windowStart + i * DAY_MS),
    [windowStart],
  );
  const windowEnd = windowStart + WINDOW_DAYS * DAY_MS;

  const depsByTask = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const dep of dependencies ?? []) {
      if (!dep.task_id || !dep.depends_on?.code) continue;
      map.set(dep.task_id, [...(map.get(dep.task_id) ?? []), dep.depends_on.code]);
    }
    return map;
  }, [dependencies]);

  const bars = useMemo(() => {
    return (tasks ?? [])
      .map((task) => {
        const start = startOfDay(new Date(task.started_at ?? task.created_at).getTime());
        const endSource = task.completed_at ?? task.deadline ?? task.promised_at;
        const end = startOfDay(
          endSource ? new Date(endSource).getTime() : start + Number(task.sla_hours) * 3_600_000,
        );
        const sla = computeSLA(task, warn);
        const tone =
          task.status === "completed"
            ? "completed"
            : sla.state === "breached" || sla.state === "missed"
              ? "breached"
              : sla.state === "at_risk"
                ? "at_risk"
                : "on_track";
        return { task, start, end: Math.max(end, start + DAY_MS), sla, tone };
      })
      .filter((row) => row.end >= windowStart && row.start <= windowEnd)
      .sort((a, b) => a.start - b.start);
  }, [tasks, warn, windowStart, windowEnd]);

  if (isLoading) return <TMLoading label="Loading timeline" />;

  return (
    <div className="space-y-6">
      <TMPageHeader
        title="Visual Timeline & Gantt"
        subtitle="Cross-team delivery timeline built from real start, promise and deadline dates"
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setOffsetWeeks((w) => w - 1)} aria-label="Previous weeks">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-40 text-center text-xs text-muted-foreground">
              {formatDate(new Date(windowStart).toISOString())} → {formatDate(new Date(windowEnd - DAY_MS).toISOString())}
            </span>
            <Button size="sm" variant="outline" onClick={() => setOffsetWeeks((w) => w + 1)} aria-label="Next weeks">
              <ChevronRight className="h-4 w-4" />
            </Button>
            {offsetWeeks !== 0 && (
              <Button size="sm" variant="ghost" onClick={() => setOffsetWeeks(0)}>
                Today
              </Button>
            )}
          </div>
        }
      />

      <TMPanel
        title="Delivery timeline"
        icon={<Calendar className="h-4 w-4" />}
        actions={
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {Object.keys(TONE).map((key) => (
              <span key={key} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded ${TONE[key]}`} /> {titleCase(key)}
              </span>
            ))}
          </div>
        }
      >
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="flex border-b border-border">
              <div className="w-64 shrink-0 border-r border-border px-3 py-2 text-xs font-medium text-muted-foreground">
                Task
              </div>
              <div className="flex flex-1">
                {days.map((day) => {
                  const isToday = day === startOfDay(Date.now());
                  return (
                    <div
                      key={day}
                      className={`flex-1 border-r border-border/50 py-2 text-center text-[10px] ${isToday ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
                    >
                      {new Date(day).getDate()}
                    </div>
                  );
                })}
              </div>
            </div>

            {bars.map(({ task, start, end, sla, tone }) => {
              const offset = Math.max(0, Math.round((start - windowStart) / DAY_MS));
              const span = Math.max(1, Math.min(WINDOW_DAYS - offset, Math.round((end - start) / DAY_MS)));
              const deps = depsByTask.get(task.id) ?? [];
              return (
                <div key={task.id} className="flex items-center border-b border-border/60">
                  <button
                    type="button"
                    onClick={() => onOpenTask(task.id)}
                    className="w-64 shrink-0 space-y-0.5 border-r border-border px-3 py-2 text-left hover:bg-accent/40"
                  >
                    <div className="flex items-center gap-2">
                      <TaskCode code={task.code} />
                      {task.status === "completed" ? (
                        <CheckCircle className="h-3 w-3 text-muted-foreground" />
                      ) : sla.state === "breached" ? (
                        <AlertTriangle className="h-3 w-3 text-destructive" />
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-foreground">{task.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {task.assignee?.full_name ?? "Unassigned"}
                      {deps.length > 0 && (
                        <span className="ml-1 inline-flex items-center gap-1">
                          <GitBranch className="h-3 w-3" /> {deps.join(", ")}
                        </span>
                      )}
                    </p>
                  </button>
                  <div className="relative flex h-14 flex-1 items-center">
                    {days.map((day) => (
                      <div key={day} className="h-full flex-1 border-r border-border/30" />
                    ))}
                    <div
                      className={`absolute flex h-6 items-center rounded px-2 ${TONE[tone]}`}
                      style={{ left: `${(offset / WINDOW_DAYS) * 100}%`, width: `${(span / WINDOW_DAYS) * 100}%` }}
                      title={`${task.code} • ${task.progress}% • ${sla.label}`}
                    >
                      <span className="truncate text-[10px] font-medium text-foreground">{task.progress}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {bars.length === 0 && <TMEmpty message="No tasks in this window" />}
          </div>
        </div>
      </TMPanel>

      <TMPanel title="Timeline flags" icon={<AlertTriangle className="h-4 w-4" />}>
        <div className="flex flex-wrap gap-2">
          {bars
            .filter((row) => row.tone === "breached" || row.tone === "at_risk")
            .map(({ task, sla }) => (
              <button
                key={task.id}
                type="button"
                onClick={() => onOpenTask(task.id)}
                className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-left text-xs hover:bg-accent/40"
              >
                <TaskCode code={task.code} />
                <span className="ml-2 text-foreground">{task.title}</span>
                <Badge variant="outline" className="ml-2">{sla.label}</Badge>
              </button>
            ))}
          {bars.every((row) => row.tone !== "breached" && row.tone !== "at_risk") && (
            <TMEmpty message="No timeline risks in this window" />
          )}
        </div>
      </TMPanel>
    </div>
  );
}
