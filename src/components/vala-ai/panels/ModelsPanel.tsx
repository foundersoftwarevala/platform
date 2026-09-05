import { useQuery } from "@tanstack/react-query";
import { Cpu } from "lucide-react";
import { useLanguage } from "@/lib/language-catalog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { modelsQuery } from "../queries";
import { EmptyState, PanelHeader, PanelSkeleton, StatCard } from "../shared";

export function ModelsPanel() {
  const { translate: t } = useLanguage();
  const { data, isPending } = useQuery(modelsQuery);
  if (isPending || !data) return <PanelSkeleton />;

  const models = data.data ?? [];
  const totalRequests = models.reduce((s: number, m: any) => s + (m.requests ?? 0), 0);
  const avgLatency = models.length ? Math.round(models.reduce((s: number, m: any) => s + (m.latencyMs ?? 0), 0) / models.length) : 0;

  return (
    <div className="space-y-6">
      <PanelHeader title={t("AI Models")} description={t("Routing pool used by the VALA AI command engine.")} icon={Cpu} source={data.source} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("Models")} value={String(models.length)} />
        <StatCard label={t("Requests (30d)")} value={String(totalRequests)} tone="info" />
        <StatCard label={t("Avg. latency")} value={`${avgLatency}ms`} tone="success" />
      </div>
      {models.length === 0 ? <EmptyState message={t("No models registered.")} /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {(models as any[]).map((model) => (
            <article key={model.id} className="rounded-xl border border-border/60 bg-surface/70 p-4 shadow-[var(--shadow-panel)]">
              <div className="flex items-start justify-between gap-3">
                <div><h2 className="font-semibold">{model.name}</h2><p className="text-xs text-muted-foreground">{model.provider}</p></div>
                <Badge variant="outline" className={model.status === "active" ? "border-success/40 text-success" : "border-border text-muted-foreground"}>{t(model.status.charAt(0).toUpperCase() + model.status.slice(1))}</Badge>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-muted-foreground">{t("Requests")}</dt><dd className="font-semibold">{(model.requests ?? 0).toLocaleString()}</dd></div><div><dt className="text-muted-foreground">{t("Latency")}</dt><dd className="font-semibold">{model.latencyMs ?? 0}ms</dd></div></dl>
              <div className="mt-4"><div className="mb-1 flex justify-between text-[11px] text-muted-foreground"><span>{t("Load")}</span><span>{model.load ?? 0}%</span></div><Progress value={model.load ?? 0} /></div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
