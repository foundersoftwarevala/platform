import type { ComponentType, ReactNode } from "react";
import { Activity, AlertCircle, Inbox, Sparkles, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/* ---------------------------------- shell --------------------------------- */

export function SectionShell({
  title,
  description,
  icon: Icon,
  actions,
  children,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon | ComponentType<{ className?: string }>;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-6">
      {/* Premium hero banner — one per screen */}
      <header className="hero-surface relative overflow-hidden p-5 sm:p-7 lg:p-8">
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-accent-pink/40 blur-3xl" />

        <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:flex-wrap sm:justify-between">
          <div className="min-w-0">
            {Icon ? (
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[11px] font-medium backdrop-blur">
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{title}</span>
              </div>
            ) : null}
            <h2 className="mt-3 truncate text-2xl font-semibold tracking-tight sm:text-3xl lg:text-[32px]">
              {title}
            </h2>
            {description ? (
              <p className="mt-1.5 max-w-2xl text-sm text-primary-foreground/80 sm:text-[15px]">
                {description}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-medium">
                <Activity className="h-3 w-3" aria-hidden="true" />
                Live finance data
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-medium">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                Software Vala Finance Manager
              </span>
            </div>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </header>
      {children}
    </section>
  );
}

/* --------------------------------- metrics -------------------------------- */

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  loading,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon | ComponentType<{ className?: string }>;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  loading?: boolean;
}) {
  const toneClass = {
    default: "text-primary-glow",
    success: "text-accent-emerald",
    warning: "text-accent-amber",
    danger: "text-destructive",
    info: "text-primary-glow",
  }[tone];

  return (
    <div className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        {Icon ? <Icon className={cn("h-4 w-4 shrink-0", toneClass)} /> : null}
      </div>
      {loading ? (
        <Skeleton className="skeleton-shimmer mt-2 h-7 w-28" />
      ) : (
        <p className="mt-1 break-words text-xl font-bold leading-tight text-foreground">{value}</p>
      )}
      {hint ? <p className="mt-2 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">{children}</div>;
}


/* -------------------------------- status ---------------------------------- */

const STATUS_TONES: Record<string, string> = {
  active: "bg-success/15 text-success border-success/30",
  completed: "bg-success/15 text-success border-success/30",
  success: "bg-success/15 text-success border-success/30",
  paid: "bg-success/15 text-success border-success/30",
  approved: "bg-success/15 text-success border-success/30",
  resolved: "bg-success/15 text-success border-success/30",
  processed: "bg-success/15 text-success border-success/30",
  reimbursed: "bg-success/15 text-success border-success/30",
  filed: "bg-success/15 text-success border-success/30",
  sent: "bg-info/15 text-info border-info/30",
  processing: "bg-info/15 text-info border-info/30",
  investigating: "bg-info/15 text-info border-info/30",
  acknowledged: "bg-info/15 text-info border-info/30",
  credit: "bg-success/15 text-success border-success/30",
  debit: "bg-destructive/15 text-destructive border-destructive/30",
  pending: "bg-warning/15 text-warning border-warning/30",
  partial: "bg-warning/15 text-warning border-warning/30",
  on_hold: "bg-warning/15 text-warning border-warning/30",
  draft: "bg-muted text-muted-foreground border-border",
  paused: "bg-warning/15 text-warning border-warning/30",
  open: "bg-warning/15 text-warning border-warning/30",
  overdue: "bg-destructive/15 text-destructive border-destructive/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
  expired: "bg-destructive/15 text-destructive border-destructive/30",
  frozen: "bg-destructive/15 text-destructive border-destructive/30",
  reversed: "bg-destructive/15 text-destructive border-destructive/30",
  disabled: "bg-muted text-muted-foreground border-border",
  false_positive: "bg-muted text-muted-foreground border-border",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  info: "bg-info/15 text-info border-info/30",
};

export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  const key = (status ?? "").toLowerCase();
  return (
    <Badge
      variant="outline"
      className={cn("capitalize", STATUS_TONES[key] ?? "bg-muted text-muted-foreground border-border", className)}
    >
      {(status ?? "unknown").replace(/_/g, " ")}
    </Badge>
  );
}

/* ------------------------------ table wrapper ------------------------------ */

export function PanelCard({
  title,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bento-card premium-halo enter-soft !p-0", className)}>
      {title ? (
        <div className="flex flex-row items-center justify-between gap-3 px-5 pb-3 pt-5">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn("px-5 pb-5", title ? "pt-0" : "pt-5")}>{children}</div>
    </div>
  );

}

export function QueryState({
  isLoading,
  error,
  isEmpty,
  emptyLabel = "No records yet",
  rows = 5,
  children,
}: {
  isLoading: boolean;
  error?: unknown;
  isEmpty?: boolean;
  emptyLabel?: string;
  rows?: number;
  children: ReactNode;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="skeleton-shimmer h-10 w-full" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <AlertCircle className="h-4 w-4" />
        {error instanceof Error ? error.message : "Could not load data"}
      </div>
    );
  }
  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-10 text-center">
        <Inbox className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }
  return <>{children}</>;
}
