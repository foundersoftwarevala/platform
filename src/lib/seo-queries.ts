import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Tables = Database["public"]["Tables"];
export type SeoTable = keyof Tables & `seo_${string}`;
export type Row<T extends SeoTable> = Tables[T]["Row"];

type ListOptions = {
  order?: { column: string; ascending?: boolean };
  limit?: number;
  filters?: Array<{ column: string; value: string | number | boolean }>;
};

/** Reads go straight through the Data API (public read policies, no PII writes). */
export async function listRows<T extends SeoTable>(
  table: T,
  options: ListOptions = {},
): Promise<Row<T>[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = (supabase as any).from(table).select("*");
  for (const filter of options.filters ?? []) {
    query = query.eq(filter.column, filter.value);
  }
  if (options.order) {
    query = query.order(options.order.column, {
      ascending: options.order.ascending ?? true,
    });
  }
  if (options.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Row<T>[];
}

export function tableQuery<T extends SeoTable>(table: T, options: ListOptions = {}) {
  return queryOptions({
    queryKey: ["seo", table, options],
    queryFn: () => listRows(table, options),
    staleTime: 30_000,
  });
}

export const seoQueries = {
  activity: () =>
    tableQuery("seo_activity_log", { order: { column: "occurred_at", ascending: false }, limit: 200 }),
  pages: () => tableQuery("seo_pages", { order: { column: "url" } }),
  keywords: () =>
    tableQuery("seo_keywords", { order: { column: "search_volume", ascending: false } }),
  rankings: () =>
    tableQuery("seo_keyword_rankings", { order: { column: "recorded_on" }, limit: 5000 }),
  metaRules: () => tableQuery("seo_meta_rules", { order: { column: "priority" } }),
  indexing: () =>
    tableQuery("seo_indexing_records", { order: { column: "url" } }),
  metrics: () =>
    tableQuery("seo_performance_metrics", { order: { column: "recorded_on" } }),
  automations: () => tableQuery("seo_automations", { order: { column: "name" } }),
  automationRuns: () =>
    tableQuery("seo_automation_runs", { order: { column: "started_at", ascending: false }, limit: 60 }),
  issues: () =>
    tableQuery("seo_issues", { order: { column: "detected_at", ascending: false } }),
  reports: () =>
    tableQuery("seo_reports", { order: { column: "period_end", ascending: false } }),
  audits: () =>
    tableQuery("seo_audits", { order: { column: "started_at", ascending: false } }),
  backlinks: () =>
    tableQuery("seo_backlinks", { order: { column: "domain_authority", ascending: false } }),
  competitors: () =>
    tableQuery("seo_competitors", { order: { column: "visibility_score", ascending: false } }),
  gaps: () =>
    tableQuery("seo_competitor_gaps", { order: { column: "search_volume", ascending: false } }),
  suggestions: () =>
    tableQuery("seo_ai_suggestions", { order: { column: "created_at", ascending: false } }),
  content: () =>
    tableQuery("seo_content_items", { order: { column: "created_at", ascending: false } }),
  technicalChecks: () =>
    tableQuery("seo_technical_checks", { order: { column: "category" } }),
  alerts: () =>
    tableQuery("seo_alerts", { order: { column: "created_at", ascending: false } }),
  leads: () =>
    tableQuery("seo_leads", { order: { column: "score", ascending: false } }),
  adCampaigns: () => tableQuery("seo_ad_campaigns", { order: { column: "name" } }),
  emailCampaigns: () => tableQuery("seo_email_campaigns", { order: { column: "name" } }),
  socialPosts: () =>
    tableQuery("seo_social_posts", { order: { column: "scheduled_at", ascending: false } }),
  socialComments: () =>
    tableQuery("seo_social_comments", { order: { column: "created_at", ascending: false } }),
  inbox: () =>
    tableQuery("seo_inbox_messages", { order: { column: "created_at", ascending: false } }),
  flows: () => tableQuery("seo_automation_flows", { order: { column: "name" } }),
  reels: () =>
    tableQuery("seo_reels", { order: { column: "created_at", ascending: false } }),
  integrations: () => tableQuery("seo_integrations", { order: { column: "display_name" } }),
  regions: () =>
    tableQuery("seo_regions", { order: { column: "keywords_count", ascending: false } }),
  behavior: () =>
    tableQuery("seo_page_behavior", { order: { column: "recorded_on" }, limit: 5000 }),
  spam: () =>
    tableQuery("seo_spam_events", { order: { column: "created_at", ascending: false } }),
  products: () => tableQuery("seo_product_entries", { order: { column: "product_name" } }),
  benchmarks: () =>
    tableQuery("seo_benchmark_runs", { order: { column: "created_at", ascending: false }, limit: 200 }),
  errorEvents: () =>
    tableQuery("seo_error_events", { order: { column: "last_seen_at", ascending: false }, limit: 200 }),
};
