import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { absoluteUrl, siteUrl } from "@/lib/seo/site-url";
import {
  isBrokenSeoHttpStatus,
  scanSeoProductUrls,
  SEO_PRODUCT_CRAWL_LIMIT,
  type SeoProductCrawlCheck,
} from "./seo-product-crawl.server";

type SeoCrawlJob = {
  id: string;
  domain: string;
  url: string;
  status: string;
  pages_scanned: number;
  pages_total: number | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type SeoCrawlBrokenLink = {
  id: string;
  domain: string;
  url: string;
  source_url: string | null;
  http_status: number | null;
  status: string;
  first_seen_at: string;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

type SeoCrawlJobInsert = Partial<SeoCrawlJob> & Pick<SeoCrawlJob, "domain" | "url">;
type SeoCrawlBrokenLinkInsert = Partial<SeoCrawlBrokenLink> &
  Pick<SeoCrawlBrokenLink, "domain" | "url">;
type SeoCrawlBrokenLinkUpdate = Partial<SeoCrawlBrokenLink>;

type SeoCrawlTables = Database["public"]["Tables"] & {
  seo_crawl_jobs: {
    Row: SeoCrawlJob;
    Insert: SeoCrawlJobInsert;
    Update: Partial<SeoCrawlJob>;
    Relationships: [];
  };
  seo_broken_links: {
    Row: SeoCrawlBrokenLink;
    Insert: SeoCrawlBrokenLinkInsert;
    Update: Partial<SeoCrawlBrokenLink>;
    Relationships: [];
  };
};

type SeoCrawlDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & { Tables: SeoCrawlTables };
};

const CRAWL_LIMIT = SEO_PRODUCT_CRAWL_LIMIT;
const BROKEN_LINK_READ_BATCH_SIZE = 10;
const seoCrawlResultSchema = z.object({
  id: z.string().uuid(),
  domain: z.string(),
  url: z.string(),
  source_url: z.string().nullable(),
  http_status: z.number().int().nullable(),
  status: z.string(),
  last_checked_at: z.string().nullable(),
});

export type SeoProductBrokenLink = z.infer<typeof seoCrawlResultSchema>;

function crawlDatabase(client: unknown): SupabaseClient<SeoCrawlDatabase> {
  return client as SupabaseClient<SeoCrawlDatabase>;
}

async function seoOperator(action: string) {
  const { requireOperator } = await import("@/lib/auth/require-operator.server");
  return requireOperator(action, { alsoAllow: ["seo", "marketing"] });
}

export const listSeoProductCrawlJobs = createServerFn({ method: "GET" }).handler(
  async (): Promise<SeoCrawlJob[]> => {
    await seoOperator("Reading SEO crawl jobs");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await crawlDatabase(supabaseAdmin)
      .from("seo_crawl_jobs")
      .select(
        "id, domain, url, status, pages_scanned, pages_total, started_at, completed_at, error_message, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(`SEO crawl jobs could not be read: ${error.message}`);
    return data ?? [];
  },
);

export const listSeoProductBrokenLinks = createServerFn({ method: "GET" }).handler(
  async (): Promise<SeoProductBrokenLink[]> => {
    await seoOperator("Reading broken product links");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await crawlDatabase(supabaseAdmin)
      .from("seo_broken_links")
      .select("id, domain, url, source_url, http_status, status, last_checked_at")
      .in("status", ["open", "error"])
      .order("last_checked_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(`Broken SEO links could not be read: ${error.message}`);
    return (data ?? []).map((row) => seoCrawlResultSchema.parse(row));
  },
);

async function checkProductCatalog() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: products, error: productError } = await supabaseAdmin
    .from("marketplace_products")
    .select("id, slug, category_id")
    .eq("visible", true)
    .eq("content_status", "published")
    .is("deleted_at", null)
    .order("id", { ascending: true })
    .limit(CRAWL_LIMIT);
  if (productError)
    throw new Error(`Published product URLs could not be read: ${productError.message}`);

  const categoryIds = [
    ...new Set(
      (products ?? [])
        .map((product) => product.category_id)
        .filter((id): id is string => id !== null),
    ),
  ];
  const categorySlugById = new Map<string, string>();
  if (categoryIds.length) {
    const { data: categories, error: categoryError } = await supabaseAdmin
      .from("marketplace_categories")
      .select("id, slug")
      .in("id", categoryIds)
      .eq("is_hidden", false);
    if (categoryError)
      throw new Error(`Product categories could not be read: ${categoryError.message}`);
    for (const category of categories ?? []) categorySlugById.set(category.id, category.slug);
  }

  const rootSource = absoluteUrl("/marketplace");
  const urls = (products ?? []).map((product) => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(product.slug)) {
      throw new Error(`Published product ${product.id} has an invalid URL slug.`);
    }
    const sourceCategory = product.category_id
      ? categorySlugById.get(product.category_id)
      : undefined;
    const sourcePath = sourceCategory
      ? `/marketplace/category/${encodeURIComponent(sourceCategory)}`
      : "/marketplace";
    return {
      url: absoluteUrl(`/marketplace/product/${encodeURIComponent(product.slug)}`),
      sourceUrl: sourceCategory ? absoluteUrl(sourcePath) : rootSource,
    };
  });
  return { supabaseAdmin, urls };
}

