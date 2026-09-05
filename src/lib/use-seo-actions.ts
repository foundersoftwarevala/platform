import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
  deleteRecord,
  generateSeoReport,
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

export type SeoValue = string | number | boolean | null | string[];
export type SeoTableName =
  | "seo_pages" | "seo_keywords" | "seo_meta_rules" | "seo_indexing_records"
  | "seo_automations" | "seo_issues" | "seo_reports" | "seo_audits"
  | "seo_backlinks" | "seo_competitors" | "seo_ai_suggestions" | "seo_content_items"
  | "seo_technical_checks" | "seo_alerts" | "seo_leads" | "seo_ad_campaigns"
  | "seo_email_campaigns" | "seo_social_posts" | "seo_social_comments"
  | "seo_inbox_messages" | "seo_automation_flows" | "seo_reels"
  | "seo_integrations" | "seo_product_entries";

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
  const invalidate = useInvalidate();
  const insertFn = useServerFn(insertRecord);
  const updateFn = useServerFn(updateRecord);
  const deleteFn = useServerFn(deleteRecord);

  const insert = useMutation({
    mutationFn: (input: InsertInput) => insertFn({ data: input }),
    onSuccess: () => {
      toast.success("Created");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: (input: UpdateInput) => updateFn({ data: input }),
    onSuccess: () => {
      toast.success("Saved");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (input: DeleteInput) => deleteFn({ data: input }),
    onSuccess: () => {
      toast.success("Deleted");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { insert, update, remove };
}

export function useRunAutomation() {
  const invalidate = useInvalidate();
  const run = useServerFn(runAutomation);
  return useMutation({
    mutationFn: (id: string) => run({ data: { id } }),
    onSuccess: (result) => {
      toast.success(result.message);
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

function useSeoOperation<T>(serverFn: (options?: { data?: never }) => Promise<T>, success: (result: T) => string) {
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
  return useSeoOperation(run, (result) => `Audit complete · score ${result.score}`);
}

export function useTechnicalChecks() {
  const run = useServerFn(runTechnicalChecks);
  return useSeoOperation(run, (result) => `${result.checked} live technical checks completed`);
}

export function useGenerateReport() {
  const run = useServerFn(generateSeoReport);
  return useSeoOperation(run, () => "SEO report generated from live records");
}

export function useRecrawlUrl() {
  const invalidate = useInvalidate();
  const run = useServerFn(recrawlUrl);
  return useMutation({
    mutationFn: (id: string) => run({ data: { id } }),
    onSuccess: (result) => {
      toast.success(`Live crawl completed · HTTP ${result.httpStatus}`);
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
  const invalidate = useInvalidate();
  const sync = useServerFn(syncSearchConsole);
  return useMutation({
    mutationFn: (input: { siteUrl: string; days: number }) => sync({ data: input }),
    onSuccess: (result) => {
      toast.success(`${result.synced} day(s) synced from Search Console`);
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSemrushSync() {
  const invalidate = useInvalidate();
  const sync = useServerFn(syncSemrush);
  return useMutation({
    mutationFn: (input: { domain: string; database: string }) => sync({ data: input }),
    onSuccess: (result) => {
      toast.success(`${result.imported} keyword(s) imported from Semrush`);
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
