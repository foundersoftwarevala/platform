/**
 * SEO Orchestration Master
 * Coordinates all SEO services and provides unified entry points
 */

import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { encryptAiCredential } from "@/lib/ai-credentials.server";

const seoDomainInput = z.object({
  domain: z
    .string()
    .min(1)
    .max(253)
    .regex(/^[A-Za-z0-9.-]+$/),
});

const seoAuditInput = seoDomainInput.extend({
  max_pages: z.number().int().min(1).max(500).optional(),
});

type SeoHealthStatus = {
  domain: string;
  timestamp: string;
  services: Record<string, { configured: boolean; active: boolean }>;
  https: boolean;
  homepage_status?: number;
  latest_gsc?: {
    impressions: number;
    clicks: number;
    ctr: number;
    avg_position: number;
    date: string;
  };
  latest_psi?: {
    performance: number;
    accessibility: number;
    seo: number;
    best_practices: number;
    tested_at: string;
  };
  latest_cwv?: {
    lcp: number;
    inp: number;
    cls: number;
    form_factor: string;
    tested_at: string;
  };
  health_score?: number;
  health_status?: "healthy" | "warning" | "critical";
};

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
 * The domain comes from the request body and was fetched with plain fetch()
 * from inside the server's network, so "169.254.169.254" or an internal host
 * name would have been fetched for whoever asked. It now goes through the
 * checked fetcher (lib/seo/public-fetch.server.ts).
 */
async function domainFetch(domain: unknown, path = "") {
  const { publicFetch } = await import("@/lib/seo/public-fetch.server");
  const host = String(domain ?? "").trim();
  if (!/^[A-Za-z0-9.-]{1,253}$/.test(host)) throw new Error("That is not a valid domain.");
  return publicFetch(`https://${host}${path}`, { maxBytes: 2_000_000 });
}

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
// UNIFIED SEO SETUP
// ============================================================================

export const setupSeoInfrastructure = createServerFn({ method: "POST" })
  .inputValidator(
    (d: unknown) =>
      d as {
        domain: string;
        site_url: string;
        google_api_key?: string;
        bing_api_key?: string;
        indexnow_key?: string;
        cloudflare_token?: string;
        cloudflare_zone_id?: string;
      },
  )
  .handler(async ({ data }) => {
    await seoGuard("setupSeoInfrastructure");
    const admin = getSupabaseAdmin();
    const steps: Array<{ step: string; status: "success" | "failed"; message: string }> = [];

    try {
      // Step 1: Register API Credentials
      if (data.google_api_key) {
        const { data: provider } = await admin
          .from("seo_api_providers")
          .select("id")
          .eq("name", "Google Search Console")
          .single();

        if (provider) {
          await admin.from("seo_api_credentials").upsert({
            provider_id: provider.id,
            credential_type: "api_key",
            credential_value: encryptAiCredential(data.google_api_key),
            is_active: true,
          });
          steps.push({ step: "Google API", status: "success", message: "Credentials stored" });
        }
      }

      if (data.bing_api_key) {
        const { data: provider } = await admin
          .from("seo_api_providers")
          .select("id")
          .eq("name", "Bing Webmaster Tools")
          .single();

        if (provider) {
          await admin.from("seo_api_credentials").upsert({
            provider_id: provider.id,
            credential_type: "api_key",
            credential_value: encryptAiCredential(data.bing_api_key),
            is_active: true,
          });
          steps.push({ step: "Bing API", status: "success", message: "Credentials stored" });
        }
      }

      if (data.indexnow_key) {
        const { data: provider } = await admin
          .from("seo_api_providers")
          .select("id")
          .eq("name", "IndexNow")
          .single();

        if (provider) {
          await admin.from("seo_api_credentials").upsert({
            provider_id: provider.id,
            credential_type: "api_key",
            credential_value: encryptAiCredential(data.indexnow_key),
            is_active: true,
          });
          steps.push({ step: "IndexNow API", status: "success", message: "Credentials stored" });
        }
      }

      // Step 2: Store domain configuration
      const { error: domainConfigError } = await admin.from("domain_config").upsert(
        {
          domain: data.domain,
          site_url: data.site_url,
          cloudflare_zone_id: data.cloudflare_zone_id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "domain" },
      );
      if (domainConfigError) {
        throw new Error(`Could not store domain configuration: ${domainConfigError.message}`);
      }

      steps.push({ step: "Domain Config", status: "success", message: "Configuration stored" });

      // Step 3: Initialize indexing queue
      const { data: queued, error: queueReadError } = await admin
        .from("indexing_queue")
        .select("url")
        .eq("url", data.site_url)
        .limit(1);
      if (queueReadError) {
        throw new Error(`Could not check the indexing queue: ${queueReadError.message}`);
      }
      if (!queued?.length) {
        const { error: queueInsertError } = await admin.from("indexing_queue").insert({
          url: data.site_url,
          status: "pending",
          priority: 1,
        });
        if (queueInsertError && queueInsertError.code !== "23505") {
          throw new Error(`Could not initialize the indexing queue: ${queueInsertError.message}`);
        }
      }

      steps.push({
        step: "Indexing Queue",
        status: "success",
        message: queued?.length ? "Already initialized" : "Initialized",
      });

      return {
        success: true,
        domain: data.domain,
        steps,
        message: "SEO infrastructure setup completed",
      };
    } catch (error) {
      steps.push({
        step: "Setup",
        status: "failed",
        message: String(error),
      });

      return {
        success: false,
        domain: data.domain,
        steps,
        error: String(error),
      };
    }
  });

