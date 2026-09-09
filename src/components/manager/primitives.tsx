import type { ReactNode } from "react";
import { AlertCircle, Inbox, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  delta,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string | number;
  delta?: string | undefined;
  icon?: LucideIcon | undefined;
  hint?: string | undefined;
}) {
  const positive = delta?.startsWith("+");
  return (
    <div className="bento-card hover-lift !p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        {Icon ? <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-primary-glow" /> : null}
      </div>
      <p className="numeric mt-1 truncate text-xl font-bold text-foreground">{value}</p>
      <div className="mt-2 flex items-center gap-2 text-[11px]">
        {delta ? (
          <span
            className={cn("font-medium", positive ? "text-accent-emerald" : "text-accent-pink")}
          >
            {delta}
          </span>
        ) : null}
        {hint ? <span className="text-muted-foreground">{hint}</span> : null}
      </div>
    </div>
  );
}

const TONES: Record<string, string> = {
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-destructive/15 text-destructive",
  info: "bg-info/15 text-info",
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary/15 text-primary",
};

export type Tone = keyof typeof TONES;

export function toneForStatus(status: string): Tone {
  const value = status.toLowerCase();
  if (
    [
      "active",
      "indexed",
      "pass",
      "published",
      "resolved",
      "connected",
      "success",
      "ready",
      "positive",
      "replied",
      "qualified",
      "tracking",
    ].some((s) => value.includes(s))
  )
    return "success";
  if (
    [
      "warn",
      "pending",
      "review",
      "scheduled",
      "paused",
      "in_progress",
      "draft",
      "generating",
      "rendering",
      "medium",
      "unread",
    ].some((s) => value.includes(s))
  )
    return "warning";
  if (
    [
      "fail",
      "critical",
      "high",
      "toxic",
      "open",
      "error",
      "lost",
      "negative",
      "escalated",
      "blocked",
      "not_indexed",
      "excluded",
    ].some((s) => value.includes(s))
  )
    return "danger";
  if (["info", "low", "new", "discovered"].some((s) => value.includes(s))) return "info";
  return "neutral";
}

export function StatusPill({ value, tone }: { value: string; tone?: Tone | undefined }) {
  const resolved = tone ?? toneForStatus(value);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        TONES[resolved],
      )}
    >
      {value.replace(/[_-]/g, " ")}
    </span>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string | undefined;
  description?: string | undefined;
  actions?: ReactNode | undefined;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <div className={cn("panel overflow-hidden", className)}>
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold leading-none">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading data…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" aria-hidden="true" />
      ))}
    </div>
  );
}

