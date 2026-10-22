import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock3, Handshake } from "lucide-react";
import { useSupabaseSession } from "@/hooks/use-session";
import { useTranslation } from "@/lib/i18n/use-translation";
import { formatWalletAmount } from "@/lib/wallet/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getMyTaskPromiseData,
  makePromise,
} from "@/lib/tasks/promises.functions";
import type { TaskPromiseDTO } from "@/lib/tasks/promises.types";

export function DMPromises() {
  const { t, formatDate } = useTranslation();
  const { userId, loading: sessionLoading } = useSupabaseSession();
  const queryClient = useQueryClient();
  const fetchPromises = useServerFn(getMyTaskPromiseData);
  const createPromise = useServerFn(makePromise);
  const query = useQuery({
    queryKey: ["developer-task-promises", userId],
    queryFn: () => fetchPromises({ data: undefined }),
    enabled: !sessionLoading && Boolean(userId),
  });
  const createMutation = useMutation({
    mutationFn: (data: { taskId: string; deadlineAt: string; note: string | null }) =>
      createPromise({ data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["developer-task-promises", userId] }),
  });
  const pendingTaskIds = new Set(
    query.data?.promises.filter((promise) => promise.status === "pending").map((promise) => promise.taskId) ?? [],
  );
  const loading = sessionLoading || query.isLoading;
  const error = query.error;

  function handleMakePromise(event: FormEvent<HTMLFormElement>, taskId: string) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const localDeadline = String(form.get("deadlineAt") ?? "");
    if (!localDeadline) return;
    createMutation.mutate(
      {
        taskId,
        deadlineAt: new Date(localDeadline).toISOString(),
        note: String(form.get("note") ?? "").trim() || null,
      },
      { onSuccess: () => formElement.reset() },
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("devmanager.promises.developer_title")}</h1>
        <p className="text-sm text-muted-foreground">{t("devmanager.promises.developer_subtitle")}</p>
      </div>

      {loading || !userId || error ? (
        <p
          className="text-sm text-muted-foreground"
          role={error || (!sessionLoading && !userId) ? "alert" : "status"}
          aria-busy={loading || undefined}
        >
          {!sessionLoading && !userId
            ? t("devmanager.promises.sign_in")
            : loading
              ? t("devmanager.promises.loading")
              : t("devmanager.promises.load_error", {
                  error: error instanceof Error ? error.message : String(error),
                })}
        </p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock3 className="h-5 w-5" />
                {t("devmanager.promises.make_title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {query.data?.tasks.length ? (
                query.data.tasks.map((task) => (
                  <form
                    key={task.id}
                    className="grid gap-3 rounded-lg border p-4 md:grid-cols-[minmax(0,1fr)_auto]"
                    onSubmit={(event) => handleMakePromise(event, task.id)}
                  >
                    <div className="space-y-2">
                      <p className="font-medium">{task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("devmanager.promises.task_status", { status: task.status })}
                      </p>
                      {pendingTaskIds.has(task.id) ? (
                        <p className="text-sm text-muted-foreground">
                          {t("devmanager.promises.pending_exists")}
                        </p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="grid gap-1 text-sm">
                            {t("devmanager.promises.deadline")}
                            <input
                              className="h-10 rounded-md border bg-background px-3"
                              name="deadlineAt"
                              type="datetime-local"
                              required
                            />
                          </label>
                          <label className="grid gap-1 text-sm">
                            {t("devmanager.promises.note")}
                            <input
                              className="h-10 rounded-md border bg-background px-3"
                              name="note"
                              maxLength={2000}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                    {!pendingTaskIds.has(task.id) && (
                      <Button
                        type="submit"
                        disabled={createMutation.isPending}
                        className="self-end"
                      >
                        <Handshake className="mr-2 h-4 w-4" />
                        {t("devmanager.promises.make")}
                      </Button>
                    )}
                  </form>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">{t("devmanager.promises.no_eligible_tasks")}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("devmanager.promises.list_title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {query.data?.promises.length ? (
                query.data.promises.map((promise) => (
                  <DeveloperPromiseRow
                    key={promise.id}
                    promise={promise}
                    formatDate={formatDate}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">{t("devmanager.promises.empty")}</p>
              )}
            </CardContent>
          </Card>
          {createMutation.error && (
            <p className="text-sm text-destructive" role="alert">
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : t("devmanager.promises.action_failed")}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function DeveloperPromiseRow({
  promise,
  formatDate,
}: {
  promise: TaskPromiseDTO;
  formatDate: (value: string) => string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4">
      <div className="space-y-1">
        <p className="font-semibold">{promise.taskTitle}</p>
        <p className="text-sm text-muted-foreground">
          {t("devmanager.promises.promised_value", { date: formatDate(promise.promisedAt) })}
          {" · "}
          {t("devmanager.promises.deadline_value", { date: formatDate(promise.deadlineAt) })}
        </p>
        {promise.note && <p className="text-sm">{promise.note}</p>}
        <p className="text-xs text-muted-foreground">
          {t("devmanager.promises.fine_value", {
            amount: formatWalletAmount(promise.fineCents, "INR"),
          })}
          {promise.fineAppliedAt
            ? ` · ${t("devmanager.promises.fine_applied", { date: formatDate(promise.fineAppliedAt) })}`
            : ""}
        </p>
      </div>
      <span className="rounded-full bg-muted px-3 py-1 text-xs">
        {t("devmanager.promises.status", { status: promise.status })}
      </span>
    </div>
  );
}

export default DMPromises;
