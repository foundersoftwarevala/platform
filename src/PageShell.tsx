import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * Shared spacing + typography scale for every premium screen.
 * container 1600px · padding 16/24/32 · rhythm 24/32/40 · section gap 24
 */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:flex-wrap sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-2xl sm:text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/**
 * Gradient hero banner shown at the top of every screen.
 */
export function PageBanner({
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  action,
  stats,
}: {
  icon: LucideIcon;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  stats?: { label: string; value: string }[];
}) {
  return (
    <section className="hero-surface relative overflow-hidden p-5 sm:p-7">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(45% 60% at 85% 10%, hsl(0 0% 100% / 0.22), transparent 60%), radial-gradient(35% 50% at 10% 100%, hsl(0 0% 0% / 0.2), transparent 60%)",
        }}
      />
      <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <span className="grid h-12 w-12 sm:h-14 sm:w-14 shrink-0 place-items-center rounded-2xl bg-primary-foreground/15 ring-1 ring-primary-foreground/25 backdrop-blur-sm">
            <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
          </span>
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] opacity-80">
                {eyebrow}
              </p>
            )}
            <h1 className="truncate text-xl sm:text-2xl lg:text-[28px] font-semibold tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 text-xs sm:text-sm opacity-85 line-clamp-2">{subtitle}</p>
            )}
          </div>
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>

      {stats && stats.length > 0 && (
        <div className="relative mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl bg-primary-foreground/12 px-3 py-2 ring-1 ring-primary-foreground/15 backdrop-blur-sm"
            >
              <div className="text-lg font-mono font-bold leading-none">{s.value}</div>
              <div className="mt-1 text-[10px] uppercase tracking-wider opacity-80">{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Horizontal pill nav that replaces per-module top bars. */
export function SectionPills<T extends string>({
  sections,
  active,
  onChange,
}: {
  sections: readonly { id: T; label: string; icon: LucideIcon }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="pill-nav overflow-x-auto">
      {sections.map((s) => {
        const Icon = s.icon;
        const isActive = s.id === active;
        return (
          <button
            key={s.id}
            onClick={() => onChange(s.id)}
            className={
              isActive
                ? "flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary/20 px-3 py-1.5 text-xs font-medium text-foreground ring-1 ring-primary/40"
                : "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
            }
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="bento-card flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="grid place-items-center h-14 w-14 rounded-2xl bg-primary/15 text-primary mb-5">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-md">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
