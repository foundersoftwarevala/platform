import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/* ---------------------------------------------------------------- headers */

export function ScreenHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("glass-panel border-border/50 p-5", className)}>
      {(title ?? actions) ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title ? <h2 className="text-base font-semibold text-foreground">{title}</h2> : null}
            {description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </Card>
  );
}

/* ------------------------------------------------------------- stat cards */

export type StatTone = "violet" | "blue" | "teal" | "green" | "gold" | "rose";

const toneRing: Record<StatTone, string> = {
  violet: "text-aurora-violet bg-aurora-violet/10 ring-aurora-violet/20",
  blue: "text-aurora-blue bg-aurora-blue/10 ring-aurora-blue/20",
  teal: "text-aurora-teal bg-aurora-teal/10 ring-aurora-teal/20",
  green: "text-aurora-green bg-aurora-green/10 ring-aurora-green/20",
  gold: "text-aurora-gold bg-aurora-gold/10 ring-aurora-gold/20",
  rose: "text-aurora-rose bg-aurora-rose/10 ring-aurora-rose/20",
};

export function StatCard({
  label,
  value,
  sublabel,
  delta,
  icon: Icon,
  tone = "violet",
  index = 0,
}: {
  label: string;
  value: string;
  sublabel?: string;
  delta?: number;
  icon: LucideIcon;
  tone?: StatTone;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card className="glass-panel border-border/50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
            {sublabel ? <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p> : null}
          </div>
          <span className={cn("rounded-xl p-2.5 ring-1", toneRing[tone])}>
            <Icon className="h-5 w-5" />
          </span>
        </div>
        {typeof delta === "number" ? (
          <p
            className={cn(
              "mt-3 text-xs font-medium",
              delta >= 0 ? "text-status-success" : "text-status-error",
            )}
          >
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}% vs previous period
          </p>
        ) : null}
      </Card>
    </motion.div>
  );
}

/* ----------------------------------------------------------- status badge */

const statusTone: Record<string, string> = {
  active: "bg-status-success/15 text-status-success ring-status-success/30",
  published: "bg-status-success/15 text-status-success ring-status-success/30",
  approved: "bg-status-success/15 text-status-success ring-status-success/30",
  compliant: "bg-status-success/15 text-status-success ring-status-success/30",
  ready: "bg-status-success/15 text-status-success ring-status-success/30",
  sent: "bg-status-success/15 text-status-success ring-status-success/30",
  accepted: "bg-status-success/15 text-status-success ring-status-success/30",
  on_track: "bg-status-success/15 text-status-success ring-status-success/30",
  completed: "bg-aurora-blue/15 text-aurora-blue ring-aurora-blue/30",
  scheduled: "bg-aurora-blue/15 text-aurora-blue ring-aurora-blue/30",
  sending: "bg-aurora-blue/15 text-aurora-blue ring-aurora-blue/30",
  tracking: "bg-aurora-blue/15 text-aurora-blue ring-aurora-blue/30",
  new: "bg-aurora-blue/15 text-aurora-blue ring-aurora-blue/30",
  pending: "bg-status-warning/15 text-status-warning ring-status-warning/30",
  in_review: "bg-status-warning/15 text-status-warning ring-status-warning/30",
  paused: "bg-status-warning/15 text-status-warning ring-status-warning/30",
  attention: "bg-status-warning/15 text-status-warning ring-status-warning/30",
  at_risk: "bg-status-warning/15 text-status-warning ring-status-warning/30",
  watch: "bg-status-warning/15 text-status-warning ring-status-warning/30",
  warning: "bg-status-warning/15 text-status-warning ring-status-warning/30",
  opportunity: "bg-aurora-gold/15 text-aurora-gold ring-aurora-gold/30",
  under_spent: "bg-aurora-gold/15 text-aurora-gold ring-aurora-gold/30",
  rejected: "bg-status-error/15 text-status-error ring-status-error/30",
  critical: "bg-status-error/15 text-status-error ring-status-error/30",
  dismissed: "bg-muted text-muted-foreground ring-border",
  archived: "bg-muted text-muted-foreground ring-border",
  draft: "bg-muted text-muted-foreground ring-border",
  info: "bg-aurora-cyan/15 text-aurora-cyan ring-aurora-cyan/30",
};

export function StatusBadge({ value, className }: { value: string | null; className?: string }) {
  const key = (value ?? "").toLowerCase();
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-0 font-medium capitalize ring-1",
        statusTone[key] ?? "bg-secondary text-secondary-foreground ring-border",
        className,
      )}
    >
      {(value ?? "—").replace(/_/g, " ")}
    </Badge>
  );
}

/* --------------------------------------------------------------- states */

export function LoadingState({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function InlineSpinner() {
  return <Loader2 className="h-4 w-4 animate-spin" />;
}

/**
 * Renders the right state for a live query: skeleton, error, empty or content.
 */
export function QueryState<T>({
  isLoading,
  error,
  data,
  emptyMessage = "No records yet.",
  skeletonRows,
  children,
}: {
  isLoading: boolean;
  error: unknown;
  data: T[] | undefined;
  emptyMessage?: string;
  skeletonRows?: number;
  children: (rows: T[]) => ReactNode;
}) {
  if (isLoading) return <LoadingState {...(skeletonRows ? { rows: skeletonRows } : {})} />;
  if (error)
    return <ErrorState message={error instanceof Error ? error.message : "Failed to load data."} />;
  if (!data || data.length === 0) return <EmptyState message={emptyMessage} />;
  return <>{children(data)}</>;
}

/* ----------------------------------------------------------- misc pieces */

export function ProgressBar({
  value,
  max,
  tone = "violet",
}: {
  value: number;
  max: number;
  tone?: StatTone;
}) {
  const percentage = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const bar: Record<StatTone, string> = {
    violet: "bg-aurora-violet",
    blue: "bg-aurora-blue",
    teal: "bg-aurora-teal",
    green: "bg-aurora-green",
    gold: "bg-aurora-gold",
    rose: "bg-aurora-rose",
  };
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
      <div className={cn("h-full rounded-full transition-all", bar[tone])} style={{ width: `${percentage}%` }} />
    </div>
  );
}

export const CHART_COLORS = [
  "hsl(var(--aurora-violet))",
  "hsl(var(--aurora-blue))",
  "hsl(var(--aurora-teal))",
  "hsl(var(--aurora-green))",
  "hsl(var(--aurora-gold))",
  "hsl(var(--aurora-rose))",
  "hsl(var(--aurora-cyan))",
];

export const chartAxisProps = {
  stroke: "hsl(var(--muted-foreground))",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
};

export const chartTooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "0.75rem",
  color: "hsl(var(--popover-foreground))",
  fontSize: "12px",
};
