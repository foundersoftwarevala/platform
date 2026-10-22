import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { useTranslation } from "@/lib/i18n/use-translation";
import {
  getResellerCountrySeoDraftProgress,
  queueResellerCountrySeoDrafts,
} from "@/lib/reseller-country-seo.functions";

const PROGRESS_KEY = ["reseller-country-seo-progress"];

export function ResellerCountrySeoQueue() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const progress = useQuery({
    queryKey: PROGRESS_KEY,
    queryFn: () => getResellerCountrySeoDraftProgress(),
    refetchInterval: 5000,
  });
  const queue = useMutation({
    mutationFn: () => queueResellerCountrySeoDrafts(),
    onSuccess: async (result) => {
      toast.success(
        result.queued
          ? t("seo.reseller_country_seo_queued", { count: result.queued })
          : t("seo.reseller_country_seo_already_complete", {
              completed: result.completed,
              inProgress: result.alreadyQueued,
            }),
      );
      await queryClient.invalidateQueries({ queryKey: PROGRESS_KEY });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t("seo.reseller_country_seo_queue_failed"),
      );
    },
  });

  const counts = progress.data;
  const completedPercent = counts ? Math.round((counts.completed / counts.total) * 100) : 0;

  return (
    <section className="space-y-4" aria-labelledby="reseller-country-seo-title">
      <header className="rounded-2xl border border-border bg-background/40 p-5">
        <h2 id="reseller-country-seo-title" className="text-lg font-semibold">
          {t("seo.reseller_country_seo_title")}
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          {t("seo.reseller_country_seo_description")}
        </p>
        <button
          type="button"
          onClick={() => queue.mutate()}
          disabled={queue.isPending}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          {queue.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {queue.isPending
            ? t("seo.reseller_country_seo_queueing")
            : t("seo.reseller_country_seo_queue_button")}
        </button>
        {queue.isError && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {queue.error instanceof Error
              ? queue.error.message
              : t("seo.reseller_country_seo_queue_failed")}
          </p>
        )}
      </header>

      <div className="rounded-2xl border border-border bg-background/40 p-5">
        {progress.isPending && (
          <p className="text-sm text-muted-foreground">
            {t("seo.reseller_country_seo_loading_progress")}
          </p>
        )}
        {progress.isError && (
          <p role="alert" className="text-sm text-destructive">
            {progress.error instanceof Error
              ? progress.error.message
              : t("seo.reseller_country_seo_progress_failed")}
          </p>
        )}
        {counts && (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{t("seo.reseller_country_seo_progress_title")}</span>
              <span className="text-sm text-muted-foreground">
                {t("seo.reseller_country_seo_completed_count", {
                  completed: counts.completed,
                  total: counts.total,
                })}
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label={t("seo.reseller_country_seo_progress_aria_label")}
              aria-valuemin={0}
              aria-valuemax={counts.total}
              aria-valuenow={counts.completed}
            >
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${completedPercent}%` }}
              />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
              <div>
                <dt className="text-muted-foreground">
                  {t("seo.reseller_country_seo_queued_label")}
                </dt>
                <dd>{counts.queued}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t("seo.reseller_country_seo_processing")}
                </dt>
                <dd>{counts.processing}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t("seo.reseller_country_seo_retry_wait")}
                </dt>
                <dd>{counts.retrying}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("seo.reseller_country_seo_completed")}</dt>
                <dd>{counts.completed}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("seo.failed")}</dt>
                <dd>{counts.failed}</dd>
              </div>
            </dl>
          </>
        )}
      </div>
    </section>
  );
}
