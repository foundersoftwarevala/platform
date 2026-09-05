import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactNode } from "react";

export function KpiCard({
  label,
  value,
  hint,
  delta,
  icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  delta?: { value: string; direction: "up" | "down" | "flat" };
  icon?: ReactNode;
  tone?: "default" | "primary" | "success" | "warning" | "destructive";
}) {
  const accent =
    tone === "primary"
      ? "text-primary-glow"
      : tone === "success"
      ? "text-accent-emerald"
      : tone === "warning"
      ? "text-accent-amber"
      : tone === "destructive"
      ? "text-destructive"
      : "text-muted-foreground";

  return (
    <div className="premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-1 truncate text-xl font-bold tabular-nums text-foreground">{value}</div>
        </div>
        {icon && <div className={`shrink-0 ${accent}`}>{icon}</div>}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
        <span className="truncate text-muted-foreground">{hint ?? "\u00a0"}</span>
        {delta && (
          <span
            className={[
              "inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium tabular-nums",
              delta.direction === "up"
                ? "bg-accent-emerald/12 text-accent-emerald"
                : delta.direction === "down"
                ? "bg-accent-pink/12 text-accent-pink"
                : "bg-muted text-muted-foreground",
            ].join(" ")}
          >
            {delta.direction === "up" && <ArrowUpRight className="size-3" />}
            {delta.direction === "down" && <ArrowDownRight className="size-3" />}
            {delta.direction === "flat" && <Minus className="size-3" />}
            {delta.value}
          </span>
        )}
      </div>
    </div>
  );
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">{children}</div>
  );
}
