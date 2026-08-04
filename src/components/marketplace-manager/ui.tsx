import { type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            {eyebrow}
          </div>
        )}
        <h1 className="text-3xl font-bold text-foreground md:text-4xl">{title}</h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function SubNav({
  items,
  active,
  onChange,
}: {
  items: string[];
  active: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="scroll-row mb-6 flex gap-1 overflow-x-auto border-b border-border pb-px">
      {items.map((it) => {
        const isActive = it === active;
        return (
          <button
            key={it}
            onClick={() => onChange(it)}
            className={`relative whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {it}
            {isActive && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-primary to-accent" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`glass rounded-2xl p-5 ${className}`}>{children}</div>
  );
}

export function StatCard({
  label,
  value,
  delta,
  tone = "default",
  icon,
}: {
  label: string;
  value: string;
  delta?: string;
  tone?: "default" | "success" | "warning" | "premium" | "destructive";
  icon?: ReactNode;
}) {
  const toneMap: Record<string, string> = {
    default: "text-accent",
    success: "text-success",
    warning: "text-warning",
    premium: "text-premium",
    destructive: "text-destructive",
  };
  const barMap: Record<string, string> = {
    default: "bg-accent",
    success: "bg-success",
    warning: "bg-warning",
    premium: "bg-premium",
    destructive: "bg-destructive",
  };
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-[oklch(0.22_0.04_235/0.35)] p-5 transition-all duration-500 hover:-translate-y-0.5 hover:border-[oklch(0.80_0.13_192/0.45)] hover:bg-[oklch(0.24_0.045_230/0.55)] hover:shadow-[0_18px_40px_-20px_oklch(0_0_0/0.7)]">
      <span
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: "linear-gradient(135deg, oklch(0.80 0.13 192 / 0.16), transparent 45%)" }}
      />
      <div className="relative flex items-start justify-between">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </div>
        {icon && (
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background/60 ${toneMap[tone]} transition-shadow group-hover:shadow-[0_0_14px_-2px_currentColor]`}>
            {icon}
          </div>
        )}
      </div>
      <div className="relative mt-5 font-mono text-[28px] font-bold leading-none tracking-tight tabular">
        {value}
      </div>
      {delta && (
        <div className={`relative mt-2 text-[10px] font-medium tracking-wide ${toneMap[tone]}`}>{delta}</div>
      )}
      <span className="relative mt-3 block h-px w-full overflow-hidden bg-border">
        <span className={`block h-full w-1/3 ${barMap[tone]} opacity-70`} />
      </span>
    </div>
  );
}

export function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_currentColor]" />
      {text}
    </div>
  );
}

export function SectionRow({
  title,
  count,
  cta = "Manage",
  onCta,
  children,
}: {
  title: string;
  count?: number;
  cta?: string;
  onCta?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h2 className="text-xl font-bold text-foreground">{title}</h2>
          <span className="h-px w-24 bg-gradient-to-r from-border to-transparent" />
          {typeof count === "number" && (
            <span className="rounded-full border border-border bg-background/40 px-2.5 py-0.5 font-mono text-[10px] tabular text-muted-foreground">
              {count}
            </span>
          )}
        </div>
        <button
          onClick={onCta}
          className="group flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.16em] text-accent transition-colors hover:text-cyan-glow"
        >
          {cta}
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
      {children}
    </section>
  );
}

export function PillButton({
  children,
  variant = "ghost",
  onClick,
}: {
  children: ReactNode;
  variant?: "primary" | "ghost" | "premium";
  onClick?: () => void;
}) {
  const map = {
    primary:
      "bg-accent text-accent-foreground hover:brightness-110 shadow-[0_8px_24px_-8px_oklch(0.80_0.13_192/0.6),inset_0_1px_0_oklch(1_0_0/0.25)]",
    ghost:
      "border border-border bg-white/[0.03] text-foreground hover:bg-white/[0.06] hover:border-[oklch(1_0_0/0.14)] ring-rim",
    premium:
      "text-primary-foreground hover:brightness-110",
  };
  return (
    <button
      onClick={onClick}
      style={variant === "premium" ? { background: "var(--gradient-premium)", boxShadow: "var(--shadow-premium)" } : undefined}
      className={`rounded-full px-5 py-2 text-[12px] font-bold tracking-tight transition-all active:scale-[0.98] ${map[variant]}`}
    >
      {children}
    </button>
  );
}
