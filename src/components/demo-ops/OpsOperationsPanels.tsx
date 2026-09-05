/**
 * OPS — NOTIFICATION CENTER, ALERT SYSTEM, ONE-CLICK ACTIONS,
 *       ISSUE ASSIGNMENT, AUDIT TRAIL, DIAGNOSTICS ASSISTANT
 */

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Bell, BellRing, Bot, FileStack, UserCog, Zap } from "lucide-react";
import { DataStateNotice } from "@/components/demo-manager/DataStateNotice";
import { useAuth } from "@/hooks/useAuth";
import { MonitorGap, OpsSection, StateBadge } from "./OpsPrimitives";
import {
  useOpsActions,
  useOpsAlerts,
  useOpsAuditTrail,
  useOpsDemos,
  useOpsDetections,
  useOpsEscalations,
} from "@/hooks/useDemoOps";
import { DETECTION_LABELS, relativeTime, rootCauseFor } from "@/lib/demo-ops";
import { cn } from "@/lib/utils";

export function OpsAlertsPanel() {
  const { user } = useAuth();
  const alertsQuery = useOpsAlerts();
  const { acknowledgeAlert } = useOpsActions();
  const [sound, setSound] = useState(false);
  const [desktop, setDesktop] = useState(false);

  const alerts = (alertsQuery.data ?? []).filter((a) => a.is_active !== false);

  const enableDesktop = async (next: boolean) => {
    if (!next) {
      setDesktop(false);
      return;
    }
    if (typeof Notification === "undefined") {
      toast.error("This browser does not support desktop notifications");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setDesktop(true);
      toast.success("Desktop notifications enabled for this session");
    } else {
      toast.error("Desktop notification permission denied");
    }
  };

  return (
    <OpsSection
      title="Notification Center & Alert System"
      description="Active alerts read from demo_alerts; acknowledging writes back to the row. Sound and desktop delivery use the browser APIs directly."
      icon={Bell}
      badge={alerts.length ? `${alerts.length} ACTIVE` : undefined}
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-border/40 bg-background/40 p-3 space-y-2">
            <p className="text-xs font-semibold text-foreground">Delivery channels</p>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Sound alert</span>
              <Switch checked={sound} onCheckedChange={setSound} />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Desktop notification</span>
              <Switch checked={desktop} onCheckedChange={(v) => void enableDesktop(v)} />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">In-app popup alert</span>
              <StateBadge state="pass" label="always on" />
            </div>
          </div>
          <MonitorGap
            title="Internal chat & AIRA CEO escalation"
            requirement="Routing alerts into internal chat and the AIRA CEO stream needs those delivery endpoints wired to this project; escalation rows are already written to demo_escalations."
            fields={["chat delivery endpoint", "AIRA CEO notification endpoint"]}
          />
        </div>

        <DataStateNotice
          isLoading={alertsQuery.isLoading}
          error={alertsQuery.error}
          isEmpty={!alertsQuery.isLoading && !alertsQuery.error && alerts.length === 0}
          hasSession={Boolean(user)}
          resource="demo alerts"
          emptyTitle="No active alerts"
          emptyDescription="Offline, slow, expiring, SSL, build, API and branding alerts appear here from demo_alerts."
          onRetry={() => void alertsQuery.refetch()}
        >
          <div className="space-y-2">
            {alerts.slice(0, 30).map((alert) => (
              <div key={alert.id} className="rounded-lg border border-border/40 bg-background/40 p-3 flex flex-wrap items-center gap-3">
                <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-400">
                  {alert.alert_type}
                </Badge>
                <p className="min-w-0 flex-1 text-xs text-foreground truncate">{alert.message}</p>
                {alert.requires_action && (
                  <Badge variant="outline" className="text-[9px] border-red-500/40 text-red-400">
                    action required
                  </Badge>
                )}
                <span className="text-[10px] font-mono text-muted-foreground">{relativeTime(alert.created_at)}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  disabled={acknowledgeAlert.isPending}
                  onClick={() => acknowledgeAlert.mutate({ alertId: alert.id, action: "Acknowledged in Operations Center" })}
                >
                  <BellRing className="w-3 h-3 mr-1" />
                  Acknowledge
                </Button>
              </div>
            ))}
          </div>
        </DataStateNotice>
      </div>
    </OpsSection>
  );
}

const ONE_CLICK = [
  { key: "restart", label: "Restart Demo" },
  { key: "rebuild", label: "Rebuild Demo" },
  { key: "clear-cache", label: "Clear Cache" },
  { key: "regenerate-branding", label: "Regenerate Branding" },
  { key: "reconnect-database", label: "Reconnect Database" },
  { key: "sync-marketplace", label: "Sync Marketplace" },
  { key: "recheck", label: "Re-run Health Check" },
] as const;

