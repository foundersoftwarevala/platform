import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/lib/language-catalog";
import { AlertTriangle, Bug, CheckCircle2, ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { issuesQuery } from "../queries";
import { EmptyState, PanelHeader, PanelSkeleton, StatCard } from "../shared";

export function ErrorDetectionPanel() {
  const { translate: t } = useLanguage();
  const { data, isPending } = useQuery(issuesQuery);
  if (isPending || !data) return <PanelSkeleton />;

  const issues = data.data ?? [];
  const critical = issues.filter((i: any) => i.severity === "critical" && i.count > 0);
  const total = issues.reduce((sum: number, i: any) => sum + i.count, 0);

  const severityLabel = (severity: string) => {
    switch (severity) {
      case "critical":
        return t("Critical");
      case "warning":
        return t("Warning");
      case "success":
        return t("Success");
      default:
        return severity;
    }
  };

  return (
    <div className="space-y-6">
      <PanelHeader title={t("Error Detection")} description={t("Continuous scan for broken routes, APIs and permission gaps.")} icon={Bug} source={data.source} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("Open issues")} value={String(total)} tone={total ? "warning" : "success"} icon={ShieldAlert} />
        <StatCard label={t("Critical")} value={String(critical.reduce((s: number, i: any) => s + i.count, 0))} tone="danger" icon={ShieldAlert} />
        <StatCard label={t("Clean checks")} value={String(issues.length - critical.length)} tone="success" icon={ShieldCheck} />
      </div>
      {issues.length === 0 ? <EmptyState message={t("No diagnostics recorded.")} /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {(issues as any[]).map((issue) => (
            <article key={issue.id} className="rounded-xl border border-border/60 bg-surface/70 p-4 shadow-[var(--shadow-panel)]">
              <div className="flex items-start justify-between gap-3">
                <div><h2 className="text-sm font-semibold">{issue.label}</h2><p className="text-xs text-muted-foreground">{issue.category}</p></div>
                <Badge variant="outline" className={issue.severity === "critical" ? "border-destructive/50 text-destructive" : issue.severity === "warning" ? "border-warning/40 text-warning" : "border-success/40 text-success"}>{issue.count} {severityLabel(issue.severity)}</Badge>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{issue.detail ?? t("No anomalies detected in latest scan.")}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
