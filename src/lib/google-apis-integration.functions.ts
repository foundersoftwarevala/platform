/**
 * Google Search & Insights APIs Integration
 * Real integration with Google Search Console, PageSpeed Insights, CrUX, URL Inspection
 */

import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

// ============================================================================
// ADMIN CLIENT
// ============================================================================

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getGoogleApiKey() {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("Google API Key not configured");
  return key;
}

// ============================================================================
// GOOGLE SEARCH CONSOLE INTEGRATION
// ============================================================================

export const syncSearchConsoleData = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as {
    site_url: string;
    start_date?: string;
    end_date?: string;
    dimensions?: string[];
  })
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    
    try {
      // Note: In production, use OAuth2 for Search Console
      // This example shows the structure for real GSC API integration
      // GSC API requires OAuth2 bearer token from authenticated user
      
      const gscApiUrl = "https://www.googleapis.com/webmasters/v3/sites";
      
      // Fetch query stats (requires OAuth2)
      const queryStats = await fetch(
        `${gscApiUrl}/${encodeURIComponent(data.site_url)}/searchAnalytics/query`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // OAuth2 token would be here in production
            // Authorization: `Bearer ${oauthToken}`,
          },
          body: JSON.stringify({
            startDate: data.start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            endDate: data.end_date || new Date().toISOString().split('T')[0],
            dimensions: data.dimensions || ["date", "page", "query", "device"],
            rowLimit: 25000,
          }),
        }
      );

      if (!queryStats.ok) {
        throw new Error(`GSC API error: ${queryStats.statusText}`);
      }

      const queryData = await queryStats.json();

      // Store search analytics in database
      if (queryData.rows) {
        for (const row of queryData.rows) {
          await admin.from("search_console_data").insert({
            site_url: data.site_url,
            page: row.keys?.[1] || "",
            query: row.keys?.[2] || "",
            device: row.keys?.[3] || "desktop",
            date: row.keys?.[0] || new Date().toISOString().split('T')[0],
            impressions: row.impressions || 0,
            clicks: row.clicks || 0,
            ctr: row.ctr || 0,
            avg_position: row.position || 0,
            created_at: new Date().toISOString(),
          });
        }
      }

      // Fetch sitemap stats
      const sitemapStatsUrl = `${gscApiUrl}/${encodeURIComponent(data.site_url)}/sitemaps`;
      
      return {
        success: true,
        rows_synced: queryData.rows?.length || 0,
        message: "Search Console data synced successfully"
      };
    } catch (error) {
      console.error("Search Console sync error:", error);
      throw error;
    }
  });

// ============================================================================
// GOOGLE PAGESPEED INSIGHTS API
// ============================================================================

export const runPageSpeedInsights = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as {
    url: string;
    strategy?: "desktop" | "mobile";
  })
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    const apiKey = await getGoogleApiKey();

    try {
      const strategy = data.strategy || "mobile";
      
      const response = await fetch(
        `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(data.url)}&strategy=${strategy}&key=${apiKey}`,
        { method: "GET" }
      );

      if (!response.ok) {
        throw new Error(`PageSpeed API error: ${response.statusText}`);
      }

      const result = await response.json();

      // Extract scores
      const lighthouseResult = result.lighthouseResult;
      const metrics = lighthouseResult.audits;
      
      // Store in database
      await admin.from("pagespeed_insights").insert({
        url: data.url,
        strategy: strategy,
        performance_score: lighthouseResult.categories.performance.score * 100,
        accessibility_score: lighthouseResult.categories.accessibility.score * 100,
        best_practices_score: lighthouseResult.categories["best-practices"].score * 100,
        seo_score: lighthouseResult.categories.seo.score * 100,
        pwa_score: lighthouseResult.categories.pwa?.score * 100 || null,
        first_contentful_paint: metrics["first-contentful-paint"]?.numericValue,
        largest_contentful_paint: metrics["largest-contentful-paint"]?.numericValue,
        cumulative_layout_shift: metrics["cumulative-layout-shift"]?.numericValue,
        total_blocking_time: metrics["total-blocking-time"]?.numericValue,
        speed_index: metrics["speed-index"]?.numericValue,
        opportunities: JSON.stringify(result.lighthouseResult.opportunities || {}),
        diagnostics: JSON.stringify(result.lighthouseResult.diagnostics || {}),
        created_at: new Date().toISOString(),
      });

      // Also store Core Web Vitals
      const cwvData = result.loadingExperience?.metrics;
      if (cwvData) {
        await admin.from("core_web_vitals").insert({
          url: data.url,
          form_factor: strategy === "mobile" ? "mobile" : "desktop",
          lcp_percentile_75: cwvData["LARGEST_CONTENTFUL_PAINT_ms"]?.percentile,
          inp_percentile_75: cwvData["INTERACTION_TO_NEXT_PAINT_ms"]?.percentile,
          cls_percentile_75: cwvData["CUMULATIVE_LAYOUT_SHIFT_SCORE"]?.percentile,
          ttfb_percentile_75: cwvData["FIRST_INPUT_DELAY_ms"]?.percentile,
          created_at: new Date().toISOString(),
        });
      }

      return {
        success: true,
        url: data.url,
        strategy: strategy,
        scores: {
          performance: lighthouseResult.categories.performance.score * 100,
          accessibility: lighthouseResult.categories.accessibility.score * 100,
          best_practices: lighthouseResult.categories["best-practices"].score * 100,
          seo: lighthouseResult.categories.seo.score * 100,
        },
      };
    } catch (error) {
      console.error("PageSpeed Insights error:", error);
      throw error;
    }
  });