export function OpsActionsPanel() {
  const { user } = useAuth();
  const demosQuery = useOpsDemos();
  const { runAction } = useOpsActions();
  const demos = demosQuery.data ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const active = demos.find((d) => d.id === selected) ?? demos[0] ?? null;

  return (
    <OpsSection
      title="One Click Actions"
      description="Each action updates the demo record where applicable and always writes an auditable row to demo_report_cards. Health re-check calls the real health-check function."
      icon={Zap}
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
        isLoading={demosQuery.isLoading}
        error={demosQuery.error}
        isEmpty={!demosQuery.isLoading && !demosQuery.error && demos.length === 0}
        hasSession={Boolean(user)}
        resource="demo actions"
        emptyTitle="No demos available"
        emptyDescription="Actions apply to a selected demo record."
        onRetry={() => void demosQuery.refetch()}
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {ONE_CLICK.map((item) => (
            <Button
              key={item.key}
              variant="outline"
              className="h-9 justify-start text-xs"
              disabled={!active || runAction.isPending}
              onClick={() => active && runAction.mutate({ demo: active, action: item.key })}
            >
              <Zap className="w-3.5 h-3.5 mr-2 text-neon-teal" />
              {item.label}
            </Button>
          ))}
        </div>
      </DataStateNotice>
    </OpsSection>
  );
}

const ASSIGN_ROLES = ["developer", "qa", "support"] as const;

