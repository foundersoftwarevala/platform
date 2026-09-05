import { useQuery } from "@tanstack/react-query";
import { Lock, Unlock } from "lucide-react";
import { useLanguage } from "@/lib/language-catalog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { lockQuery } from "../queries";
import { PanelHeader, PanelSkeleton } from "../shared";

export function LockStatusPanel() {
  const { translate: t } = useLanguage();
  const { data, isPending } = useQuery(lockQuery);
  if (isPending || !data) return <PanelSkeleton />;

  const state = data.data ?? { locked: true, reason: "Write lock active", changedBy: "system", updatedAt: new Date().toISOString() };

  return (
    <div className="space-y-6">
      <PanelHeader title={t("Lock Status")} description={t("Inspect and change VALA AI write lock state.")} icon={Lock} source={data.source} />
      <div className="rounded-xl border border-border bg-surface/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><h2 className="text-lg font-semibold">{t("System Lock")}</h2><p className="text-sm text-muted-foreground">{state.reason ?? t("No reason")}</p></div>
          <Badge variant="outline" className={state.locked ? "border-success/50 text-success" : "border-warning/50 text-warning"}>{state.locked ? t("Active") : t("Disabled")}</Badge>
        </div>
        <div className="mt-6 flex items-center gap-3"><Button variant={state.locked ? "default" : "outline"}> {state.locked ? <Lock className="mr-2 size-4" /> : <Unlock className="mr-2 size-4" />} {state.locked ? t("Lock armed") : t("Unlock")}</Button><span className="text-xs text-muted-foreground">{t("Changed by")} {state.changedBy ?? t("system")} • {new Date(state.updatedAt).toLocaleString()}</span></div>
      </div>
    </div>
  );
}
