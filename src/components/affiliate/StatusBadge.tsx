import type { ReactNode } from "react";

type Tone = "neutral" | "success" | "warning" | "destructive" | "info" | "primary";

export function StatusBadge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  const map: Record<Tone, string> = {
    neutral: "bg-muted text-foreground border-border",
    success: "bg-success/10 text-success border-success/20",
    warning: "bg-warning/15 text-warning-foreground border-warning/30",
    destructive: "bg-destructive/10 text-destructive border-destructive/20",
    info: "bg-info/10 text-info border-info/20",
    primary: "bg-primary-soft text-primary border-primary/15",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${map[tone]}`}
    >
      <span className={`size-1.5 rounded-full ${
        tone === "success" ? "bg-success" :
        tone === "warning" ? "bg-warning" :
        tone === "destructive" ? "bg-destructive" :
        tone === "info" ? "bg-info" :
        tone === "primary" ? "bg-primary" : "bg-muted-foreground/50"
      }`} />
      {children}
    </span>
  );
}

export function SectionCard({ title, action, children, padded = true }: { title?: string; action?: ReactNode; children: ReactNode; padded?: boolean }) {
  return (
    <div className="premium-halo enter-soft overflow-hidden rounded-2xl">
      {title && (
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <h3 className="font-display text-[13px] font-semibold tracking-tight text-foreground">{title}</h3>
          {action}
        </div>
      )}
      <div className={padded ? "p-4" : ""}>{children}</div>
    </div>
  );
}

export function Tabs({
  items,
  active,
  onChange,
}: {
  items: string[];
  active?: string;
  onChange?: (value: string) => void;
}) {
  const current = active ?? items[0];
  return (
    <div
      role="tablist"
      className="no-scrollbar flex items-center gap-0 overflow-x-auto border-b border-border bg-surface px-4 lg:px-6"
    >
      {items.map((it) => {
        const isActive = current === it;
        return (
          <button
            key={it}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange?.(it)}
            className={[
              "relative whitespace-nowrap px-3 py-2.5 text-[13px] font-medium transition-colors",
              isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {it}
            {isActive && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />}
          </button>
        );
      })}
    </div>
  );
}
