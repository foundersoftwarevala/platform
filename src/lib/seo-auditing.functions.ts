/**
 * SEO Auditing & Validation System
 * Comprehensive checks for HTTP/HTTPS, redirects, canonicals, robots.txt, sitemaps, schema, etc.
 */

import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

/**
 * Every server function in this file is a public RPC endpoint and works with
 * the service role, which reads and writes past every policy. None had a check
 * of its own, so anyone - signed in or not - could call them. The SEO
 * console's people are the operators plus the seo and marketing staff the
 * route gate admits, as in seo.functions.ts.
 */
async function seoGuard(action: string) {
  const { requireOperator } = await import("@/lib/auth/require-operator.server");
  return requireOperator(action, { alsoAllow: ["seo", "marketing"] });
}

/**
 * Every address below comes from the request body and was fetched with plain
 * fetch() from inside the server's network - localhost, the database, internal
 * services, the cloud metadata endpoint, and any redirect to them. All of it
 * now goes through the checked fetcher (lib/seo/public-fetch.server.ts).
 */
async function auditFetch(url: string) {
  const { publicFetch } = await import("@/lib/seo/public-fetch.server");
  return publicFetch(url, { maxBytes: 2_000_000, timeoutMs: 15_000 });
}

async function assertAuditUrl(url: unknown): Promise<string> {
  const { assertFetchableUrl } = await import("@/lib/seo/public-fetch.server");
  return (await assertFetchableUrl(String(url ?? ""))).toString();
}

// ============================================================================
// TYPES
// ============================================================================

export type SeoAuditResult = {
  url: string;
  timestamp: string;
  checks: {
    https_available: boolean;
    http_redirects_to_https: boolean;
    canonical_tag: boolean | string;
    robots_txt_accessible: boolean;
    sitemap_accessible: boolean;
    status_code: number;
    redirect_chain_length: number;
    max_redirects_exceeded: boolean;
    content_length: number;
    response_headers: Record<string, string>;
    mobile_usable: boolean;
    broken_links_count: number;
    internal_links_count: number;
    duplicate_meta_titles: boolean;
    duplicate_meta_descriptions: boolean;
    og_tags_present: boolean;
    twitter_card_present: boolean;
    schema_org_valid: boolean;
    schema_types: string[];
    hreflang_present: boolean;
    hreflang_valid: boolean;
    structured_data_errors: string[];
  };
  issues: string[];
  score: number;
};

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

// ============================================================================
// COMPREHENSIVE SEO AUDIT
// ============================================================================

