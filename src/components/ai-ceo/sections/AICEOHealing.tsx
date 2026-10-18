import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  HeartPulse,
  Power,
  ShieldAlert,
  XCircle,
  Zap,
} from "lucide-react";

import {
  DegradedNotice,
  EmptyState,
  ErrorState,
  LoadingState,
  PageBanner,
  PageShell,
} from "@/components/ai-ceo/PageShell";
import { SourceNote } from "@/components/ai-ceo/ops/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useHealingBoard, type TimelineRow } from "@/hooks/useHealingBoard";
import { useTranslation } from "@/lib/i18n/use-translation";

/**
 * The self-healing engine, shown as it actually is.
 *
 * Two things this screen refuses to do.
 *
 * It never draws an all-clear it did not establish. A failed read leaves the
 * counts null and the screen says so, because a dashboard showing zero
 * incidents when it could not reach the database is worse than one showing
 * nothing at all.
 *
 * It never implies a recovery worked because an action succeeded. Verified
 * and unverified attempts are drawn differently everywhere they appear,
 * since the whole engine exists to keep those apart.
 *
 * The scheduler row says BLOCKED and stays saying it. The engine can decide
 * and verify recoveries, but nothing runs them on a schedule yet, and a
 * dashboard that showed the engine as healthy while nothing was scheduled
 * would be the most expensive lie here.
 */

/** Status of each part of the engine, as evidence supports — not as hoped. */
const ENGINE_PARTS: {
  key: string;
  status: "VERIFIED" | "PARTIAL" | "BLOCKED";
}[] = [
  { key: "ceo.heal_part_detection", status: "VERIFIED" },
  { key: "ceo.heal_part_worker", status: "VERIFIED" },
  { key: "ceo.heal_part_claim", status: "VERIFIED" },
  { key: "ceo.heal_part_verification", status: "VERIFIED" },
  { key: "ceo.heal_part_circuit", status: "VERIFIED" },
  { key: "ceo.heal_part_budget", status: "VERIFIED" },
  { key: "ceo.heal_part_killswitch", status: "VERIFIED" },
  { key: "ceo.heal_part_override", status: "VERIFIED" },
  { key: "ceo.heal_part_audit", status: "VERIFIED" },
  { key: "ceo.heal_part_actions", status: "PARTIAL" },
  { key: "ceo.heal_part_scheduler", status: "BLOCKED" },
];

/** The three that genuinely act, and the five that do not exist yet. */
const REAL_ACTIONS = ["reduce_concurrency", "reassign", "backoff"];
const UNAVAILABLE_ACTIONS = ["retry", "reroute", "fallback_route", "rebalance", "resume"];

const statusStyle = (status: string): string => {
  switch (status) {
    case "VERIFIED":
      return "bg-accent-emerald/20 text-accent-emerald";
    case "PARTIAL":
      return "bg-accent-amber/20 text-accent-amber";
    case "BLOCKED":
      return "bg-destructive/20 text-destructive";
    default:
      return "bg-muted/20 text-muted-foreground";
  }
};

const severityStyle = (severity: string): string => {
  switch (severity) {
    case "CRITICAL":
      return "bg-destructive/20 text-destructive border-destructive/30";
    case "HIGH":
      return "bg-accent-amber/20 text-accent-amber border-accent-amber/30";
    default:
      return "bg-primary/20 text-primary-glow border-primary/30";
  }
};

const stateStyle = (state: string): string => {
  switch (state) {
    case "RESOLVED":
      return "bg-accent-emerald/20 text-accent-emerald";
    case "ESCALATED":
    case "FAILED":
      return "bg-destructive/20 text-destructive";
    case "CIRCUIT_OPEN":
    case "RETRY_PENDING":
      return "bg-accent-amber/20 text-accent-amber";
    default:
      return "bg-primary/20 text-primary-glow";
  }
};

const when = (value: string | null): string => {
  if (!value) return "";
  const at = new Date(value);
  return Number.isFinite(at.getTime()) ? at.toISOString().replace("T", " ").slice(0, 16) : value;
};

