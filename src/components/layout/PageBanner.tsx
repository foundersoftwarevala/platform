import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, ChevronRight, Home } from "lucide-react";
import { navMetaForPath } from "@/lib/nav";

/**
 * Per-screen hero banner. Matches the reference design language:
 * gradient `hero-surface` band, soft light orbs, module chip,
 * large display title and a supporting subtitle.
 */
export function PageBanner() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const meta = navMetaForPath(pathname);
  if (!meta || pathname === "/") return null;

  const Icon = meta.icon;
  const subtitle = `${meta.group} module — configure, review and operate ${meta.label.toLowerCase()} across the recognition system.`;

  return (
    <section className="hero-surface relative overflow-hidden p-5 sm:p-7 lg:p-9">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-accent-pink/40 blur-3xl"
      />

      <div className="relative grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-primary-foreground/70 sm:text-[11px]"
          >
            <Link to="/ams/overview" className="flex items-center gap-1 transition-opacity hover:opacity-100 opacity-80">
              <Home className="h-3 w-3" /> AMS
            </Link>
            <ChevronRight className="h-3 w-3 opacity-50" />
            <span className="truncate">{meta.group}</span>
          </nav>

          <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[11px] font-medium backdrop-blur">
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{meta.label}</span>
          </div>

          <h1 className="mt-4 truncate text-2xl font-semibold tracking-tight sm:text-3xl lg:text-[34px]">
            {meta.label}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-primary-foreground/80 sm:text-[15px]">
            {subtitle}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-medium">
              <Activity className="h-3 w-3" />
              {meta.group}
            </span>
          </div>
        </div>

        <div className="hidden lg:grid lg:justify-self-end">
          <span className="grid h-20 w-20 place-items-center rounded-2xl border border-white/25 bg-white/12 backdrop-blur">
            <Icon className="h-9 w-9" />
          </span>
        </div>
      </div>
    </section>
  );
}
