import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/lib/language-catalog";
import { Wallet } from "lucide-react";
import { creditsQuery } from "../queries";
import { EmptyState, formatMoney, PanelHeader, PanelSkeleton, StatCard } from "../shared";

export function CreditsPanel() {
  const { translate: t } = useLanguage();
  const { data, isPending } = useQuery(creditsQuery);
  if (isPending || !data) return <PanelSkeleton />;

  const credits = data.data;
  const money = (v: number | null | undefined) => (typeof v === "number" ? formatMoney(v) : "—");
  const unpriced = credits.unpricedMonth ?? 0;

  return (
    <div className="space-y-6">
      <PanelHeader
        title={t("Credits")}
        description={t("Usage, balance and top-up pressure signals.")}
        icon={Wallet}
        source={data.source}
      />
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label={t("Balance")} value={money(credits.balance)} />
        <StatCard label={t("Today usage")} value={money(credits.todayUsage)} tone="info" />
        <StatCard label={t("Month usage")} value={money(credits.monthUsage)} tone="warning" />
        <StatCard
          label={t("Runway")}
          value={typeof credits.runwayDays === "number" ? `${credits.runwayDays}d` : "—"}
          tone="success"
        />
      </div>
      {unpriced > 0 ? (
        <p className="text-xs text-muted-foreground">
          {t(
            "{n} AI calls this month reported no token usage (streamed replies), so their cost is not included above.",
          ).replace("{n}", String(unpriced))}
        </p>
      ) : null}
      <EmptyState message={data.reason ?? t("No credit transactions available.")} />
    </div>
  );
}
