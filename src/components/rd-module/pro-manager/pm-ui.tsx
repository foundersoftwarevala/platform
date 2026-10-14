import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/rd-module/utils";

export type Tone = "brand" | "success" | "warning" | "danger" | "info" | "muted";

const toneMap: Record<Tone, string> = {
  brand: "bg-brand/15 text-brand border-brand/30",
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  danger: "bg-danger/15 text-danger border-danger/30",
  info: "bg-info/15 text-info border-info/30",
  muted: "bg-surface-2 text-muted-foreground border-border",
};

export function toneFor(value: string): Tone {
  const v = (value ?? "").toLowerCase();
  if (/(critical|breach|breached|suspended|rejected|expired|high_risk|failed|open|blocked)/.test(v))
    return "danger";
  if (/(warning|near_breach|pending|waiting|grace|paused|medium|in_review|expiring)/.test(v))
    return "warning";
  if (/(healthy|active|resolved|fulfilled|approved|completed|on_track|ended|low|stable)/.test(v))
    return "success";
  if (/(escalated|forwarded|recommended|high)/.test(v)) return "info";
  return "muted";
}

export const PMBadge = ({
  children,
  tone = "muted",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
      toneMap[tone],
      className,
    )}
  >
    {children}
  </span>
);

export const StatusBadge = ({ value }: { value: string }) => (
  <PMBadge tone={toneFor(value)}>{(value ?? "").replace(/_/g, " ")}</PMBadge>
);

export const PMSection = ({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) => (
  <motion.section
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.25 }}
    className="space-y-5"
  >
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
    {children}
  </motion.section>
);

export const PMPanel = ({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <div className={cn("panel p-5", className)}>
    {(title || actions) && (
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {Icon && (
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/15 text-brand">
              <Icon className="h-4 w-4" />
            </span>
          )}
          <div>
            {title && (
              <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
            )}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    )}
    {children}
  </div>
);

export const PMStat = ({
  label,
  value,
  hint,
  icon: Icon,
  tone = "brand",
  onClick,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: Tone;
  onClick?: () => void;
}) => {
  const Wrapper = onClick ? motion.button : motion.div;
  return (
    <Wrapper
      {...(onClick ? { type: "button" as const, onClick, whileHover: { y: -3 } } : {})}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("panel p-4 text-left", onClick && "cursor-pointer hover:shadow-glow")}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg border",
            toneMap[tone],
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 font-display text-2xl font-semibold text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Wrapper>
  );
};

export const PMEmpty = ({ message }: { message: string }) => (
  <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
    {message}
  </p>
);

export const PMLoading = ({ rows = 3 }: { rows?: number }) => (
  <div className="space-y-2">
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className="h-14 animate-pulse rounded-xl bg-surface-2" />
    ))}
  </div>
);

export const AIOutput = ({ text }: { text: string }) => (
  <div className="brand-soft mt-4 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border p-4 text-sm leading-relaxed text-foreground scroll-slim">
    {text}
  </div>
);

export function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function formatDay(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { dateStyle: "medium" });
}
