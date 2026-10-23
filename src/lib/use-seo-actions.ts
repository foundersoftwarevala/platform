import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n/use-translation";

import {
  deleteRecord,
  generateSeoReport,
  generateSeoContentDraft,
  generateSeoKeywordIdeas,
  listSeoAiManagerServices,
  generateWithAi,
  insertRecord,
  runAutomation,
  runSiteAudit,
  runTechnicalChecks,
  recrawlUrl,
  syncSearchConsole,
  syncSemrush,
  updateRecord,
} from "@/lib/seo.functions";
import { submitToIndexNow } from "@/lib/bing-indexnow-integration.functions";
import {
  getMarketplaceProductCountrySeoProgress,
  getMarketplaceProductCountrySeoWorkerStatus,
  processMarketplaceProductCountrySeoBatch,
  retryFailedMarketplaceProductCountrySeo,
  setMarketplaceProductCountrySeoWorkerEnabled,
} from "@/lib/marketplace-product-seo.functions";

export type SeoValue = string | number | boolean | null | string[];
export type SeoTableName =
  | "seo_pages"
  | "seo_keywords"
  | "seo_meta_rules"
  | "seo_indexing_records"
  | "seo_automations"
  | "seo_issues"
  | "seo_reports"
  | "seo_audits"
  | "seo_backlinks"
  | "seo_competitors"
  | "seo_ai_suggestions"
  | "seo_content_items"
  | "seo_technical_checks"
  | "seo_alerts"
  | "seo_leads"
  | "seo_ad_campaigns"
  | "seo_email_campaigns"
  | "seo_social_posts"
  | "seo_social_comments"
  | "seo_inbox_messages"
  | "seo_automation_flows"
  | "seo_reels"
  | "seo_integrations"
  | "seo_product_entries";

export type InsertInput = { table: SeoTableName; values: Record<string, SeoValue> };
export type UpdateInput = InsertInput & { id: string };
export type DeleteInput = { table: SeoTableName; id: string };
export type AiInput = {
  task: "suggestions" | "content" | "meta" | "reel" | "assistant";
  prompt: string;
  persist?: boolean;
  context?: string;
};

function useInvalidate() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ["seo"] });
}

