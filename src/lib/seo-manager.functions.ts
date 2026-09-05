import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type SeoOverview = {
  source: "supabase" | "empty";
  seo_score: number | null;
  indexed_pages: number;
  non_indexed_pages: number;
  crawled_pages: number;
  broken_pages: number;
  pending_pages: number;
  missing_meta: number;
  missing_schema: number;
  missing_h1: number;
  missing_description: number;
  duplicate_titles: number;
  duplicate_meta: number;
  missing_alt: number;
  broken_images: number;
  broken_links: number;
  redirect_issues: number;
  canonical_issues: number;
  clicks: number;
  impressions: number;
  ctr: number | null;
  average_position: number | null;
  top_keywords: number;
  updated_at: string;
};

const emptyOverview = (): SeoOverview => ({
  source: "empty",
  seo_score: null,
  indexed_pages: 0,
  non_indexed_pages: 0,
  crawled_pages: 0,
  broken_pages: 0,
  pending_pages: 0,
  missing_meta: 0,
  missing_schema: 0,
  missing_h1: 0,
  missing_description: 0,
  duplicate_titles: 0,
  duplicate_meta: 0,
  missing_alt: 0,
  broken_images: 0,
  broken_links: 0,
  redirect_issues: 0,
  canonical_issues: 0,
  clicks: 0,
  impressions: 0,
  ctr: null,
  average_position: null,
  top_keywords: 0,
  updated_at: new Date().toISOString(),
});

function countMissing(rows: Array<Record<string, unknown>>, field: string) {
  return rows.filter((row) => !String(row[field] ?? "").trim()).length;
}

export const getSitemapXml = createServerFn({ method: "GET" }).handler(async (): Promise<string> => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const pagesResult = await supabaseAdmin
      .from("seo_pages")
      .select("id,url,index_status,canonical_url,updated_at")
      .eq("index_status", "indexed")
      .limit(5000);

    const pages = (pagesResult.data ?? []) as Array<Record<string, unknown>>;
    const urls = pages
      .filter((row) => String(row.url ?? "").trim())
      .map((row) => {
        const loc = String(row.canonical_url ?? row.url ?? "");
        const lastmod = String(row.updated_at ?? new Date().toISOString());
        return `<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`;
      })
      .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
  } catch {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`;
  }
});

export const getRobotsTxt = createServerFn({ method: "GET" }).handler(async (): Promise<string> => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const pagesResult = await supabaseAdmin.from("seo_pages").select("id,url,index_status").limit(1);
    const sitemapBase = "https://softwarevala.com/sitemap.xml";
    const ready = !pagesResult.error;
    const lines = [
      "User-agent: *",
      "Allow: /",
      `Sitemap: ${sitemapBase}`,
      ready ? "Host: https://softwarevala.com" : "Host: https://softwarevala.com",
    ];
    return lines.join("\n");
  } catch {
    return [
      "User-agent: *",
      "Allow: /",
      "Sitemap: https://softwarevala.com/sitemap.xml",
      "Host: https://softwarevala.com",
    ].join("\n");
  }
});

export const getSeoSchemaPages = createServerFn({ method: "GET" }).handler(async (): Promise<Array<{ url: string; schema: string | null }>> => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("seo_pages")
      .select("url,schema_json")
      .not("schema_json", "is", null)
      .limit(2000);

    if (error) return [];
    return (data ?? []).map((row: any) => ({ url: row.url, schema: row.schema_json ?? null }));
  } catch {
    return [];
  }
});

export const getSeoOverview = createServerFn({ method: "GET" }).handler(async (): Promise<SeoOverview> => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [pagesResult, performanceResult, keywordsResult] = await Promise.all([
      supabaseAdmin.from("seo_pages").select("id,index_status,seo_score,meta_title,meta_description,h1,canonical_url,schema_json,broken_links_count,images_missing_alt").limit(10000),
      supabaseAdmin.from("seo_performance_metrics").select("clicks,impressions,ctr,average_position").order("recorded_on", { ascending: false }).limit(1),
      supabaseAdmin.from("seo_keywords").select("id,position,previous_position,status").limit(10000),
    ]);

    if (pagesResult.error && keywordsResult.error && performanceResult.error) return emptyOverview();

    const pages = (pagesResult.data ?? []) as Array<Record<string, unknown>>;
    const keywords = (keywordsResult.data ?? []) as Array<Record<string, unknown>>;
    const performance = (performanceResult.data?.[0] ?? {}) as Record<string, unknown>;
    const indexed = pages.filter((row) => String(row.index_status ?? "").toLowerCase() === "indexed").length;
    const nonIndexed = pages.filter((row) => String(row.index_status ?? "").toLowerCase() !== "indexed").length;
    const brokenPages = pages.filter((row) => Number(row.broken_links_count ?? 0) > 0).length;
    const scores = pages.map((row) => Number(row.seo_score)).filter(Number.isFinite);
    const clicks = Number(performance.clicks ?? 0);
    const impressions = Number(performance.impressions ?? 0);
    const ctr = Number.isFinite(Number(performance.ctr)) ? Number(performance.ctr) : impressions > 0 ? clicks / impressions : null;

    return {
      ...emptyOverview(),
      source: "supabase",
      seo_score: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null,
      indexed_pages: indexed,
      non_indexed_pages: nonIndexed,
      crawled_pages: pages.length,
      broken_pages: brokenPages,
      missing_meta: pages.filter((row) => !String(row.meta_title ?? "").trim() || !String(row.meta_description ?? "").trim()).length,
      missing_schema: countMissing(pages, "schema_json"),
      missing_h1: countMissing(pages, "h1"),
      missing_description: countMissing(pages, "meta_description"),
      missing_alt: pages.reduce((sum, row) => sum + Number(row.images_missing_alt ?? 0), 0),
      broken_links: pages.reduce((sum, row) => sum + Number(row.broken_links_count ?? 0), 0),
      clicks,
      impressions,
      ctr,
      average_position: Number.isFinite(Number(performance.average_position)) ? Number(performance.average_position) : null,
      top_keywords: keywords.length,
      updated_at: new Date().toISOString(),
    };
  } catch {
    return emptyOverview();
  }
});

export const saveSeoPage = createServerFn({ method: "POST" })
  .inputValidator((value) => z.object({
    id: z.string().uuid().optional(),
    url: z.string().min(1),
    meta_title: z.string().max(255).nullable().optional(),
    meta_description: z.string().max(1000).nullable().optional(),
    h1: z.string().max(255).nullable().optional(),
    canonical_url: z.string().url().nullable().optional(),
    schema_json: z.string().nullable().optional(),
  }).parse(value ?? {}))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("seo_pages").upsert(data as never, { onConflict: "url" }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });
