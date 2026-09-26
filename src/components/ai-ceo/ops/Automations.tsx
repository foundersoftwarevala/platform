import { Play, Power, Repeat, Workflow } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";

import {
  DegradedNotice,
  EmptyState,
  ErrorState,
  LoadingState,
  PageBanner,
  PageShell,
} from "@/components/ai-ceo/PageShell";
import { Badge } from "@/components/ui/badge";
import { useCEOOps } from "@/hooks/useCEOOps";

import { Day, Figure, OpsTable, OpsTile } from "./shared";

/**
 * Every automation rule on the platform, from all four tables that hold them.
 *
 * Four managers each grew their own automation table — `automation_rules`,
 * `marketing_automations`, `seo_automations` and `tm_automations` — and they
 * disagree even about column names. The obvious move is to pick the biggest
 * one and call it the list; that would quietly hide three quarters of what is
 * running.
 *
 * So every row carries the table it came from. An executive asking "what runs
 * by itself around here" gets one answer, and anyone who needs to go and
 * change a rule knows where it lives.
 */
export function AutomationsWorkspace() {
  const { t } = useTranslation();
  const { automations, summary, sources, degraded, isLoading, failed, refetch } = useCEOOps();

  if (isLoading) {
    return (
      <PageShell>
        <PageBanner
          eyebrow="AI CEO · Operations"
          title={t("ceo.automations")}
          subtitle="Everything that runs without being asked, across all four rule tables."
          icon={Workflow}
        />
        <LoadingState label={t("ceo.automations_loading")} />
      </PageShell>
    );
  }

  if (failed) {
    return (
      <PageShell>
        <PageBanner eyebrow="AI CEO · Operations" title={t("ceo.automations")} icon={Workflow} />
        <ErrorState
          title={t("ceo.automations_failed")}
          description="None of the four automation tables could be read, so this screen cannot say what is running."
          onRetry={() => void refetch()}
        />
      </PageShell>
    );
  }

  const byTable = automations.reduce<Record<string, number>>((acc, row) => {
    acc[row.source] = (acc[row.source] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <PageShell>
      <PageBanner
        eyebrow="AI CEO · Operations"
        title={t("ceo.automations")}
        subtitle="Everything that runs without being asked, across all four rule tables."
        icon={Workflow}
        status={`${summary.automationsEnabled ?? 0} of ${summary.automations ?? 0} enabled`}
      />

      {degraded.length > 0 && <DegradedNotice sources={degraded} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OpsTile label={t("ceo.rules")} value={summary.automations} icon={Workflow} />
        <OpsTile
          label={t("ceo.enabled")}
          value={summary.automationsEnabled}
          icon={Power}
          tone="success"
        />
        <OpsTile
          label={t("ceo.runs_recorded")}
          value={automations.reduce<number | null>(
            (total, a) => (a.runCount === null ? total : (total ?? 0) + a.runCount),
            null,
          )}
          icon={Repeat}
        />
        <OpsTile
          label={t("ceo.source_tables")}
          value={Object.keys(byTable).length || null}
          icon={Play}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {Object.entries(byTable).map(([table, count]) => (
          <Badge key={table} variant="outline" className="font-mono text-[10px]">
            {table} · {count}
          </Badge>
        ))}
      </div>

      <OpsTable
        head={["Rule", "Trigger", "Action", "State", "Runs", "Last run", "Table"]}
        rows={automations.map((rule) => [
          <span key="n" className="font-medium">
            {rule.name}
            {rule.description && (
              <span className="mt-0.5 block max-w-[320px] truncate text-[11px] font-normal text-muted-foreground">
                {rule.description}
              </span>
            )}
          </span>,
          <span key="t" className="text-xs">
            {rule.trigger ?? "—"}
          </span>,
          <span key="a" className="text-xs">
            {rule.action ?? "—"}
          </span>,
          <Badge
            key="s"
            variant="outline"
            className={
              rule.enabled
                ? "border-accent-emerald/30 bg-accent-emerald/20 text-accent-emerald"
                : "border-border text-muted-foreground"
            }
          >
            {rule.enabled ? t("ceo.enabled") : t("ceo.disabled")}
          </Badge>,
          <Figure key="r" value={rule.runCount} />,
          <Day key="l" value={rule.lastRunAt} />,
          <code key="src" className="rounded bg-muted/60 px-1 py-0.5 font-mono text-[10px]">
            {rule.source}
          </code>,
        ])}
        empty={
          <EmptyState
            icon={Workflow}
            title={t("ceo.automations_empty")}
            description={`None of the four tables (${sources.automations ?? ""}) holds a rule. Nothing here is simulated, so the list stays empty until one is created.`}
          />
        }
      />
    </PageShell>
  );
}