const AICEOHealing = () => {
  const { t } = useTranslation();
  const { totals, selfCheck, budgets, timeline, degraded, isLoading, failed, denied, refetch } =
    useHealingBoard();

  if (isLoading) {
    return (
      <PageShell>
        <PageBanner icon={HeartPulse} title={t("ceo.heal_title")} />
        <LoadingState label={t("ceo.heal_loading")} rows={2} />
      </PageShell>
    );
  }

  if (denied) {
    return (
      <PageShell>
        <PageBanner icon={HeartPulse} title={t("ceo.heal_title")} />
        <EmptyState
          icon={ShieldAlert}
          title={t("ceo.ci_denied_title")}
          description={t("ceo.ci_denied_body")}
        />
      </PageShell>
    );
  }

  if (failed) {
    return (
      <PageShell>
        <PageBanner icon={HeartPulse} title={t("ceo.heal_title")} />
        <ErrorState
          title={t("ceo.heal_failed")}
          description={t("ceo.heal_failed_body")}
          onRetry={() => void refetch()}
        />
      </PageShell>
    );
  }

  // A count that could not be taken shows as a dash. Never as zero.
  const shown = (value: number | undefined): string =>
    typeof value === "number" ? value.toLocaleString() : "—";

  // One row per incident for the table; the timeline holds one per attempt.
  const incidents = Array.from(
    timeline.reduce((map, row) => {
      if (!map.has(row.incidentId)) map.set(row.incidentId, row);
      return map;
    }, new Map<string, TimelineRow>()),
  ).map(([, row]) => row);

  return (
    <PageShell>
      <PageBanner
        icon={HeartPulse}
        title={t("ceo.heal_title")}
        subtitle={t("ceo.heal_subtitle")}
        status={
          selfCheck
            ? selfCheck.enabled
              ? t("ceo.heal_enabled")
              : `${t("ceo.heal_disabled")} — ${selfCheck.disabledReason ?? ""}`
            : t("ceo.heal_state_unknown")
        }
      />

      {degraded.length > 0 && <DegradedNotice sources={degraded} />}

      {/* The switch, and whether the engine thinks it is well. */}
      {selfCheck && (
        <Card
          className={`card3d premium-halo enter-soft rounded-2xl ${
            selfCheck.degraded ? "border border-accent-amber/40" : ""
          }`}
        >
          <CardContent className="p-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Power
                className={`w-5 h-5 ${selfCheck.enabled ? "text-accent-emerald" : "text-destructive"}`}
              />
              <span className="text-sm text-foreground">
                {selfCheck.enabled ? t("ceo.heal_enabled") : t("ceo.heal_disabled")}
              </span>
            </div>
            {selfCheck.degraded && (
              <Badge className="bg-accent-amber/20 text-accent-amber">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {t("ceo.heal_degraded")}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {selfCheck.awaitingRecovery} {t("ceo.heal_awaiting")} · {selfCheck.blockedByFounder}{" "}
              {t("ceo.heal_blocked_by_you")} · {selfCheck.staleLocks} {t("ceo.heal_stale_locks")}
            </span>
            {selfCheck.succeededUnverified > 0 && (
              <Badge className="bg-accent-amber/20 text-accent-amber">
                {selfCheck.succeededUnverified} {t("ceo.heal_succeeded_unverified")}
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      {/* The counts. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-6">
        {[
          {
            label: t("ceo.heal_incidents"),
            value: totals?.incidents,
            icon: Activity,
            color: "text-primary-glow",
          },
          {
            label: t("ceo.heal_recovered"),
            value: totals?.autoRecovered,
            icon: CheckCircle2,
            color: "text-accent-emerald",
          },
          {
            label: t("ceo.heal_in_progress"),
            value: totals?.inProgress,
            icon: Zap,
            color: "text-primary-glow",
          },
          {
            label: t("ceo.heal_escalated"),
            value: totals?.escalated,
            icon: AlertTriangle,
            color: "text-destructive",
          },
          {
            label: t("ceo.heal_circuits"),
            value: totals?.circuitsOpen,
            icon: XCircle,
            color: "text-accent-amber",
          },
          {
            label: t("ceo.heal_verified_attempts"),
            value: totals?.verifiedAttempts,
            icon: CheckCircle2,
            color: "text-accent-emerald",
          },
        ].map((tile) => (
          <Card key={tile.label} className="card3d premium-halo enter-soft rounded-2xl">
            <CardContent className="p-4 flex items-center gap-3">
              <tile.icon className={`w-5 h-5 ${tile.color}`} />
              <div>
                <p className="text-xl font-bold text-foreground tabular-nums">
                  {shown(tile.value)}
                </p>
                <p className="text-xs text-muted-foreground">{tile.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* What is proven and what is not. The scheduler stays BLOCKED. */}
        <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground flex items-center gap-2">
              <HeartPulse className="w-5 h-5 text-accent-pink" />
              {t("ceo.heal_engine")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ENGINE_PARTS.map((part) => (
                <div
                  key={part.key}
                  className="flex items-center justify-between p-2 rounded-lg bg-surface border border-border"
                >
                  <span className="text-sm text-foreground">{t(part.key as never)}</span>
                  <Badge className={statusStyle(part.status)}>{part.status}</Badge>
                </div>
              ))}
            </div>
            {/* Named as a status, never as a credential or a path. */}
            <p className="mt-3 text-[11px] text-muted-foreground">{t("ceo.heal_scheduler_note")}</p>
          </CardContent>
        </Card>

        {/* What the engine may actually do. */}
        <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground flex items-center gap-2">
              <Zap className="w-5 h-5 text-accent-amber" />
              {t("ceo.heal_actions")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2">{t("ceo.heal_actions_real")}</p>
            <div className="flex flex-wrap gap-2">
              {REAL_ACTIONS.map((action) => (
                <Badge
                  key={action}
                  className="bg-accent-emerald/20 text-accent-emerald font-mono text-[11px]"
                >
                  {action}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4 mb-2">
              {t("ceo.heal_actions_unavailable")}
            </p>
            <div className="flex flex-wrap gap-2">
              {UNAVAILABLE_ACTIONS.map((action) => (
                <Badge
                  key={action}
                  className="bg-muted/20 text-muted-foreground font-mono text-[11px]"
                >
                  {action}
                </Badge>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">{t("ceo.heal_backoff_note")}</p>
          </CardContent>
        </Card>
      </div>

      {/* What each class may spend. */}
      <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-primary-glow" />
            {t("ceo.heal_budgets")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {budgets.length === 0 ? (
            <EmptyState
              icon={ShieldAlert}
              title={t("ceo.heal_no_budgets")}
              description={t("ceo.heal_no_budgets_body")}
            />
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {budgets.map((budget) => (
                <div
                  key={budget.failureClass}
                  className="p-3 rounded-lg bg-surface border border-border"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground font-mono">{budget.failureClass}</span>
                    <Badge
                      className={
                        budget.autonomous
                          ? "bg-accent-emerald/20 text-accent-emerald"
                          : "bg-muted/20 text-muted-foreground"
                      }
                    >
                      {budget.autonomous ? t("ceo.heal_autonomous") : t("ceo.heal_human_only")}
                    </Badge>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {budget.maxAttempts} {t("ceo.heal_attempts_word")} · {budget.maxRecoveryMinutes}
                    {t("ceo.heal_minutes_short")} · {t("ceo.heal_scope_word")} {budget.maxScopeRows}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {budget.currentlyRecovering}/{budget.maxConcurrent} {t("ceo.heal_running_word")}{" "}
                    · {budget.awaiting} {t("ceo.heal_awaiting")}
                  </p>
                </div>
              ))}
            </div>
          )}
          <SourceNote source="founder_recovery_budgets" count={budgets.length} />
        </CardContent>
      </Card>

      {/* Every recovery, attempt by attempt. */}
      <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary-glow" />
            {t("ceo.heal_timeline")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[420px]">
            {incidents.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title={t("ceo.heal_no_incidents")}
                description={t("ceo.heal_no_incidents_body")}
              />
            ) : (
              <div className="space-y-3">
                {incidents.map((incident, i) => {
                  const attempts = timeline.filter(
                    (row) => row.incidentId === incident.incidentId && row.attemptNumber !== null,
                  );
                  return (
                    <motion.div
                      key={incident.incidentId}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i, 10) * 0.03 }}
                      className="p-4 rounded-xl bg-surface border border-border"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-foreground">{incident.whatFailed}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {incident.rootCauseHypothesis}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Badge className={severityStyle(incident.severity)}>
                            {incident.severity}
                          </Badge>
                          <Badge className="bg-muted/20 text-muted-foreground font-mono text-[11px]">
                            {incident.whyClassified}
                          </Badge>
                          <Badge className={stateStyle(incident.finalState)}>
                            {incident.finalState.replace(/_/g, " ").toLowerCase()}
                          </Badge>
                        </div>
                      </div>

                      {attempts.length > 0 && (
                        <ul className="mt-3 space-y-1">
                          {attempts.map((attempt) => (
                            <li
                              key={`${attempt.incidentId}-${attempt.attemptNumber}`}
                              className="text-[11px] text-muted-foreground"
                            >
                              {attempt.attemptNumber}.{" "}
                              <span className="font-mono">{attempt.actionTaken}</span> —{" "}
                              {attempt.whatHappened?.toLowerCase()}
                              {/* Verified and unverified never look alike. */}
                              {attempt.verified ? (
                                <span className="text-accent-emerald">
                                  {" "}
                                  · {t("ceo.heal_verified_word")}: {attempt.verificationDetail}
                                </span>
                              ) : (
                                <span className="text-accent-amber">
                                  {" "}
                                  · {t("ceo.heal_unverified_word")}
                                </span>
                              )}
                              {attempt.error && (
                                <span className="text-destructive"> · {attempt.error}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}

                      <p className="mt-2 text-[11px] text-muted-foreground/80">
                        {t("ceo.heal_detected_word")} {when(incident.detectedAt)}
                        {incident.correlationKey && ` · ${incident.correlationKey}`}
                      </p>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
          <SourceNote source="founder_healing_timeline" count={incidents.length} />
        </CardContent>
      </Card>
    </PageShell>
  );
};

export default AICEOHealing;
