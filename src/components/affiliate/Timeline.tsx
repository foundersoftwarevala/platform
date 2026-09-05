import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Activity } from "lucide-react";
import { EntityAvatar, TimeAgo } from "./Money";

export type TimelineEvent = {
  id: string;
  title: ReactNode;
  actor?: string | null;
  description?: ReactNode;
  at: string | Date | null | undefined;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "destructive" | "primary";
};

/**
 * Enterprise activity timeline: connector rail, event icon, actor avatar,
 * relative timestamp with absolute tooltip.
 */
export function Timeline({ events, dense }: { events: TimelineEvent[]; dense?: boolean }) {
  if (events.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        No activity recorded yet.
      </div>
    );
  }
  return (
    <ol className="relative pl-2">
      {events.map((e, i) => {
        const Icon = e.icon ?? Activity;
        const tone =
          e.tone === "success" ? "text-success bg-success/10 border-success/20"
          : e.tone === "warning" ? "text-warning-foreground bg-warning/15 border-warning/30"
          : e.tone === "destructive" ? "text-destructive bg-destructive/10 border-destructive/20"
          : e.tone === "primary" ? "text-primary bg-primary-soft border-primary/20"
          : "text-muted-foreground bg-muted border-border";
        return (
          <li key={e.id} className={["relative flex gap-3", dense ? "pb-3" : "pb-5"].join(" ")}>
            {i < events.length - 1 && (
              <span aria-hidden="true" className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />
            )}
            <span className={["relative z-10 grid size-8 shrink-0 place-items-center rounded-full border", tone].join(" ")}>
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{e.title}</p>
                <span className="text-[11px] text-muted-foreground">
                  <TimeAgo value={e.at} />
                </span>
              </div>
              {e.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">{e.description}</p>
              )}
              {e.actor && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <EntityAvatar name={e.actor} size="xs" />
                  {e.actor}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
