import { Link } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";
import { useLanguage } from "@/lib/language-catalog";
import { ACTIVE_STATES, useApi, type Status, type Task } from "../api";
import { Badge, Card, Empty, ErrorBox, Loading, Page, PageHeader, Stat } from "../ui";
import { relativeTime } from "../format";

export function CommandCenter() {
  const { translate: t } = useLanguage();
  const status = useApi<Status>(["status"], "/status", { refetchInterval: 10_000 });
  const tasks = useApi<Task[]>(["tasks", "all"], "/tasks", { refetchInterval: 5_000 });

  const s = status.data;
  const active = (tasks.data ?? []).filter((x) => ACTIVE_STATES.includes(x.state));
  const attention = (tasks.data ?? [])
    .filter((x) => x.state === "BLOCKED" || x.state === "FAILED")
    .slice(0, 6);
  const sum = (keys: (keyof Status["tasksByState"])[]) =>
    keys.reduce((n, k) => n + (s?.tasksByState[k] ?? 0), 0);

  return (
    <div>
      <PageHeader
        title={t("Command Center")}
        description={t(
          "Live state of the agent, its model, the machine it runs on, and every task in flight.",
        )}
        icon={LayoutDashboard}
      />
      <Page>
        <ErrorBox error={status.error ?? tasks.error} />
        {!s ? (
          <Loading />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
              <Stat label={t("Projects")} value={s.projects} />
              <Stat label={t("Running / queued")} value={sum(ACTIVE_STATES)} tone="info" />
              <Stat
                label={t("Blocked")}
                value={s.tasksByState.BLOCKED}
                tone={s.tasksByState.BLOCKED ? "warning" : "default"}
              />
              <Stat
                label={t("Failed")}
                value={s.tasksByState.FAILED}
                tone={s.tasksByState.FAILED ? "danger" : "default"}
              />
              <Stat
                label={t("Complete (verified)")}
                value={s.tasksByState.COMPLETE}
                tone="success"
              />
              <Stat
                label={t("Pending approvals")}
                value={s.pendingApprovals}
                tone={s.pendingApprovals ? "warning" : "default"}
              />
              <Stat
                label={t("Open change requests")}
                value={s.openChangeRequests}
                tone={s.openChangeRequests ? "warning" : "default"}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card title={t("Local model")}>
                <p
                  className={
                    s.model.online
                      ? "text-sm font-semibold text-success"
                      : "text-sm font-semibold text-destructive"
                  }
                >
                  {s.model.online ? t("Online") : t("Offline")}
                </p>
                <p className="mt-1 break-all text-xs text-muted-foreground">
                  {s.model.model ?? "—"} · {s.model.url}
                </p>
                {s.model.error ? (
                  <p className="mt-2 text-xs text-destructive">{s.model.error}</p>
                ) : null}
                {!s.model.online ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("Tasks that need the model wait as BLOCKED until it is running.")}
                  </p>
                ) : null}
              </Card>
              <Card title={t("Machine resources")}>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <dt className="text-muted-foreground">{t("Free disk")}</dt>
                  <dd>{`${s.resources.freeDiskGb} / ${s.resources.totalDiskGb} GB`}</dd>
                  <dt className="text-muted-foreground">{t("Free memory")}</dt>
                  <dd>{`${s.resources.freeMemMb} / ${s.resources.totalMemMb} MB`}</dd>
                  <dt className="text-muted-foreground">{t("CPU cores")}</dt>
                  <dd>{s.resources.cpuCount}</dd>
                </dl>
                {s.resources.problems.map((p) => (
                  <p key={p} className="mt-2 text-xs text-warning">
                    {p}
                  </p>
                ))}
              </Card>
              <Card title={t("Runner")}>
                <p className="text-sm">
                  {s.worker.running ? t("Running") : t("Stopped")}
                  {s.worker.busyTask
                    ? ` · ${t("working on")} ${s.worker.busyTask}`
                    : ` · ${t("idle")}`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("Last tick")} {relativeTime(s.worker.lastTick)}
                </p>
                {s.worker.lastError ? (
                  <p className="mt-2 text-xs text-destructive">{s.worker.lastError}</p>
                ) : null}
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("Audit chain")}:{" "}
                  {s.audit.ok ? t("intact") : `${t("broken at")} #${s.audit.brokenAt}`} (
                  {s.audit.entries})
                </p>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card title={t("In flight")}>
                {active.length === 0 ? (
                  <Empty>{t("No task is running or queued.")}</Empty>
                ) : (
                  <TaskList tasks={active} />
                )}
              </Card>
              <Card title={t("Needs attention")}>
                {attention.length === 0 ? (
                  <Empty>{t("No blocked or failed tasks.")}</Empty>
                ) : (
                  <TaskList tasks={attention} showReason />
                )}
              </Card>
            </div>

            <Card title={t("What this system can and cannot do today")}>
              <ul className="divide-y divide-border">
                {s.capabilities.map((c) => (
                  <li key={c.area} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                    <Badge value={c.status} />
                    <span>{t(c.area)}</span>
                    {c.note ? (
                      <span className="text-xs text-muted-foreground">— {t(c.note)}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </Page>
    </div>
  );
}

export function TaskList({ tasks, showReason = false }: { tasks: Task[]; showReason?: boolean }) {
  return (
    <ul className="divide-y divide-border">
      {tasks.map((task) => (
        <li key={task.id} className="py-2">
          <Link
            to="/vala-ai/tasks/$taskId"
            params={{ taskId: task.id }}
            className="flex flex-wrap items-center gap-2 text-sm hover:underline"
          >
            <Badge value={task.state} />
            <span className="font-mono text-xs text-muted-foreground">{task.id}</span>
            <span className="min-w-0 flex-1 truncate">{task.title}</span>
            <span className="text-xs text-muted-foreground">
              {task.project_name ?? task.project_id} · {relativeTime(task.updated_at)}
            </span>
          </Link>
          {showReason && (task.blocked_reason || task.error) ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {task.blocked_reason ?? task.error}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
