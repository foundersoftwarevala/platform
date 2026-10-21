import React, { useState } from "react";
import { CheckCircle, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useCanonicalTasks,
  useRejectCanonicalTask,
  useVerifyCanonicalTask,
} from "@/hooks/useDevManagerData";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useDMPrompt } from "../DMPromptDialog";

type ReviewFilter = "all" | "submitted" | "rejected" | "verified";

const DATE_TIME: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "medium" };

export const DMReviewQA: React.FC = () => {
  const { t, formatDate } = useTranslation();
  const prompt = useDMPrompt();
  const [activeTab, setActiveTab] = useState<ReviewFilter>("all");
  const tasks = useCanonicalTasks();
  const verify = useVerifyCanonicalTask();
  const reject = useRejectCanonicalTask();
  const reviewRows = (tasks.data ?? []).filter(
    (task) => task.status === "submitted" || task.status === "rejected" || task.status === "verified",
  );
  const filteredRows = reviewRows.filter((task) => activeTab === "all" || task.status === activeTab);
  const pending = verify.isPending || reject.isPending;

  // PHASE4-WIRED: canonical submitted tasks are reviewed through audited task server functions.
  const decide = async (taskId: string, decision: "verify" | "reject") => {
    const answer = await prompt.ask({
      title: decision === "verify" ? t("devmanager.review.approve_prompt") : t("devmanager.review.send_back_prompt"),
      reasonLabel: t("devmanager.prompt.note"),
      minLength: 1,
      confirmLabel: decision === "verify" ? t("devmanager.common.approve") : t("devmanager.review.send_back"),
    });
    const notes = answer?.reason?.trim();
    if (!notes) return;
    if (decision === "verify") verify.mutate({ taskId, notes });
    else reject.mutate({ taskId, reason: notes });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("devmanager.review.title")}</h1>
        <p className="text-muted-foreground">{t("devmanager.review.subtitle")}</p>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ReviewFilter)}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="all">{t("devmanager.common.all")}</TabsTrigger>
          <TabsTrigger value="submitted">{t("devmanager.review.tab_pending")}</TabsTrigger>
          <TabsTrigger value="rejected">{t("devmanager.review.qa_failed")}</TabsTrigger>
          <TabsTrigger value="verified">{t("devmanager.review.qa_passed")}</TabsTrigger>
        </TabsList>
        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle className="h-5 w-5" />
                {t("devmanager.review.queue")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(tasks.isLoading || tasks.error || filteredRows.length === 0) && (
                  <p
                    className="text-sm text-muted-foreground"
                    role={tasks.error ? "alert" : "status"}
                    aria-live={tasks.error ? undefined : "polite"}
                    aria-busy={tasks.isLoading || undefined}
                  >
                    {tasks.isLoading
                      ? t("devmanager.review.loading")
                      : tasks.error
                        ? t("devmanager.review.load_error", { error: tasks.error.message })
                        : t("devmanager.review.empty")}
                  </p>
                )}
                {filteredRows.map((task) => {
                  const isRejected = task.status === "rejected";
                  const isVerified = task.status === "verified";
                  return (
                    <div
                      key={task.id}
                      className={`rounded-lg border p-4 ${
                        isRejected
                          ? "border-red-500/30 bg-red-500/5"
                          : isVerified
                            ? "border-green-500/30 bg-green-500/5"
                            : "bg-muted/30"
                      }`}
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{task.id.slice(0, 8).toUpperCase()}</span>
                          <Badge>{task.status.replace(/_/g, " ")}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(task.updatedAt, DATE_TIME)}
                        </span>
                      </div>
                      <p className="mb-1 font-semibold">{task.title}</p>
                      <p className="mb-3 text-sm text-muted-foreground">
                        {t("devmanager.review.submission_line", {
                          submission: task.submissionNotes || t("devmanager.review.submission_default"),
                          task: task.title,
                          dev: task.developerLabel,
                        })}
                      </p>
                      {task.submissionNotes && (
                        <p className="mb-3 whitespace-pre-wrap text-sm">{task.submissionNotes}</p>
                      )}
                      {task.artifacts != null && (
                        <pre className="mb-3 max-h-40 overflow-auto rounded bg-background/60 p-2 text-xs">
                          {JSON.stringify(task.artifacts, null, 2)}
                        </pre>
                      )}
                      {(task.managerNotes || isRejected || isVerified) && (
                        <p className={`mb-3 text-sm ${isRejected ? "text-red-500" : "text-muted-foreground"}`}>
                          {task.managerNotes ?? ""}
                        </p>
                      )}
                      {task.status === "submitted" && (
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            disabled={pending}
                            onClick={() => void decide(task.id, "verify")}
                          >
                            <CheckCircle className="mr-1 h-4 w-4" />
                            {t("devmanager.common.approve")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() => void decide(task.id, "reject")}
                          >
                            <RotateCcw className="mr-1 h-4 w-4" />
                            {t("devmanager.review.send_back")}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {prompt.dialog}
    </div>
  );
};

export default DMReviewQA;
