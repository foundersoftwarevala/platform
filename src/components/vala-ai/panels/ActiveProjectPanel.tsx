import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/lib/language-catalog";
import { FolderOpen, Globe, Layers, Rocket } from "lucide-react";
import { projectsQuery } from "../queries";
import { EmptyState, PanelHeader, PanelSkeleton, relativeTime, StatCard } from "../shared";

export function ActiveProjectPanel() {
  const { translate: t } = useLanguage();
  const { data, isPending } = useQuery(projectsQuery);
  if (isPending || !data) return <PanelSkeleton />;

  const projects = data.data ?? [];

  return (
    <div className="space-y-6">
      <PanelHeader title={t("Active Projects")} description={t("Track runtime project health, stack, and deployment visibility.")} icon={FolderOpen} source={data.source} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("Projects")} value={String(projects.length)} />
        <StatCard label={t("Active")} value={String(projects.filter((p: any) => p.status === "active").length)} tone="success" icon={Rocket} />
        <StatCard label={t("Build")} value={String(projects.filter((p: any) => p.status === "building").length)} tone="info" icon={Layers} />
      </div>
      {projects.length === 0 ? <EmptyState message={t("No active project records available.")} /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {(projects as any[]).map((p) => (
            <article key={p.id} className="rounded-xl border border-border/60 bg-surface/70 p-4 shadow-[var(--shadow-panel)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-foreground">{p.title}</h2>
                  <p className="text-xs text-muted-foreground">{p.stack ?? t("Unknown stack")}</p>
                </div>
                <span className="rounded-full border border-primary/40 px-2 py-1 text-[10px] uppercase text-primary">{t(p.status.charAt(0).toUpperCase() + p.status.slice(1))}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div><dt className="text-muted-foreground">{t("URL")}</dt><dd className="font-medium">{p.url ?? "—"}</dd></div>
                <div><dt className="text-muted-foreground">{t("Last deploy")}</dt><dd className="font-medium">{relativeTime(p.lastDeploy)}</dd></div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
