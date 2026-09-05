import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import type { Lead, LeadPriority, LeadStatus, LeadTemperature } from "@/lib/lead-manager/types";
import { STATUS_LABEL } from "@/lib/lead-manager/types";

export const inr = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
    notation: value >= 100000 ? "compact" : "standard",
  }).format(value ?? 0);

export const num = (value: number) => new Intl.NumberFormat("en-IN").format(value ?? 0);

export const relTime = (iso?: string | null) => {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (Math.abs(mins) < 60) return mins >= 0 ? `${mins}m ago` : `in ${-mins}m`;
  const hrs = Math.round(mins / 60);
  if (Math.abs(hrs) < 24) return hrs >= 0 ? `${hrs}h ago` : `in ${-hrs}h`;
  const days = Math.round(hrs / 24);
  return days >= 0 ? `${days}d ago` : `in ${-days}d`;
};

export const dateTime = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export const maskPhone = (phone: string, unmasked: boolean) =>
  unmasked ? phone : phone.replace(/(\+?\d{2,3})(\d+)(\d{3})/, (_m, a, b, c) => `${a}${"•".repeat(b.length)}${c}`);

export const maskEmail = (email: string, unmasked: boolean) => {
  if (unmasked) return email;
  const [user = "", domain = ""] = email.split("@");
  return `${user.slice(0, 2)}${"•".repeat(Math.max(3, user.length - 2))}@${domain}`;
};

/* ------------------------------------------------------------------ *
 * Motion primitives (presentation only)
 * ------------------------------------------------------------------ */

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** Smoothly counts a numeric target up from its previous value. */
function useCountUp(target: number, duration = 900) {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduced || !Number.isFinite(target)) {
      setDisplay(target);
      fromRef.current = target;
      return;
    }
    const from = fromRef.current;
    if (from === target) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      setDisplay(from + (target - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = target;
    };
  }, [target, duration, reduced]);

  return display;
}

/**
 * Renders a value with an animated counter when the value contains a number
 * (e.g. "1,204", "₹4.2L", "38%"). Non-numeric nodes render untouched.
 */
function AnimatedValue({ value }: { value: ReactNode }) {
  const text = typeof value === "string" || typeof value === "number" ? String(value) : null;
  const match = text ? text.match(/-?[\d,.]*\d/) : null;
  const raw = match ? Number(match[0].replace(/,/g, "")) : NaN;
  const animated = useCountUp(Number.isFinite(raw) ? raw : 0);

  if (!text || !match || !Number.isFinite(raw)) return <>{value}</>;

  const decimals = (match[0].split(".")[1] ?? "").length;
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(animated);

  return (
    <>
      {text.slice(0, match.index)}
      <span className="num">{formatted}</span>
      {text.slice((match.index ?? 0) + match[0].length)}
    </>
  );
}

