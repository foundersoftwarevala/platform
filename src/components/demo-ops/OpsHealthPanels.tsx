/**
 * OPS — DASHBOARD KPIs + HEALTH MONITOR + AUTO DETECTION
 */

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Gauge,
  Heart,
  MonitorOff,
  RefreshCw,
  Search,
  ShieldAlert,
  Timer,
  Wrench,
  Palette,
  Server,
  Clock,
  Sparkles,
} from "lucide-react";
import { DataStateNotice } from "@/components/demo-manager/DataStateNotice";
import { useAuth } from "@/hooks/useAuth";
import { HealthBadge, KpiTile, OpsSection } from "./OpsPrimitives";
import { useOpsActions, useOpsDemos, useOpsDetections, useOpsKpis } from "@/hooks/useDemoOps";
import {
  DETECTION_LABELS,
  HEALTH_META,
  daysUntil,
  healthStateOf,
  performanceScore,
  relativeTime,
  rootCauseFor,
  type DetectionKind,
  type HealthState,
} from "@/lib/demo-ops";
import { cn } from "@/lib/utils";

export function OpsKpiGrid() {
  const { user } = useAuth();
  const { kpis, isLoading, error, refetch } = useOpsKpis();

  return (
    <OpsSection
      title="Dashboard KPIs"
      description="Every tile is computed from live rows in demos, demo_alerts, demo_escalations, demo_login_credentials and demo_validation_logs."
      icon={Gauge}
      badge="LIVE"
      actions={
        <Button size="sm" variant="outline" onClick={refetch} disabled={isLoading}>
          <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", isLoading && "animate-spin")} />
          Recheck
        </Button>
      }
    >
      <DataStateNotice
        isLoading={isLoading}
        error={error}
        isEmpty={!isLoading && !error && kpis.total === 0}
        hasSession={Boolean(user)}
        resource="demo fleet KPIs"
        emptyTitle="No demos registered"
        emptyDescription="KPIs populate as soon as the demos table has records."
        onRetry={refetch}
      >
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <KpiTile label="Total Demos" value={kpis.total} icon={Server} />
          <KpiTile label="Live Demos" value={kpis.live} tone="good" icon={CheckCircle2} />
          <KpiTile label="Offline Demos" value={kpis.offline} tone={kpis.offline ? "bad" : "good"} icon={MonitorOff} />
          <KpiTile label="Failed Demos" value={kpis.failed} tone={kpis.failed ? "bad" : "good"} icon={AlertOctagon} />
          <KpiTile
            label="Pending Fixes"
            value={kpis.pendingFixes}
            tone={kpis.pendingFixes ? "warn" : "good"}
            icon={Wrench}
            hint="Open escalations"
          />
          <KpiTile
            label="Expiring Soon"
            value={kpis.expiringSoon}
            tone={kpis.expiringSoon ? "warn" : "good"}
            icon={Timer}
            hint="≤ 7 days"
          />
          <KpiTile
            label="SSL / HTTPS Issues"
            value={kpis.insecureUrls}
            tone={kpis.insecureUrls ? "bad" : "good"}
            icon={ShieldAlert}
            hint="Non-HTTPS demo URLs"
          />
          <KpiTile
            label="Branding Issues"
            value={kpis.brandingIssues}
            tone={kpis.brandingIssues ? "warn" : "good"}
            icon={Palette}
          />
          <KpiTile
            label="Performance Issues"
            value={kpis.performanceIssues}
            tone={kpis.performanceIssues ? "warn" : "good"}
            icon={Gauge}
            hint="Score < 70"
          />
          <KpiTile
            label="Security Issues"
            value={kpis.securityIssues}
            tone={kpis.securityIssues ? "bad" : "good"}
            icon={ShieldAlert}
          />
          <KpiTile
            label="Auto Fixed Today"
            value={kpis.autoFixedToday}
            tone="good"
            icon={Sparkles}
            hint="System-verified healthy"
          />
          <KpiTile
            label="Manual Fix Required"
            value={kpis.manualFixRequired}
            tone={kpis.manualFixRequired ? "warn" : "good"}
            icon={AlertTriangle}
          />
        </div>
      </DataStateNotice>
    </OpsSection>
  );
}