export const performSeoAudit = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { url: string })
  .handler(async ({ data }) => {
    await seoGuard("performSeoAudit");
    await assertAuditUrl(data.url);
    const admin = getSupabaseAdmin();
    const result: SeoAuditResult = {
      url: data.url,
      timestamp: new Date().toISOString(),
      checks: {
        https_available: false,
        http_redirects_to_https: false,
        canonical_tag: false,
        robots_txt_accessible: false,
        sitemap_accessible: false,
        status_code: 0,
        redirect_chain_length: 0,
        max_redirects_exceeded: false,
        content_length: 0,
        response_headers: {},
        mobile_usable: false,
        broken_links_count: 0,
        internal_links_count: 0,
        duplicate_meta_titles: false,
        duplicate_meta_descriptions: false,
        og_tags_present: false,
        twitter_card_present: false,
        schema_org_valid: false,
        schema_types: [],
        hreflang_present: false,
        hreflang_valid: false,
        structured_data_errors: [],
      },
      issues: [],
      score: 0,
    };

    try {
      // 1. Check HTTPS availability
      const httpsResponse = await auditFetch(data.url);
      if (httpsResponse.error) {
        result.issues.push("HTTPS connection failed");
      } else {
        result.checks.https_available = httpsResponse.status > 0 && httpsResponse.status < 400;
        result.checks.status_code = httpsResponse.status;
        result.checks.redirect_chain_length = httpsResponse.redirects.length;
        result.checks.content_length = Buffer.byteLength(httpsResponse.body);
        result.checks.response_headers = httpsResponse.contentType
          ? { "content-type": httpsResponse.contentType }
          : {};
      }

      // 2. Check HTTP to HTTPS redirect
      try {
        const httpUrl = data.url.replace("https://", "http://");
        const httpResponse = await auditFetch(httpUrl);
        if (httpResponse.error) throw new Error(httpResponse.error);
        // The first hop followed is where the plain-http address redirected.
        result.checks.http_redirects_to_https =
          httpResponse.redirects[0]?.startsWith("https://") ?? false;
      } catch (e) {
        result.issues.push("HTTP check failed");
      }

      // 3. Fetch full page content for meta checks
      let htmlContent = "";
      if (httpsResponse.ok) {
        htmlContent = httpsResponse.body;
      } else {
        result.issues.push("Could not fetch page content");
      }

      // 4. Extract and validate canonical tags
      const canonicalMatch = htmlContent.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i);
      result.checks.canonical_tag = canonicalMatch ? canonicalMatch[1] : false;

      // 5. Check robots.txt
      try {
        const robotsUrl = new URL(data.url).origin + "/robots.txt";
        const robotsResponse = await auditFetch(robotsUrl);
        result.checks.robots_txt_accessible = robotsResponse.ok;
        if (!robotsResponse.ok) {
          result.issues.push("robots.txt not found or not accessible");
        }
      } catch (e) {
        result.issues.push("robots.txt check failed");
      }

      // 6. Check sitemap.xml
      try {
        const sitemapUrl = new URL(data.url).origin + "/sitemap.xml";
        const sitemapResponse = await auditFetch(sitemapUrl);
        result.checks.sitemap_accessible = sitemapResponse.ok;
        if (!sitemapResponse.ok) {
          result.issues.push("sitemap.xml not found or not accessible");
        }
      } catch (e) {
        result.issues.push("sitemap.xml check failed");
      }

      // 7. Check for Open Graph tags
      result.checks.og_tags_present = /og:title|og:description|og:image/.test(htmlContent);

      // 8. Check for Twitter Card tags
      result.checks.twitter_card_present = /twitter:card|twitter:title/.test(htmlContent);

      // 9. Validate schema.org structured data
      const jsonLdMatches = htmlContent.match(
        /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
      );

      if (jsonLdMatches) {
        result.checks.schema_org_valid = true;
        for (const match of jsonLdMatches) {
          try {
            const jsonMatch = match.match(/>([\s\S]*?)<\/script>/);
            if (jsonMatch) {
              const schema = JSON.parse(jsonMatch[1]);
              result.checks.schema_types.push(schema["@type"] || "Unknown");
            }
          } catch (e) {
            result.checks.structured_data_errors.push(String(e));
          }
        }
      }

      // 10. Check hreflang tags
      const hrefLangMatches = htmlContent.match(
        /<link[^>]*rel="alternate"[^>]*hreflang="([^"]+)"[^>]*>/gi,
      );

      if (hrefLangMatches && hrefLangMatches.length > 0) {
        result.checks.hreflang_present = true;
        // Basic validation
        result.checks.hreflang_valid = hrefLangMatches.every((tag) =>
          /hreflang="[a-z]{2}(-[A-Z]{2})?"/.test(tag),
        );
      }

      // 11. Check for meta descriptions and titles (for duplicates)
      const titles = htmlContent.match(/<title>([^<]+)<\/title>/gi) || [];
      const descriptions =
        htmlContent.match(/<meta\s+name="description"\s+content="([^"]+)"/gi) || [];

      result.checks.duplicate_meta_titles = titles.length > 1;
      result.checks.duplicate_meta_descriptions = descriptions.length > 1;

      // 12. Parse links for internal/broken link analysis
      const linkMatches = htmlContent.match(/<a[^>]*href="([^"]+)"[^>]*>/gi) || [];
      const internalLinks = new Set<string>();
      const brokenLinks = new Set<string>();

      for (const linkMatch of linkMatches) {
        const href = linkMatch.match(/href="([^"]+)"/)?.[1];
        if (href && !href.startsWith("http")) {
          internalLinks.add(href);
        }
      }

      result.checks.internal_links_count = internalLinks.size;

      // Calculate audit score
      const checksArray = Object.entries(result.checks).filter(
        ([key, value]) => typeof value === "boolean",
      );
      const passedChecks = checksArray.filter(([, value]) => value === true).length;
      result.score = Math.round((passedChecks / checksArray.length) * 100);

      // Store audit in database
      await admin
        .from("seo_audits")
        .insert({
          url: data.url,
          audit_data: JSON.stringify(result.checks),
          issues: JSON.stringify(result.issues),
          score: result.score,
          created_at: new Date().toISOString(),
        })
        .catch(() => {
          // Table may not exist yet
          console.warn("Could not store audit result (table may not exist)");
        });

      return result;
    } catch (error) {
      console.error("SEO audit error:", error);
      throw error;
    }
  });

// ============================================================================
// CRAWL WEBSITE LINKS
// ============================================================================