/** Row-level create/update/delete against the SEO tables. */
export function useRecordActions() {
  const { t } = useTranslation();
  const invalidate = useInvalidate();
  const insertFn = useServerFn(insertRecord);
  const updateFn = useServerFn(updateRecord);
  const deleteFn = useServerFn(deleteRecord);

  const insert = useMutation({
    mutationFn: (input: InsertInput) => insertFn({ data: input }),
    onSuccess: () => {
      toast.success(t("seo.created"));
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: (input: UpdateInput) => updateFn({ data: input }),
    onSuccess: () => {
      toast.success(t("seo.saved"));
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (input: DeleteInput) => deleteFn({ data: input }),
    onSuccess: () => {
      toast.success(t("seo.deleted"));
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { insert, update, remove };
}

export function useRunAutomation() {
  const run = useServerFn(runAutomation);
  return useMutation({
    mutationFn: (id: string) => run({ data: { id } }),
    onError: (e: Error) => toast.error(e.message),
  });
}

function useSeoOperation<T>(
  serverFn: (options?: { data?: never }) => Promise<T>,
  success: (result: T) => string,
) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => serverFn(),
    onSuccess: (result) => {
      toast.success(success(result));
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSiteAudit() {
  const run = useServerFn(runSiteAudit);
  // The audit's own message carries the page and issue counts it found, which
  // is the part an operator acts on; the score alone said nothing about why.
  return useSeoOperation(run, (result) => `${result.message} · score ${result.score}`);
}

export function useTechnicalChecks() {
  const { t } = useTranslation();
  const run = useServerFn(runTechnicalChecks);
  return useSeoOperation(run, (result) =>
    t("seo.technical_checks_completed", { count: result.checked }),
  );
}

export function useGenerateReport() {
  const run = useServerFn(generateSeoReport);
  return useSeoOperation(run, (result) => result.message);
}

export function useRecrawlUrl() {
  const { t } = useTranslation();
  const invalidate = useInvalidate();
  const run = useServerFn(recrawlUrl);
  return useMutation({
    mutationFn: (id: string) => run({ data: { id } }),
    onSuccess: (result) => {
      toast.success(t("seo.live_crawl_completed", { status: result.httpStatus }));
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAiGeneration() {
  const invalidate = useInvalidate();
  const generate = useServerFn(generateWithAi);
  return useMutation({
    mutationFn: (input: AiInput) => generate({ data: input }),
    onSuccess: () => void invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSearchConsoleSync() {
  const { t } = useTranslation();
  const sync = useServerFn(syncSearchConsole);
  return useMutation({
    mutationFn: (input: { siteUrl: string; days: number }) => sync({ data: input }),
    onSuccess: (result) =>
      toast.success(
        t("seo.search_console_sync_complete", {
          count: result.rowsSynced,
        }),
      ),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useGenerateSeoContentDraft() {
  const { t } = useTranslation();
  const generate = useServerFn(generateSeoContentDraft);
  return useMutation({
    mutationFn: (input: { topic: string; targetKeyword?: string; locale: string }) =>
      generate({ data: input }),
    onSuccess: (result) => toast.success(t("seo.draft_saved", { title: result.title })),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useGenerateSeoKeywordIdeas() {
  const { t } = useTranslation();
  const generate = useServerFn(generateSeoKeywordIdeas);
  return useMutation({
    mutationFn: (input: { topic: string; locale: string; count: number }) =>
      generate({ data: input }),
    onSuccess: (result) =>
      toast.success(t("seo.keyword_ideas_saved", { count: result.ideas.length })),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSeoAiManagerServices() {
  const list = useServerFn(listSeoAiManagerServices);
  return useQuery({
    queryKey: ["seo", "ai-api-manager-services"],
    queryFn: () => list(),
    staleTime: 30_000,
  });
}

export function useSubmitIndexNow() {
  const submit = useServerFn(submitToIndexNow);
  return useMutation({
    mutationFn: (input: { host: string; key: string; key_location?: string; urls: string[] }) =>
      submit({ data: input }),
    onSuccess: (result) => {
      if (result.success) toast.success(result.message);
      else toast.error(result.message);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSemrushSync() {
  const sync = useServerFn(syncSemrush);
  return useMutation({
    mutationFn: (input: { domain: string; database: string }) => sync({ data: input }),
    onError: (e: Error) => toast.error(e.message),
  });
}

const MARKETPLACE_PRODUCT_SEO_PROGRESS_KEY = ["seo", "marketplace-product-country-progress"];
const MARKETPLACE_PRODUCT_SEO_WORKER_KEY = ["seo", "marketplace-product-country-worker"];

export function useMarketplaceProductCountrySeoProgress(pollWhileProcessing = false) {
  const read = useServerFn(getMarketplaceProductCountrySeoProgress);
  return useQuery({
    queryKey: MARKETPLACE_PRODUCT_SEO_PROGRESS_KEY,
    queryFn: () => read(),
    refetchInterval: (query) =>
      pollWhileProcessing || query.state.data?.processing ? 5000 : false,
  });
}

export function useMarketplaceProductCountrySeoWorkerStatus() {
  const read = useServerFn(getMarketplaceProductCountrySeoWorkerStatus);
  return useQuery({
    queryKey: MARKETPLACE_PRODUCT_SEO_WORKER_KEY,
    queryFn: () => read(),
    refetchInterval: (query) => (query.state.data?.enabled ? 5000 : 15000),
  });
}

export function useSetMarketplaceProductCountrySeoWorkerEnabled() {
  const client = useQueryClient();
  const setEnabled = useServerFn(setMarketplaceProductCountrySeoWorkerEnabled);
  return useMutation({
    mutationFn: (enabled: boolean) => setEnabled({ data: { enabled } }),
    onSuccess: (result) => {
      void client.invalidateQueries({ queryKey: MARKETPLACE_PRODUCT_SEO_WORKER_KEY });
      void client.invalidateQueries({ queryKey: MARKETPLACE_PRODUCT_SEO_PROGRESS_KEY });
      toast.success(
        result.enabled ? "Marketplace SEO worker resumed." : "Marketplace SEO worker paused.",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useProcessMarketplaceProductCountrySeoBatch() {
  const client = useQueryClient();
  const processBatch = useServerFn(processMarketplaceProductCountrySeoBatch);
  return useMutation({
    mutationFn: () => processBatch(),
    onSuccess: (result) => {
      void client.invalidateQueries({ queryKey: MARKETPLACE_PRODUCT_SEO_PROGRESS_KEY });
      void client.invalidateQueries({ queryKey: MARKETPLACE_PRODUCT_SEO_WORKER_KEY });
      if (result.apiConfigurationPending) {
        toast.error(
          "Pending API configuration. Configure Ollama Local or an approved Free text model in AI API Manager.",
        );
      } else if (result.claimed === 0 && !result.enabled) {
        toast.success(result.pauseReason ?? "Marketplace SEO worker is paused.");
      } else if (result.claimed === 0) {
        toast.success("Marketplace SEO worker is already processing an item.");
      } else {
        toast.success(
          `SEO item processed · ${result.completed} generated · ${result.failed} failed`,
        );
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useRetryFailedMarketplaceProductCountrySeo() {
  const client = useQueryClient();
  const retry = useServerFn(retryFailedMarketplaceProductCountrySeo);
  return useMutation({
    mutationFn: () => retry(),
    onSuccess: (result) => {
      void client.invalidateQueries({ queryKey: MARKETPLACE_PRODUCT_SEO_PROGRESS_KEY });
      toast.success(`${result.requeued.toLocaleString()} failed SEO item(s) queued for retry`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
