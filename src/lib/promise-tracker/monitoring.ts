import { supabase } from "@/integrations/supabase/client";

/**
 * Production monitoring for the Promise Tracker.
 *
 * Every realtime disruption, failed backend mutation and failed audit-log write
 * is persisted to `promise_health_events` so operators can see failures inside
 * the app (Settings → System health) instead of only in a browser console.
 */
export type HealthSource = "realtime" | "mutation" | "audit-log" | "query";
export type HealthLevel = "info" | "warning" | "error";

export type HealthReport = {
  source: HealthSource;
  level?: HealthLevel;
  event: string;
  message: string;
  context?: Record<string, unknown>;
};

const DEDUPE_WINDOW_MS = 30_000;
const recent = new Map<string, number>();

function shouldSkip(key: string) {
  const now = Date.now();
  for (const [entry, at] of recent) {
    if (now - at > DEDUPE_WINDOW_MS) recent.delete(entry);
  }
  const last = recent.get(key);
  recent.set(key, now);
  return last !== undefined && now - last < DEDUPE_WINDOW_MS;
}

/** Records a health event. Never throws — monitoring must not break the app. */
export async function reportHealth(report: HealthReport): Promise<void> {
  const level = report.level ?? "error";
  const key = `${report.source}:${report.event}:${report.message}`;

  if (level === "error") {
    console.error(`[promise-tracker:${report.source}] ${report.event} — ${report.message}`);
  }

  if (shouldSkip(key)) return;

  try {
    const { error } = await supabase.from("promise_health_events").insert({
      source: report.source,
      level,
      event: report.event,
      message: report.message.slice(0, 2000),
      context: (report.context ?? {}) as never,
    });
    if (error) {
      console.error("[promise-tracker:monitoring] failed to persist health event", error);
    }
  } catch (error) {
    console.error("[promise-tracker:monitoring] failed to persist health event", error);
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export const HEALTH_LEVEL_META: Record<string, { label: string; className: string }> = {
  info: { label: "Info", className: "bg-info/15 text-info border-info/30" },
  warning: { label: "Warning", className: "bg-warning/15 text-warning border-warning/30" },
  error: { label: "Error", className: "bg-destructive/15 text-destructive border-destructive/30" },
};
