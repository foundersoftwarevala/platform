import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle, Bell, ChevronDown, ChevronUp, Clock, Sparkles, TriangleAlert,
} from "lucide-react";

import { executiveFeeds, type AlertPriority, type ExecRole } from "./executiveFeed";

const PRIORITY: Record<AlertPriority, { label: string; chip: string; bar: string; ring: string }> = {
  critical: {
    label: "Critical",
    chip: "bg-destructive/15 text-destructive border-destructive/30",
    bar: "bg-destructive",
    ring: "border-destructive/30",
  },
  high: {
    label: "High",
    chip: "bg-accent-amber/15 text-accent-amber border-accent-amber/30",
    bar: "bg-accent-amber",
    ring: "border-accent-amber/25",
  },
  medium: {
    label: "Medium",
    chip: "bg-primary/15 text-primary-glow border-primary/30",
    bar: "bg-primary",
    ring: "border-primary/25",
  },
  low: {
    label: "Low",
    chip: "bg-accent-emerald/15 text-accent-emerald border-accent-emerald/30",
    bar: "bg-accent-emerald",
    ring: "border-accent-emerald/25",
  },
};

/**
 * Executive Action Center — the universal, role-based operations banner that
 * sits directly under the page header on every manager dashboard.
 */
export function ExecutiveBanner({
  role,
  onNavigate,
}: {
  role: ExecRole;
  onNavigate?: (target: string) => void;
}) {
  const items = executiveFeeds[role] ?? [];
  const [expanded, setExpanded] = useState(false);
  const trackRef = useRef<HTMLDivElement | null>(null);

  // Smooth auto-scroll through alerts while collapsed.
  useEffect(() => {
    if (expanded) return;
    const el = trackRef.current;
    if (!el || items.length < 3) return;
    let stop = false;
    const tick = window.setInterval(() => {
      if (stop || !el) return;
      const next = el.scrollLeft + el.clientWidth * 0.6;
      el.scrollTo({
        left: next >= el.scrollWidth - el.clientWidth - 8 ? 0 : next,
        behavior: "smooth",
      });
    }, 4500);
    return () => {
      stop = true;
      window.clearInterval(tick);
    };
  }, [expanded, items.length]);

  if (!items.length) return null;

  const critical = items.filter((i) => i.priority === "critical").length;
  const totalPending = items.reduce((s, i) => s + (i.count ?? 0), 0);

  return (
    <section className="rounded-2xl border border-border bg-surface/60 p-4 backdrop-blur-xl">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary-glow">
            <Bell className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">What needs my attention right now?</p>
            <p className="truncate text-xs text-muted-foreground">
              {items.length} live signals · {critical} critical · {totalPending} items pending action
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {critical > 0 && (
            <span className="hidden items-center gap-1 rounded-full border border-destructive/30 bg-destructive/15 px-2.5 py-1 text-[11px] font-medium text-destructive sm:inline-flex">
              <TriangleAlert className="h-3 w-3" /> {critical} critical
            </span>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </header>

      <div
        ref={trackRef}
        className={
          expanded
            ? "mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
            : "scroll-row mt-3 flex gap-3 overflow-x-auto pb-1"
        }
      >
        {items.map((a) => {
          const p = PRIORITY[a.priority];
          return (
            <button
              key={a.id}
              onClick={() => onNavigate?.(a.target)}
              className={`group ${expanded ? "" : "w-[270px] shrink-0"} rounded-xl border ${p.ring} bg-background/50 p-3 text-left transition hover:bg-muted/50`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${p.chip}`}
                >
                  <AlertTriangle className="h-2.5 w-2.5" /> {p.label}
                </span>
                <span className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                  {a.kind}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-semibold">{a.title}</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.detail}</p>

              {typeof a.progress === "number" && (
                <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className={`h-full ${p.bar}`} style={{ width: `${a.progress}%` }} />
                </div>
              )}

              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  {a.due ? (
                    <>
                      <Clock className="h-3 w-3" /> {a.due}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3" /> AI insight
                    </>
                  )}
                </span>
                {a.count ? (
                  <span className="rounded-full border border-border px-1.5 tabular-nums">
                    {a.count}
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}