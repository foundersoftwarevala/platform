import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BellRing, Clock, PauseCircle, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { computeSLA, PRIORITY_LABELS, relativeTime } from "@/lib/tm/format";
import { useClaimTask, useSettings, useTasks } from "@/lib/tm/hooks";
import type { TMTask } from "@/lib/tm/types";

/**
 * The buzzer, wherever the person happens to be looking.
 *
 * Section 5 asks for the eligible user's browser to receive the alert - not for
 * a list that is only alarming while you are already standing on the Buzzer
 * Alerts screen. Previously the sound lived inside that one screen, so a
 * developer working on Task Execution, or sitting on the dashboard, heard
 * nothing at all. This mounts once in the shell and follows them across all
 * twenty-one screens.
 *
 * What a person sees is bounded by row-level security, not by anything decided
 * here: the query returns unassigned work plus their own, so "eligible" is
 * enforced by the database rather than by a filter in the browser that a
 * determined client could ignore.
 *
 * Three channels, because section 5 lists three. The panel is the visual alert.
 * The oscillator is the audible one. The browser notification is raised only
 * where permission already exists - asking for it unprompted on page load is
 * the kind of thing people permanently deny, so the request is attached to the
 * person's own click on the sound control instead.
 */

function useAlarm(enabled: boolean, count: number, repeatMinutes: number) {
  const last = useRef(0);
  useEffect(() => {
    if (!enabled || count === 0) return;
    const gap = Math.max(1, repeatMinutes) * 60_000;
    if (Date.now() - last.current < gap) return;
    last.current = Date.now();
    try {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 880;
      gain.gain.value = 0.05;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      osc.onended = () => void ctx.close();
    } catch {
      /* audio unavailable - the panel and the notification still stand */
    }
  }, [enabled, count, repeatMinutes]);
}

function useBrowserNotice(tasks: TMTask[]) {
  const announced = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    for (const task of tasks) {
      if (announced.current.has(task.id)) continue;
      announced.current.add(task.id);
      try {
        const notice = new Notification(`${task.code} needs someone`, {
          body: `${task.title}\n${PRIORITY_LABELS[task.priority] ?? task.priority} priority`,
          tag: task.id,
        });
        notice.onclick = () => {
          window.focus();
          notice.close();
        };
      } catch {
        /* the browser refused it; the panel is still on screen */
      }
    }

    // Forget tasks that stopped buzzing, so a task that buzzes again later
    // still raises a fresh notification.
    const live = new Set(tasks.map((t) => t.id));
    for (const id of Array.from(announced.current)) {
      if (!live.has(id)) announced.current.delete(id);
    }
  }, [tasks]);
}

export function TaskBuzzerAlert({ onOpenTask }: { onOpenTask?: (taskId: string) => void }) {
  const { data: tasks } = useTasks();
  const { data: settings } = useSettings();
  const claim = useClaimTask();
  const [muted, setMuted] = useState(false);
  const [dismissed, setDismissed] = useState<Record<string, number>>({});

  const buzzing = useMemo(
    () =>
      (tasks ?? []).filter(
        (t) => t.buzzer_active && (dismissed[t.id] ?? 0) < Date.now(),
      ),
    [tasks, dismissed],
  );

  useAlarm(
    !muted && (settings?.buzzer_enabled ?? true),
    buzzing.length,
    settings?.buzzer_repeat_minutes ?? 10,
  );
  useBrowserNotice(buzzing);

  const askForNotifications = useCallback(() => {
    setMuted((m) => !m);
    // Attached to a real click, which is the only time browsers treat the
    // request as anything other than a nuisance.
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") void Notification.requestPermission();
    }
  }, []);

  if (buzzing.length === 0) return null;
  const task = buzzing[0];
  const sla = computeSLA(task, settings?.sla_warning_percent ?? 75);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 w-[min(24rem,calc(100vw-2rem))]">
      <div className="pointer-events-auto rounded-xl border border-destructive/50 bg-destructive/10 p-4 shadow-lg backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <BellRing className="h-4 w-4 shrink-0 animate-pulse text-destructive" />
            <span className="text-sm font-semibold text-foreground">
              {buzzing.length === 1 ? "A task needs someone" : `${buzzing.length} tasks need someone`}
            </span>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 shrink-0"
            aria-label="Dismiss this alert for now"
            onClick={() => setDismissed((d) => ({ ...d, [task.id]: Date.now() + 5 * 60_000 }))}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="mt-2 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="font-mono text-[11px]">{task.code}</Badge>
            <Badge variant="outline">{PRIORITY_LABELS[task.priority] ?? task.priority}</Badge>
            {task.escalation_level > 0 && (
              <Badge variant="outline">Level {task.escalation_level}</Badge>
            )}
          </div>
          <p className="truncate text-sm text-foreground">{task.title}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {sla.label} · raised {relativeTime(task.updated_at)}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={claim.isPending}
            onClick={() => claim.mutate(task.id)}
          >
            {claim.isPending ? "Claiming…" : "Claim"}
          </Button>
          {onOpenTask && (
            <Button size="sm" variant="outline" onClick={() => onOpenTask(task.id)}>
              Open
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={askForNotifications}
            aria-label={muted ? "Unmute the buzzer" : "Mute the buzzer"}
          >
            <PauseCircle className="mr-1 h-3.5 w-3.5" />
            {muted ? "Unmute" : "Mute"}
          </Button>
        </div>
      </div>
    </div>
  );
}
