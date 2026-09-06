import type { TMTask, TMTaskPriority, TMTaskStatus } from "./types";

export const STATUS_LABELS: Record<TMTaskStatus, string> = {
  new: "New",
  assigned: "Assigned",
  accepted: "Accepted",
  in_progress: "In Progress",
  ai_review: "AI Review",
  waiting_client: "Waiting Client",
  testing: "Testing",
  blocked: "Blocked",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Token-based classes only — no hardcoded palette colours. */
export const STATUS_CLASSES: Record<TMTaskStatus, string> = {
  new: "bg-info/15 text-info border-info/30",
  assigned: "bg-primary/15 text-primary border-primary/30",
  accepted: "bg-primary/15 text-primary border-primary/30",
  in_progress: "bg-primary/20 text-primary border-primary/40",
  ai_review: "bg-accent/40 text-accent-foreground border-border",
  waiting_client: "bg-warning/15 text-warning border-warning/30",
  testing: "bg-info/15 text-info border-info/30",
  blocked: "bg-destructive/15 text-destructive border-destructive/30",
  on_hold: "bg-muted text-muted-foreground border-border",
  completed: "bg-success/15 text-success border-success/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

export const PRIORITY_LABELS: Record<TMTaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const PRIORITY_CLASSES: Record<TMTaskPriority, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-info/15 text-info border-info/30",
  high: "bg-warning/15 text-warning border-warning/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
};

export function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export function formatMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return `${hours}h ${rest.toString().padStart(2, "0")}m`;
}

export function formatSeconds(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => v.toString().padStart(2, "0")).join(":");
}

export function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function relativeTime(value: string | null): string {
  if (!value) return "—";
  const diffMs = Date.now() - new Date(value).getTime();
  const future = diffMs < 0;
  const mins = Math.floor(Math.abs(diffMs) / 60000);
  const label = (() => {
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  })();
  if (label === "just now") return label;
  return future ? `in ${label}` : `${label} ago`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export type SLAState = "no_sla" | "on_track" | "at_risk" | "breached" | "met" | "missed";

export interface SLAInfo {
  state: SLAState;
  /** 0-100+, percentage of the SLA window consumed. */
  percent: number;
  minutesRemaining: number;
  label: string;
  className: string;
}

const TERMINAL: TMTaskStatus[] = ["completed", "cancelled"];

/**
 * Derives live SLA state from the task's real timestamps. No mock values.
 */
export function computeSLA(task: Pick<TMTask, "status" | "created_at" | "promised_at" | "deadline" | "completed_at" | "sla_hours">, warningPercent = 75): SLAInfo {
  const target = task.deadline ?? task.promised_at;
  if (!target) {
    return {
      state: "no_sla",
      percent: 0,
      minutesRemaining: 0,
      label: "No SLA set",
      className: "text-muted-foreground",
    };
  }

  const start = new Date(task.created_at).getTime();
  const end = new Date(target).getTime();
  const now = TERMINAL.includes(task.status) && task.completed_at ? new Date(task.completed_at).getTime() : Date.now();
  const window = Math.max(end - start, 60_000);
  const percent = Math.round(((now - start) / window) * 100);
  const minutesRemaining = Math.round((end - now) / 60000);

  if (TERMINAL.includes(task.status)) {
    const met = now <= end;
    return {
      state: task.status === "cancelled" ? "no_sla" : met ? "met" : "missed",
      percent: Math.min(percent, 200),
      minutesRemaining,
      label: task.status === "cancelled" ? "Cancelled" : met ? "SLA met" : `Missed by ${formatMinutes(-minutesRemaining)}`,
      className: task.status === "cancelled" ? "text-muted-foreground" : met ? "text-success" : "text-destructive",
    };
  }

  if (minutesRemaining < 0) {
    return {
      state: "breached",
      percent: Math.min(percent, 200),
      minutesRemaining,
      label: `Breached ${formatMinutes(-minutesRemaining)} ago`,
      className: "text-destructive",
    };
  }

  if (percent >= warningPercent) {
    return {
      state: "at_risk",
      percent,
      minutesRemaining,
      label: `${formatMinutes(minutesRemaining)} left`,
      className: "text-warning",
    };
  }

  return {
    state: "on_track",
    percent: Math.max(percent, 0),
    minutesRemaining,
    label: `${formatMinutes(minutesRemaining)} left`,
    className: "text-success",
  };
}

export function isOverdue(task: Pick<TMTask, "status" | "created_at" | "promised_at" | "deadline" | "completed_at" | "sla_hours">): boolean {
  return computeSLA(task).state === "breached";
}

/** Live elapsed working minutes on a task, including the running timer. */
export function liveMinutes(task: Pick<TMTask, "actual_minutes" | "timer_running" | "started_at" | "paused_at">, nowMs = Date.now()): number {
  if (!task.timer_running || !task.started_at) return task.actual_minutes;
  const since = task.paused_at ? new Date(task.paused_at).getTime() : new Date(task.started_at).getTime();
  return task.actual_minutes + Math.max(0, Math.floor((nowMs - since) / 60000));
}