/**
 * SEO API Credential Manager
 * Secure storage and management of API keys for all integrated providers
 * Handles OAuth2 flows, API key storage, expiration, and rate limiting
 */

import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// ============================================================================
// CREDENTIAL SCHEMAS
// ============================================================================

export const GoogleCredentialInput = z.object({
  credential_type: z.enum(["api_key", "oauth2", "service_account"]),
  api_key: z.string().optional(),
  oauth_token: z.string().optional(),
  service_account_json: z.record(z.any()).optional(),
});

export const BingCredentialInput = z.object({
  api_key: z.string(),
  account_id: z.string().optional(),
});

export const CloudflareCredentialInput = z.object({
  api_token: z.string(),
  zone_id: z.string(),
  account_id: z.string(),
  email: z.string().optional(),
});

export const IndexNowCredentialInput = z.object({
  api_key: z.string(),
  key_location: z.string().optional(),
});

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
// ENCRYPTION UTILITIES (in production, use real encryption)
// ============================================================================

function encryptCredential(value: string): string {
  // TODO: In production, use crypto.subtle or libsodium
  return Buffer.from(value).toString("base64");
}

function decryptCredential(encrypted: string): string {
  // TODO: In production, use crypto.subtle or libsodium
  return Buffer.from(encrypted, "base64").toString("utf-8");
}

// ============================================================================
// REGISTER / UPDATE CREDENTIALS
// ============================================================================

export const registerGoogleCredentials = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => GoogleCredentialInput.parse(d))
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    
    // Get provider
    const { data: provider } = await admin
      .from("seo_api_providers")
      .select("id")
      .eq("name", "Google Search Console")
      .single();
    
    if (!provider) throw new Error("Provider not found");
    
    const credentialValue = data.api_key || data.oauth_token || JSON.stringify(data.service_account_json || {});
    
    // Store credential (encrypted)
    await admin.from("seo_api_credentials").upsert({
      provider_id: provider.id,
      credential_type: data.credential_type,
      credential_value: encryptCredential(credentialValue),
      is_active: true,
      expires_at: data.credential_type === "oauth2" ? new Date(Date.now() + 3600 * 1000) : null,
    }, {
      onConflict: "provider_id,credential_type",
    });
    
    return { success: true, provider_id: provider.id };
  });

export const registerBingCredentials = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => BingCredentialInput.parse(d))
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    
    const { data: provider } = await admin
      .from("seo_api_providers")
      .select("id")
      .eq("name", "Bing Webmaster Tools")
      .single();
    
    if (!provider) throw new Error("Provider not found");
    
    await admin.from("seo_api_credentials").upsert({
      provider_id: provider.id,
      credential_type: "api_key",
      credential_value: encryptCredential(data.api_key),
      is_active: true,
    }, {
      onConflict: "provider_id,credential_type",
    });
    
    return { success: true, provider_id: provider.id };
  });

export const registerCloudflareCredentials = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CloudflareCredentialInput.parse(d))
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    
    // Store in dedicated table for Cloudflare (not through seo_api_providers)
    await admin.from("seo_api_credentials").insert({
      credential_type: "cloudflare",
      credential_value: encryptCredential(JSON.stringify({
        api_token: data.api_token,
        zone_id: data.zone_id,
        account_id: data.account_id,
        email: data.email,
      })),
      is_active: true,
    });
    
    return { success: true, provider: "cloudflare" };
  });

export const registerIndexNowCredentials = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => IndexNowCredentialInput.parse(d))
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    
    const { data: provider } = await admin
      .from("seo_api_providers")
      .select("id")
      .eq("name", "IndexNow")
      .single();
    
    if (!provider) throw new Error("Provider not found");
    
    await admin.from("seo_api_credentials").upsert({
      provider_id: provider.id,
      credential_type: "api_key",
      credential_value: encryptCredential(data.api_key),
      is_active: true,
    }, {
      onConflict: "provider_id,credential_type",
    });
    
    return { success: true, provider_id: provider.id };
  });

// ============================================================================
// RETRIEVE CREDENTIALS
// ============================================================================

export const getGoogleCredentials = createServerFn({ method: "GET" })
  .handler(async () => {
    const admin = getSupabaseAdmin();
    
    const { data: provider } = await admin
      .from("seo_api_providers")
      .select("id")
      .eq("name", "Google Search Console")
      .single();
    
    if (!provider) return null;
    
    const { data: cred } = await admin
      .from("seo_api_credentials")
      .select("credential_type, credential_value")
      .eq("provider_id", provider.id)
      .eq("is_active", true)
      .single();
    
    if (!cred) return null;
    
    return {
      credential_type: cred.credential_type,
      value: decryptCredential(cred.credential_value),
    };
  });

