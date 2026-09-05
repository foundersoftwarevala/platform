import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, FileText, XCircle } from "lucide-react";
import { useLanguage } from "@/lib/language-catalog";
import { logsQuery } from "../queries";
import { EmptyState, PanelHeader, PanelSkeleton, relativeTime, StatCard } from "../shared";

type Filter = "all" | "success" | "warning" | "error";

export function ExecutionLogsPanel() {
  const { translate: t } = useLanguage();
  const { data, isPending } = useQuery(logsQuery);
  const [filter, setFilter] = useState<Filter>("all");

  const logs = data?.data ?? [];
  const filtered = useMemo(() => (filter === "all" ? logs : logs.filter((l: any) => l.status === filter)), [logs, filter]);

  if (isPending || !data) return <PanelSkeleton />;

  const avg = logs.length ? Math.round(logs.reduce((sum: number, l: any) => sum + l.durationMs, 0) / logs.length) : 0;

  return (
    <div className="space-y-6">
      <PanelHeader title={t("Execution Logs")} description={t("Every command executed against the platform, with latency and outcome.")} icon={FileText} source={data.source} />
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label={t("Total")} value={String(logs.length)} />
        <StatCard label={t("Success")} value={String(logs.filter((l: any) => l.status === "success").length)} tone="success" />
        <StatCard label={t("Warnings")} value={String(logs.filter((l: any) => l.status === "warning").length)} tone="warning" />
        <StatCard label={t("Avg latency")} value={`${avg}ms`} tone="info" />
      </div>
      <div className="flex items-center gap-2">
        {(["all", "success", "warning", "error"] as Filter[]).map((f) => (
          <button key={f} className="rounded border px-3 py-1 text-xs" onClick={() => setFilter(f)}>{t(f === "all" ? "All" : f === "success" ? "Success" : f === "warning" ? "Warnings" : "Errors")}</button>
        ))}
      </div>
      {filtered.length === 0 ? <EmptyState message={t("No execution logs available.")} /> : (
        <div className="rounded-xl border border-border/60 bg-surface/60">
          <ul className="divide-y divide-border/60">
            {(filtered as any[]).map((log) => (
              <li key={log.id} className="flex items-center gap-3 p-3 text-sm">
                {log.status === "success" ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : log.status === "error" ? <XCircle className="size-4 shrink-0 text-destructive" /> : <AlertTriangle className="size-4 shrink-0 text-warning" />}
                <div className="min-w-0 flex-1"><p className="truncate font-mono">{log.command}</p><p className="text-xs text-muted-foreground">{log.projectTitle ?? t("No project")} • {relativeTime(log.createdAt)}</p></div>
                <span className="text-xs text-muted-foreground">{log.durationMs}ms</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
