import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  PRIORITY_CLASSES,
  PRIORITY_LABELS,
  STATUS_CLASSES,
  STATUS_LABELS,
  computeSLA,
} from "@/lib/tm/format";
import type { TMTask, TMTaskPriority, TMTaskStatus } from "@/lib/tm/types";

/** Premium screen banner shared by every Task Manager screen. */
export function TMPageHeader({
  title,
  subtitle,
  actions,
  badge,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <section className="hero-surface enter-soft relative overflow-hidden p-5 sm:p-7 lg:p-8">
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-accent-pink/30 blur-3xl" />

      <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[11px] font-medium backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> {badge ?? "Task Operations"}
          </div>
          <h1 className="mt-3 truncate text-2xl font-semibold tracking-tight sm:text-3xl lg:text-[34px]">
            {title}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-primary-foreground/80 sm:text-[15px]">{subtitle}</p>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}

export function TMPanel({
  title,
  icon,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("bento-card premium-halo enter-soft border-0 !p-0", className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
          {icon}
          {title}
        </CardTitle>
        {actions}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function TMStat({
  label,
  value,
  icon,
  onClick,
  tone = "default",
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  onClick?: () => void;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}) {
  const toneClass = {
    default: "text-primary-glow",
    success: "text-accent-emerald",
    warning: "text-accent-amber",
    danger: "text-destructive",
    info: "text-info",
  }[tone];

  return (
    <Card
      className={cn(
        "bento-card premium-halo hover-lift shimmer-sweep enter-soft border-0 !p-4",
        onClick && "cursor-pointer",
      )}
      onClick={onClick}
    >
      <CardContent className="p-0">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <span className={cn("shrink-0 [&_svg]:h-4 [&_svg]:w-4", toneClass)}>{icon}</span>
        </div>
        <p className="mt-1 truncate text-2xl font-bold tracking-tight text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

export function StatusBadge({ status }: { status: TMTaskStatus }) {
  return (
    <Badge variant="outline" className={cn("border", STATUS_CLASSES[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: TMTaskPriority }) {
  return (
    <Badge variant="outline" className={cn("border", PRIORITY_CLASSES[priority])}>
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}

export function SLABadge({
  task,
  warningPercent = 75,
}: {
  task: Pick<TMTask, "status" | "created_at" | "promised_at" | "deadline" | "completed_at" | "sla_hours">;
  warningPercent?: number;
}) {
  const sla = computeSLA(task, warningPercent);
  return <span className={cn("text-xs font-medium", sla.className)}>{sla.label}</span>;
}

export function TaskCode({ code }: { code: string }) {
  return <span className="font-mono text-xs text-muted-foreground">{code}</span>;
}

export function TMEmpty({ message }: { message: string }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{message}</p>;
}

export function TMLoading({ label = "Loading" }: { label?: string }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{label}…</p>;
}

export function TMRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "focus-glow flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface/60 p-4 transition-colors hover:border-primary/35 hover:bg-surface",
        className,
      )}
    >
      {children}
    </div>
  );
}
