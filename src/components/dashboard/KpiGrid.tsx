import { memo } from "react";
import { MoreVertical } from "lucide-react";
import type { Kpi } from "@/lib/roles";
import { fmtValue } from "@/lib/metrics";
import { useTranslation } from "@/lib/i18n/use-translation";

const toneStyle: Record<Kpi["tone"], { bg: string; fg: string; ring: string; line: string }> = {
  brand: {
    bg: "bg-brand/15",
    fg: "text-[oklch(0.72_0.2_265)]",
    ring: "hover:border-[oklch(0.62_0.22_265)]/60",
    line: "oklch(0.72 0.2 265)",
  },
  success: {
    bg: "bg-success/15",
    fg: "text-success",
    ring: "hover:border-success/60",
    line: "oklch(0.72 0.17 165)",
  },
  warning: {
    bg: "bg-warning/15",
    fg: "text-warning",
    ring: "hover:border-warning/60",
    line: "oklch(0.8 0.16 85)",
  },
  danger: {
    bg: "bg-destructive/15",
    fg: "text-destructive",
    ring: "hover:border-destructive/60",
    line: "oklch(0.66 0.22 25)",
  },
  violet: {
    bg: "bg-[oklch(0.65_0.22_320)]/15",
    fg: "text-[oklch(0.78_0.2_320)]",
    ring: "hover:border-[oklch(0.65_0.22_320)]/60",
    line: "oklch(0.72 0.2 320)",
  },
  cyan: {
    bg: "bg-[oklch(0.7_0.16_210)]/15",
    fg: "text-[oklch(0.78_0.15_210)]",
    ring: "hover:border-[oklch(0.7_0.16_210)]/60",
    line: "oklch(0.74 0.15 210)",
  },
};

function KpiCardBase({
  kpi,
  onOpen,
  value,
  loading = false,
}: {
  kpi: Kpi;
  /** Kept for callers; no figure is derived from the role any more. */
  roleKey?: string;
  onOpen?: (k: string) => void;
  /**
   * A real figure for this KPI. `null` or `undefined` means the platform has
   * no source for it: a dash and "not tracked yet" are shown. No figure, trend
   * line or delta is ever generated.
   */
  value?: number | null;
  /** The real figures are still being read: a dash and no caption. */
  loading?: boolean;
}) {
  const { t: translate } = useTranslation();
  const t = toneStyle[kpi.tone];
  const hasValue = typeof value === "number";
  return (
    <button
      onClick={() => onOpen?.(kpi.key)}
      aria-busy={loading || undefined}
      className={`group text-left rounded-2xl bg-card border border-border p-4 depth-3d sheen-3d ${t.ring}`}
    >
      <div className="flex items-start justify-between">
        <div
          className={`grid h-9 w-9 place-items-center rounded-xl ${t.bg} emboss-3d transition-transform duration-300 group-hover:scale-110`}
        >
          <kpi.icon className={`h-4 w-4 ${t.fg}`} />
        </div>
        <span className="opacity-0 group-hover:opacity-100 transition text-muted-foreground">
          <MoreVertical className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-2xl font-black tracking-tight text-foreground">
          {hasValue ? fmtValue(value, kpi.unit) : "—"}
        </span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground truncate">
        {kpi.labelKey ? translate(kpi.labelKey) : kpi.label}
      </div>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        {/* A real figure gets no invented trend line and no invented delta.
            When there is nothing to report, say so plainly. */}
        <span className="text-[10px] font-medium text-muted-foreground">
          {loading
            ? " "
            : hasValue
              ? translate("dashboard.kpi.live")
              : translate("dashboard.kpi.not_tracked")}
        </span>
      </div>
    </button>
  );
}

function KpiGridBase({
  items,
  roleKey,
  onOpen,
  values,
  loading = false,
}: {
  items: Kpi[];
  roleKey: string;
  onOpen: (k: string) => void;
  /**
   * Real figures by KPI key. A key that is missing (or no map at all) reads
   * "not tracked yet" - there is no sample engine behind these cards.
   */
  values?: Record<string, number | null>;
  /** The real figures are still loading. */
  loading?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
      {items.map((k) => (
        <KpiCard
          key={k.key}
          kpi={k}
          roleKey={roleKey}
          onOpen={onOpen}
          value={values && k.key in values ? values[k.key] : null}
          loading={loading}
        />
      ))}
    </div>
  );
}

export const KpiGrid = memo(KpiGridBase) as typeof KpiGridBase;

export const KpiCard = memo(KpiCardBase) as typeof KpiCardBase;