const HEALTH_ORDER: HealthState[] = ["live", "slow", "error", "offline", "maintenance"];

export function OpsHealthMonitor() {
  const { user } = useAuth();
  const demosQuery = useOpsDemos();
  const { runAction } = useOpsActions();
  const [filter, setFilter] = useState<HealthState | "all">("all");
  const [search, setSearch] = useState("");

  const demos = demosQuery.data ?? [];
  const counts = useMemo(() => {
    const base: Record<HealthState, number> = { live: 0, slow: 0, error: 0, offline: 0, maintenance: 0 };
    demos.forEach((d) => (base[healthStateOf(d)] += 1));
    return base;
  }, [demos]);

  const visible = demos.filter((d) => {
    const state = healthStateOf(d);
    const matchState = filter === "all" || state === filter;
    const q = search.trim().toLowerCase();
    const matchSearch = !q || d.title?.toLowerCase().includes(q) || d.url?.toLowerCase().includes(q);
    return matchState && matchSearch;
  });

  return (
    <OpsSection
      title="Demo Health Monitor"
      description="Live · Slow · Error · Offline · Maintenance — classified from demos.status, http_status and response_time_ms."
      icon={Heart}
      badge="REAL-TIME"
      actions={
        <Button size="sm" variant="outline" onClick={() => void demosQuery.refetch()} disabled={demosQuery.isFetching}>
          <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", demosQuery.isFetching && "animate-spin")} />
          Refresh
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "rounded-full border px-3 py-1 text-[10px] font-mono uppercase",
              filter === "all"
                ? "border-neon-teal/50 bg-neon-teal/10 text-neon-teal"
                : "border-border/50 text-muted-foreground hover:text-foreground",
            )}
          >
            All · {demos.length}
          </button>
          {HEALTH_ORDER.map((state) => {
            const meta = HEALTH_META[state];
            return (
              <button
                key={state}
                onClick={() => setFilter(state)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[10px] font-mono uppercase",
                  filter === state
                    ? cn(meta.border, meta.bg, meta.text)
                    : "border-border/50 text-muted-foreground hover:text-foreground",
                )}
              >
                {meta.label} · {counts[state]}
              </button>
            );
          })}
          <div className="relative ml-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search demo or URL"
              className="h-8 w-56 pl-8 text-xs"
            />
          </div>
        </div>

        <DataStateNotice
          isLoading={demosQuery.isLoading}
          error={demosQuery.error}
          isEmpty={!demosQuery.isLoading && !demosQuery.error && visible.length === 0}
          hasSession={Boolean(user)}
          resource="demo health"
          emptyTitle="No demos in this state"
          emptyDescription="Change the filter or clear the search to see the rest of the fleet."
          onRetry={() => void demosQuery.refetch()}
        >
          <div className="space-y-2">
            {visible.slice(0, 60).map((demo) => {
              const state = healthStateOf(demo);
              const score = performanceScore(demo);
              const expiry = daysUntil(demo.expiry_date);
              return (
                <div
                  key={demo.id}
                  className="rounded-lg border border-border/40 bg-background/40 p-3 flex flex-wrap items-center gap-3"
                >
                  <HealthBadge state={state} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">{demo.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate font-mono">{demo.url}</p>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] font-mono text-muted-foreground">
                    <span title="Last recorded HTTP status">HTTP {demo.http_status ?? "—"}</span>
                    <span title="Response time">{demo.response_time_ms ?? "—"} ms</span>
                    <span title="Uptime">{demo.uptime_percentage?.toFixed?.(1) ?? "—"}%</span>
                    <span title="Derived performance score">score {score ?? "—"}</span>
                    <span title="Last health check" className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {relativeTime(demo.last_health_check)}
                    </span>
                    {expiry !== null && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px]",
                          expiry < 0
                            ? "border-red-500/40 text-red-400"
                            : expiry <= 7
                              ? "border-amber-500/40 text-amber-400"
                              : "border-border/50",
                        )}
                      >
                        {expiry < 0 ? "expired" : `${expiry}d left`}
                      </Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    disabled={runAction.isPending}
                    onClick={() => runAction.mutate({ demo, action: "recheck" })}
                  >
                    <Activity className="w-3 h-3 mr-1" />
                    Re-check
                  </Button>
                </div>
              );
            })}
            {visible.length > 60 && (
              <p className="text-[11px] text-muted-foreground">
                Showing the 60 most recently updated of {visible.length} matching demos.
              </p>
            )}
          </div>
        </DataStateNotice>
      </div>
    </OpsSection>
  );
}

