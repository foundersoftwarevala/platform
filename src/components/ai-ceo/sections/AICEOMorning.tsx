import { motion } from "framer-motion";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardList,
  Clock,
  ShieldAlert,
  Sunrise,
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFounderDay, type PlanItem } from "@/hooks/useFounderDay";
import { useTranslation } from "@/lib/i18n/use-translation";

/**
 * Morning AI: the day, in the order it should be worked.
 *
 * Everything on this screen was computed by arithmetic that can be argued
 * with. Each item carries the sentence that put it where it is, and each
 * suggested agent carries the reason it is eligible — because the one thing
 * an operator must be able to do with the day's order is disagree with it.
 *
 * Nothing here assigns or completes work. The agent shown is a suggestion,
 * and completed and verified are counted separately, because an agent
 * finishing a task is not the same as the outcome being verified.
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

const stateStyle = (state: string): string => {
  switch (state) {
    case "WAITING_APPROVAL":
      return "bg-accent-amber/20 text-accent-amber";
    case "EXECUTING":
    case "ASSIGNED":
      return "bg-primary/20 text-primary-glow";
    case "COMPLETED":
      return "bg-accent-emerald/20 text-accent-emerald";
    case "FAILED":
      return "bg-destructive/20 text-destructive";
    default:
      return "bg-muted/20 text-muted-foreground";
  }
};

const AICEOMorning = () => {
  const { t } = useTranslation();
  const { day, isLoading, failed, denied, refetch, runCycle, isRunning, closeCycle, isClosing } =
    useFounderDay();

  if (isLoading) {
    return (
      <PageShell>
        <PageBanner icon={Sunrise} title={t("ceo.morning_title")} />
        <LoadingState label={t("ceo.morning_loading")} rows={2} />
      </PageShell>
    );
  }

  if (denied) {
    return (
      <PageShell>
        <PageBanner icon={Sunrise} title={t("ceo.morning_title")} />
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
        <PageBanner icon={Sunrise} title={t("ceo.morning_title")} />
        <ErrorState
          title={t("ceo.morning_failed")}
          description={t("ceo.morning_failed_body")}
          onRetry={() => void refetch()}
        />
      </PageShell>
    );
  }

  const hasCycle = Boolean(day?.cycleId);

  return (
    <PageShell>
      <PageBanner
        icon={Sunrise}
        title={t("ceo.morning_title")}
        subtitle={t("ceo.morning_subtitle")}
        status={hasCycle ? `${day?.cycleDate} · ${day?.state}` : t("ceo.morning_not_run")}
        actions={
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void runCycle()} disabled={isRunning}>
              <ClipboardList className="w-4 h-4 mr-1" />
              {isRunning ? t("ceo.morning_running") : t("ceo.morning_run")}
            </Button>
            {hasCycle && day?.state !== "CLOSED" && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void closeCycle(day!.cycleId!)}
                disabled={isClosing}
              >
                {isClosing ? t("ceo.morning_closing") : t("ceo.morning_close")}
              </Button>
            )}
          </div>
        }
      />

      {(day?.degraded.length ?? 0) > 0 && <DegradedNotice sources={day!.degraded} />}

      {!hasCycle ? (
        <>
          <EmptyState
            icon={Sunrise}
            title={t("ceo.morning_empty_title")}
            description={t("ceo.morning_empty_body")}
          />
          {/*
            Where this screen looked. Without it, a day with no cycle is
            indistinguishable from a screen that never looked anywhere —
            which is exactly how the AI CEO probe found it.
          */}
          <SourceNote source="founder_daily_cycles" count={0} />
        </>
      ) : (
        <>
          {/* The day, counted in SQL. Completed and verified stay apart. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-6">
            {[
              {
                label: t("ceo.morning_planned"),
                value: day!.plannedItems,
                icon: ClipboardList,
                color: "text-primary-glow",
              },
              {
                label: t("ceo.morning_waiting"),
                value: day!.waitingApproval,
                icon: Clock,
                color: "text-accent-amber",
              },
              {
                label: t("ceo.morning_escalations"),
                value: day!.escalations,
                icon: AlertTriangle,
                color: "text-destructive",
              },
              {
                label: t("ceo.morning_completed"),
                value: day!.completed,
                icon: CheckCircle2,
                color: "text-accent-emerald",
              },
              {
                label: t("ceo.morning_verified"),
                value: day!.verified,
                icon: CheckCircle2,
                color: "text-accent-emerald",
              },
              {
                label: t("ceo.morning_failed_count"),
                value: day!.failed,
                icon: ShieldAlert,
                color: "text-destructive",
              },
            ].map((tile) => (
              <Card key={tile.label} className="card3d premium-halo enter-soft rounded-2xl">
                <CardContent className="p-4 flex items-center gap-3">
                  <tile.icon className={`w-5 h-5 ${tile.color}`} />
                  <div>
                    <p className="text-xl font-bold text-foreground">{tile.value}</p>
                    <p className="text-xs text-muted-foreground">{tile.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* The brief. */}
          <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground flex items-center gap-2">
                <Sunrise className="w-5 h-5 text-accent-amber" />
                {t("ceo.morning_brief")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {day!.briefFindings.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title={t("ceo.morning_brief_empty_title")}
                  description={t("ceo.morning_brief_empty_body")}
                />
              ) : (
                <ul className="space-y-2">
                  {day!.briefFindings.map((finding, i) => (
                    <li key={i} className="text-sm text-foreground">
                      {finding}
                    </li>
                  ))}
                </ul>
              )}
              {day!.briefLimitations.length > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-accent-amber/5 border border-accent-amber/20">
                  {day!.briefLimitations.map((limit, i) => (
                    <p key={i} className="text-xs text-accent-amber/90">
                      {limit}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* The work plan. */}
          <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary-glow" />
                {t("ceo.morning_plan")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[460px]">
                {day!.items.length === 0 ? (
                  <EmptyState
                    icon={CheckCircle2}
                    title={t("ceo.morning_plan_empty_title")}
                    description={t("ceo.morning_plan_empty_body")}
                  />
                ) : (
                  <div className="space-y-3">
                    {day!.items.map((item: PlanItem, i: number) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i, 12) * 0.03 }}
                        className="p-4 rounded-xl bg-surface border border-border"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm text-foreground">
                              <span className="text-muted-foreground tabular-nums mr-2">
                                {item.position}.
                              </span>
                              {item.title}
                            </p>
                            {/* The sentence that put it here. */}
                            <p className="mt-1 text-xs text-muted-foreground">
                              {item.priorityReason}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <Badge className={severityStyle(item.severity)}>{item.severity}</Badge>
                            <Badge className={stateStyle(item.state)}>
                              {item.state.replace(/_/g, " ").toLowerCase()}
                            </Badge>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <Bot className="w-3 h-3" />
                          {item.suggestedAgentName ? (
                            <span>{item.allocationReason}</span>
                          ) : (
                            <span>{item.allocationReason ?? t("ceo.morning_no_agent")}</span>
                          )}
                          {item.verification !== "UNVERIFIED" && (
                            <Badge className="bg-accent-emerald/20 text-accent-emerald">
                              {item.verification.toLowerCase()}
                            </Badge>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              <SourceNote source="founder_work_plan_items" count={day!.plannedItems} />
            </CardContent>
          </Card>
        </>
      )}
    </PageShell>
  );
};

export default AICEOMorning;