// ============================================================================
// DAILY SEO SYNC ORCHESTRATION
// ============================================================================

export const runDailySeoSync = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => seoDomainInput.parse(d))
  .handler(async ({ data }) => {
    await seoGuard("runDailySeoSync");
    const results: Record<
      string,
      "synced" | "failed" | "error" | "processed" | "accessible" | "not_found"
    > = {};

    // 1. Sync Google Search Console data
    try {
      const gscSync = await fetch("/api/seo/sync-gsc", {
        method: "POST",
        body: JSON.stringify({ site_url: `https://${data.domain}` }),
      });
      results.gsc = gscSync.ok ? "synced" : "failed";
    } catch (e) {
      results.gsc = "error";
    }

    // 2. Sync Bing Webmaster data
    try {
      const bingSync = await fetch("/api/seo/sync-bing", {
        method: "POST",
        body: JSON.stringify({ site_url: `https://${data.domain}` }),
      });
      results.bing = bingSync.ok ? "synced" : "failed";
    } catch (e) {
      results.bing = "error";
    }

    // 3. Process pending IndexNow submissions
    try {
      const indexnowProcess = await fetch("/api/seo/process-indexing", {
        method: "POST",
        body: JSON.stringify({ host: data.domain }),
      });
      results.indexnow = indexnowProcess.ok ? "processed" : "failed";
    } catch (e) {
      results.indexnow = "error";
    }

    // 4. Run sitemap check
    try {
      const sitemapCheck = await domainFetch(data.domain, "/sitemap.xml");
      results.sitemap = sitemapCheck.error ? "error" : sitemapCheck.ok ? "accessible" : "not_found";
    } catch (e) {
      results.sitemap = "error";
    }

    return {
      success: Object.values(results).every(
        (result) => result !== "error" && result !== "failed" && result !== "not_found",
      ),
      domain: data.domain,
      results,
      timestamp: new Date().toISOString(),
    };
  });

// ============================================================================
// FULL SITE SEO AUDIT
// ============================================================================

