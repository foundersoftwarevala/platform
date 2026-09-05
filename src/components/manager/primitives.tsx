import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
          <span className={cn("font-medium", positive ? "text-accent-emerald" : "text-accent-pink")}>
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
    ["active", "indexed", "pass", "published", "resolved", "connected", "success", "ready", "positive", "replied", "qualified", "tracking"].some(
      (s) => value.includes(s),
    )
  )
    return "success";
  if (["warn", "pending", "review", "scheduled", "paused", "in_progress", "draft", "generating", "rendering", "medium", "unread"].some((s) => value.includes(s)))
    return "warning";
  if (["fail", "critical", "high", "toxic", "open", "error", "lost", "negative", "escalated", "blocked", "not_indexed", "excluded"].some((s) => value.includes(s)))
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

export function Spinner() {
  return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />;
}

export function LoadingBlock({ rows = 5 }: { rows?: number }) {
  return <LoadingRows rows={rows} />;
}

export function ErrorState({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "Unable to load this manager data.";
  return <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{message}</div>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold">{title}</h1>{description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}</div>{actions}</div>;
}

export function GlassCard({ title, icon, children, className }: { title?: string; icon?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={cn("panel overflow-hidden", className)}>{title ? <div className="flex items-center gap-2 border-b border-border px-5 py-4"><span>{icon}</span><h2 className="text-base font-semibold">{title}</h2></div> : null}<div className="p-5">{children}</div></section>;
}

export function StatCard({ label, value, icon, tone: _tone, change, loading: _loading }: { label: string; value: ReactNode; icon?: ReactNode; tone?: string; change?: ReactNode; loading?: boolean }) {
  return <div className="bento-card p-4"><div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{label}</span>{icon}</div><div className="mt-2 text-xl font-bold">{value}</div>{change ? <div className="mt-1 text-xs text-muted-foreground">{change}</div> : null}</div>;
}

export function StatusBadge({ value }: { value: string }) {
  return <StatusPill value={value} />;
}

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div
      role="status"
      className="rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground"
    >
      <p>{message}</p>
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function QueryBoundary<T>({
  query,
  children,
  empty = "Nothing here yet.",
}: {
  query: { data?: T[] | undefined; isLoading: boolean; error: unknown };
  children: (rows: T[]) => ReactNode;
  empty?: string;
}) {
  if (query.isLoading) return <LoadingRows />;
  if (query.error) {
    if (typeof console !== "undefined") console.error("[seo] query failed", query.error);
    return (
      <div
        role="alert"
        className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        We couldn&rsquo;t load this data right now. Please retry in a moment &mdash; if it keeps failing, check
        Diagnostics for the captured error.
      </div>
    );
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

export const num = (value: number) => nf.format(value);
export const inr = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
export const usd = (value: number) => cf.format(value);
export const day = (value?: string | null) => value ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";
export const when = (value?: string | null) => value ? formatDateTime(value) : "—";

export function downloadRows(filename: string, rows: Record<string, unknown>[]) {
  if (typeof document === "undefined") return;
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const csv = [columns, ...rows.map((row) => columns.map((column) => row[column] ?? ""))]
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
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