const DETECTION_ORDER: DetectionKind[] = ["404", "500", "blank", "build", "api", "database", "login"];

export function OpsDetectionPanel() {
  const { user } = useAuth();
  const { hits, isLoading, error, refetch } = useOpsDetections();
  const [kind, setKind] = useState<DetectionKind | "all">("all");

  const counts = useMemo(() => {
    const base = Object.fromEntries(DETECTION_ORDER.map((k) => [k, 0])) as Record<DetectionKind, number>;
    hits.forEach((h) => (base[h.kind] += 1));
    return base;
  }, [hits]);

  const visible = kind === "all" ? hits : hits.filter((h) => h.kind === kind);

  return (
    <OpsSection
      title="Auto Failure Detection"
      description="404, 500, blank screen, build, API, database and login failures matched from demos.http_status and demo_validation_logs error signatures."
      icon={AlertOctagon}
      actions={
        <Button size="sm" variant="outline" onClick={refetch} disabled={isLoading}>
          <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", isLoading && "animate-spin")} />
          Rescan
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
          {DETECTION_ORDER.map((k) => (
            <button
              key={k}
              onClick={() => setKind(kind === k ? "all" : k)}
              className={cn(
                "rounded-lg border p-2 text-left transition-colors",
                kind === k ? "border-neon-teal/50 bg-neon-teal/10" : "border-border/40 hover:border-border",
              )}
            >
              <p className="text-[10px] uppercase text-muted-foreground truncate">{DETECTION_LABELS[k]}</p>
              <p className={cn("text-lg font-mono font-bold", counts[k] ? "text-red-400" : "text-emerald-400")}>
                {counts[k]}
              </p>
            </button>
          ))}
        </div>

        <DataStateNotice
          isLoading={isLoading}
          error={error}
          isEmpty={!isLoading && !error && visible.length === 0}
          hasSession={Boolean(user)}
          resource="failure detections"
          emptyTitle="No failures detected"
          emptyDescription="No stored HTTP status or validation log matches a failure signature."
          onRetry={refetch}
        >
          <div className="space-y-2">
            {visible.slice(0, 40).map((hit, index) => {
              const rc = rootCauseFor(hit.kind);
              return (
                <div key={`${hit.demoId}-${hit.kind}-${index}`} className="rounded-lg border border-border/40 bg-background/40 p-3 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[9px] border-red-500/40 text-red-400">
                      {DETECTION_LABELS[hit.kind]}
                    </Badge>
                    <span className="text-xs font-medium text-foreground truncate">{hit.demoTitle}</span>
                    <span className="ml-auto text-[10px] font-mono text-muted-foreground">{relativeTime(hit.at)}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground break-words">{hit.evidence}</p>
                  <p className="text-[11px] text-muted-foreground/80">
                    <span className="text-foreground font-medium">Likely cause: </span>
                    {rc.cause}
                  </p>
                </div>
              );
            })}
          </div>
        </DataStateNotice>
      </div>
    </OpsSection>
  );
}