export const runFullSiteAudit = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => seoAuditInput.parse(d))
  .handler(async ({ data }) => {
    await seoGuard("runFullSiteAudit");
    const admin = getSupabaseAdmin();
    const maxPages = data.max_pages ?? 50;
    const audits = [];

    // Get pages from indexing queue or sitemap
    const { data: pages } = await admin.from("indexing_queue").select("url").limit(maxPages);

    if (!pages || pages.length === 0) {
      return {
        success: false,
        error: "No pages found to audit",
      };
    }

    for (const page of pages) {
      try {
        // Run audit for each page
        const auditResponse = await fetch("/api/seo/audit", {
          method: "POST",
          body: JSON.stringify({ url: page.url }),
        });

        if (auditResponse.ok) {
          const auditData = await auditResponse.json();
          audits.push(auditData);
        }
      } catch (error) {
        console.error(`Audit failed for ${page.url}:`, error);
      }
    }

    // Calculate aggregate score
    const avgScore = audits.reduce((sum, a) => sum + (a.score || 0), 0) / audits.length;

    // Store audit summary
    const { error: summaryError } = await admin.from("seo_audits_summary").insert({
      domain: data.domain,
      pages_audited: audits.length,
      average_score: Math.round(avgScore),
      audit_data: JSON.stringify(audits),
      created_at: new Date().toISOString(),
    });
    if (summaryError) {
      throw new Error(`Could not store the audit summary: ${summaryError.message}`);
    }

    return {
      success: true,
      domain: data.domain,
      pages_audited: audits.length,
      average_score: Math.round(avgScore),
      audits,
    };
  });

// ============================================================================
// SEO HEALTH DASHBOARD
// ============================================================================

