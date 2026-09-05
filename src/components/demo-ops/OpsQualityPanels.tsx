/**
 * OPS — RESOURCE MONITOR, SCORES, SECURITY SCAN, USAGE ANALYTICS, SCREENSHOTS
 */

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Camera, Cpu, Gauge, LineChart, ShieldAlert } from "lucide-react";
import { DataStateNotice } from "@/components/demo-manager/DataStateNotice";
import { useAuth } from "@/hooks/useAuth";
import { CheckList, MetricRow, MonitorGap, OpsSection, StateBadge } from "./OpsPrimitives";
import { useOpsAccessibility, useOpsAnalytics, useOpsCredentials, useOpsDemos } from "@/hooks/useDemoOps";
import { performanceScore, safeUrl, scoreTone, securityChecks } from "@/lib/demo-ops";
import { cn } from "@/lib/utils";

export function OpsScorePanel() {
  const { user } = useAuth();
  const demosQuery = useOpsDemos();
  const a11yQuery = useOpsAccessibility();
  const demos = demosQuery.data ?? [];

  const rows = useMemo(
    () =>
      demos
        .map((d) => {
          const host = safeUrl(d.url)?.hostname ?? "";
          const a11y = (a11yQuery.data ?? []).find((r: any) =>
            host && typeof r.page_url === "string" ? r.page_url.includes(host) : false,
          );
          return { demo: d, score: performanceScore(d), a11y };
        })
        .sort((a, b) => (a.score ?? 999) - (b.score ?? 999)),
    [demos, a11yQuery.data],
  );

  return (
    <OpsSection
      title="Performance, Accessibility & Resource Monitor"
      description="Performance score is computed from stored response_time_ms and uptime_percentage. Accessibility comes from accessibility_compliance matched on host. Lighthouse, SEO and host resources are reported as not monitored."
      icon={Gauge}
    >
      <div className="space-y-4">
        <DataStateNotice
          isLoading={demosQuery.isLoading}
          error={demosQuery.error}
          isEmpty={!demosQuery.isLoading && !demosQuery.error && rows.length === 0}
          hasSession={Boolean(user)}
          resource="performance scores"
          emptyTitle="No demos to score"
          emptyDescription="Scores derive from latency and uptime recorded on each demo."
          onRetry={() => void demosQuery.refetch()}
        >
          <div className="space-y-2">
            {rows.slice(0, 25).map(({ demo, score, a11y }) => (
              <div key={demo.id} className="rounded-lg border border-border/40 bg-background/40 p-3 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground truncate">{demo.title}</p>
                  <p className="text-[11px] font-mono text-muted-foreground">
                    {demo.response_time_ms ?? "—"} ms · uptime {demo.uptime_percentage ?? "—"}%
                  </p>
                </div>
                <StateBadge state={scoreTone(score)} label={score === null ? "no data" : `perf ${score}`} />
                {a11y ? (
                  <Badge variant="outline" className="text-[9px]">
                    WCAG {String((a11y as any).wcag_level ?? "—")} · {String((a11y as any).status ?? "—")}
                  </Badge>
                ) : (
                  <StateBadge state="unmonitored" label="a11y n/a" />
                )}
              </div>
            ))}
          </div>
        </DataStateNotice>

        <div className="grid gap-3 md:grid-cols-2">
          <MonitorGap
            title="Resource monitor — CPU · RAM · Storage · Bandwidth"
            requirement="Host metrics need an agent or hosting API reporting per demo. No resource samples are stored, so no values are shown."
            fields={["cpu_percent, memory_mb, storage_gb, bandwidth_gb, sampled_at"]}
          />
          <MonitorGap
            title="Lighthouse & SEO score"
            requirement="Lighthouse and SEO audits must be run per demo URL and persisted before scores can be trusted here."
            fields={["lighthouse_performance, lighthouse_seo, lighthouse_best_practices, audited_at"]}
          />
        </div>
      </div>
    </OpsSection>
  );
}