/** Per-screen banner header — gradient hero surface, used on every screen. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string | undefined;
  actions?: ReactNode | undefined;
}) {
  return (
    <header className="hero-surface relative overflow-hidden px-5 py-6 sm:px-7 sm:py-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40 bg-[radial-gradient(60%_120%_at_85%_0%,rgba(255,255,255,0.35),transparent_60%)]"
      />
      <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold sm:text-3xl lg:text-[34px]">{title}</h1>
          {description ? (
            <p className="mt-1.5 max-w-2xl text-sm text-primary-foreground/80 sm:text-[15px]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap justify-end gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}

export function GlassCard({
  title,
  icon,
  actions,
  children,
  className,
}: {
  title?: string | undefined;
  icon?: ReactNode | undefined;
  actions?: ReactNode | undefined;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <Card className={cn("bento-card p-0", className)}>
      {title ? (
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <CardTitle className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
            {icon}
            {title}
          </CardTitle>
          {actions}
        </CardHeader>
      ) : null}
      <CardContent className={title ? "" : "pt-5 sm:pt-6"}>{children}</CardContent>
    </Card>
  );
}

const STAT_TONES: Record<string, string> = {
  primary: "from-primary to-primary-glow",
  cyan: "from-neon-cyan to-neon-teal",
  green: "from-neon-green to-neon-teal",
  amber: "from-neon-gold to-neon-orange",
  red: "from-neon-red to-neon-pink",
  violet: "from-accent-pink to-primary-glow",
  slate: "from-muted to-secondary",
};

export type StatTone = keyof typeof STAT_TONES;

export function StatCard({
  label,
  value,
  icon,
  change,
  tone = "primary",
  loading,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode | undefined;
  change?: string | undefined;
  tone?: StatTone | undefined;
  loading?: boolean | undefined;
}) {
  const positive = change?.startsWith("+");
  return (
    <Card className="bento-card hover-lift p-0">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div
            className={cn(
              "rounded-xl bg-gradient-to-br p-2.5 text-primary-foreground shadow-[0_10px_24px_-14px_var(--color-primary)]",
              STAT_TONES[tone] ?? STAT_TONES["primary"],
            )}
          >
            {icon}
          </div>
          {change ? (
            <Badge
              variant="outline"
              className={cn(
                "text-xs",
                positive
                  ? "border-status-success/40 text-status-success"
                  : "border-status-error/40 text-status-error",
              )}
            >
              {change}
            </Badge>
          ) : null}
        </div>
        <div className="mt-4">
          {loading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <p className="text-2xl font-semibold text-foreground">{value}</p>
          )}
          <p className="mt-1 text-xs font-medium text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

const STATUS_TONE: Record<string, string> = {
  active: "border-status-success/40 bg-status-success/15 text-status-success",
  healthy: "border-status-success/40 bg-status-success/15 text-status-success",
  online: "border-status-success/40 bg-status-success/15 text-status-success",
  enabled: "border-status-success/40 bg-status-success/15 text-status-success",
  operational: "border-status-success/40 bg-status-success/15 text-status-success",
  resolved: "border-status-success/40 bg-status-success/15 text-status-success",
  paid: "border-status-success/40 bg-status-success/15 text-status-success",
  passed: "border-status-success/40 bg-status-success/15 text-status-success",
  succeeded: "border-status-success/40 bg-status-success/15 text-status-success",
  completed: "border-status-success/40 bg-status-success/15 text-status-success",
  production: "border-status-success/40 bg-status-success/15 text-status-success",
  stable: "border-status-success/40 bg-status-success/15 text-status-success",
  warning: "border-status-warning/40 bg-status-warning/15 text-status-warning",
  degraded: "border-status-warning/40 bg-status-warning/15 text-status-warning",
  pending: "border-status-warning/40 bg-status-warning/15 text-status-warning",
  investigating: "border-status-warning/40 bg-status-warning/15 text-status-warning",
  running: "border-status-warning/40 bg-status-warning/15 text-status-warning",
  training: "border-status-warning/40 bg-status-warning/15 text-status-warning",
  review: "border-status-warning/40 bg-status-warning/15 text-status-warning",
  beta: "border-status-warning/40 bg-status-warning/15 text-status-warning",
  overdue: "border-status-error/40 bg-status-error/15 text-status-error",
  critical: "border-status-error/40 bg-status-error/15 text-status-error",
  error: "border-status-error/40 bg-status-error/15 text-status-error",
  down: "border-status-error/40 bg-status-error/15 text-status-error",
  failed: "border-status-error/40 bg-status-error/15 text-status-error",
  revoked: "border-status-error/40 bg-status-error/15 text-status-error",
  blocked: "border-status-error/40 bg-status-error/15 text-status-error",
  open: "border-status-error/40 bg-status-error/15 text-status-error",
  suspended: "border-status-error/40 bg-status-error/15 text-status-error",
  high: "border-status-error/40 bg-status-error/15 text-status-error",
  retired: "border-border/60 bg-muted/40 text-muted-foreground",
  inactive: "border-border/60 bg-muted/40 text-muted-foreground",
  disabled: "border-border/60 bg-muted/40 text-muted-foreground",
  archived: "border-border/60 bg-muted/40 text-muted-foreground",
  draft: "border-border/60 bg-muted/40 text-muted-foreground",
  deprecated: "border-status-warning/40 bg-status-warning/15 text-status-warning",
};

export function StatusBadge({
  value,
  className,
}: {
  value?: string | null | undefined;
  className?: string | undefined;
}) {
  const key = (value ?? "unknown").toLowerCase();
  return (
    <Badge
      variant="outline"
      className={cn(
        "capitalize",
        STATUS_TONE[key] ?? "border-status-info/40 bg-status-info/15 text-status-info",
        className,
      )}
    >
      {value ?? "unknown"}
    </Badge>
  );
}

export function LoadingBlock({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2.5" role="status" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
    </div>
  );
}

export function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: ReactNode | undefined;
}) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center px-6 py-12 text-center sm:py-16">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary">
        <Inbox className="h-5 w-5" aria-hidden />
      </div>
      <p className="text-sm font-medium text-foreground">Nothing here yet</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  return (
    <div
      role="alert"
      className="bento-card flex min-h-56 flex-col items-center justify-center border-destructive/40 px-6 py-12 text-center text-sm text-destructive"
    >
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-destructive/15">
        <AlertCircle className="h-5 w-5" aria-hidden />
      </div>
      <p className="font-semibold">Something went wrong</p>
      <p className="mt-1 text-destructive/90">
        {error instanceof Error ? error.message : "Failed to load data"}
      </p>
    </div>
  );
}

/** Wraps query state into loading / error / empty / content. */
export function QueryBoundary<T>({
  query,
  empty = "No records yet",
  children,
}: {
  query: { data?: T[] | undefined; isLoading: boolean; error: unknown };
  empty?: string | undefined;
  children: (rows: T[]) => ReactNode;
}) {
  if (query.isLoading) return <LoadingBlock />;
  if (query.error) {
    if (typeof console !== "undefined") console.error("[manager] query failed", query.error);
    return <ErrorState error={query.error} />;
  }
  const rows = query.data ?? [];
  if (rows.length === 0) return <EmptyState message={empty} />;
  return <>{children(rows)}</>;
}

export const nf = new Intl.NumberFormat("en-US");
export const cf = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export const inr = (n: number | null | undefined) =>
  `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export const usd = (n: number | null | undefined) =>
  `$${Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export const num = (n: number | null | undefined) => Number(n ?? 0).toLocaleString("en-IN");

export const when = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "—";

export const day = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—";

export function downloadRows(filename: string, rows: Record<string, unknown>[]) {
  if (typeof document === "undefined") return;
  if (rows.length === 0) return;
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const csv = [
    columns.join(","),
    ...rows.map((row) =>
      columns
        .map((column) => {
          const v = row[column];
          const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
          return `"${s.replace(/"/g, '""')}"`;
        })
        .join(","),
    ),
  ].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
