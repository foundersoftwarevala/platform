import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Activity, AlertTriangle, Info, RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Page furniture for the AI CEO module.
 *
 * This is the module's own inner layout — the spacing scale, the gradient
 * banner, the section header, the empty/loading/error states its ten screens
 * share. It is deliberately *not* an application shell: the sidebar, top bar,
 * routing and authentication all stay with Software Vala's own shell, which
 * wraps these pages in src/routes/ai-ceo.tsx.
 *
 * Every colour resolves through the project's design tokens, and the surface
 * classes (hero-surface, bento-card, premium-halo, card3d) are the same ones
 * the other consoles use, so these screens sit inside the existing theme
 * rather than beside it.
 *
 * The imported module kept the same helpers in components/layout, alongside its
 * AppSidebar and TopBar. Those two were dropped; these were kept, because they
 * are what makes the ten screens look like each other.
 */

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      {children}
    </div>
  );
}

/** The gradient banner at the top of every AI CEO screen. */
export function PageBanner({
  eyebrow,
  title,
  subtitle,
  icon: Icon,
  status,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  status?: string;
  actions?: ReactNode;
}) {
  return (
    <section className="hero-surface relative overflow-hidden p-5 sm:p-7 lg:p-9">
      <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-accent-pink/40 blur-3xl" />

      <div className="relative grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[11px] font-medium backdrop-blur">
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{eyebrow ?? title}</span>
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl lg:text-[34px]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 max-w-2xl text-sm text-white/80 sm:text-[15px]">{subtitle}</p>
          )}
          {status && (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-medium">
                <Activity className="h-3 w-3" aria-hidden="true" />
                {status}
              </span>
            </div>
          )}
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-2 lg:justify-self-end">{actions}</div>
        )}
      </div>
    </section>
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
        <h2 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
        {subtitle && (
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground sm:text-[15px]">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/** Horizontal pill nav used inside a screen. Scrolls rather than wrapping. */
export function SectionPills({
  items,
  active,
  onSelect,
}: {
  items: string[];
  active: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <div className="flex min-w-max items-center gap-2 px-1">
        {items.map((item, i) => (
          <button
            key={item}
            type="button"
            onClick={() => onSelect(i)}
            aria-pressed={i === active}
            className={cn(
              "focus-glow whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-medium transition-colors",
              i === active
                ? "border-primary/40 bg-primary/20 text-foreground"
                : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton-shimmer h-24 rounded-2xl p-4", className)} aria-hidden="true" />;
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
    <div className="bento-card premium-halo enter-soft flex flex-col items-center justify-center px-6 py-16 text-center sm:py-20">
      <div className="relative mb-5">
        <div className="absolute inset-0 -z-10 rounded-full bg-primary/15 blur-2xl" />
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function LoadingState({
  label = "Loading live data…",
  rows = 3,
}: {
  label?: string;
  rows?: number;
}) {
  return (
    <div className="space-y-4" role="status" aria-busy="true">
      <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        {label}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: rows * 3 }).map((_, i) => (
          <CardSkeleton key={i} className="!p-4" />
        ))}
      </div>
    </div>
  );
}

export function ErrorState({
  title = "This section didn't load",
  description = "The live source is unreachable right now. Retry, or continue with the last known state.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="bento-card premium-halo enter-soft flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-destructive/15 text-destructive">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="btn-premium focus-glow relative mt-6 inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/50"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
        </button>
      )}
    </div>
  );
}

/**
 * Says plainly which live sources were unreachable on this load.
 *
 * The dashboard degrades one tile at a time rather than failing whole, which is
 * right — but an operator must be able to tell a measured zero from a source
 * that did not answer, or they will read a broken feed as a quiet week.
 */
export function DegradedNotice({ sources }: { sources: string[] }) {
  if (!sources.length) return null;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-accent-amber/30 bg-accent-amber/10 p-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent-amber" aria-hidden="true" />
      <p className="text-xs text-accent-amber">
        <strong>Partial data.</strong> These sources did not answer on this load, so anything
        depending on them is incomplete: {sources.join(", ")}.
      </p>
    </div>
  );
}

/**
 * Marks a screen whose content is illustrative because the source that would
 * fill it does not exist yet.
 *
 * The module shipped six screens of hand-written figures with nothing to say
 * they were not measurements. Keeping the content is reasonable — it shows the
 * shape of the screen and the brief allows realistic placeholder content until
 * the real source is connected — but an executive must never mistake it for
 * something counted. `waitingFor` names precisely what has to be built.
 */
export function SeedNotice({ waitingFor }: { waitingFor: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-accent-amber/30 bg-accent-amber/10 p-3">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-amber" aria-hidden="true" />
      <p className="text-xs text-accent-amber">
        <strong>Illustrative content, not measured data.</strong> This screen shows the layout and
        the shape of the analysis it will carry. It is waiting on {waitingFor}. Nothing here is
        counted from the platform, so do not read these figures as fact.
      </p>
    </div>
  );
}
