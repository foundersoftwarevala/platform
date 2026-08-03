import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import type { MetricSnapshot } from "@/lib/creator/types";
import { Sparkline } from "./Sparkline";

function formatValue(snap: MetricSnapshot): string {
  if (snap.unit === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: snap.value >= 1000 ? 0 : 2,
    }).format(snap.value);
  }
  if (snap.value >= 1_000_000) return (snap.value / 1_000_000).toFixed(1) + "M";
  if (snap.value >= 1_000) return (snap.value / 1_000).toFixed(1) + "K";
  return new Intl.NumberFormat("en-US").format(snap.value);
}

function formatDelta(deltaPct: number | null): { label: string; tone: "up" | "down" | "flat" } {
  if (deltaPct === null || !isFinite(deltaPct)) return { label: "—", tone: "flat" };
  if (Math.abs(deltaPct) < 0.0005) return { label: "0%", tone: "flat" };
  const sign = deltaPct > 0 ? "+" : "";
  return {
    label: `${sign}${(deltaPct * 100).toFixed(1)}%`,
    tone: deltaPct > 0 ? "up" : "down",
  };
}

export function KpiCard({
  label,
  icon: Icon,
  snap,
  tint = "text-primary-glow",
  connected,
}: {
  label: string;
  icon: LucideIcon;
  snap: MetricSnapshot;
  tint?: string;
  connected: boolean;
}) {
  const delta = formatDelta(snap.deltaPct);
  const DeltaIcon =
    delta.tone === "up" ? ArrowUpRight : delta.tone === "down" ? ArrowDownRight : Minus;
  const deltaColor =
    delta.tone === "up"
      ? "text-accent-emerald"
      : delta.tone === "down"
        ? "text-accent-pink"
        : "text-muted-foreground";

  return (
    <div className="bento-card !p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1 truncate text-xl font-bold">
            {connected || snap.value > 0 ? formatValue(snap) : "—"}
          </p>
        </div>
        <Icon className={`h-4 w-4 shrink-0 ${tint}`} aria-hidden />
      </div>

      <div className={`mt-2 flex items-center gap-1 text-[11px] ${deltaColor}`}>
        <DeltaIcon className="h-3 w-3" aria-hidden />
        <span>{delta.label}</span>
        <span className="text-muted-foreground">vs prev.</span>
      </div>

      <div className={`mt-2 ${tint}`}>
        <Sparkline data={snap.series} />
      </div>
    </div>
  );
}
