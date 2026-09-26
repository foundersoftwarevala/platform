import { motion } from "framer-motion";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Clock,
  Gauge,
  ShieldAlert,
  Target,
} from "lucide-react";

import {
  DegradedNotice,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ai-ceo/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFounderState } from "@/hooks/useFounderState";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { AttentionItem, Kpi, PendingApproval, Risk } from "@/lib/founder/state.types";

/**
 * What the Command Center knows, beyond what it can count.
 *
 * The dashboard above this already counts the platform honestly — orders,
 * accounts, errors, latency, each from a named table, each showing a dash
 * where nothing is tracked. What it could not do was say anything about the
 * company: what needs attention, which KPI has drifted, what is waiting on a
 * human, which domain is unhealthy and why.
 *
 * All of that already exists in the operating state built by Part 3 and the
 * governance built by Part 4. Nothing here queries a table directly and no
 * figure here is computed in the browser: it reads the same assembled state
 * the rest of the Founder AI uses, so there is one answer to "how is the
 * company doing" rather than two that can disagree.
 *
 * Every row says where it came from and when it was measured. An empty list
 * means the register is empty, which is worth showing; a failed read says so
 * separately, because "nothing needs attention" and "we could not find out"
 * must never look the same.
 */

const severityStyle = (severity: string): string => {
  switch (severity) {
    case "CRITICAL":
      return "bg-destructive/20 text-destructive border-destructive/30";
    case "HIGH":
      return "bg-accent-amber/20 text-accent-amber border-accent-amber/30";
    case "MEDIUM":
      return "bg-primary/20 text-primary-glow border-primary/30";
    default:
      return "bg-accent-emerald/20 text-accent-emerald border-accent-emerald/30";
  }
};

const healthStyle = (health: string): string => {
  switch (health) {
    case "CRITICAL":
      return "bg-destructive/20 text-destructive";
    case "AT_RISK":
      return "bg-accent-amber/20 text-accent-amber";
    case "HEALTHY":
      return "bg-accent-emerald/20 text-accent-emerald";
    default:
      return "bg-muted/20 text-muted-foreground";
  }
};

/**
 * Freshness in words, so a stale figure cannot pass as a current one.
 *
 * The return type is the union of the four keys rather than `string`, so the
 * catalogue and this function cannot drift apart without the compiler saying
 * so.
 */
type FreshnessKey = "ceo.ci_fresh" | "ceo.ci_ageing" | "ceo.ci_stale" | "ceo.ci_never";

const freshnessKey = (freshness: string): FreshnessKey => {
  switch (freshness) {
    case "FRESH":
      return "ceo.ci_fresh";
    case "AGEING":
      return "ceo.ci_ageing";
    case "STALE":
      return "ceo.ci_stale";
    default:
      return "ceo.ci_never";
  }
};

const when = (value: string | null, missing: string): string => {
  if (!value) return missing;
  const at = new Date(value);
  return Number.isFinite(at.getTime()) ? at.toISOString().replace("T", " ").slice(0, 16) : value;
};

/** A KPI counts as drifted when its own thresholds say so — never by eye. */
const hasDrifted = (kpi: Kpi): boolean => kpi.status === "AT_RISK" || kpi.status === "CRITICAL";

