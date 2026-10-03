import { useTranslation } from "@/lib/i18n/use-translation";

/**
 * Said plainly on reseller screens that have no server storage behind them.
 * `text` names the exact thing that is not stored, where the general sentence
 * would not be true.
 */
export function LocalOnlyNotice({ text }: { text?: string } = {}) {
  const { t } = useTranslation();
  return (
    <p
      className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200"
      data-local-only
    >
      {text ?? t("reseller.local_only")}
    </p>
  );
}
