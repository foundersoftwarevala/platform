/**
 * OPERATIONS CENTER — SHARED UI PRIMITIVES
 * ========================================
 * Built on the Software Vala glass/neon design system so every ops panel
 * matches the rest of the Demo Manager.
 */

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CHECK_META, HEALTH_META, type CheckState, type HealthState, type OpsCheck } from "@/lib/demo-ops";
import { Info } from "lucide-react";

export function OpsSection({
  title,
  description,
  icon: Icon,
  badge,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <Card className={cn("glass-panel border-border/40", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                {Icon && <Icon className="w-4 h-4 text-neon-teal" />}
                {title}
                {badge && (
                  <Badge variant="outline" className="text-[9px] font-mono border-neon-teal/40 text-neon-teal">
                    {badge}
                  </Badge>
                )}
              </CardTitle>
              {description && <p className="text-xs text-muted-foreground max-w-2xl">{description}</p>}
            </div>
            {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
          </div>
        </CardHeader>
        <CardContent className="pt-0">{children}</CardContent>
      </Card>
    </motion.div>
  );
}

export function StateBadge({ state, label }: { state: CheckState; label?: string }) {
  const meta = CHECK_META[state];
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide",
        meta.bg,
        meta.border,
        meta.text,
      )}
    >
      {label ?? meta.label}
    </span>
  );
}

export function HealthBadge({ state }: { state: HealthState }) {
  const meta = HEALTH_META[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase",
        meta.bg,
        meta.border,
        meta.text,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

export function CheckList({ checks }: { checks: OpsCheck[] }) {
  return (
    <ul className="space-y-2">
      {checks.map((check) => (
        <li
          key={check.id}
          className="rounded-lg border border-border/40 bg-background/40 p-3 flex items-start justify-between gap-3"
        >
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-medium text-foreground">{check.label}</p>
            <p className="text-xs text-muted-foreground break-words">{check.detail}</p>
            <p className="text-[10px] font-mono text-muted-foreground/70">source: {check.source}</p>
          </div>
          <StateBadge state={check.state} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Honest placeholder for a capability whose data source is not connected yet.
 * Deliberately shows no numbers — only what needs wiring.
 */
export function MonitorGap({
  title,
  requirement,
  fields,
}: {
  title: string;
  requirement: string;
  fields?: string[];
}) {
  return (
    <div className="rounded-lg border border-dashed border-border/60 bg-background/30 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Info className="w-4 h-4 text-muted-foreground" />
        <p className="text-xs font-medium text-foreground">{title}</p>
        <StateBadge state="unmonitored" />
      </div>
      <p className="text-xs text-muted-foreground">{requirement}</p>
      {fields && fields.length > 0 && (
        <ul className="list-disc list-inside text-[11px] text-muted-foreground/80 space-y-0.5">
          {fields.map((f) => (
            <li key={f} className="font-mono">
              {f}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function KpiTile({
  label,
  value,
  hint,
  tone = "neutral",
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "good" | "warn" | "bad" | "neutral";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-400"
      : tone === "warn"
        ? "text-amber-400"
        : tone === "bad"
          ? "text-red-400"
          : "text-neon-teal";
  return (
    <div className="glass-panel rounded-xl border border-border/40 p-4 space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon && <Icon className={cn("w-4 h-4", toneClass)} />}
      </div>
      <p className={cn("text-2xl font-mono font-bold", toneClass)}>{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground/80">{hint}</p>}
    </div>
  );
}

export function MetricRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/30 py-2 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-mono text-foreground">{value}</span>
    </div>
  );
}