/** Tiny inline sparkline. Purely decorative trend rendering of provided points. */
export function Sparkline({
  points,
  className,
  tone = "currentColor",
}: {
  points: number[];
  className?: string;
  tone?: string;
}) {
  const path = useMemo(() => {
    if (points.length < 2) return { line: "", area: "" };
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = max - min || 1;
    const step = 100 / (points.length - 1);
    const coords = points.map((p, i) => [i * step, 28 - ((p - min) / span) * 24 - 2] as const);
    const line = coords.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
    return { line, area: `${line} L100,30 L0,30 Z` };
  }, [points]);

  if (!path.line) return null;

  return (
    <svg
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn("h-8 w-full", className)}
    >
      <path d={path.area} fill={tone} opacity={0.12} />
      <path
        d={path.line}
        fill="none"
        stroke={tone}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function SectionHeader({
  title,
  description,
  icon: Icon,
  actions,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
}) {
  return (
    <div className="rise grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:justify-between">
      <div className="flex min-w-0 items-start gap-3.5">
        {Icon ? (
          <span className="stat-tile ambient-glow float-soft flex size-12 shrink-0 items-center justify-center text-primary">
            <Icon className="size-5" />
          </span>
        ) : null}
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
  series,
  trend,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: "primary" | "success" | "warning" | "destructive" | "info";
  series?: number[];
  trend?: number;
}) {
  const toneClass = {
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
    info: "text-info",
  }[tone];

  return (
    <Card className="bento-card premium-halo hover-lift shimmer-sweep rise group gap-0 border-0 !p-5">
      <div className="relative z-[3] flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        {Icon ? (
          <span
            className={cn(
              "stat-tile flex size-8 items-center justify-center transition-transform duration-300 group-hover:scale-110",
              toneClass,
            )}
          >
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>

      <p className="relative z-[3] mt-3 font-display text-[1.75rem] font-semibold leading-none tracking-tight">
        <AnimatedValue value={value} />
      </p>

      <div className="relative z-[3] mt-1.5 flex items-center gap-2">
        {typeof trend === "number" ? (
          <span
            className={cn(
              "num rounded-full border px-1.5 py-0.5 text-[11px] font-medium",
              trend >= 0
                ? "border-success/30 bg-success/10 text-success"
                : "border-destructive/30 bg-destructive/10 text-destructive",
            )}
          >
            {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}%
          </span>
        ) : null}
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>

      {series && series.length > 1 ? (
        <div className={cn("relative z-[3] mt-3 -mb-1", toneClass)}>
          <Sparkline points={series} />
        </div>
      ) : null}
    </Card>
  );
}

export function Panel({
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
    <Card className={cn("bento-card premium-halo rise gap-0 border-0 !p-0", className)}>
      {title ? (
        <div className="relative z-[3] flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold tracking-tight">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className="relative z-[3] p-5">{children}</div>
    </Card>
  );
}

const statusTone: Record<LeadStatus, string> = {
  new: "bg-info/15 text-info border-info/30",
  contacted: "bg-primary/15 text-primary border-primary/30",
  interested: "bg-chart-5/15 text-chart-5 border-chart-5/30",
  follow_up: "bg-warning/15 text-warning border-warning/30",
  negotiation: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  won: "bg-success/15 text-success border-success/30",
  lost: "bg-destructive/15 text-destructive border-destructive/30",
  spam: "bg-muted text-muted-foreground border-border",
};

const livePulse = new Set<LeadStatus>(["new", "negotiation", "follow_up"]);

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 font-medium backdrop-blur-sm transition-colors duration-200",
        statusTone[status],
      )}
    >
      <span className={cn("size-1.5 rounded-full bg-current", livePulse.has(status) && "status-dot")} />
      {STATUS_LABEL[status]}
    </Badge>
  );
}

const priorityTone: Record<LeadPriority, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-warning/15 text-warning border-warning/30",
  medium: "bg-info/15 text-info border-info/30",
  low: "bg-muted text-muted-foreground border-border",
};

export function PriorityBadge({ priority }: { priority: LeadPriority }) {
  return (
    <Badge
      variant="outline"
      className={cn("capitalize backdrop-blur-sm", priorityTone[priority])}
    >
      {priority}
    </Badge>
  );
}

const tempTone: Record<LeadTemperature, string> = {
  hot: "bg-destructive/15 text-destructive border-destructive/30",
  warm: "bg-warning/15 text-warning border-warning/30",
  cold: "bg-info/15 text-info border-info/30",
};

export function TemperatureBadge({ temperature }: { temperature: LeadTemperature }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 capitalize backdrop-blur-sm", tempTone[temperature])}>
      <span className={cn("size-1.5 rounded-full bg-current", temperature === "hot" && "status-dot")} />
      {temperature}
    </Badge>
  );
}

export function ScoreBar({ score, label }: { score: number; label?: string }) {
  const tone = score >= 75 ? "bg-success" : score >= 50 ? "bg-warning" : "bg-destructive";
  return (
    <div className="min-w-24">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label ?? "Score"}</span>
        <span className="num font-medium">{score}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted/70 shadow-inner">
        <div
          className={cn("h-full rounded-full transition-[width] duration-700 ease-out", tone)}
          style={{ width: `${score}%`, boxShadow: "0 0 10px currentColor" }}
        />
      </div>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rise flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/10 px-6 py-14 text-center">
      <span className="stat-tile float-soft mb-3 flex size-12 items-center justify-center text-primary">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.6-3.6" strokeLinecap="round" />
        </svg>
      </span>
      <p className="font-display font-medium">{title}</p>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="shimmer h-11 rounded-lg"
          style={{ animationDelay: `${i * 90}ms` }}
        />
      ))}
    </div>
  );
}

export function exportLeadsCsv(leads: Lead[], filename = "leads") {
  const cols = [
    "name",
    "email",
    "phone",
    "company",
    "city",
    "state",
    "country",
    "source",
    "sub_source",
    "campaign",
    "category",
    "industry",
    "status",
    "priority",
    "temperature",
    "ai_score",
    "intent_score",
    "conversion_probability",
    "deal_value",
    "budget_range",
    "requirements",
    "created_at",
    "last_contact_at",
    "next_follow_up",
  ] as const;
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [
    cols.join(","),
    ...leads.map((l) => cols.map((c) => escape(l[c])).join(",")),
  ].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
