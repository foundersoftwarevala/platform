/**
 * Demo Gateway System
 * 
 * Provides a branded Software Vala interface for accessing third-party demos
 * while keeping users on the Software Vala domain.
 * 
 * Architecture:
 * User clicks Marketplace DEMO
 * → Browser navigates to /demo/[slug]
 * → Server validates demo URL against allowlist
 * → Client renders branded wrapper with iframe/embed
 * → Iframe loads actual demo application
 * → Software Vala branding applied (favicon, title, metadata)
 */

import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { SUPPLIED_DEMOS_16 } from "@/lib/supplied-demos-catalog";

type DemoRecord = Database["public"]["Tables"]["product_demo_urls"]["Row"];
type ProductRecord = Database["public"]["Tables"]["marketplace_products"]["Row"];

/**
 * Demo allowlist - domains that are permitted to be embedded/proxied
 * Format: hostname only (e.g., "lovable.app", "demo.example.com")
 */
const DEMO_DOMAIN_ALLOWLIST = [
  "lovable.app",
  "demo.lovable.app",
  "sl1nk.com",
  // Add more as needed
];

/**
 * Get all allowed demo URLs from supplied catalog
 */
function getAllowedDemoUrls(): string[] {
  return SUPPLIED_DEMOS_16.map(demo => demo.demoUrl);
}

/**
 * Validate that a demo URL is safe to load
 * Returns true if:
 * - URL is an internal /api/proxy/demo/* route, OR
 * - Domain is in allowlist, AND
 * - URL is in supplied demos catalog OR comes from database, AND
 * - URL uses HTTPS
 */
export function validateDemoUrl(urlString: string): boolean {
  try {
    // Allow internal proxy endpoints (they route through our own server)
    if (urlString.startsWith('/api/proxy/demo/') || urlString.startsWith('/api/demo-proxy')) {
      return true;
    }
    
    const url = new URL(urlString);
    
    // Check HTTPS
    if (url.protocol !== "https:") {
      return false;
    }
    
    // Check domain allowlist
    const domainAllowed = DEMO_DOMAIN_ALLOWLIST.some(
      (domain) => url.hostname === domain || url.hostname.endsWith("." + domain)
    );
    
    if (!domainAllowed) {
      return false;
    }
    
    // Check supplied catalog (or database when integrated)
    // For now, accept all lovable.app URLs that pass above checks
    return true;
  } catch {
    return false;
  }
}

/**
 * Get demo configuration for a product slug
 * Returns: { product, demo, safeUrl, demoName }
 * Used by gateway route to fetch real demo URL
 */
export const getDemoConfig = createServerFn({ method: "GET" })
  .middleware([])
  .handler(async (ctx) => {
    const slug = ctx.data as string;
    if (!slug) {
      throw new Error("Product slug required");
    }

    try {
      const env = typeof process !== "undefined" ? process.env : undefined;
      const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
      const supabaseUrl = viteEnv?.VITE_SUPABASE_URL ?? env?.SUPABASE_URL;
      const supabaseKey =
        viteEnv?.VITE_SUPABASE_PUBLISHABLE_KEY ??
        viteEnv?.VITE_SUPABASE_ANON_KEY ??
        env?.SUPABASE_PUBLISHABLE_KEY ??
        env?.SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase configuration");

      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: product, error: productError } = await supabase
        .from("marketplace_products")
        .select("id, name")
        .eq("slug", slug)
        .eq("visible", true)
        .maybeSingle();
      if (productError) throw productError;
      if (!product) return { slug, demo_url: null, demo_name: null, error: "Product not found" };

      const { data: demo, error: demoError } = await supabase
        .from("product_demo_urls")
        .select("demo_name, url, status")
        .eq("product_id", product.id)
        .eq("status", "active")
        .order("sort_order")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (demoError) throw demoError;
      return {
        slug,
        demo_url: demo?.url ?? null,
        demo_name: demo?.demo_name ?? product.name,
        error: demo ? null : "No active demo found",
      };
    } catch (error) {
      console.error(`[demo-gateway] Error fetching config for ${slug}:`, error);
      throw error;
    }
  });

/**
 * Get demo URL from Demo Manager (product_demo_urls table)
 * This is called client-side via the marketplace.functions API
 * Returns: { url, name, status }
 */
export async function fetchDemoFromMarketplace(
  productSlug: string
): Promise<{ url: string; name: string; status: string } | null> {
  try {
    // This will be implemented via marketplace.functions.ts
    // which has access to Supabase client
    const response = await fetch(`/api/marketplace/demo/${productSlug}`);
    if (!response.ok) return null;
    return response.json();
  } catch (error) {
    console.error(`[demo-gateway] Error fetching demo for ${productSlug}:`, error);
    return null;
  }
}

/**
 * Software Vala branding configuration
 */
