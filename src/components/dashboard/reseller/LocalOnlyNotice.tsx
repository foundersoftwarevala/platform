import { useTranslation } from "@/lib/i18n/use-translation";

/** Said plainly on reseller modules that have no server storage behind them. */
export function LocalOnlyNotice() {
  const { t } = useTranslation();
  return (
    <p
      className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200"
      data-local-only
    >
      {t("reseller.local_only")}
    </p>
  );
}