export function OpsSecurityPanel() {
  const { user } = useAuth();
  const demosQuery = useOpsDemos();
  const credsQuery = useOpsCredentials();
  const demos = demosQuery.data ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const active = demos.find((d) => d.id === selected) ?? demos[0] ?? null;
  const creds = (credsQuery.data ?? []).filter((c) => c.demo_id === active?.id);

  return (
    <OpsSection
      title="Security Scan"
      description="SSL scheme, weak/default demo passwords and destructive-action locks are checked against real rows. Header, exposed-file and debug-mode probes are labelled unmonitored."
      icon={ShieldAlert}
      actions={
        demos.length > 0 ? (
          <select
            value={active?.id ?? ""}
            onChange={(e) => setSelected(e.target.value)}
            className="h-8 max-w-[260px] rounded-md border border-border/50 bg-background/60 px-2 text-xs"
          >
            {demos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        ) : undefined
      }
    >
      <DataStateNotice
        isLoading={demosQuery.isLoading || credsQuery.isLoading}
        error={demosQuery.error}
        isEmpty={!demosQuery.isLoading && !demosQuery.error && demos.length === 0}
        hasSession={Boolean(user)}
        resource="security posture"
        emptyTitle="No demos to scan"
        emptyDescription="Security checks run per demo record."
        onRetry={() => void demosQuery.refetch()}
      >
        {active && <CheckList checks={securityChecks(active, creds)} />}
      </DataStateNotice>
    </OpsSection>
  );
}

export function OpsAnalyticsPanel() {
  const { user } = useAuth();
  const analyticsQuery = useOpsAnalytics();
  const rowsData = analyticsQuery.data ?? [];

  const totals = useMemo(() => {
    let views = 0;
    let unique = 0;
    let durationWeighted = 0;
    let bounceWeighted = 0;
    let weight = 0;
    const pages = new Map<string, number>();
    rowsData.forEach((r) => {
      views += r.total_views ?? 0;
      unique += r.unique_views ?? 0;
      const w = r.unique_views ?? 1;
      durationWeighted += (r.avg_duration_seconds ?? 0) * w;
      bounceWeighted += (r.bounce_rate ?? 0) * w;
      weight += w;
      const top = r.top_pages as unknown;
      if (Array.isArray(top)) {
        top.forEach((p: any) => {
          const key = typeof p === "string" ? p : (p?.path ?? p?.page);
          if (key) pages.set(key, (pages.get(key) ?? 0) + Number(p?.views ?? 1));
        });
      }
    });
    const topPage = [...pages.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
    return {
      views,
      unique,
      avgDuration: weight ? Math.round(durationWeighted / weight) : null,
      bounce: weight ? bounceWeighted / weight : null,
      topPage,
    };
  }, [rowsData]);

  return (
    <OpsSection
      title="Demo Usage Analytics"
      description="Visitors, active users, time spent, most-viewed page and bounce rate aggregated from demo_analytics."
      icon={LineChart}
    >
      <div className="space-y-4">
        <DataStateNotice
          isLoading={analyticsQuery.isLoading}
          error={analyticsQuery.error}
          isEmpty={!analyticsQuery.isLoading && !analyticsQuery.error && rowsData.length === 0}
          hasSession={Boolean(user)}
          resource="usage analytics"
          emptyTitle="No analytics recorded yet"
          emptyDescription="Rows appear as soon as demo_analytics receives daily aggregates."
          onRetry={() => void analyticsQuery.refetch()}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-border/40 bg-background/40 p-3">
              <MetricRow label="Total visits" value={totals.views.toLocaleString()} />
              <MetricRow label="Unique visitors" value={totals.unique.toLocaleString()} />
              <MetricRow
                label="Avg time spent"
                value={totals.avgDuration === null ? "—" : `${Math.floor(totals.avgDuration / 60)}m ${totals.avgDuration % 60}s`}
              />
              <MetricRow label="Bounce rate" value={totals.bounce === null ? "—" : `${totals.bounce.toFixed(1)}%`} />
              <MetricRow label="Most viewed page" value={totals.topPage ? totals.topPage[0] : "—"} />
              <MetricRow label="Days aggregated" value={rowsData.length} />
            </div>
            <div className="rounded-lg border border-border/40 bg-background/40 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-foreground">Most recent daily rows</p>
              {rowsData.slice(0, 10).map((r) => (
                <div key={r.id} className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                  <span>{r.date}</span>
                  <span>
                    {r.total_views ?? 0} views · {r.unique_views ?? 0} unique
                  </span>
                </div>
              ))}
            </div>
          </div>
        </DataStateNotice>
      </div>
    </OpsSection>
  );
}

export function OpsScreenshotPanel() {
  return (
    <OpsSection
      title="Auto Screenshot Monitor"
      description="Homepage, login and dashboard captures with previous-run comparison for broken-UI detection."
      icon={Camera}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <MonitorGap
          title="Screenshot capture pipeline"
          requirement="Screenshots require a headless-browser worker that captures each demo URL on a schedule and stores the image plus a perceptual hash. No captures exist yet, so no images or diffs are displayed."
          fields={[
            "capture: demo_id, view (homepage|login|dashboard), image_path, captured_at",
            "diff: previous_hash, current_hash, diff_ratio, broken_ui flag",
          ]}
        />
        <div className="rounded-lg border border-border/40 bg-background/40 p-3 space-y-2">
          <p className="text-xs font-semibold text-foreground">Views this monitor will track</p>
          {["Homepage screenshot", "Login screenshot", "Dashboard screenshot", "Compare previous screenshot", "Detect broken UI"].map(
            (item) => (
              <div key={item} className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">{item}</span>
                <StateBadge state="unmonitored" label="awaiting capture" />
              </div>
            ),
          )}
        </div>
      </div>
    </OpsSection>
  );
}

export function OpsResourceStrip() {
  return (
    <div className={cn("grid gap-3 md:grid-cols-4")}>
      {["CPU", "RAM", "Storage", "Bandwidth"].map((label) => (
        <div key={label} className="glass-panel rounded-xl border border-dashed border-border/50 p-4 space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <Cpu className="w-4 h-4 text-muted-foreground" />
          </div>
          <StateBadge state="unmonitored" label="no agent" />
        </div>
      ))}
    </div>
  );
}