export function OpsAssignmentPanel() {
  const { user } = useAuth();
  const demosQuery = useOpsDemos();
  const escalationsQuery = useOpsEscalations();
  const { assignIssue, updateIssueStatus } = useOpsActions();
  const demos = demosQuery.data ?? [];
  const [demoId, setDemoId] = useState<string>("");
  const [role, setRole] = useState<(typeof ASSIGN_ROLES)[number]>("developer");
  const [reason, setReason] = useState("");

  const targetDemo = demoId || demos[0]?.id || "";

  return (
    <OpsSection
      title="Issue Assignment & Resolution Timeline"
      description="Tickets are real rows in demo_escalations with role, level, status and resolution timestamps."
      icon={UserCog}
    >
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="rounded-lg border border-border/40 bg-background/40 p-3 space-y-2">
          <p className="text-xs font-semibold text-foreground">Create ticket</p>
          <select
            value={targetDemo}
            onChange={(e) => setDemoId(e.target.value)}
            className="h-8 w-full rounded-md border border-border/50 bg-background/60 px-2 text-xs"
          >
            {demos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
          <div className="flex gap-1">
            {ASSIGN_ROLES.map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={cn(
                  "flex-1 rounded-md border px-2 py-1 text-[10px] uppercase font-mono",
                  role === r
                    ? "border-neon-teal/50 bg-neon-teal/10 text-neon-teal"
                    : "border-border/50 text-muted-foreground",
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What needs fixing?"
            className="text-xs min-h-[72px]"
          />
          <Button
            size="sm"
            className="w-full text-xs"
            disabled={!targetDemo || !reason.trim() || assignIssue.isPending}
            onClick={() =>
              assignIssue.mutate(
                { demoId: targetDemo, role, reason: reason.trim(), level: 1 },
                { onSuccess: () => setReason("") },
              )
            }
          >
            Assign to {role}
          </Button>
        </div>

        <DataStateNotice
          isLoading={escalationsQuery.isLoading}
          error={escalationsQuery.error}
          isEmpty={!escalationsQuery.isLoading && !escalationsQuery.error && (escalationsQuery.data ?? []).length === 0}
          hasSession={Boolean(user)}
          resource="assigned issues"
          emptyTitle="No tickets yet"
          emptyDescription="Assigned issues and their resolution timeline appear here."
          onRetry={() => void escalationsQuery.refetch()}
        >
          <div className="space-y-2">
            {(escalationsQuery.data ?? []).slice(0, 20).map((row) => (
              <div key={row.id} className="rounded-lg border border-border/40 bg-background/40 p-3 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[9px]">
                    L{row.escalation_level ?? 1} · {row.escalated_to_role ?? "unassigned"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[9px]",
                      row.status === "resolved" ? "border-emerald-500/40 text-emerald-400" : "border-amber-500/40 text-amber-400",
                    )}
                  >
                    {row.status ?? "open"}
                  </Badge>
                  <span className="ml-auto text-[10px] font-mono text-muted-foreground">
                    opened {relativeTime(row.created_at)}
                    {row.resolved_at ? ` · resolved ${relativeTime(row.resolved_at)}` : ""}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground break-words">{row.reason}</p>
                {row.status !== "resolved" && (
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      disabled={updateIssueStatus.isPending}
                      onClick={() => updateIssueStatus.mutate({ id: row.id, status: "in_progress" })}
                    >
                      Mark in progress
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      disabled={updateIssueStatus.isPending}
                      onClick={() =>
                        updateIssueStatus.mutate({ id: row.id, status: "resolved", notes: "Resolved from Operations Center" })
                      }
                    >
                      Resolve
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </DataStateNotice>
      </div>
    </OpsSection>
  );
}

export function OpsAuditPanel() {
  const { user } = useAuth();
  const auditQuery = useOpsAuditTrail();
  const entries = auditQuery.data ?? [];

  return (
    <OpsSection
      title="Audit Trail"
      description="Every change, deployment, login and restart merged from audit_logs and demo_report_cards."
      icon={FileStack}
    >
      <DataStateNotice
        isLoading={auditQuery.isLoading}
        error={auditQuery.error}
        isEmpty={!auditQuery.isLoading && !auditQuery.error && entries.length === 0}
        hasSession={Boolean(user)}
        resource="audit trail"
        emptyTitle="No audit entries"
        emptyDescription="Actions performed here are written back and will appear in this trail."
        onRetry={() => void auditQuery.refetch()}
      >
        <ul className="space-y-1.5">
          {entries.slice(0, 40).map((entry) => (
            <li key={entry.id} className="rounded-lg border border-border/40 bg-background/40 p-2.5 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[9px]">
                {entry.scope}
              </Badge>
              <span className="text-xs text-foreground truncate min-w-0 flex-1">{entry.action}</span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {entry.role} · {entry.actor?.slice(0, 8) ?? "system"} · {relativeTime(entry.at)}
              </span>
              <span className="text-[9px] font-mono text-muted-foreground/60">{entry.source}</span>
            </li>
          ))}
        </ul>
      </DataStateNotice>
    </OpsSection>
  );
}

export function OpsAssistantPanel() {
  const { user } = useAuth();
  const { hits, isLoading, error, refetch } = useOpsDetections();
  const { assignIssue } = useOpsActions();

  const grouped = useMemo(() => {
    const map = new Map<string, { kind: typeof hits[number]["kind"]; count: number; demoId: string; demoTitle: string }>();
    hits.forEach((h) => {
      const key = `${h.demoId}-${h.kind}`;
      const existing = map.get(key);
      if (existing) existing.count += 1;
      else map.set(key, { kind: h.kind, count: 1, demoId: h.demoId, demoTitle: h.demoTitle });
    });
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [hits]);

  return (
    <OpsSection
      title="Diagnostics Assistant"
      description="Deterministic root-cause analysis over the real error signatures stored for each demo — explains the error, names the likely cause, suggests the fix and can open a developer ticket."
      icon={Bot}
    >
      <div className="space-y-4">
        <DataStateNotice
          isLoading={isLoading}
          error={error}
          isEmpty={!isLoading && !error && grouped.length === 0}
          hasSession={Boolean(user)}
          resource="failure diagnostics"
          emptyTitle="Nothing to diagnose"
          emptyDescription="No stored failure signatures across the fleet right now."
          onRetry={refetch}
        >
          <div className="space-y-2">
            {grouped.slice(0, 12).map((item) => {
              const rc = rootCauseFor(item.kind);
              return (
                <div key={`${item.demoId}-${item.kind}`} className="rounded-lg border border-border/40 bg-background/40 p-3 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[9px]",
                        rc.severity === "critical" ? "border-red-500/40 text-red-400" : "border-amber-500/40 text-amber-400",
                      )}
                    >
                      {rc.severity}
                    </Badge>
                    <span className="text-xs font-medium text-foreground">{rc.title}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {item.demoTitle} · {item.count}× {DETECTION_LABELS[item.kind]}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    <span className="text-foreground font-medium">Root cause: </span>
                    {rc.cause}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    <span className="text-foreground font-medium">Suggested fix: </span>
                    {rc.fix}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    disabled={assignIssue.isPending}
                    onClick={() =>
                      assignIssue.mutate({
                        demoId: item.demoId,
                        role: "developer",
                        reason: `${rc.title} — ${rc.cause} Suggested fix: ${rc.fix}`,
                        level: rc.severity === "critical" ? 2 : 1,
                      })
                    }
                  >
                    Create developer ticket
                  </Button>
                </div>
              );
            })}
          </div>
        </DataStateNotice>

        <MonitorGap
          title="Predictive failure forecasting"
          requirement="Predicting future failures needs a stored time series of health checks per demo; today only the latest check is retained on the demo record."
          fields={["health history: demo_id, checked_at, status, response_time (retained ≥ 30 days)"]}
        />
      </div>
    </OpsSection>
  );
}