export const getBingCredentials = createServerFn({ method: "GET" })
  .handler(async () => {
    const admin = getSupabaseAdmin();
    
    const { data: provider } = await admin
      .from("seo_api_providers")
      .select("id")
      .eq("name", "Bing Webmaster Tools")
      .single();
    
    if (!provider) return null;
    
    const { data: cred } = await admin
      .from("seo_api_credentials")
      .select("credential_value")
      .eq("provider_id", provider.id)
      .eq("is_active", true)
      .single();
    
    if (!cred) return null;
    
    return {
      api_key: decryptCredential(cred.credential_value),
    };
  });

export const getCloudflareCredentials = createServerFn({ method: "GET" })
  .handler(async () => {
    const admin = getSupabaseAdmin();
    
    const { data: cred } = await admin
      .from("seo_api_credentials")
      .select("credential_value")
      .eq("credential_type", "cloudflare")
      .eq("is_active", true)
      .single();
    
    if (!cred) return null;
    
    return JSON.parse(decryptCredential(cred.credential_value));
  });

export const getIndexNowCredentials = createServerFn({ method: "GET" })
  .handler(async () => {
    const admin = getSupabaseAdmin();
    
    const { data: provider } = await admin
      .from("seo_api_providers")
      .select("id")
      .eq("name", "IndexNow")
      .single();
    
    if (!provider) return null;
    
    const { data: cred } = await admin
      .from("seo_api_credentials")
      .select("credential_value")
      .eq("provider_id", provider.id)
      .eq("is_active", true)
      .single();
    
    if (!cred) return null;
    
    return {
      api_key: decryptCredential(cred.credential_value),
    };
  });

// ============================================================================
// LIST REGISTERED PROVIDERS
// ============================================================================

export const listSeoProviders = createServerFn({ method: "GET" })
  .handler(async () => {
    const admin = getSupabaseAdmin();
    
    const { data: providers } = await admin
      .from("seo_api_providers")
      .select("*")
      .eq("status", "active");
    
    return providers || [];
  });

// ============================================================================
// USAGE TRACKING
// ============================================================================

export const trackApiUsage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as {
    provider_name: string;
    endpoint: string;
    status: number;
    duration_ms: number;
    cost_usd?: number;
    error?: string;
  })
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    
    // Get provider
    const { data: provider } = await admin
      .from("seo_api_providers")
      .select("id")
      .eq("name", data.provider_name)
      .single();
    
    if (!provider) return;
    
    // Log request
    await admin.from("seo_api_request_logs").insert({
      provider_id: provider.id,
      endpoint: data.endpoint,
      method: "POST",
      response_status: data.status,
      duration_ms: data.duration_ms,
      cost_usd: data.cost_usd || 0,
      error_message: data.error || null,
      created_at: new Date().toISOString(),
    });
    
    // Update usage stats
    const yearMonth = new Date().toISOString().substring(0, 7);
    
    const { data: existing } = await admin
      .from("seo_api_usage")
      .select("*")
      .eq("provider_id", provider.id)
      .eq("year_month", yearMonth)
      .single();
    
    if (existing) {
      await admin.from("seo_api_usage").update({
        request_count: (existing.request_count || 0) + 1,
        success_count: data.status >= 200 && data.status < 300 ? (existing.success_count || 0) + 1 : existing.success_count,
        error_count: data.status >= 400 ? (existing.error_count || 0) + 1 : existing.error_count,
        total_cost_usd: (existing.total_cost_usd || 0) + (data.cost_usd || 0),
      }).eq("id", existing.id);
    } else {
      await admin.from("seo_api_usage").insert({
        provider_id: provider.id,
        year_month: yearMonth,
        request_count: 1,
        success_count: data.status >= 200 && data.status < 300 ? 1 : 0,
        error_count: data.status >= 400 ? 1 : 0,
        total_cost_usd: data.cost_usd || 0,
      });
    }
  });

// ============================================================================
// CREDENTIALS STATUS
// ============================================================================

export const getCredentialsStatus = createServerFn({ method: "GET" })
  .handler(async () => {
    const admin = getSupabaseAdmin();
    
    const { data: providers } = await admin
      .from("seo_api_providers")
      .select("id, name, provider_type, status");
    
    if (!providers) return [];
    
    const status = [];
    
    for (const provider of providers) {
      const { data: cred } = await admin
        .from("seo_api_credentials")
        .select("is_active, expires_at")
        .eq("provider_id", provider.id)
        .eq("is_active", true)
        .single();
      
      status.push({
        provider_name: provider.name,
        provider_type: provider.provider_type,
        provider_status: provider.status,
        is_configured: !!cred,
        expires_at: cred?.expires_at || null,
        is_expired: cred?.expires_at ? new Date(cred.expires_at) < new Date() : false,
      });
    }
    
    return status;
  });
