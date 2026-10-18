import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { GitBranch } from "lucide-react";
import { useLanguage } from "@/lib/language-catalog";
import { cn } from "@/lib/utils";
import { TASK_STATES, useApi, type Task, type TaskState } from "../api";
import { Badge, Empty, ErrorBox, Loading, Page, PageHeader } from "../ui";
import { relativeTime } from "../format";

export function Pipeline() {
  const { translate: t } = useLanguage();
  const [state, setState] = useState<TaskState | "">("");
  const tasks = useApi<Task[]>(
    ["tasks", "all", state],
    state ? `/tasks?state=${state}` : "/tasks",
    { refetchInterval: 5_000 },
  );

  return (
    <div>
      <PageHeader
        title={t("Execution Pipeline")}
        description={t(
          "Every task and the state it is really in. PENDING → ANALYZING → BUILDING → TESTING → FIXING → RETESTING → VERIFIED → COMPLETE.",
        )}
        icon={GitBranch}
      />
      <Page>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("Filter by state")}>
          {(["", ...TASK_STATES] as const).map((s) => (
            <button
              key={s || "all"}
              onClick={() => setState(s)}
              aria-pressed={state === s}
              className={cn(
                "rounded-md border px-2 py-1 text-xs",
                state === s
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {s ? t(s) : t("All")}
            </button>
          ))}
        </div>
        <ErrorBox error={tasks.error} />
        {tasks.isPending ? (
          <Loading />
        ) : (tasks.data ?? []).length === 0 ? (
          <Empty>
            {t("No tasks match. Create one from a project with an approved requirement.")}
          </Empty>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-surface/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">{t("Task")}</th>
                  <th className="px-3 py-2">{t("Project")}</th>
                  <th className="px-3 py-2">{t("State")}</th>
                  <th className="px-3 py-2">{t("Fix loops")}</th>
                  <th className="px-3 py-2">{t("Updated")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tasks.data!.map((task) => (
                  <tr key={task.id} className="hover:bg-surface/40">
                    <td className="px-3 py-2">
                      <Link
                        to="/vala-ai/tasks/$taskId"
                        params={{ taskId: task.id }}
                        className="hover:underline"
                      >
                        <span className="font-mono text-xs text-muted-foreground">{task.id}</span>{" "}
                        {task.title}
                      </Link>
                      {task.blocked_reason || task.error ? (
                        <p className="mt-0.5 max-w-xl truncate text-xs text-muted-foreground">
                          {task.blocked_reason ?? task.error}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        to="/vala-ai/projects/$projectId"
                        params={{ projectId: task.project_id }}
                        className="hover:underline"
                      >
                        {task.project_name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <Badge value={task.state} />
                      {task.cancel_requested &&
                      !["CANCELLED", "COMPLETE", "FAILED"].includes(task.state) ? (
                        <span className="ml-1 text-[11px] va-text-warning">{t("cancelling")}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {task.fix_loops} / {task.max_fix_loops}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {relativeTime(task.updated_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Page>
    </div>
  );
}
