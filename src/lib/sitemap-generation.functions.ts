/**
 * Sitemap & Robots.txt Generation
 * Generate and manage XML sitemaps, robots.txt, and metadata caching
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

// ============================================================================
// SITEMAP GENERATION
// ============================================================================

export const generateSitemap = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as {
    domain: string;
    urls: Array<{
      loc: string;
      lastmod?: string;
      changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
      priority?: number;
      images?: string[];
    }>;
    include_images?: boolean;
  })
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    
    try {
      // Generate XML sitemap
      let sitemapXml =
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"';

      if (data.include_images) {
        sitemapXml += ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"';
      }

      sitemapXml += ">\n";

      for (const url of data.urls) {
        sitemapXml += "  <url>\n";
        sitemapXml += `    <loc>${escapeXml(url.loc)}</loc>\n`;

        if (url.lastmod) {
          sitemapXml += `    <lastmod>${url.lastmod}</lastmod>\n`;
        }

        if (url.changefreq) {
          sitemapXml += `    <changefreq>${url.changefreq}</changefreq>\n`;
        }

        if (url.priority) {
          sitemapXml += `    <priority>${url.priority}</priority>\n`;
        }

        if (data.include_images && url.images && url.images.length > 0) {
          for (const image of url.images) {
            sitemapXml += "    <image:image>\n";
            sitemapXml += `      <image:loc>${escapeXml(image)}</image:loc>\n`;
            sitemapXml += "    </image:image>\n";
          }
        }

        sitemapXml += "  </url>\n";
      }

      sitemapXml += "</urlset>";

      // Store sitemap
      await admin.from("sitemaps").insert({
        domain: data.domain,
        sitemap_type: "regular",
        url_count: data.urls.length,
        sitemap_content: sitemapXml,
        is_active: true,
        created_at: new Date().toISOString(),
      });

      return {
        success: true,
        domain: data.domain,
        url_count: data.urls.length,
        sitemap_content: sitemapXml,
      };
    } catch (error) {
      console.error("Sitemap generation error:", error);
      throw error;
    }
  });

// ============================================================================
// ROBOTS.TXT GENERATION
// ============================================================================

export const generateRobotsTxt = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as {
    domain: string;
    sitemap_urls?: string[];
    disallowed_paths?: string[];
    user_agents?: Array<{ agent: string; disallow: string[] }>;
    crawl_delay?: number;
  })
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    
    try {
      let robotsTxt = "# robots.txt for " + data.domain + "\n";
      robotsTxt += "# Generated automatically\n\n";

      // User agents and rules
      const userAgents = data.user_agents || [
        { agent: "*", disallow: data.disallowed_paths || ["/admin", "/api"] },
      ];

      for (const ua of userAgents) {
        robotsTxt += `User-agent: ${ua.agent}\n`;

        for (const disallow of ua.disallow) {
          robotsTxt += `Disallow: ${disallow}\n`;
        }

        if (data.crawl_delay) {
          robotsTxt += `Crawl-delay: ${data.crawl_delay}\n`;
        }

        robotsTxt += "\n";
      }

      // Sitemaps
      if (data.sitemap_urls && data.sitemap_urls.length > 0) {
        robotsTxt += "# Sitemaps\n";
        for (const sitemapUrl of data.sitemap_urls) {
          robotsTxt += `Sitemap: ${sitemapUrl}\n`;
        }
      }

      // Store robots.txt
      await admin.from("robots_txt_config").insert({
        domain: data.domain,
        robots_txt_content: robotsTxt,
        is_active: true,
        created_at: new Date().toISOString(),
      });

      return {
        success: true,
        domain: data.domain,
        robots_txt_content: robotsTxt,
      };
    } catch (error) {
      console.error("Robots.txt generation error:", error);
      throw error;
    }
  });

// ============================================================================
// METADATA CACHE & AUTO-GENERATION
// ============================================================================

export const generateAndCacheMetadata = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as {
    url: string;
    title: string;
    description: string;
    keywords?: string[];
    og_image?: string;
    canonical?: string;
    hreflang_variants?: Record<string, string>;
  })
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    
    try {
      // Generate schema.org structured data
      const schema = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": data.title,
        "description": data.description,
        "url": data.url,
        "image": data.og_image,
      };

      // Generate Open Graph tags
      const ogTags = {
        "og:title": data.title,
        "og:description": data.description,
        "og:url": data.url,
        "og:image": data.og_image,
        "og:type": "website",
      };

      // Generate Twitter Card tags
      const twitterTags = {
        "twitter:card": "summary_large_image",
        "twitter:title": data.title,
        "twitter:description": data.description,
        "twitter:image": data.og_image,
      };

      // Store metadata cache
      await admin.from("metadata_cache").upsert(
        {
          url: data.url,
          title: data.title,
          description: data.description,
          keywords: JSON.stringify(data.keywords || []),
          schema_json: JSON.stringify(schema),
          og_tags: JSON.stringify(ogTags),
          twitter_tags: JSON.stringify(twitterTags),
          canonical_url: data.canonical,
          hreflang_variants: JSON.stringify(data.hreflang_variants || {}),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "url" }
      );

      return {
        success: true,
        url: data.url,
        metadata: {
          title: data.title,
          description: data.description,
          schema,
          og_tags: ogTags,
          twitter_tags: twitterTags,
        },
      };
    } catch (error) {
      console.error("Metadata cache error:", error);
      throw error;
    }
  });

// ============================================================================
// GET CACHED METADATA
// ============================================================================

export const getCachedMetadata = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { url: string })
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    
    try {
      const { data: metadata } = await admin
        .from("metadata_cache")
        .select("*")
        .eq("url", data.url)
        .single();

      if (!metadata) return null;

      return {
        url: metadata.url,
        title: metadata.title,
        description: metadata.description,
        keywords: JSON.parse(metadata.keywords || "[]"),
        schema: JSON.parse(metadata.schema_json || "{}"),
        og_tags: JSON.parse(metadata.og_tags || "{}"),
        twitter_tags: JSON.parse(metadata.twitter_tags || "{}"),
        canonical_url: metadata.canonical_url,
        hreflang_variants: JSON.parse(metadata.hreflang_variants || "{}"),
      };
    } catch (error) {
      console.error("Get metadata error:", error);
      return null;
    }
  });

// ============================================================================
// BULK METADATA GENERATION
// ============================================================================

export const generateBulkMetadata = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as {
    urls: Array<{
      url: string;
      title: string;
      description: string;
      keywords?: string[];
    }>;
  })
  .handler(async ({ data }) => {
    const results = [];

    for (const page of data.urls) {
      try {
        const result = await generateAndCacheMetadata({
          data: {
            url: page.url,
            title: page.title,
            description: page.description,
            keywords: page.keywords,
          },
        });
        results.push(result);
      } catch (error) {
        results.push({
          url: page.url,
          success: false,
          error: String(error),
        });
      }
    }

    return { success: true, results };
  });

// ============================================================================
// SCHEMA.ORG VALIDATION
// ============================================================================

export const validateSchema = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { schema_json: Record<string, any> })
  .handler(async ({ data }) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const schema = data.schema_json;

      // Validate required fields based on type
      if (!schema["@context"]) errors.push("Missing @context");
      if (!schema["@type"]) errors.push("Missing @type");

      // Type-specific validation
      const schemaType = schema["@type"];

      if (schemaType === "Article" || schemaType === "BlogPosting") {
        if (!schema.headline) errors.push("Missing headline for Article");
        if (!schema.datePublished)
          errors.push("Missing datePublished for Article");
        if (!schema.author) warnings.push("Recommended: Add author for Article");
      }

      if (schemaType === "Product") {
        if (!schema.name) errors.push("Missing name for Product");
        if (!schema.offers) errors.push("Missing offers for Product");
        if (!schema.description)
          warnings.push("Recommended: Add description for Product");
      }

      if (schemaType === "LocalBusiness" || schemaType === "Organization") {
        if (!schema.name) errors.push("Missing name for Business");
        if (!schema.address) warnings.push("Recommended: Add address");
      }

      const admin = getSupabaseAdmin();
      await admin.from("schema_validation_results").insert({
        schema_type: schemaType,
        is_valid: errors.length === 0,
        errors: JSON.stringify(errors),
        warnings: JSON.stringify(warnings),
        extracted_data: JSON.stringify(schema),
        created_at: new Date().toISOString(),
      });

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [String(error)],
        warnings: [],
      };
    }
  });

// ============================================================================
// UTILITIES
// ============================================================================

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
