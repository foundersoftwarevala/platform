/**
 * Cloudflare Integration Handler
 * Manages DNS, HTTPS, redirects, and domain configuration for softwarevala.net
 */

import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

// ============================================================================
// TYPES
// ============================================================================

export type DnsRecord = {
  id: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied?: boolean;
};

export type DomainHealthCheck = {
  domain: string;
  https_enabled: boolean;
  ssl_valid: boolean;
  dns_configured: boolean;
  redirects_configured: boolean;
  robots_txt_accessible: boolean;
  sitemap_accessible: boolean;
  homepage_accessible: boolean;
  api_responsive: boolean;
  overall_health: "healthy" | "warning" | "critical";
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

async function getCloudflareCredentials() {
  const admin = getSupabaseAdmin();
  const { data: cred } = await admin
    .from("seo_api_credentials")
    .select("credential_value")
    .eq("credential_type", "cloudflare")
    .eq("is_active", true)
    .single();

  if (!cred) throw new Error("Cloudflare credentials not configured");

  // In production, decrypt this
  return JSON.parse(cred.credential_value);
}

// ============================================================================
// DNS MANAGEMENT
// ============================================================================

export const getDnsRecords = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { zone_id?: string })
  .handler(async ({ data }) => {
    const cf = await getCloudflareCredentials();
    const zoneId = data.zone_id || cf.zone_id;

    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
      headers: { Authorization: `Bearer ${cf.api_token}` },
    });

    if (!response.ok) throw new Error(`Cloudflare API error: ${response.statusText}`);

    const result = await response.json();
    return result.result as DnsRecord[];
  });

export const updateDnsRecord = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as {
    zone_id?: string;
    record_id: string;
    name: string;
    type: string;
    content: string;
    ttl?: number;
    proxied?: boolean;
  })
  .handler(async ({ data }) => {
    const cf = await getCloudflareCredentials();
    const zoneId = data.zone_id || cf.zone_id;

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${data.record_id}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${cf.api_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: data.type,
          name: data.name,
          content: data.content,
          ttl: data.ttl || 3600,
          proxied: data.proxied ?? false,
        }),
      }
    );

    if (!response.ok) throw new Error(`Cloudflare API error: ${response.statusText}`);

    const result = await response.json();
    return result.result as DnsRecord;
  });

export const createDnsRecord = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as {
    zone_id?: string;
    name: string;
    type: string;
    content: string;
    ttl?: number;
    proxied?: boolean;
  })
  .handler(async ({ data }) => {
    const cf = await getCloudflareCredentials();
    const zoneId = data.zone_id || cf.zone_id;

    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cf.api_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: data.type,
        name: data.name,
        content: data.content,
        ttl: data.ttl || 3600,
        proxied: data.proxied ?? false,
      }),
    });

    if (!response.ok) throw new Error(`Cloudflare API error: ${response.statusText}`);

    const result = await response.json();
    return result.result as DnsRecord;
  });

// ============================================================================
// SSL/HTTPS MANAGEMENT
// ============================================================================

export const getSSLCertificate = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { zone_id?: string })
  .handler(async ({ data }) => {
    const cf = await getCloudflareCredentials();
    const zoneId = data.zone_id || cf.zone_id;

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/ssl/certificate_pack`,
      {
        headers: { Authorization: `Bearer ${cf.api_token}` },
      }
    );

    if (!response.ok) throw new Error(`Cloudflare API error: ${response.statusText}`);

    const result = await response.json();
    return result.result;
  });

export const enableHttpsRedirect = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { zone_id?: string })
  .handler(async ({ data }) => {
    const cf = await getCloudflareCredentials();
    const zoneId = data.zone_id || cf.zone_id;

    // Set always_use_https
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/settings/always_use_https`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${cf.api_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value: "on" }),
    });

    if (!response.ok) throw new Error(`Cloudflare API error: ${response.statusText}`);

    return { success: true };
  });

// ============================================================================
// REDIRECT RULES
// ============================================================================

export const createRedirectRule = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as {
    zone_id?: string;
    source: string;
    destination: string;
    status_code: number;
  })
  .handler(async ({ data }) => {
    const cf = await getCloudflareCredentials();
    const zoneId = data.zone_id || cf.zone_id;

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/rules/lists/redirects/items`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cf.api_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: data.source,
          destination: data.destination,
          status_code: data.status_code,
        }),
      }
    );

    if (!response.ok) throw new Error(`Cloudflare API error: ${response.statusText}`);

    return { success: true };
  });

// ============================================================================
// PAGE RULES & CACHING
// ============================================================================

export const setCachingRules = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as {
    zone_id?: string;
    path_pattern: string;
    cache_level: "bypass" | "development" | "cache" | "cache_everything";
    browser_cache_ttl?: number;
  })
  .handler(async ({ data }) => {
    const cf = await getCloudflareCredentials();
    const zoneId = data.zone_id || cf.zone_id;

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/cache_rules`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cf.api_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description: `Cache rule for ${data.path_pattern}`,
          expression: `(http.request.uri.path like "${data.path_pattern}")`,
          action: "set_cache_settings",
          action_parameters: {
            cache: true,
            cache_key: { cache_by_device_type: true },
            cache_ttl: data.browser_cache_ttl || 3600,
            cache_on_cookie: "session_id",
          },
        }),
      }
    );

    if (!response.ok) throw new Error(`Cloudflare API error: ${response.statusText}`);

    return { success: true };
  });

