import { type ReactNode } from "react";

/**
 * Premium page banner used at the top of every screen.
 * Gradient hero surface + kicker + title + description + actions.
 */
export function PageHeader({
  kicker, title, description, actions,
}: {
  kicker?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-surface p-5 sm:p-6 lg:p-7 shadow-[var(--shadow-card)] motion-rise">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(72% 130% at 0% 0%, color-mix(in oklab, var(--color-primary) 34%, transparent), transparent 62%), radial-gradient(52% 115% at 100% 0%, color-mix(in oklab, var(--color-accent-pink) 22%, transparent), transparent 66%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--color-primary)_75%,transparent),transparent)]"
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          {kicker && (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/35 bg-primary/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-primary-glow">
              {kicker}
            </div>
          )}
          <h1 className="mt-2 text-2xl sm:text-3xl lg:text-[34px] font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 max-w-2xl text-sm sm:text-[15px] leading-relaxed text-foreground/72">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
      </div>
    </div>


  );
}
