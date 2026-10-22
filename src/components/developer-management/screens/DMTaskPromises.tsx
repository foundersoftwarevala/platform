import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { formatWalletAmount } from "@/lib/wallet/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  breakPromise,
  getManagedTaskPromises,
} from "@/lib/tasks/promises.functions";

export function DMTaskPromises({
  onTaskClick,
  onDeveloperClick,
}: {
  onTaskClick: (taskId: string) => void;
  onDeveloperClick: (developerId: string) => void;
}) {
  const { t, formatDate } = useTranslation();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"pending" | "broken">("pending");
  const fetchPromises = useServerFn(getManagedTaskPromises);
  const breakTaskPromise = useServerFn(breakPromise);
  const queryKey = ["managed-task-promises", status] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => fetchPromises({ data: { status } }),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["managed-task-promises"] });
  const breakMutation = useMutation({
    mutationFn: (data: { promiseId: string; reason: string }) => breakTaskPromise({ data }),
    onSuccess: refresh,
  });
  const error = query.error ?? breakMutation.error;

  function submitBreak(event: FormEvent<HTMLFormElement>, promiseId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    breakMutation.mutate(
      { promiseId, reason: String(data.get("reason") ?? "") },
      { onSuccess: () => form.reset() },
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("devmanager.promises.manager_title")}</h1>
        <p className="text-sm text-muted-foreground">{t("devmanager.promises.manager_subtitle")}</p>
      </div>

      <label className="grid max-w-xs gap-2 text-sm">
        {t("devmanager.promises.filter")}
        <select
          className="h-10 rounded-md border bg-background px-3"
          value={status}
          onChange={(event) => {
            const selectedStatus = event.currentTarget.value;
            if (selectedStatus === "pending" || selectedStatus === "broken") {
              setStatus(selectedStatus);
            }
          }}
        >
          <option value="pending">{t("devmanager.promises.pending")}</option>
          <option value="broken">{t("devmanager.promises.broken")}</option>
        </select>
      </label>

      <Card>
        <CardHeader>
          <CardTitle>{t("devmanager.promises.manager_list_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {query.isLoading ? (
            <p className="text-sm text-muted-foreground" role="status" aria-busy="true">
              {t("devmanager.promises.loading")}
            </p>
          ) : query.error ? (
            <p className="text-sm text-destructive" role="alert">
              {t("devmanager.promises.load_error", {
                error: query.error instanceof Error ? query.error.message : String(query.error),
              })}
            </p>
          ) : query.data?.length ? (
            query.data.map((promise) => (
              <article key={promise.id} className="space-y-3 rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <Button
                      variant="link"
                      className="h-auto p-0 font-semibold"
                      onClick={() => onTaskClick(promise.taskId)}
                    >
                      {promise.taskTitle}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      {t("devmanager.promises.task_status", { status: promise.taskStatus })}
                    </p>
                    <Button
                      variant="link"
                      className="h-auto p-0 text-xs text-muted-foreground"
                      onClick={() => onDeveloperClick(promise.developerId)}
                    >
                      {t("devmanager.promises.developer_value", { id: promise.developerId })}
                    </Button>
                  </div>
                  <div className="text-right text-sm">
                    <p>
                      {t("devmanager.promises.promised_value", {
                        date: formatDate(promise.promisedAt),
                      })}
                    </p>
                    <p>
                      {t("devmanager.promises.deadline_value", {
                        date: formatDate(promise.deadlineAt),
                      })}
                    </p>
                    <p className="text-muted-foreground">
                      {t("devmanager.promises.status", { status: promise.status })}
                    </p>
                  </div>
                </div>
                {promise.note && <p className="text-sm">{promise.note}</p>}
                {promise.breakReason && (
                  <p className="text-sm text-destructive">
                    {t("devmanager.promises.break_reason_value", { reason: promise.breakReason })}
                  </p>
                )}
                <p className="text-sm">
                  {promise.status === "pending"
                    ? t("devmanager.promises.fine_policy")
                    : promise.finePercentage
                      ? t("devmanager.promises.fine_tier_value", {
                          percentage: promise.finePercentage,
                          amount: formatWalletAmount(promise.fineCents, "INR"),
                        })
                      : t("devmanager.promises.fine_legacy_value", {
                          amount: formatWalletAmount(promise.fineCents, "INR"),
                        })}
                  {promise.fineAppliedAt
                    ? ` · ${t("devmanager.promises.fine_applied", {
                        date: formatDate(promise.fineAppliedAt),
                      })}`
                    : ""}
                </p>
                {promise.status === "pending" && (
                  <div className="border-t pt-3">
                    <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => submitBreak(event, promise.id)}>
                      <label className="grid min-w-48 flex-1 gap-1 text-xs">
                        {t("devmanager.promises.break_reason")}
                        <input
                          className="h-9 rounded-md border bg-background px-2"
                          name="reason"
                          minLength={5}
                          maxLength={2000}
                          required
                        />
                      </label>
                      <Button type="submit" variant="destructive" disabled={breakMutation.isPending}>
                        {t("devmanager.promises.break")}
                      </Button>
                    </form>
                  </div>
                )}
              </article>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">{t("devmanager.promises.empty")}</p>
          )}
          {error && !query.error && (
            <p className="text-sm text-destructive" role="alert">
              {error instanceof Error ? error.message : String(error)}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default DMTaskPromises;
