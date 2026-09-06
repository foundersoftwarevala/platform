import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellRing, Volume2, VolumeX, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { relativeTime, titleCase } from "@/lib/tm/format";
import {
  useAcknowledgeBuzzer,
  useAssignTask,
  useChangeStatus,
  useMembers,
  useNow,
  useSetBuzzer,
  useSettings,
  useTasks,
} from "@/lib/tm/hooks";
import { computeSLA } from "@/lib/tm/format";
import { PriorityBadge, SLABadge, StatusBadge, TMEmpty, TMLoading, TMPageHeader, TMPanel, TMRow, TaskCode } from "../shared";

/** Short beep generated with WebAudio — no external asset, only fires on real active buzzers. */
function useBeep(enabled: boolean, trigger: number, repeatMinutes: number) {
  const last = useRef(0);
  useEffect(() => {
    if (!enabled || trigger === 0) return;
    const gap = Math.max(1, repeatMinutes) * 60_000;
    if (Date.now() - last.current < gap) return;
    last.current = Date.now();
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 880;
      gain.gain.value = 0.04;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
      osc.onended = () => void ctx.close();
    } catch {
      /* audio unavailable — visual buzzer still active */
    }
  }, [enabled, trigger, repeatMinutes]);
}

export function TMBuzzer({ onOpenTask }: { onOpenTask: (taskId: string) => void }) {
  const { data: tasks, isLoading } = useTasks();
  const { data: members } = useMembers();
  const { data: settings } = useSettings();
  const acknowledge = useAcknowledgeBuzzer();
  const setBuzzer = useSetBuzzer();
  const assign = useAssignTask();
  const changeStatus = useChangeStatus();
  const [sound, setSound] = useState(true);
  const now = useNow(15_000);
  const warn = settings?.sla_warning_percent ?? 75;

  const active = useMemo(() => (tasks ?? []).filter((t) => t.buzzer_active), [tasks]);
  const candidates = useMemo(
    () =>
      (tasks ?? []).filter(
        (t) =>
          !t.buzzer_active &&
          t.status !== "completed" &&
          t.status !== "cancelled" &&
          (t.priority === "critical" || computeSLA(t, warn).state === "breached" || (!t.assigned_to && t.priority === "high")),
      ),
    [tasks, warn, now],
  );

  useBeep(sound && (settings?.buzzer_enabled ?? true), active.length, settings?.buzzer_repeat_minutes ?? 10);

  if (isLoading) return <TMLoading label="Loading buzzer alerts" />;

  return (
    <div className="space-y-6">
      <TMPageHeader
        title="Buzzer Alert System"
        subtitle="Unmissable alerts for critical and unaccepted work"
        actions={
          <div className="flex items-center gap-3">
            <Badge variant="outline">{settings?.buzzer_repeat_minutes ?? 10} min repeat</Badge>
            <div className="flex items-center gap-2">
              {sound ? <Volume2 className="h-4 w-4 text-muted-foreground" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
              <Switch checked={sound} onCheckedChange={setSound} aria-label="Buzzer sound" />
            </div>
          </div>
        }
      />

      <TMPanel
        title="Active buzzers"
        icon={<BellRing className={`h-4 w-4 ${active.length ? "animate-pulse text-destructive" : ""}`} />}
        actions={<Badge variant="outline">{active.length}</Badge>}
      >
        <div className="space-y-3">
          {active.map((task) => (
            <TMRow key={task.id} className="border-destructive/40 bg-destructive/10">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <TaskCode code={task.code} />
                  <PriorityBadge priority={task.priority} />
                  <StatusBadge status={task.status} />
                  <Badge variant="outline">Level {task.escalation_level}</Badge>
                </div>
                <p className="truncate text-sm text-foreground">{task.title}</p>
                <p className="text-xs text-muted-foreground">
                  Raised {relativeTime(task.updated_at)} • {task.assignee?.full_name ?? "Unassigned"} • <SLABadge task={task} warningPercent={warn} />
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" disabled={acknowledge.isPending} onClick={() => acknowledge.mutate(task.id)}>
                  Acknowledge
                </Button>
                {!task.assigned_to && (members ?? []).length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={assign.isPending}
                    onClick={() => {
                      const member = (members ?? []).find((m) => m.active) ?? (members ?? [])[0];
                      if (member) assign.mutate({ task, memberId: member.id, memberName: member.full_name });
                    }}
                  >
                    Quick assign
                  </Button>
                )}
                {task.status !== "accepted" && task.status !== "in_progress" && (
                  <Button
                    size="sm"
                    disabled={changeStatus.isPending}
                    onClick={() => changeStatus.mutate({ task, status: "accepted", note: "Accepted from buzzer alert" })}
                  >
                    Accept task
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => onOpenTask(task.id)}>Open</Button>
              </div>
            </TMRow>
          ))}
          {active.length === 0 && <TMEmpty message="No buzzers ringing" />}
        </div>
      </TMPanel>

      <TMPanel
        title="Buzzer candidates"
        icon={<Zap className="h-4 w-4" />}
        actions={<Badge variant="outline">{candidates.length}</Badge>}
      >
        <div className="space-y-3">
          {candidates.map((task) => (
            <TMRow key={task.id}>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <TaskCode code={task.code} />
                  <PriorityBadge priority={task.priority} />
                  <StatusBadge status={task.status} />
                </div>
                <p className="truncate text-sm text-foreground">{task.title}</p>
                <p className="text-xs text-muted-foreground">
                  {titleCase(task.category)} • {task.assignee?.full_name ?? "Unassigned"} • <SLABadge task={task} warningPercent={warn} />
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={setBuzzer.isPending}
                  onClick={() => setBuzzer.mutate({ taskId: task.id, active: true })}
                >
                  <Bell className="mr-1 h-3 w-3" /> Raise buzzer
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onOpenTask(task.id)}>Open</Button>
              </div>
            </TMRow>
          ))}
          {candidates.length === 0 && <TMEmpty message="Nothing needs a buzzer right now" />}
        </div>
      </TMPanel>
    </div>
  );
}
