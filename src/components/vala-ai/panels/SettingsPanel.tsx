import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/lib/language-catalog";
import { Settings } from "lucide-react";
import { settingsQuery } from "../queries";
import { EmptyState, PanelHeader, PanelSkeleton } from "../shared";

export function SettingsPanel() {
  const { translate: t } = useLanguage();
  const { data, isPending } = useQuery(settingsQuery);
  if (isPending || !data) return <PanelSkeleton />;

  const settings = data.data ?? [];

  return (
    <div className="space-y-6">
      <PanelHeader title={t("Module Settings")} description={t("Governed VALA AI platform configuration.")} icon={Settings} source={data.source} />
      {settings.length === 0 ? <EmptyState message={t("No settings rows found.")} /> : (
        <div className="grid gap-3">
          {(settings as any[]).map((s) => (
            <article key={s.id} className="rounded-xl border border-border/60 bg-surface/70 p-4">
              <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">{s.label ?? s.key}</h2><span className="text-xs uppercase text-muted-foreground">{t(s.enabled ? "enabled" : "disabled")}</span></div>
              <p className="mt-2 text-xs text-muted-foreground">{s.description ?? t("No description")}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