async function updateExistingBrokenLinks(
  db: SupabaseClient<SeoCrawlDatabase>,
  checks: SeoProductCrawlCheck[],
  domain: string,
  checkedAt: string,
): Promise<number> {
  if (!checks.length) return 0;
  const existingByUrl = new Map<string, { id: string; status: string }>();
  for (let offset = 0; offset < checks.length; offset += BROKEN_LINK_READ_BATCH_SIZE) {
    const urlBatch = checks
      .slice(offset, offset + BROKEN_LINK_READ_BATCH_SIZE)
      .map((check) => check.url);
    const { data, error } = await db
      .from("seo_broken_links")
      .select("id, url, status")
      .eq("domain", domain)
      .in("status", ["open", "error", "fixed"])
      .in("url", urlBatch)
      .order("last_checked_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(`Existing broken links could not be read: ${error.message}`);
    for (const row of data ?? []) {
      if (!existingByUrl.has(row.url)) existingByUrl.set(row.url, row);
    }
  }

  const inserts: SeoCrawlBrokenLinkInsert[] = [];
  const updates: Array<{ id: string; values: SeoCrawlBrokenLinkUpdate }> = [];
  let findings = 0;
  for (const check of checks) {
    const broken =
      check.error !== null ||
      (check.httpStatus !== null && isBrokenSeoHttpStatus(check.httpStatus));
    if (broken) findings += 1;
    const old = existingByUrl.get(check.url);
    const status = check.error ? "error" : broken ? "open" : "fixed";
    const values = {
      domain,
      url: check.url,
      source_url: check.sourceUrl,
      http_status: check.httpStatus,
      status,
      last_checked_at: checkedAt,
      updated_at: checkedAt,
    };
    if (old) {
      if (old.status !== status || broken) updates.push({ id: old.id, values });
    } else if (broken) {
      inserts.push({
        ...values,
        first_seen_at: checkedAt,
        created_at: checkedAt,
      });
    }
  }

  for (let offset = 0; offset < updates.length; offset += 10) {
    const batch = updates.slice(offset, offset + 10);
    const writes = await Promise.all(
      batch.map(({ id, values }) => db.from("seo_broken_links").update(values).eq("id", id)),
    );
    const failedWrite = writes.find((result) => result.error);
    if (failedWrite?.error) {
      throw new Error(`Broken link status could not be updated: ${failedWrite.error.message}`);
    }
  }
  if (inserts.length) {
    const { error } = await db.from("seo_broken_links").insert(inserts);
    if (error) throw new Error(`Broken links could not be saved: ${error.message}`);
  }
  return findings;
}

export const runSiteCrawl = createServerFn({ method: "POST" }).handler(async () => {
  await seoOperator("Scanning published Marketplace product URLs");
  const site = new URL(siteUrl());
  if (site.protocol !== "https:") {
    throw new Error("Technical SEO crawling requires the canonical site URL to use HTTPS.");
  }
  const { supabaseAdmin, urls } = await checkProductCatalog();
  const db = crawlDatabase(supabaseAdmin);
  const startedAt = new Date().toISOString();
  const domain = site.host;
  const startUrl = absoluteUrl("/marketplace");
  const activeJobResult = await db
    .from("seo_crawl_jobs")
    .select("id, started_at")
    .eq("domain", domain)
    .eq("status", "running")
    .maybeSingle();
  if (activeJobResult.error) {
    throw new Error(`Active SEO crawl jobs could not be checked: ${activeJobResult.error.message}`);
  }
  if (activeJobResult.data) {
    const started = activeJobResult.data.started_at
      ? new Date(activeJobResult.data.started_at).getTime()
      : 0;
    const stale = !Number.isFinite(started) || Date.now() - started > 15 * 60_000;
    if (!stale) throw new Error("A Technical SEO crawl is already running.");
    const staleAt = new Date().toISOString();
    const { error } = await db
      .from("seo_crawl_jobs")
      .update({
        status: "failed",
        completed_at: staleAt,
        updated_at: staleAt,
        error_message: "Crawl lease expired before the job completed.",
      })
      .eq("id", activeJobResult.data.id)
      .eq("status", "running");
    if (error) throw new Error(`The expired SEO crawl could not be released: ${error.message}`);
  }
  const { data: job, error: jobError } = await db
    .from("seo_crawl_jobs")
    .insert({
      domain,
      url: startUrl,
      status: "running",
      pages_scanned: 0,
      pages_total: urls.length,
      started_at: startedAt,
      updated_at: startedAt,
    })
    .select("id")
    .single();
  if (jobError) {
    if (jobError.code === "23505") throw new Error("A Technical SEO crawl is already running.");
    throw new Error(`SEO crawl job could not be created: ${jobError.message}`);
  }

  try {
    const checks = await scanSeoProductUrls(urls, site.origin);
    const checkedAt = new Date().toISOString();
    const findings = await updateExistingBrokenLinks(db, checks, domain, checkedAt);
    const { error: updateError } = await db
      .from("seo_crawl_jobs")
      .update({
        status: "completed",
        pages_scanned: checks.length,
        completed_at: checkedAt,
        updated_at: checkedAt,
        error_message: null,
      })
      .eq("id", job.id);
    if (updateError)
      throw new Error(`SEO crawl job could not be completed: ${updateError.message}`);

    return {
      jobId: job.id,
      scanned: checks.length,
      brokenLinks: findings,
      failedRequests: checks.filter((check) => check.error !== null).length,
      message: `Scanned ${checks.length} published product URL(s); found ${findings} broken or unreachable link(s).`,
    };
  } catch (cause) {
    const errorMessage = cause instanceof Error ? cause.message : "The SEO crawl failed.";
    const failedAt = new Date().toISOString();
    const { error: updateError } = await db
      .from("seo_crawl_jobs")
      .update({
        status: "failed",
        completed_at: failedAt,
        updated_at: failedAt,
        error_message: errorMessage.slice(0, 1000),
      })
      .eq("id", job.id);
    if (updateError) {
      throw new Error(
        `${errorMessage} The crawl job could not be marked failed: ${updateError.message}`,
      );
    }
    throw cause;
  }
});