export const crawlWebsite = createServerFn({ method: "POST" })
  .inputValidator(
    (d: unknown) =>
      d as {
        url: string;
        max_depth?: number;
        max_pages?: number;
      },
  )
  .handler(async ({ data }) => {
    await seoGuard("crawlWebsite");
    const crawled = new Set<string>();
    const baseUrl = new URL(await assertAuditUrl(data.url)).origin;
    // Bounded whatever the caller asks for: each page is a request this server makes.
    const maxDepth = Math.min(Math.max(Number(data.max_depth) || 3, 0), 3);
    const maxPages = Math.min(Math.max(Number(data.max_pages) || 100, 1), 100);
    const results: Array<{
      url: string;
      status: number;
      title?: string;
      h1?: string;
    }> = [];

    async function crawlPage(url: string, depth: number): Promise<void> {
      if (depth > maxDepth || crawled.size >= maxPages || crawled.has(url)) {
        return;
      }

      crawled.add(url);

      try {
        const response = await auditFetch(url);
        if (response.error) throw new Error(response.error);
        const html = response.body;

        const titleMatch = html.match(/<title>([^<]+)<\/title>/);
        const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);

        results.push({
          url,
          status: response.status,
          title: titleMatch?.[1],
          h1: h1Match?.[1],
        });

        // Extract and crawl internal links
        const linkMatches = html.match(/<a[^>]*href="([^"]+)"[^>]*>/gi) || [];

        for (const linkMatch of linkMatches) {
          const href = linkMatch.match(/href="([^"]+)"/)?.[1];

          if (href && !href.startsWith("#")) {
            try {
              const linkUrl = new URL(href, url).toString();
              if (linkUrl.startsWith(baseUrl) && !crawled.has(linkUrl)) {
                await crawlPage(linkUrl, depth + 1);
              }
            } catch (e) {
              // Invalid URL
            }
          }
        }
      } catch (error) {
        results.push({
          url,
          status: 0,
          title: undefined,
        });
      }
    }

    await crawlPage(data.url, 0);

    return {
      success: true,
      total_pages: results.length,
      crawled_urls: results,
    };
  });

// ============================================================================
// MOBILE USABILITY CHECK
// ============================================================================

export const checkMobileUsability = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { url: string })
  .handler(async ({ data }) => {
    await seoGuard("checkMobileUsability");
    try {
      const response = await auditFetch(data.url);
      if (response.error) throw new Error(response.error);
      const html = response.body;

      const checks = {
        has_viewport_meta: /<meta[^>]*viewport/.test(html),
        has_charset_meta: /<meta[^>]*charset/.test(html),
        font_size_ok: !/<font-size[^>]*[0-9]{1,2}px/i.test(html),
        touch_friendly: /<meta[^>]*user-scalable=yes|minimum-scale/.test(html),
      };

      const passed = Object.values(checks).filter(Boolean).length;
      const score = Math.round((passed / Object.keys(checks).length) * 100);

      return { success: true, checks, score };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

// ============================================================================
// KEYWORD EXTRACTION
// ============================================================================

export const extractPageKeywords = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { url: string })
  .handler(async ({ data }) => {
    await seoGuard("extractPageKeywords");
    try {
      const response = await auditFetch(data.url);
      if (response.error) throw new Error(response.error);
      const html = response.body;

      // Extract keywords from meta tag
      const keywordsMatch = html.match(/<meta[^>]*name="keywords"[^>]*content="([^"]+)"/i);
      const keywords = keywordsMatch ? keywordsMatch[1].split(",").map((k) => k.trim()) : [];

      // Extract title
      const titleMatch = html.match(/<title>([^<]+)<\/title>/);
      const title = titleMatch ? titleMatch[1] : "";

      // Extract description
      const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
      const description = descMatch ? descMatch[1] : "";

      // Extract H1s
      const h1Matches = html.match(/<h1[^>]*>([^<]+)<\/h1>/gi) || [];
      const h1s = h1Matches.map((h) => h.replace(/<[^>]*>/g, ""));

      return {
        success: true,
        keywords,
        title,
        description,
        h1s,
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

// ============================================================================
// DUPLICATE CONTENT CHECK
// ============================================================================

export const checkDuplicateContent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { urls: string[] })
  .handler(async ({ data }) => {
    await seoGuard("checkDuplicateContent");
    const contentHashes = new Map<string, string[]>();

    const urls = Array.isArray(data.urls) ? data.urls.slice(0, 50) : [];
    for (const url of urls) {
      try {
        const response = await auditFetch(String(url));
        if (response.error) throw new Error(response.error);
        const html = response.body;

        // Simple hash of main content (remove tags)
        const content = html.replace(/<[^>]*>/g, " ").trim();
        const hash = content.substring(0, 100); // Simple comparison

        if (!contentHashes.has(hash)) {
          contentHashes.set(hash, []);
        }
        contentHashes.get(hash)!.push(url);
      } catch (error) {
        console.error("Error checking:", url, error);
      }
    }

    const duplicates = Array.from(contentHashes.entries())
      .filter(([, urls]) => urls.length > 1)
      .map(([, urls]) => urls);

    return {
      success: true,
      duplicate_groups: duplicates,
      duplicate_urls: duplicates.flat(),
    };
  });
