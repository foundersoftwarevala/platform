import { cn } from "@/lib/utils";
import { useEffect, useState, type ReactNode } from "react";

export function SectionTitle({ kicker, title, action }: { kicker?: string; title: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-3">
      <div>
        {kicker && <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">{kicker}</div>}
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label, value, sub, icon, accent = "primary", trend,
}: {
  label: string; value: ReactNode; sub?: string;
  icon: ReactNode;
  accent?: "primary" | "secondary" | "trophy" | "xp" | "mythic" | "legendary";
  trend?: string;
}) {
  const accentMap: Record<string, string> = {
    primary: "text-primary glow-primary",
    secondary: "text-secondary glow-secondary",
    trophy: "text-trophy glow-trophy",
    xp: "text-xp glow-xp",
    mythic: "rarity-mythic",
    legendary: "rarity-legendary",
  };
  return (
    <div className="surface-card motion-card p-4 flex items-start justify-between gap-3 group">
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
        {trend && <div className="text-[10px] mt-2 text-success">▲ {trend}</div>}
      </div>
      <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center bg-card/60", accentMap[accent])}>
        {icon}
      </div>
    </div>
  );
}

export function ProgressBar({ pct, gradient = "var(--gradient-xp)" }: { pct: number; gradient?: string }) {
  const target = Math.max(0, Math.min(100, pct));
  const [width, setWidth] = useState(0);

  // Animate from the previous value to the new one on every progression change.
  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(target));
    return () => cancelAnimationFrame(id);
  }, [target]);

  return (
    <div
      className="h-2.5 w-full rounded-full bg-muted/60 overflow-hidden"
      role="progressbar"
      aria-valuenow={Math.round(target)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-[var(--ease-enterprise)] motion-reduce:transition-none"
        style={{ width: `${width}%`, background: gradient, boxShadow: "var(--shadow-glow-xp)" }}
      />
    </div>
  );
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return <div className="text-xs text-muted-foreground italic py-4">{children}</div>;
}
