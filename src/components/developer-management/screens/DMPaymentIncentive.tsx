import React from "react";
import { AlertTriangle, CheckCircle, Clock, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCanonicalTasks } from "@/hooks/useDevManagerData";
import { useTranslation } from "@/lib/i18n/use-translation";

// PHASE4-WIRED: payment states and completion are read/written on canonical tasks.
export const DMPaymentIncentive: React.FC = () => {
  const { t, formatDate } = useTranslation();
  const tasks = useCanonicalTasks();
  const paymentTasks = (tasks.data ?? []).filter(
    (task) => task.paymentStatus !== "pending" || task.status === "verified" || task.status === "paid",
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("devmanager.payment.title")}</h1>
        <p className="text-muted-foreground">{t("devmanager.payment.subtitle")}</p>
      </div>

      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="flex items-center gap-3 py-4">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <span className="text-sm font-medium text-amber-500">
            {t("devmanager.payment.no_direct_payout")}
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5" />
            {t("devmanager.payment.summary")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(tasks.isLoading || tasks.error || paymentTasks.length === 0) && (
              <p
                className="text-sm text-muted-foreground"
                role={tasks.error ? "alert" : "status"}
                aria-live={tasks.error ? undefined : "polite"}
                aria-busy={tasks.isLoading || undefined}
              >
                {tasks.isLoading
                  ? t("devmanager.common.loading")
                  : tasks.error
                    ? t("devmanager.common.figures_error", { error: tasks.error.message })
                    : t("devmanager.payment.empty")}
              </p>
            )}
            {paymentTasks.map((task) => (
              <div key={task.id} className="rounded-lg border bg-muted/30 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.developerLabel} · {t("devmanager.payment.payment_status", { status: task.paymentStatus })}
                    </p>
                  </div>
                  {task.paymentStatus === "due" && (
                    <span className="rounded-full bg-red-500/15 px-2 py-1 text-xs text-red-600">
                      {t("devmanager.payment.due")}
                    </span>
                  )}
                </div>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {t("devmanager.payment.verified_at")}: {task.verifiedAt ? formatDate(task.verifiedAt) : "—"}
                  </span>
                  <span>{t("devmanager.payment.due_at")}: {task.dueAt ? formatDate(task.dueAt) : "—"}</span>
                  <span>{t("devmanager.payment.paid_at")}: {task.paidAt ? formatDate(task.paidAt) : "—"}</span>
                </div>
                <div className="mt-3">
                  {task.status === "verified" ? (
                    <p className="text-sm text-muted-foreground" title={t("wallet.finance_only")}>
                      {t("wallet.finance_only")}
                    </p>
                  ) : task.status === "paid" ? (
                    <p className="text-sm text-emerald-600">
                      <CheckCircle className="mr-1 inline h-4 w-4" />
                      {t("devmanager.payment.paid_at")}: {task.paidAt ? formatDate(task.paidAt) : "—"}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DMPaymentIncentive;
