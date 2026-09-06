import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowUpCircle,
  Bell,
  Bot,
  CheckCircle,
  Clock,
  Flame,
  Layers,
  ListTodo,
  ShieldAlert,
  Sparkles,
  UserCheck,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { computeSLA, relativeTime, titleCase } from "@/lib/tm/format";
import {
  useActivity,
  useApprovals,
  useDependencies,
  useEscalations,
  useNotifications,
  useSettings,
  useTasks,
  useAcknowledgeBuzzer,
  useNow,
} from "@/lib/tm/hooks";
import { TM_ACTIVE_STATUSES, TM_STATUSES } from "@/lib/tm/types";
import type { TMScreen } from "../TMSidebar";
import { SLABadge, StatusBadge, TMEmpty, TMLoading, TMPageHeader, TMPanel, TMRow, TMStat, TaskCode } from "../shared";

export function TMDashboard({ onNavigate }: { onNavigate: (screen: TMScreen) => void }) {
  const { data: tasks, isLoading } = useTasks();
  const { data: activity } = useActivity();
  const { data: approvals } = useApprovals();
  const { data: escalations } = useEscalations();
  const { data: dependencies } = useDependencies();
  const { data: notifications } = useNotifications();
  const { data: settings } = useSettings();
  const acknowledge = useAcknowledgeBuzzer();
  useNow(30_000);

  const warn = settings?.sla_warning_percent ?? 75;

  const stats = useMemo(() => {
    const list = tasks ?? [];
    const active = list.filter((t) => TM_ACTIVE_STATUSES.includes(t.status));
    const sla = list.map((t) => ({ task: t, sla: computeSLA(t, warn) }));
    return {
      active: active.length,
      overdue: sla.filter((s) => s.sla.state === "breached").length,
      atRisk: sla.filter((s) => s.sla.state === "at_risk").length,
      pendingApprovals: (approvals ?? []).filter((a) => a.status === "pending").length,
      running: list.filter((t) => t.timer_running).length,
      humanIntervention: list.filter((t) => t.status === "blocked" || t.status === "waiting_client").length,
      escalated: (escalations ?? []).filter((e) => e.status === "open" || e.status === "acknowledged").length,
      cancelled: list.filter((t) => t.status === "cancelled").length,
      completed: list.filter((t) => t.status === "completed").length,
      crossModule: (dependencies ?? []).length,
      highPriority: active.filter((t) => t.priority === "high" || t.priority === "critical").length,
      compliance: active.filter((t) => t.category === "compliance" || t.category === "security").length,
      buzzers: list.filter((t) => t.buzzer_active),
      breaches: sla.filter((s) => s.sla.state === "breached").map((s) => s.task),
      unread: (notifications ?? []).filter((n) => !n.read).length,
    };
  }, [tasks, approvals, escalations, dependencies, notifications, warn]);

  const flow = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tasks ?? []) counts.set(t.status, (counts.get(t.status) ?? 0) + 1);
    return TM_STATUSES.map((status) => ({ status, count: counts.get(status) ?? 0 }));
  }, [tasks]);

  if (isLoading) return <TMLoading label="Loading task control" />;

  return (
    <div className="space-y-6">
      <TMPageHeader
        title="Task Dashboard"
        subtitle="Enterprise operation control • live SLA, approvals and escalation state"
        actions={
          <Button variant="outline" size="sm" onClick={() => onNavigate("task_creation")}>
            New task
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        <TMStat label="Total Active Tasks" value={stats.active} icon={<ListTodo />} onClick={() => onNavigate("task_inbox")} />
        <TMStat label="Overdue Tasks" value={stats.overdue} icon={<AlertTriangle />} tone="danger" onClick={() => onNavigate("task_sla_tracker")} />
        <TMStat label="SLA At Risk" value={stats.atRisk} icon={<Clock />} tone="warning" onClick={() => onNavigate("task_sla_tracker")} />
        <TMStat label="Pending Approvals" value={stats.pendingApprovals} icon={<CheckCircle />} tone="warning" onClick={() => onNavigate("task_approval")} />
        <TMStat label="Timers Running" value={stats.running} icon={<Bot />} tone="info" onClick={() => onNavigate("task_execution")} />
        <TMStat label="Human Intervention" value={stats.humanIntervention} icon={<UserCheck />} onClick={() => onNavigate("task_assignment")} />
        <TMStat label="Escalated Tasks" value={stats.escalated} icon={<ArrowUpCircle />} tone="danger" onClick={() => onNavigate("task_escalation")} />
        <TMStat label="Cancelled Tasks" value={stats.cancelled} icon={<XCircle />} onClick={() => onNavigate("task_history")} />
        <TMStat label="Completed" value={stats.completed} icon={<Sparkles />} tone="success" onClick={() => onNavigate("task_history")} />
        <TMStat label="Linked Dependencies" value={stats.crossModule} icon={<Layers />} onClick={() => onNavigate("task_dependency")} />
        <TMStat label="High Priority" value={stats.highPriority} icon={<Flame />} tone="warning" onClick={() => onNavigate("task_inbox")} />
        <TMStat label="Compliance / Security" value={stats.compliance} icon={<ShieldAlert />} onClick={() => onNavigate("task_review")} />
      </div>

      <TMPanel title="Task Status Flow" icon={<Layers className="h-4 w-4" />}>
        <div className="flex flex-wrap gap-2">
          {flow.map(({ status, count }) => (
            <button
              key={status}
              type="button"
              onClick={() => onNavigate("task_inbox")}
              className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-left transition-colors hover:bg-accent/40"
            >
              <StatusBadge status={status} />
              <span className="font-display text-sm text-foreground">{count}</span>
            </button>
          ))}
        </div>
      </TMPanel>

      {stats.buzzers.length > 0 && (
        <TMPanel title="Active Buzzers" icon={<Bell className="h-4 w-4 text-destructive" />}>
          <div className="space-y-3">
            {stats.buzzers.map((task) => (
              <TMRow key={task.id} className="border-destructive/40 bg-destructive/10">
                <div>
                  <TaskCode code={task.code} />
                  <p className="text-sm text-foreground">{task.title}</p>
                  <p className="text-xs text-muted-foreground">Escalation level {task.escalation_level}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => acknowledge.mutate(task.id)} disabled={acknowledge.isPending}>
                  Acknowledge
                </Button>
              </TMRow>
            ))}
          </div>
        </TMPanel>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <TMPanel title="SLA Breach Alerts" icon={<AlertTriangle className="h-4 w-4 text-destructive" />}>
          <div className="space-y-3">
            {stats.breaches.slice(0, 6).map((task) => (
              <TMRow key={task.id}>
                <div>
                  <TaskCode code={task.code} />
                  <p className="text-sm text-foreground">{task.title}</p>
                  <SLABadge task={task} warningPercent={warn} />
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={task.status} />
                  <Button size="sm" variant="outline" onClick={() => onNavigate("task_escalation")}>
                    Escalate
                  </Button>
                </div>
              </TMRow>
            ))}
            {stats.breaches.length === 0 && <TMEmpty message="No SLA breaches right now" />}
          </div>
        </TMPanel>

        <TMPanel
          title="Recent Task Activity"
          icon={<Clock className="h-4 w-4" />}
          actions={<Badge variant="outline">{stats.unread} unread alerts</Badge>}
        >
          <div className="space-y-3">
            {(activity ?? []).slice(0, 8).map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg bg-muted/40 p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.action}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.details ?? `${titleCase(item.action_type)} by ${item.actor_name}`}
                  </p>
                </div>
                <span className="whitespace-nowrap text-xs text-muted-foreground">{relativeTime(item.created_at)}</span>
              </div>
            ))}
            {(activity ?? []).length === 0 && <TMEmpty message="No activity logged yet" />}
          </div>
        </TMPanel>
      </div>
    </div>
  );
}