export const getSeoHealthStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => seoDomainInput.parse(d))
  .handler(async ({ data }) => {
    await seoGuard("getSeoHealthStatus");
    const admin = getSupabaseAdmin();
    const status: SeoHealthStatus = {
      domain: data.domain,
      timestamp: new Date().toISOString(),
      services: {},
      https: false,
    };

    // Check Domain Health
    try {
      const domainResponse = await domainFetch(data.domain);
      if (domainResponse.error) throw new Error(domainResponse.error);
      status.https = domainResponse.status > 0 && domainResponse.status < 400;
      status.homepage_status = domainResponse.status;
    } catch (e) {
      status.https = false;
    }

    // Check API Credentials Status
    const { data: providers } = await admin.from("seo_api_providers").select("id, name");

    if (providers) {
      for (const provider of providers) {
        const { data: cred } = await admin
          .from("seo_api_credentials")
          .select("is_active")
          .eq("provider_id", provider.id)
          .eq("is_active", true)
          .single();

        status.services[provider.name] = {
          configured: !!cred,
          active: !!cred,
        };
      }
    }

    // Get latest metrics
    const { data: gscData } = await admin
      .from("search_console_data")
      .select("*")
      .eq("site_url", `https://${data.domain}`)
      .order("date", { ascending: false })
      .limit(1);

    if (gscData && gscData.length > 0) {
      const latest = gscData[0];
      status.latest_gsc = {
        impressions: latest.impressions,
        clicks: latest.clicks,
        ctr: latest.ctr,
        avg_position: latest.avg_position,
        date: latest.date,
      };
    }

    // Get latest PageSpeed score
    const { data: psiData } = await admin
      .from("pagespeed_insights")
      .select("*")
      .eq("url", `https://${data.domain}`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (psiData && psiData.length > 0) {
      const latest = psiData[0];
      status.latest_psi = {
        performance: latest.performance_score,
        accessibility: latest.accessibility_score,
        seo: latest.seo_score,
        best_practices: latest.best_practices_score,
        tested_at: latest.created_at,
      };
    }

    // Get Core Web Vitals
    const { data: cwvData } = await admin
      .from("core_web_vitals")
      .select("*")
      .eq("url", `https://${data.domain}`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (cwvData && cwvData.length > 0) {
      const latest = cwvData[0];
      status.latest_cwv = {
        lcp: latest.lcp_percentile_75,
        inp: latest.inp_percentile_75,
        cls: latest.cls_percentile_75,
        form_factor: latest.form_factor,
        tested_at: latest.created_at,
      };
    }

    // Calculate overall health score
    let healthScore = 0;
    let checks = 0;

    if (status.https) {
      healthScore += 20;
    }
    checks += 20;

    const configuredServices = Object.values(status.services).filter(
      (service) => service.configured,
    ).length;
    const maxServices = Object.keys(status.services).length;
    if (maxServices > 0) {
      healthScore += (configuredServices / maxServices) * 30;
      checks += 30;
    }

    if (status.latest_psi && status.latest_psi.performance >= 50) {
      healthScore += 25;
    }
    checks += 25;

    if (status.latest_cwv && status.latest_cwv.lcp < 2500) {
      healthScore += 25;
    }
    checks += 25;

    status.health_score = Math.round((healthScore / checks) * 100);
    status.health_status =
      status.health_score >= 80 ? "healthy" : status.health_score >= 60 ? "warning" : "critical";

    return status;
  });

// ============================================================================
// DEPLOY SEO INFRASTRUCTURE
// ============================================================================

export const deployToProduction = createServerFn({ method: "POST" })
  .inputValidator(
    (d: unknown) =>
      d as {
        domain: string;
        generate_sitemaps?: boolean;
        generate_robots_txt?: boolean;
        run_initial_audit?: boolean;
      },
  )
  .handler(async ({ data }) => {
    await seoGuard("deployToProduction");
    const steps: Array<{ step: string; status: "success" | "failed"; details?: string }> = [];

    try {
      // 1. Verify infrastructure
      const health = await getSeoHealthStatus({ data: { domain: data.domain } });

      if (!health.https) {
        steps.push({
          step: "HTTPS Check",
          status: "failed",
          details: "Domain not accessible via HTTPS",
        });
        return { success: false, steps };
      }

      steps.push({ step: "HTTPS Check", status: "success" });

      // 2. Generate sitemaps
      if (data.generate_sitemaps) {
        try {
          const response = await fetch("/api/seo/generate-sitemap", {
            method: "POST",
            body: JSON.stringify({ domain: data.domain }),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          steps.push({ step: "Sitemap Generation", status: "success" });
        } catch (error) {
          steps.push({
            step: "Sitemap Generation",
            status: "failed",
            details: String(error),
          });
        }
      }

      // 3. Generate robots.txt
      if (data.generate_robots_txt) {
        try {
          const response = await fetch("/api/seo/generate-robots", {
            method: "POST",
            body: JSON.stringify({ domain: data.domain }),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          steps.push({ step: "Robots.txt Generation", status: "success" });
        } catch (error) {
          steps.push({
            step: "Robots.txt Generation",
            status: "failed",
            details: String(error),
          });
        }
      }

      // 4. Run initial audit
      if (data.run_initial_audit) {
        try {
          const audit = await runFullSiteAudit({ data: { domain: data.domain, max_pages: 10 } });
          steps.push({
            step: "Initial Audit",
            status: "success",
            details: `Audited ${audit.pages_audited} pages`,
          });
        } catch (error) {
          steps.push({
            step: "Initial Audit",
            status: "failed",
            details: String(error),
          });
        }
      }

      // 5. Submit sitemaps to search engines
      try {
        const response = await fetch("/api/seo/submit-sitemaps", {
          method: "POST",
          body: JSON.stringify({ domain: data.domain }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        steps.push({ step: "Sitemap Submission", status: "success" });
      } catch (error) {
        steps.push({
          step: "Sitemap Submission",
          status: "failed",
          details: String(error),
        });
      }

      // This used to append "Production Deployment: success" and answer
      // success: true whatever the steps above reported, and counted a request
      // as done without looking at its status. It now says what happened.
      const failed = steps.filter((s) => s.status === "failed").length;
      if (!failed) steps.push({ step: "Production Deployment", status: "success" });

      return {
        success: failed === 0,
        domain: data.domain,
        steps,
        health,
        message: failed
          ? `SEO deployment incomplete: ${failed} step(s) failed`
          : "SEO infrastructure deployed to production",
      };
    } catch (error) {
      steps.push({
        step: "Deployment",
        status: "failed",
        details: String(error),
      });

      return { success: false, steps, error: String(error) };
    }
  });