export function CommandCenterIntelligence() {
  const { t } = useTranslation();
  const {
    attention,
    kpis,
    risks,
    health,
    pendingApprovals,
    sources,
    degraded,
    isLoading,
    failed,
    denied,
    refetch,
  } = useFounderState();

  if (isLoading) {
    return <LoadingState label={t("ceo.ci_loading")} rows={2} />;
  }

  // Refused is not broken. A reader without executive permission is told so
  // plainly, and is not offered a retry that would refuse them again.
  if (denied) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title={t("ceo.ci_denied_title")}
        description={t("ceo.ci_denied_body")}
      />
    );
  }

  if (failed) {
    return (
      <ErrorState
        title={t("ceo.ci_failed_title")}
        description={t("ceo.ci_failed_body")}
        onRetry={() => void refetch()}
      />
    );
  }

  const drifted = kpis.filter(hasDrifted);
  const openAttention = attention.filter((a) => a.status !== "DISMISSED");

  return (
    <div className="space-y-4 sm:space-y-6">
      {degraded.length > 0 && <DegradedNotice sources={degraded} />}

      {/* Domain health, with the reason each light is the colour it is. */}
      <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary-glow" />
            {t("ceo.ci_health")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {health.length === 0 ? (
            <EmptyState
              icon={Brain}
              title={t("ceo.ci_health_empty_title")}
              description={t("ceo.ci_health_empty_body")}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {health.map((domain, i) => (
                <motion.div
                  key={domain.domain}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-4 rounded-xl bg-surface border border-border"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">{domain.domain}</span>
                    <Badge className={healthStyle(domain.health)}>{domain.health}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{domain.reason}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    <span>
                      {domain.openAttention} {t("ceo.ci_open")}
                    </span>
                    <span>
                      {domain.criticalAttention} {t("ceo.ci_critical")}
                    </span>
                    <span>
                      {domain.kpisAtRisk} {t("ceo.ci_kpis_at_risk")}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* What needs a person. */}
        <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-accent-amber" />
              {t("ceo.ci_attention")}
              {openAttention.length > 0 && (
                <Badge className="bg-accent-amber/20 text-accent-amber">
                  {openAttention.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px]">
              {openAttention.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title={t("ceo.ci_attention_empty_title")}
                  description={t("ceo.ci_attention_empty_body")}
                />
              ) : (
                <div className="space-y-3">
                  {openAttention.map((item: AttentionItem) => (
                    <div key={item.id} className="p-3 rounded-lg bg-surface border border-border">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-foreground">{item.title}</p>
                        <Badge className={severityStyle(item.severity)}>{item.severity}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p>
                      <p className="mt-2 text-[11px] text-muted-foreground/80">
                        {item.domain} · {item.sourceSystem} ·{" "}
                        {when(item.createdAt, t("ceo.ci_no_timestamp"))}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* What is waiting on a human decision. */}
        <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary-glow" />
              {t("ceo.ci_waiting")}
              {pendingApprovals.length > 0 && (
                <Badge className="bg-primary/20 text-primary-glow">{pendingApprovals.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px]">
              {pendingApprovals.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title={t("ceo.ci_waiting_empty_title")}
                  description={t("ceo.ci_waiting_empty_body")}
                />
              ) : (
                <div className="space-y-3">
                  {pendingApprovals.map((approval: PendingApproval) => (
                    <div
                      key={approval.id}
                      className="p-3 rounded-lg bg-surface border border-border"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-foreground">{approval.title}</p>
                        <Badge className="bg-primary/20 text-primary-glow">{approval.status}</Badge>
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground/80">
                        {approval.sourceSystem} · {t("ceo.ci_requested")}{" "}
                        {when(approval.requestedAt, t("ceo.ci_no_timestamp"))}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* KPIs that have moved against their own thresholds. */}
        <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground flex items-center gap-2">
              <Gauge className="w-5 h-5 text-accent-pink" />
              {t("ceo.ci_kpi_deviations")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[260px]">
              {kpis.length === 0 ? (
                <EmptyState
                  icon={Target}
                  title={t("ceo.ci_kpi_none_title")}
                  description={t("ceo.ci_kpi_none_body")}
                />
              ) : drifted.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title={t("ceo.ci_kpi_ok_title")}
                  description={`${kpis.length} ${t("ceo.ci_kpi_ok_body")}`}
                />
              ) : (
                <div className="space-y-3">
                  {drifted.map((kpi: Kpi) => (
                    <div key={kpi.id} className="p-3 rounded-lg bg-surface border border-border">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-foreground">{kpi.name}</p>
                        <Badge className={healthStyle(kpi.status)}>{kpi.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{kpi.statusReason}</p>
                      <p className="mt-2 text-[11px] text-muted-foreground/80">
                        {/* A reading with no value is shown as unknown, never as zero. */}
                        {kpi.current.value === null
                          ? t("ceo.ci_no_reading")
                          : `${kpi.current.value}${kpi.unit ? ` ${kpi.unit}` : ""}`}
                        {" · "}
                        {kpi.source} · {when(kpi.current.measuredAt, t("ceo.ci_no_timestamp"))} ·{" "}
                        {t(freshnessKey(kpi.current.freshness))}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Open risks. */}
        <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-destructive" />
              {t("ceo.ci_risks")}
              {risks.length > 0 && (
                <Badge className="bg-destructive/20 text-destructive">{risks.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[260px]">
              {risks.length === 0 ? (
                <EmptyState
                  icon={ShieldAlert}
                  title={t("ceo.ci_risks_empty_title")}
                  description={t("ceo.ci_risks_empty_body")}
                />
              ) : (
                <div className="space-y-3">
                  {risks.map((risk: Risk) => (
                    <div key={risk.id} className="p-3 rounded-lg bg-surface border border-border">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-foreground">{risk.title}</p>
                        <Badge className={severityStyle(risk.severity)}>{risk.severity}</Badge>
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground/80">
                        {risk.domain} · {risk.source} · {t("ceo.ci_detected")}{" "}
                        {when(risk.detectedAt, t("ceo.ci_no_timestamp"))}
                        {risk.likelihood !== null &&
                          ` · ${t("ceo.ci_likelihood")} ${risk.likelihood}`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Where this section's answer came from, and how old each part is. */}
      {Object.keys(sources).length > 0 && (
        <Card className="card3d enter-soft rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t("ceo.ci_sources")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(sources).map(([key, source]) => (
                <Badge key={key} variant="outline" className="text-[11px]">
                  {source.source} · {t(freshnessKey(source.freshness))}
                </Badge>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <Button size="sm" variant="ghost" onClick={() => void refetch()}>
                {t("ceo.ci_reread")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default CommandCenterIntelligence;
