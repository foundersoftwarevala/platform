import { memo } from "react";
import { ArrowUpDown, Filter as FilterIcon } from "lucide-react";
import type { Kpi } from "@/lib/roles";
import { useTranslation } from "@/lib/i18n/use-translation";

export type KpiSort = "default" | "label_asc" | "label_desc" | "tone";
export type KpiTone = Kpi["tone"] | "all";

function KpiToolbarBase({
  tones, tone, onToneChange, sort, onSortChange,
}: {
  tones: KpiTone[];
  tone: KpiTone;
  onToneChange: (t: KpiTone) => void;
  sort: KpiSort;
  onSortChange: (s: KpiSort) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
        <FilterIcon className="h-3.5 w-3.5" /> {t("dashboard.kpi.filter")}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tones.map((option) => (
          <button
            key={option}
            onClick={() => onToneChange(option)}
            className={`rounded-full border px-2.5 py-1 text-[11px] capitalize transition ${
              tone === option
                ? "bg-brand text-brand-foreground border-transparent"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(`dashboard.kpi.tone_${option}`)}
          </button>
        ))}
      </div>
      <div className="ml-auto inline-flex items-center gap-2">
        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        <select
          aria-label={t("dashboard.kpi.sort")}
          value={sort}
          onChange={(e) => onSortChange(e.target.value as KpiSort)}
          className="rounded-lg border border-border bg-card px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-brand/50"
        >
          <option value="default">{t("dashboard.kpi.sort_default")}</option>
          <option value="label_asc">{t("dashboard.kpi.sort_label_asc")}</option>
          <option value="label_desc">{t("dashboard.kpi.sort_label_desc")}</option>
          <option value="tone">{t("dashboard.kpi.sort_tone")}</option>
        </select>
      </div>
    </div>
  );
}

export const KpiToolbar = memo(KpiToolbarBase) as typeof KpiToolbarBase;
