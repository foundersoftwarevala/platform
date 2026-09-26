import { Link } from "@tanstack/react-router";
import { useTranslation } from "@/lib/i18n/use-translation";
import { AlarmClock, ClipboardList, Layers, Timer } from "lucide-react";

import {
  DegradedNotice,
  EmptyState,
  ErrorState,
  LoadingState,
  PageBanner,
  PageShell,
} from "@/components/ai-ceo/PageShell";
import { useCEOOps } from "@/hooks/useCEOOps";

import { Day, Figure, OpsTable, OpsTile, SourceNote, ToneBadge } from "./shared";

/**
 * The work in front of the business, from the task manager's own table.
 *
 * The imported module drew this screen from five tasks written into the
 * component, each with a made-up assignee and a made-up due date. `tm_tasks`
 * is where the platform actually records work — code, module, client, status,
 * priority, the promised date and the SLA it was promised under — so that is
 * what this reads.
 *
 * The SLA column is the reason this screen is worth having: a task with a
 * promise date in the past and a status that is not finished is the single
 * most useful thing an executive can be shown, and it can only be computed
 * from real rows.
 */

const DONE = new Set(["done", "closed", "cancelled", "completed", "delivered"]);

function isOverdue(promisedAt: string | null, status: string): boolean {
  if (!promisedAt || DONE.has(status.toLowerCase())) return false;
  const at = new Date(promisedAt).getTime();
  return Number.isFinite(at) && at < Date.now();
}

export function TaskCenter() {
  const { t } = useTranslation();
  const { tasks, summary, sources, degraded, isLoading, failed, refetch } = useCEOOps();

  if (isLoading) {
    return (
      <PageShell>
        <PageBanner
          eyebrow="AI CEO · Operations"
          title={t("ceo.tasks")}
          subtitle="Work recorded across the platform, with the promise each one was made under."
          icon={ClipboardList}
        />
        <LoadingState label={t("ceo.tasks_loading")} />
      </PageShell>
    );
  }

  if (failed) {
    return (
      <PageShell>
        <PageBanner eyebrow="AI CEO · Operations" title={t("ceo.tasks")} icon={ClipboardList} />
        <ErrorState
          title={t("ceo.tasks_failed")}
          description="tm_tasks could not be read, so this screen cannot say what work is outstanding."
          onRetry={() => void refetch()}
        />
      </PageShell>
    );
  }

  const overdue = tasks.filter((t) => isOverdue(t.promisedAt, t.status));

  return (
    <PageShell>
      <PageBanner
        eyebrow="AI CEO · Operations"
        title={t("ceo.tasks")}
        subtitle="Work recorded across the platform, with the promise each one was made under."
        icon={ClipboardList}
        status={summary.tasksOpen === null ? "Not measured" : `${summary.tasksOpen} open`}
      />

      {degraded.length > 0 && <DegradedNotice sources={degraded} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OpsTile
          label={t("ceo.tasks")}
          value={summary.tasks}
          icon={ClipboardList}
          hint={sources.tasks}
        />
        <OpsTile label={t("ceo.open")} value={summary.tasksOpen} icon={Layers} tone="warning" />
        <OpsTile
          label={t("ceo.past_promise_date")}
          value={overdue.length || null}
          icon={AlarmClock}
          tone={overdue.length > 0 ? "danger" : "success"}
          hint="open tasks whose promised date has passed"
        />
        <OpsTile
          label={t("ceo.hours_estimated")}
          value={tasks.reduce<number | null>(
            (total, t) => (t.estimatedHours === null ? total : (total ?? 0) + t.estimatedHours),
            null,
          )}
          icon={Timer}
        />
      </div>

      <SourceNote source={sources.tasks} count={tasks.length} />

      <OpsTable
        head={["Task", "Module", "Status", "Priority", "Promised", t("ceo.sla"), "Assigned"]}
        rows={tasks.map((task) => [
          <Link
            key="t"
            to="/ai-ceo/tasks/$taskId"
            params={{ taskId: task.id }}
            className="font-medium text-primary hover:underline"
          >
            {task.code ? `${task.code} · ` : ""}
            {task.title}
          </Link>,
          <span key="m" className="text-xs text-muted-foreground">
            {task.module ?? task.category ?? "—"}
          </span>,
          <ToneBadge key="s" value={task.status} />,
          <ToneBadge key="p" value={task.priority} />,
          <span
            key="d"
            className={isOverdue(task.promisedAt, task.status) ? "text-destructive" : ""}
          >
            <Day value={task.promisedAt} />
          </span>,
          <Figure key="sla" value={task.slaHours} suffix="h" />,
          <span key="a" className="font-mono text-[11px] text-muted-foreground">
            {task.assignedTo ? task.assignedTo.slice(0, 8) : t("ceo.unassigned")}
          </span>,
        ])}
        empty={
          <EmptyState
            icon={ClipboardList}
            title={t("ceo.tasks_empty")}
            description="tm_tasks holds no rows. This screen lists whatever that table contains and invents nothing, so it stays empty until work is recorded."
          />
        }
      />
    </PageShell>
  );
}

/** One task, with the promise and the effort recorded against it. */
export function TaskDetail({ taskId }: { taskId: string }) {
  const { t } = useTranslation();
  const { tasks, isLoading, failed, refetch } = useCEOOps();
  const task = tasks.find((t) => t.id === taskId);

  if (isLoading) {
    return (
      <PageShell>
        <LoadingState label={t("ceo.tasks_loading")} rows={1} />
      </PageShell>
    );
  }

  if (failed) {
    return (
      <PageShell>
        <ErrorState
          title={t("ceo.tasks_failed")}
          description="tm_tasks could not be read."
          onRetry={() => void refetch()}
        />
      </PageShell>
    );
  }

  if (!task) {
    return (
      <PageShell>
        <PageBanner
          eyebrow="AI CEO · Operations"
          title={t("ceo.task_not_found")}
          icon={ClipboardList}
        />
        <EmptyState
          icon={ClipboardList}
          title={t("ceo.task_no_id")}
          description="tm_tasks holds no row with this id, or it falls outside the most recent two hundred this console reads."
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageBanner
        eyebrow="AI CEO · Operations"
        title={task.title}
        subtitle={task.code ? `${task.code} · ${task.module ?? "no module recorded"}` : undefined}
        icon={ClipboardList}
        status={task.status}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OpsTile label={t("ceo.estimated")} value={task.estimatedHours} icon={Timer} hint="hours" />
        <OpsTile
          label={t("ceo.spent")}
          value={task.actualMinutes}
          icon={Timer}
          hint="minutes recorded"
        />
        <OpsTile
          label={t("ceo.sla")}
          value={task.slaHours}
          icon={AlarmClock}
          hint="hours promised"
        />
        <OpsTile
          label={t("ceo.past_promise")}
          value={isOverdue(task.promisedAt, task.status) ? "Yes" : "No"}
          icon={AlarmClock}
          tone={isOverdue(task.promisedAt, task.status) ? "danger" : "success"}
        />
      </div>

      <div className="bento-card p-5">
        <h3 className="text-sm font-semibold">{t("ceo.task_register_records")}</h3>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Client", task.clientName],
            ["Category", task.category],
            ["Priority", task.priority],
            ["Assigned to", task.assignedTo],
            ["Promised at", task.promisedAt],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
              <dd className="mt-1 break-words text-sm">{value ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </div>
    </PageShell>
  );
}