// ============================================================================
// DOMAIN HEALTH CHECK
// ============================================================================

export const checkDomainHealth = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { domain: string })
  .handler(async ({ data }) => {
    const checks: DomainHealthCheck = {
      domain: data.domain,
      https_enabled: false,
      ssl_valid: false,
      dns_configured: false,
      redirects_configured: false,
      robots_txt_accessible: false,
      sitemap_accessible: false,
      homepage_accessible: false,
      api_responsive: false,
      overall_health: "critical",
    };

    try {
      // Check HTTPS
      const httpsResponse = await fetch(`https://${data.domain}`, {
        method: "HEAD",
        redirect: "manual",
      });
      checks.https_enabled = httpsResponse.ok || httpsResponse.status === 200 || httpsResponse.status === 301;

      // Check homepage
      const homeResponse = await fetch(`https://${data.domain}/`, { redirect: "follow" });
      checks.homepage_accessible = homeResponse.ok;

      // Check robots.txt
      const robotsResponse = await fetch(`https://${data.domain}/robots.txt`);
      checks.robots_txt_accessible = robotsResponse.ok;

      // Check sitemap
      const sitemapResponse = await fetch(`https://${data.domain}/sitemap.xml`);
      checks.sitemap_accessible = sitemapResponse.ok;

      // Check API
      const apiResponse = await fetch(`https://${data.domain}/api/health`, { method: "HEAD" });
      checks.api_responsive = apiResponse.ok || apiResponse.status === 404 || apiResponse.status === 405;

      // Determine overall health
      const healthyChecks = Object.values(checks)
        .filter(v => typeof v === "boolean")
        .filter(v => v).length;
      const totalChecks = Object.values(checks).filter(v => typeof v === "boolean").length;

      if (healthyChecks === totalChecks) {
        checks.overall_health = "healthy";
      } else if (healthyChecks >= totalChecks * 0.75) {
        checks.overall_health = "warning";
      }
    } catch (error) {
      console.error("Domain health check error:", error);
    }

    return checks;
  });

// ============================================================================
// PAGESSPEED & PERFORMANCE
// ============================================================================

export const configurePerformanceSettings = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { zone_id?: string })
  .handler(async ({ data }) => {
    const cf = await getCloudflareCredentials();
    const zoneId = data.zone_id || cf.zone_id;

    const settings = [
      // Minification
      {
        setting: "minify",
        value: { javascript: true, css: true, html: true },
      },
      // Brotli compression
      {
        setting: "brotli",
        value: "on",
      },
      // Polish (image optimization)
      {
        setting: "polish",
        value: "lossless",
      },
      // Rocket Loader
      {
        setting: "rocket_loader",
        value: "on",
      },
      // Automatic HTTPS Rewrites
      {
        setting: "automatic_https_rewrites",
        value: "on",
      },
      // HTTP/2
      {
        setting: "http2",
        value: "on",
      },
      // HTTP/3 (QUIC)
      {
        setting: "http3",
        value: "on",
      },
    ];

    const results = [];

    for (const setting of settings) {
      try {
        const response = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${zoneId}/settings/${setting.setting}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${cf.api_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ value: setting.value }),
          }
        );

        if (response.ok) {
          results.push({ setting: setting.setting, success: true });
        } else {
          results.push({ setting: setting.setting, success: false });
        }
      } catch (error) {
        results.push({ setting: setting.setting, success: false, error: String(error) });
      }
    }

    return { success: results.every(r => r.success), results };
  });

// ============================================================================
// SECURITY HEADERS
// ============================================================================

export const configureSecurityHeaders = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { zone_id?: string })
  .handler(async ({ data }) => {
    const cf = await getCloudflareCredentials();
    const zoneId = data.zone_id || cf.zone_id;

    // Configure through Transform Rules
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/transforms/managed_headers`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${cf.api_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          managed_request_headers: [
            { id: "add_x_frame_options", enabled: true },
            { id: "add_x_content_type_options", enabled: true },
            { id: "add_x_xss_protection", enabled: true },
          ],
          managed_response_headers: [
            { id: "add_content_security_policy", enabled: true },
            { id: "add_strict_transport_security", enabled: true },
            { id: "add_x_frame_options", enabled: true },
            { id: "add_x_content_type_options", enabled: true },
          ],
        }),
      }
    );

    if (!response.ok) throw new Error(`Cloudflare API error: ${response.statusText}`);

    return { success: true };
  });