export const BRANDING_CONFIG = {
  title: "Software Vala™ — The Name of Trust",
  description: "Experience enterprise software solutions",
  favicon: "/software-vala-logo.png",
  ogImage: "/og-image.png",
  colors: {
    primary: "#0f172a",
    accent: "#3b82f6",
  },
};

/**
 * Generate branded HTML for demo gateway
 * Used to inject Software Vala metadata into demo pages
 */
export function generateBrandedDemoHtml(
  demoUrl: string,
  demoName: string
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${BRANDING_CONFIG.title}</title>
  <meta name="description" content="${BRANDING_CONFIG.description}">
  <meta property="og:title" content="${BRANDING_CONFIG.title}">
  <meta property="og:description" content="Exploring: ${demoName}">
  <meta property="og:image" content="${BRANDING_CONFIG.ogImage}">
  <link rel="icon" type="image/png" href="${BRANDING_CONFIG.favicon}">
  <link rel="apple-touch-icon" href="${BRANDING_CONFIG.favicon}">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: ${BRANDING_CONFIG.colors.primary};
    }
    .demo-container { 
      width: 100vw; 
      height: 100vh; 
      display: flex; 
      flex-direction: column;
    }
    .demo-header {
      background: linear-gradient(to right, ${BRANDING_CONFIG.colors.primary}, #1e293b);
      border-bottom: 1px solid #334155;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      gap: 12px;
      color: white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      z-index: 100;
    }
    .demo-header img {
      height: 28px;
      width: auto;
    }
    .demo-header-text {
      font-size: 12px;
      color: #94a3b8;
    }
    .demo-header-text strong {
      color: white;
      font-weight: 600;
    }
    .demo-frame {
      flex: 1;
      border: none;
      width: 100%;
      height: 100%;
    }
    .demo-error {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 20px;
      padding: 40px;
      color: #cbd5e1;
      text-align: center;
    }
    .demo-error h2 {
      color: #f1f5f9;
      font-size: 24px;
    }
    .demo-error p {
      max-width: 500px;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="demo-container">
    <div class="demo-header">
      <img src="${BRANDING_CONFIG.favicon}" alt="Software Vala™">
      <span class="demo-header-text">
        <strong>Software Vala™</strong> Demo — ${demoName}
      </span>
    </div>
    <iframe 
      class="demo-frame" 
      src="${demoUrl}" 
      title="Demo: ${demoName}"
      allow="geolocation;camera;microphone;payment;clipboard-read;clipboard-write"
      sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-presentation"
    ></iframe>
  </div>
  <script>
    // Monitor iframe for errors and display fallback
    const iframe = document.querySelector('.demo-frame');
    
    iframe.addEventListener('error', function() {
      console.error('[demo-gateway] Demo failed to load');
      document.querySelector('.demo-frame').style.display = 'none';
      const errorDiv = document.createElement('div');
      errorDiv.className = 'demo-error';
      errorDiv.innerHTML = '<h2>Demo Unavailable</h2><p>The demo application could not be loaded. Please try again later or contact support.</p>';
      document.querySelector('.demo-container').appendChild(errorDiv);
    });

    // Handle cross-origin messages if demo needs to communicate back
    window.addEventListener('message', function(event) {
      if (event.source === iframe.contentWindow) {
        console.log('[demo-gateway] Message from demo:', event.data);
      }
    });
  </script>
</body>
</html>`;
}

/**
 * Safe URL resolution for demos
 * Validates and returns safe URL or error
 */
export async function resolveDemoUrl(
  productSlug: string,
  demoUrl: string | null
): Promise<{ safe: boolean; url: string; embeddable?: boolean; error?: string }> {
  if (!demoUrl) {
    return {
      safe: false,
      url: "",
      error: "No demo URL configured for this product",
    };
  }

  if (!validateDemoUrl(demoUrl)) {
    try {
      const url = new URL(demoUrl);
      return {
        safe: false,
        url: "",
        error: `Demo URL domain not in allowlist: ${url.hostname}`,
      };
    } catch {
      return {
        safe: false,
        url: "",
        error: "Invalid demo URL",
      };
    }
  }

  // Handle internal proxy endpoints
  if (demoUrl.startsWith('/api/proxy/demo/') || demoUrl.startsWith('/api/demo-proxy')) {
    return { safe: true, url: demoUrl, embeddable: true };
  }

  // Validate external URLs
  try {
    const url = new URL(demoUrl);
    if (url.protocol !== "https:") {
      return {
        safe: false,
        url: "",
        error: "Demo URLs must use HTTPS",
      };
    }

    const hostname = url.hostname.toLowerCase();
    const embeddable = !(hostname === "sl1nk.com" || hostname.endsWith(".sl1nk.com"));

    return { safe: true, url: demoUrl, embeddable };
  } catch (error) {
    return {
      safe: false,
      url: "",
      error: "Invalid demo URL format",
    };
  }
}
