import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  ListTodo,
  Pause,
  RefreshCw,
  RotateCcw,
  UserPlus,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useCancelCanonicalTask,
  useCreateCanonicalTask,
  useCanonicalTaskAssignees,
  useCanonicalTasks,
  useReopenCanonicalTask,
} from "@/hooks/useDevManagerData";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useDMPrompt } from "../DMPromptDialog";

type TaskFilter = "all" | "assigned" | "in_progress" | "submitted" | "rejected" | "verified" | "paid" | "cancelled";

const statusTone: Record<string, string> = {
  assigned: "bg-cyan-500/20 text-cyan-500",
  in_progress: "bg-green-500/20 text-green-500",
  submitted: "bg-amber-500/20 text-amber-500",
  rejected: "bg-red-500/20 text-red-500",
  verified: "bg-emerald-500/20 text-emerald-500",
  paid: "bg-blue-500/20 text-blue-500",
  cancelled: "bg-muted text-muted-foreground",
};

const paymentTone: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  verified: "bg-amber-500/20 text-amber-500",
  due: "bg-red-500/20 text-red-500",
  paid: "bg-emerald-500/20 text-emerald-500",
};

export const DMTaskManagement: React.FC<{ focusTaskId?: string | null }> = ({ focusTaskId }) => {
  const { t, formatDate } = useTranslation();
  const prompt = useDMPrompt();
  const [activeTab, setActiveTab] = useState<TaskFilter>("all");
  const [developerId, setDeveloperId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const tasks = useCanonicalTasks();
  const assignees = useCanonicalTaskAssignees();
  const create = useCreateCanonicalTask();
  const cancel = useCancelCanonicalTask();
  const reopen = useReopenCanonicalTask();
  const taskRows = tasks.data ?? [];
  const assignableDevelopers = assignees.data ?? [];

  // PHASE4-WIRED: focus notifications on the exact canonical task in this list.
  useEffect(() => {
    if (!focusTaskId || tasks.isLoading) return;
    if (activeTab !== "all") {
      setActiveTab("all");
      return;
    }
    document.getElementById(`manager-task-${focusTaskId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeTab, focusTaskId, tasks.isLoading]);

  const visibleTasks = taskRows.filter((task) => activeTab === "all" || task.status === activeTab);

  const cancelTask = async (taskId: string, pause = false) => {
    const answer = await prompt.ask({
      title: pause ? t("devmanager.tasks.pause") : t("devmanager.tasks.close"),
      reasonLabel: t("devmanager.prompt.reason"),
      minLength: 1,
      confirmLabel: t("devmanager.tasks.close"),
    });
    if (answer?.reason?.trim()) cancel.mutate({ taskId, reason: answer.reason.trim() });
  };

  const createAssignedTask = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const selectedDeveloper = assignableDevelopers.find((developer) => developer.userId === developerId);
    if (!selectedDeveloper || !title.trim()) return;
    const deadlineAt = deadline ? new Date(deadline).toISOString() : null;
    try {
      await create.mutateAsync({
        developerId: selectedDeveloper.userId,
        title: title.trim(),
        desc: description.trim() || null,
        deadlineAt,
      });
      setTitle("");
      setDescription("");
      setDeadline("");
    } catch {
      // The mutation hook reports the server error to the operator.
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("devmanager.tasks.title")}</h1>
        <p className="text-muted-foreground">{t("devmanager.tasks.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="h-5 w-5" />
            {t("devmanager.tasks.create_title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => void createAssignedTask(event)}>
            <label className="space-y-1 text-sm">
              <span>{t("devmanager.tasks.create_assignee")}</span>
              <select
                required
                value={developerId}
                onChange={(event) => setDeveloperId(event.target.value)}
                disabled={assignees.isLoading || assignableDevelopers.length === 0}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="">
                  {assignees.isLoading
                    ? t("devmanager.tasks.developers_loading")
                    : t("devmanager.tasks.select_developer")}
                </option>
                {assignableDevelopers.map((developer) => (
                  <option key={developer.userId} value={developer.userId}>
                    {developer.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span>{t("devmanager.tasks.create_deadline")}</span>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span>{t("devmanager.tasks.create_task_name")}</span>
              <input
                required
                maxLength={500}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span>{t("devmanager.tasks.create_description")}</span>
              <textarea
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </label>
            {assignees.error && (
              <p role="alert" className="text-sm text-destructive md:col-span-2">
                {t("devmanager.tasks.load_error", { error: assignees.error.message })}
              </p>
            )}
            {!assignees.isLoading && !assignees.error && assignableDevelopers.length === 0 && (
              <p role="status" className="text-sm text-muted-foreground md:col-span-2">
                {t("devmanager.tasks.no_assignable_developers")}
              </p>
            )}
            <div className="md:col-span-2">
              <Button type="submit" disabled={create.isPending || !developerId}>
                {t("devmanager.tasks.create_action")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TaskFilter)}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="all">{t("devmanager.common.all")}</TabsTrigger>
          <TabsTrigger value="assigned">{t("devmanager.status.assigned")}</TabsTrigger>
          <TabsTrigger value="in_progress">{t("devmanager.status.in_progress")}</TabsTrigger>
          <TabsTrigger value="submitted">{t("devmanager.review.tab_pending")}</TabsTrigger>
          <TabsTrigger value="rejected">{t("devmanager.review.qa_failed")}</TabsTrigger>
          <TabsTrigger value="verified">{t("devmanager.review.qa_passed")}</TabsTrigger>
          <TabsTrigger value="paid">{t("devmanager.payment.paid")}</TabsTrigger>
          <TabsTrigger value="cancelled">{t("devmanager.tasks.close")}</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ListTodo className="h-5 w-5" />
                {t("devmanager.tasks.task_list")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(tasks.isLoading || tasks.error || visibleTasks.length === 0) && (
                  <p
                    className="text-sm text-muted-foreground"
                    role={tasks.error ? "alert" : "status"}
                    aria-live={tasks.error ? undefined : "polite"}
                    aria-busy={tasks.isLoading || undefined}
                  >
                    {tasks.isLoading
                      ? t("devmanager.tasks.loading")
                      : tasks.error
                        ? t("devmanager.tasks.load_error", { error: tasks.error.message })
                        : t("devmanager.tasks.empty")}
                  </p>
                )}
                {visibleTasks.map((task) => (
                  <div
                    id={`manager-task-${task.id}`}
                    key={task.id}
                    className="rounded-lg border bg-muted/30 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="font-mono font-medium">{task.id.slice(0, 8).toUpperCase()}</span>
                          <Badge className={statusTone[task.status] ?? ""}>{task.status.replace(/_/g, " ")}</Badge>
                          <Badge className={paymentTone[task.paymentStatus] ?? ""}>
                            {t("devmanager.payment.payment_status", { status: task.paymentStatus })}
                          </Badge>
                        </div>
                        <h2 className="font-semibold">{task.title}</h2>
                        <p className="text-sm text-muted-foreground">
                          {t("devmanager.tasks.assignee")}: {task.developerLabel}
                        </p>
                      </div>
                      {task.priority && <Badge variant="outline">{task.priority}</Badge>}
                    </div>

                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {t("devmanager.tasks.deadline")}: {task.deadlineAt ? formatDate(task.deadlineAt) : "—"}
                      </span>
                      <span>{t("devmanager.payment.due_at")}: {task.dueAt ? formatDate(task.dueAt) : "—"}</span>
                      <span>{t("devmanager.payment.verified_at")}: {task.verifiedAt ? formatDate(task.verifiedAt) : "—"}</span>
                      <span>{t("devmanager.payment.paid_at")}: {task.paidAt ? formatDate(task.paidAt) : "—"}</span>
                    </div>
                    {task.submissionNotes && (
                      <p className="mt-3 whitespace-pre-wrap text-sm">{task.submissionNotes}</p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {(task.status === "assigned" || task.status === "in_progress") && (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={cancel.isPending}
                          onClick={() => void cancelTask(task.id)}
                        >
                          <XCircle className="mr-1 h-4 w-4" />
                          {t("devmanager.tasks.close")}
                        </Button>
                      )}
                      {task.status === "in_progress" && (
                        <span title={t("devmanager.tasks.pause_notice")}>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={cancel.isPending}
                            onClick={() => void cancelTask(task.id, true)}
                          >
                            <Pause className="mr-1 h-4 w-4" />
                            {t("devmanager.tasks.pause")}
                          </Button>
                        </span>
                      )}
                      {task.status === "rejected" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={reopen.isPending}
                          onClick={() => reopen.mutate({ taskId: task.id })}
                        >
                          <RotateCcw className="mr-1 h-4 w-4" />
                          {t("devmanager.tasks.reopen")}
                        </Button>
                      )}
                      {task.status !== "paid" && task.status !== "cancelled" && (
                        <>
                          <span title={t("devmanager.tasks.canonical_action_unavailable")}>
                            <Button size="sm" variant="outline" disabled>
                              <RefreshCw className="mr-1 h-4 w-4" />
                              {t("devmanager.tasks.reassign")}
                            </Button>
                          </span>
                          <span title={t("devmanager.tasks.canonical_action_unavailable")}>
                            <Button size="sm" variant="outline" disabled>
                              <AlertTriangle className="mr-1 h-4 w-4" />
                              {t("devmanager.common.escalate")}
                            </Button>
                          </span>
                        </>
                      )}
                      {task.status === "verified" && (
                        <p className="flex items-center gap-1 text-sm text-muted-foreground">
                          <CheckCircle className="h-4 w-4" />
                          {task.dueAt
                            ? t("devmanager.payment.payment_due_date", { date: formatDate(task.dueAt) })
                            : t("devmanager.payment.payment_status", { status: task.paymentStatus })}
                        </p>
                      )}
                      {task.status === "paid" && (
                        <p className="flex items-center gap-1 text-sm text-emerald-600">
                          <CheckCircle className="h-4 w-4" />
                          {t("devmanager.payment.paid_at")}: {task.paidAt ? formatDate(task.paidAt) : "—"}
                        </p>
                      )}
                      {task.status === "submitted" && (
                        <p className="flex items-center gap-1 text-sm text-muted-foreground">
                          <AlertTriangle className="h-4 w-4" />
                          {t("devmanager.review.tab_pending")}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {prompt.dialog}
    </div>
  );
};

export default DMTaskManagement;
