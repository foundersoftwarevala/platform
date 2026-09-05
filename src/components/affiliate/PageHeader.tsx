import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

type Crumb = { label: string; to?: string };

/**
 * Premium gradient banner shown at the top of every wall.
 * Same API as before — presentation only.
 */
export function PageHeader({
  title,
  description,
  crumbs,
  actions,
  meta,
}: {
  title: string;
  description?: string;
  crumbs?: Crumb[];
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-10">
      <section className="hero-surface enter-soft relative overflow-hidden p-5 sm:p-7 lg:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-accent-pink/40 blur-3xl" />

        <div className="relative grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            {crumbs && crumbs.length > 0 && (
              <nav className="mb-3 flex flex-wrap items-center gap-1 text-[11px] text-primary-foreground/70">
                {crumbs.map((c, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight className="size-3" />}
                    <span className={i === crumbs.length - 1 ? "text-primary-foreground" : ""}>{c.label}</span>
                  </span>
                ))}
              </nav>
            )}
            <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl lg:text-[34px]">
              {title}
            </h1>
            {description && (
              <p className="mt-1.5 max-w-2xl text-sm text-primary-foreground/80 sm:text-[15px]">
                {description}
              </p>
            )}
            {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-2 lg:justify-self-end">{actions}</div>
          )}
        </div>
      </section>
    </div>
  );
}
