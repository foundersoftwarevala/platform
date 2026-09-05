import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/lib/language-catalog";
import { Wallet } from "lucide-react";
import { creditsQuery } from "../queries";
import { EmptyState, PanelHeader, PanelSkeleton, StatCard } from "../shared";

export function CreditsPanel() {
  const { translate: t } = useLanguage();
  const { data, isPending } = useQuery(creditsQuery);
  if (isPending || !data) return <PanelSkeleton />;

  const credits = data.data ?? { balance: 0, todayUsage: 0, monthUsage: 0, runwayDays: 0, transactions: [], usage: [] };

  return (
    <div className="space-y-6">
      <PanelHeader title={t("Credits")} description={t("Usage, balance and top-up pressure signals.")} icon={Wallet} source={data.source} />
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label={t("Balance")} value={`${credits.balance ?? 0}`} />
        <StatCard label={t("Today usage")} value={`${credits.todayUsage ?? 0}`} tone="info" />
        <StatCard label={t("Month usage")} value={`${credits.monthUsage ?? 0}`} tone="warning" />
        <StatCard label={t("Runway")} value={`${credits.runwayDays ?? 0}d`} tone="success" />
      </div>
      {credits.transactions?.length ? (
        <div className="rounded-xl border border-border/60 bg-surface/60 p-4">
          <div className="grid gap-2 text-xs">
            {(credits.transactions as any[]).map((t) => <div className="flex justify-between border-b border-border/40 pb-2 last:border-0" key={t.id}><span>{t.reference}</span><span>{t.amount}</span></div>)}
          </div>
        </div>
      ) : <EmptyState message={t("No credit transactions available.")} />}
    </div>
  );
}