// ============================================================================
// GOOGLE CHROME UX REPORT (CrUX)
// ============================================================================

export const getCruxMetrics = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as {
    url: string;
    form_factor?: "desktop" | "mobile" | "all";
  })
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    const apiKey = await getGoogleApiKey();

    try {
      const formFactors = data.form_factor === "all" 
        ? ["desktop", "mobile", "tablet"]
        : [data.form_factor || "mobile"];

      const results = [];

      for (const formFactor of formFactors) {
        const response = await fetch(
          "https://www.googleapis.com/chromeuxreport/v1/records:queryRecord",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": apiKey,
            },
            body: JSON.stringify({
              url: data.url,
              formFactor: formFactor.toUpperCase(),
            }),
          }
        );

        if (!response.ok) {
          console.warn(`CrUX API warning: ${response.statusText} for ${formFactor}`);
          continue;
        }

        const result = await response.json();

        if (result.record) {
          const metrics = result.record.metrics;
          
          // Store CrUX data
          await admin.from("core_web_vitals").insert({
            url: data.url,
            form_factor: formFactor,
            lcp_percentile_75: metrics.largest_contentful_paint?.percentiles?.[2],
            inp_percentile_75: metrics.interaction_to_next_paint?.percentiles?.[2],
            cls_percentile_75: metrics.cumulative_layout_shift?.percentiles?.[2],
            ttfb_percentile_75: metrics.first_input_delay?.percentiles?.[2],
            created_at: new Date().toISOString(),
          });

          results.push({
            form_factor: formFactor,
            lcp: metrics.largest_contentful_paint?.percentiles?.[2],
            inp: metrics.interaction_to_next_paint?.percentiles?.[2],
            cls: metrics.cumulative_layout_shift?.percentiles?.[2],
          });
        }
      }

      return { success: true, metrics: results };
    } catch (error) {
      console.error("CrUX error:", error);
      throw error;
    }
  });

// ============================================================================
// GOOGLE URL INSPECTION API
// ============================================================================

export const inspectUrl = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as {
    url: string;
    site_url: string;
  })
  .handler(async ({ data }) => {
    // Note: URL Inspection API requires OAuth2
    // This is the structure for real integration
    
    try {
      const response = await fetch(
        "https://searchconsole.googleapis.com/v1/urlInspection/index:query",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // OAuth2 token would be here
            // Authorization: `Bearer ${oauthToken}`,
          },
          body: JSON.stringify({
            inspectionUrl: data.url,
            siteUrl: data.site_url,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`URL Inspection API error: ${response.statusText}`);
      }

      const result = await response.json();

      return {
        success: true,
        url: data.url,
        indexing_state: result.inspectionResult?.indexStatusResult?.indexState,
        last_crawl_time: result.inspectionResult?.indexStatusResult?.lastCrawlTime,
        canonical_url: result.inspectionResult?.indexStatusResult?.canonicalUrl,
        referring_urls: result.inspectionResult?.indexStatusResult?.referringUrls,
        mobile_usability_issues: result.inspectionResult?.mobileUsabilityResult?.issues,
        rich_results_issues: result.inspectionResult?.richResultsResult?.detectedItems,
      };
    } catch (error) {
      console.error("URL Inspection error:", error);
      throw error;
    }
  });

// ============================================================================
// BATCH URL INSPECTION
// ============================================================================

export const batchInspectUrls = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as {
    site_url: string;
    urls: string[];
  })
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    const results = [];

    for (const url of data.urls) {
      try {
        const inspection = await inspectUrl({ data: { url, site_url: data.site_url } });
        results.push(inspection);
      } catch (error) {
        results.push({ url, error: String(error), success: false });
      }
    }

    return { success: true, inspections: results };
  });

// ============================================================================
// SEARCH CONSOLE SITEMAP MANAGEMENT
// ============================================================================

export const submitSitemapToGSC = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as {
    site_url: string;
    sitemap_url: string;
  })
  .handler(async ({ data }) => {
    // Requires OAuth2
    const response = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(data.site_url)}/sitemaps/${encodeURIComponent(data.sitemap_url)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          // OAuth2 token would be here
          // Authorization: `Bearer ${oauthToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`GSC Sitemap API error: ${response.statusText}`);
    }

    return { success: true, sitemap_url: data.sitemap_url };
  });
