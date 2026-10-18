/**
 * Internal Support AI — status strip.
 * Restores the metrics that used to live in the module top bar
 * (feed status, nearest SLA, pending issues, auto-fix rate, escalation
 * queue, AI health and the security indicators). Every figure is passed in
 * from live reads; a figure that is not available renders as "—".
 */

import React from "react";
import { AlertTriangle, CheckCircle2, Clock, Globe, Heart, Lock, Shield, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SystemStatus } from "./types";
import { useTranslation } from "@/lib/i18n/use-translation";

interface AIStatusStripProps {
  /** Null while the live reads are still loading. */
  systemStatus?: SystemStatus | null;
  pendingIssues?: number | null;
  autoFixSuccessRate?: number | null;
  escalationQueue?: number | null;
  /** Minutes left on the open ticket closest to its SLA, as recorded. */
  nearestSlaMinutes?: number | null;
  userRole?: string | null;
}

const statusTone: Record<SystemStatus, string> = {
  LIVE: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  DEGRADED: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  OFFLINE: "bg-destructive/15 text-destructive border-destructive/30",
};

const statusDot: Record<SystemStatus, string> = {
  LIVE: "bg-emerald-500",
  DEGRADED: "bg-amber-500",
  OFFLINE: "bg-destructive",
};

const Metric = ({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: string;
}) => (
  <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground">
    {icon}
    <span>{label}</span>
    <span className={tone}>{value}</span>
  </div>
);

export const AIStatusStrip: React.FC<AIStatusStripProps> = ({
  systemStatus = null,
  pendingIssues = null,
  autoFixSuccessRate = null,
  escalationQueue = null,
  nearestSlaMinutes = null,
  userRole = null,
}) => {
  const { t } = useTranslation();
  const pad = (n: number) => Math.abs(n).toString().padStart(2, "0");
  const slaTimer =
    nearestSlaMinutes === null
      ? "—"
      : `${nearestSlaMinutes < 0 ? "-" : ""}${pad(Math.trunc(nearestSlaMinutes / 60))}:${pad(nearestSlaMinutes % 60)}:00`;
  const slaCritical = nearestSlaMinutes !== null && nearestSlaMinutes < 10;
  const status: SystemStatus = systemStatus ?? "DEGRADED";
  const fmt = (n: number | null) => (n === null ? "—" : String(n));

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/60 p-3 backdrop-blur-xl">
      <span className="inline-flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${systemStatus === null ? "bg-muted-foreground/40" : `animate-pulse ${statusDot[status]}`}`}
        />
        <Badge
          className={`${systemStatus === null ? "bg-muted/40 text-muted-foreground border-border" : statusTone[status]} border text-[10px]`}
          title={systemStatus === "DEGRADED" ? t("manager.support_ai.degraded_reason") : undefined}
        >
          {systemStatus ?? t("manager.support_ai.loading_badge")}
        </Badge>
        <span className="text-[11px] text-muted-foreground">Internal Support AI</span>
      </span>

      <Metric
        icon={<Clock className="h-3 w-3 text-primary" />}
        label={t("manager.support_ai.nearest_sla")}
        value={slaTimer}
        tone={`font-mono font-bold ${slaCritical ? "text-destructive" : "text-primary"}`}
      />
      <Metric
        icon={<AlertTriangle className="h-3 w-3 text-amber-400" />}
        label="Pending"
        value={fmt(pendingIssues)}
        tone="font-bold text-amber-400"
      />
      <Metric
        icon={<CheckCircle2 className="h-3 w-3 text-emerald-400" />}
        label="Auto-Fix"
        value={autoFixSuccessRate === null ? "—" : `${autoFixSuccessRate}%`}
        tone="font-bold text-emerald-400"
      />
      <Metric
        icon={<Zap className="h-3 w-3 text-primary" />}
        label="Escalations"
        value={fmt(escalationQueue)}
        tone="font-bold text-foreground"
      />
      <Metric
        icon={<Heart className="h-3 w-3 text-rose-400" />}
        label="AI Health"
        value={t("manager.console.not_tracked")}
        tone="font-bold text-muted-foreground"
      />

      <div className="ml-auto flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1.5 text-[11px] text-muted-foreground">
          <Globe className="h-3 w-3" />
          Auto-detect
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1.5 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3 text-emerald-400" />
          Encrypted
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 px-2.5 py-1.5 text-[11px] font-medium text-foreground">
          <Shield className="h-3 w-3 text-primary" />
          {userRole ? userRole.replace(/_/g, " ").toUpperCase() : "—"}
        </span>
      </div>
    </div>
  );
};

export default AIStatusStrip;
