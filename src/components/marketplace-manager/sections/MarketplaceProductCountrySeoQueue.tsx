import { Card } from "../ui";
import { Loader2, Pause, Play, RefreshCw, Sparkles } from "lucide-react";

import {
  useMarketplaceProductCountrySeoProgress,
  useMarketplaceProductCountrySeoWorkerStatus,
  useProcessMarketplaceProductCountrySeoBatch,
  useRetryFailedMarketplaceProductCountrySeo,
  useSetMarketplaceProductCountrySeoWorkerEnabled,
} from "@/lib/use-seo-actions";

export function MarketplaceProductCountrySeoQueue() {
  const processBatch = useProcessMarketplaceProductCountrySeoBatch();
  const worker = useMarketplaceProductCountrySeoWorkerStatus();
  const setWorkerEnabled = useSetMarketplaceProductCountrySeoWorkerEnabled();
  const progress = useMarketplaceProductCountrySeoProgress(
    processBatch.isPending || worker.data?.enabled === true,
  );
  const retryFailed = useRetryFailedMarketplaceProductCountrySeo();
  const counts = progress.data;
  const percent = counts?.total ? Math.floor((counts.completed / counts.total) * 100) : 0;
  const processed = (counts?.completed ?? 0) + (counts?.failed ?? 0);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">Bulk Generation Status</div>
          <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
            Eligible public products are lazily paired with all 100 Marketplace countries. The
            background worker handles one pair at a time, prefers Ollama Local, and is restricted to
            approved Free providers. Paid providers are never used by this queue. Pause takes effect
            after any in-progress pair finishes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void progress.refetch()}
          disabled={progress.isFetching}
          className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-[11px] font-semibold disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${progress.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {progress.isError ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-[11px] text-destructive">
          <span role="alert">Marketplace SEO queue progress could not be loaded.</span>
          <button
            type="button"
            onClick={() => void progress.refetch()}
            className="rounded-md border border-destructive/40 px-3 py-1 font-semibold"
          >
            Retry
          </button>
        </div>
      ) : progress.isLoading ? (
        <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Reading SEO generation progress…
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[11px]">
            <span>
              Total pairs <strong>{counts?.total.toLocaleString() ?? 0}</strong>
            </span>
            <span>
              Processed <strong>{processed.toLocaleString()}</strong>
            </span>
            <span>
              Complete <strong>{counts?.completed.toLocaleString() ?? 0}</strong> /{" "}
              <strong>{counts?.total.toLocaleString() ?? 0}</strong>
            </span>
            <span>Remaining {counts?.pending.toLocaleString() ?? 0}</span>
            <span>Processing {counts?.processing.toLocaleString() ?? 0}</span>
            <span>Failed {counts?.failed.toLocaleString() ?? 0}</span>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Marketplace product-country SEO generation"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setWorkerEnabled.mutate(!worker.data?.enabled)}
              disabled={worker.isLoading || worker.isError || setWorkerEnabled.isPending}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
            >
              {setWorkerEnabled.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : worker.data?.enabled ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              {setWorkerEnabled.isPending
                ? "Updating worker…"
                : worker.data?.enabled
                  ? "Pause"
                  : "Resume"}
            </button>
            <button
              type="button"
              onClick={() => processBatch.mutate()}
              disabled={processBatch.isPending || !counts?.pending || !worker.data?.enabled}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-[11px] font-semibold disabled:opacity-50"
            >
              {processBatch.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {processBatch.isPending ? "Processing one…" : "Process one now"}
            </button>
            <button
              type="button"
              onClick={() => retryFailed.mutate()}
              disabled={retryFailed.isPending || !counts?.failed}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-[11px] font-semibold disabled:opacity-50"
            >
              {retryFailed.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Retry next 50 failed
            </button>
          </div>
          {worker.isError ? (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-[11px] text-destructive">
              <span role="alert">Background worker status could not be loaded.</span>
              <button
                type="button"
                onClick={() => void worker.refetch()}
                className="rounded-md border border-destructive/40 px-3 py-1 font-semibold"
              >
                Retry
              </button>
            </div>
          ) : worker.isLoading ? (
            <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Reading worker status…
            </div>
          ) : worker.data ? (
            <div className="mt-3 space-y-1 text-[11px] text-muted-foreground" aria-live="polite">
              <div>
                Worker <strong>{worker.data.enabled ? "Running" : "Paused"}</strong>
                {" · "}Current AI provider <strong>{worker.data.current_provider}</strong>
              </div>
              {worker.data.pause_reason ? (
                <div role="status">{worker.data.pause_reason}</div>
              ) : null}
              {worker.data.last_error ? (
                <div className="break-words text-destructive" role="alert">
                  {worker.data.last_error}
                </div>
              ) : null}
              {worker.data.host_load_1m !== null || worker.data.available_memory_bytes !== null ? (
                <div>
                  Host load (1 min) {worker.data.host_load_1m?.toFixed(2) ?? "—"}
                  {" · "}Available memory{" "}
                  {worker.data.available_memory_bytes === null
                    ? "—"
                    : `${(worker.data.available_memory_bytes / 1024 ** 3).toFixed(1)} GiB`}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}
      {processBatch.data?.apiConfigurationPending && (
        <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-[11px] text-amber-800 dark:text-amber-200">
          <strong>Pending API configuration.</strong> Configure a valid, active AI provider in AI
          API Manager, then retry the failed items. No content was generated for those items.
        </div>
      )}
    </Card>
  );
}
