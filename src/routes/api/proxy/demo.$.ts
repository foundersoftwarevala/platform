import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * Full Reverse Proxy for Demo Applications
 * 
 * This endpoint acts as a complete reverse proxy for demo applications,
 * enabling them to run through a Software Vala controlled URL while
 * maintaining full functionality (assets, APIs, routing, etc.).
 * 
 * Route: GET /api/proxy/demo/{slug}
 * Returns: Proxied content from the actual demo URL
 */

async function getOriginalDemo(slug: string): Promise<{ url: string; name: string } | null> {
  const env = typeof process !== "undefined" ? process.env : undefined;
  const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const supabaseUrl = viteEnv?.VITE_SUPABASE_URL ?? env?.SUPABASE_URL;
  const supabaseKey = viteEnv?.VITE_SUPABASE_PUBLISHABLE_KEY ?? viteEnv?.VITE_SUPABASE_ANON_KEY ?? env?.SUPABASE_PUBLISHABLE_KEY ?? env?.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
  const { data: product } = await supabase.from("marketplace_products").select("id, name").eq("slug", slug).eq("visible", true).maybeSingle();
  if (!product) return null;
  const { data: demo } = await supabase.from("product_demo_urls").select("url, demo_name").eq("product_id", product.id).eq("status", "active").order("sort_order").limit(1).maybeSingle();
  return demo?.url ? { url: demo.url, name: demo.demo_name || product.name } : null;
}

function shouldProxyRequest(pathname: string): boolean {
  // Proxy all requests under /api/proxy/demo/{slug}
  return pathname.startsWith('/api/proxy/demo/');
}

function extractDemoSlugFromPath(pathname: string): string {
  // Extract slug from paths like /api/proxy/demo/nepali-school-demo/assets/file.js
  const match = pathname.match(/^\/api\/proxy\/demo\/([^\/]+)/);
  return match?.[1] || '';
}

function extractAssetPath(pathname: string, slug: string): string {
  // Extract the rest of the path after /api/proxy/demo/{slug}
  // e.g., /api/proxy/demo/nepali-school-demo/assets/app.js → /assets/app.js
  const prefix = `/api/proxy/demo/${slug}`;
  if (pathname.startsWith(prefix)) {
    return pathname.slice(prefix.length) || '/';
  }
  return '/';
}

async function fetchFromOriginalDomain(demoUrl: string, path: string): Promise<Response | null> {
  try {
    let actualUrl = demoUrl;
    
    // If demoUrl is a shortlink (like sl1nk.com), follow redirects to get the actual URL
    if (demoUrl.includes('sl1nk.com') || demoUrl.includes('encurtador')) {
      try {
        const redirectResp = await fetch(demoUrl, {
          headers: {
            'User-Agent': 'Software Vala Demo Proxy/1.0',
          },
          redirect: 'follow',
        });
        actualUrl = redirectResp.url || demoUrl;
        console.log(`[demo-proxy] Resolved shortlink: ${demoUrl} → ${actualUrl}`);
      } catch (redirectError) {
        console.log(`[demo-proxy] Could not resolve shortlink, using as-is: ${demoUrl}`);
        actualUrl = demoUrl;
      }
    }
    
    // Parse the actual demo URL to get the base domain
    const url = new URL(actualUrl);
    const baseDomain = url.origin;
    
    // Construct the full URL for the asset request
    const assetUrl = baseDomain + path;
    console.log(`[demo-proxy] Fetching: ${assetUrl}`);
    
    const response = await fetch(assetUrl, {
      headers: {
        'User-Agent': 'Software Vala Demo Proxy/1.0',
      },
      redirect: 'follow',
    });

    return response;
  } catch (error) {
    console.error(`[demo-proxy] Error fetching asset:`, error);
    return null;
  }
}

function rewriteHtmlAssetUrls(html: string, slug: string, originalDomainOrigin: string): string {
  // Rewrite asset URLs to route through our proxy
  // IMPORTANT: Only rewrite URLs that are NOT already proxied
  
  let rewritten = html;
  
  // Rewrite relative asset paths (/path/to/file)
  // Match src="...", href="...", data-src="..." etc
  // But SKIP paths that are already proxied (/api/proxy/demo/...)
  rewritten = rewritten.replace(
    /((?:src|href|data-src)\s*=\s*)"(\/(?!api\/proxy\/demo)[^"]*)"(?=[^\w]|$)/g,
    `$1"/api/proxy/demo/${slug}$2"`
  );
  
  // Also handle single quotes
  rewritten = rewritten.replace(
    /((?:src|href|data-src)\s*=\s*)'(\/(?!api\/proxy\/demo)[^']*)'(?=[^\w]|$)/g,
    `$1'/api/proxy/demo/${slug}$2'`
  );
  
  return rewritten;
}

export const Route = createFileRoute('/api/proxy/demo/$')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const pathname = url.pathname;
          
          console.log(`[demo-proxy] >>> Incoming request: ${pathname}`);
          
          // Extract slug from URL path manually since route params don't work with catch-all
          const slug = extractDemoSlugFromPath(pathname);
          console.log(`[demo-proxy] >>> Extracted slug: ${slug}`);
          
          if (!slug) {
            console.log(`[demo-proxy] >>> No slug found, returning 400`);
            return new Response(
              JSON.stringify({ error: 'Invalid demo slug' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
          }
          
          // Get the original demo URL from catalog
          const originalDemo = await getOriginalDemo(slug);
          if (!originalDemo) {
            console.log(`[demo-proxy] >>> Demo not found for slug: ${slug}`);
            return new Response(
              JSON.stringify({ error: 'Demo not found', slug }),
              { status: 404, headers: { 'Content-Type': 'application/json' } }
            );
          }
          
          // Extract the asset path (everything after /api/proxy/demo/{slug})
          const assetPath = extractAssetPath(pathname, slug);
          
          const originalDemoUrl = originalDemo.url;
          console.log(`[demo-proxy] Proxying ${slug}: ${pathname} → ${originalDemoUrl}${assetPath}`);
          
          // Fetch from original domain
          const proxiedResponse = await fetchFromOriginalDomain(originalDemoUrl, assetPath);
          if (!proxiedResponse) {
            console.log(`[demo-proxy] >>> Fetch failed, returning 502`);
            return new Response(
              JSON.stringify({ error: 'Failed to fetch from original domain' }),
              { status: 502, headers: { 'Content-Type': 'application/json' } }
            );
          }
          
          console.log(`[demo-proxy] >>> Got response: status=${proxiedResponse.status}`);
          
          // If it's an HTML response, rewrite asset URLs
          const contentType = proxiedResponse.headers.get('content-type') || '';
          if (contentType.includes('text/html')) {
            console.log(`[demo-proxy] >>> Processing HTML response`);
            let html = await proxiedResponse.text();
            console.log(`[demo-proxy] >>> HTML length: ${html.length}`);
            
            // Rewrite asset URLs to go through our proxy
            html = rewriteHtmlAssetUrls(html, slug, new URL(originalDemoUrl).origin);
            
            // Strip Lovable branding if present
            html = html.replace(/powered by lovable/gi, '');
            html = html.replace(/Powered by Lovable/gi, '');
            html = html.replace(/Built on Lovable/gi, '');
            
            // Update title
            const demoName = originalDemo.name || 'Demo';
            html = html.replace(/<title>[^<]*<\/title>/i, `<title>Software Vala™ — ${demoName}</title>`);
            
            console.log(`[demo-proxy] >>> Returning HTML response`);
            
            return new Response(html, {
              status: 200,
              headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'X-Software-Vala': 'true',
                'X-Demo-Slug': slug,
                'X-Demo-Name': demoName,
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': 'SAMEORIGIN',
              },
            });
          }
          
          // For non-HTML responses (JS, CSS, images, etc.), just proxy through
          console.log(`[demo-proxy] >>> Processing non-HTML response (${contentType})`);
          let responseBuffer = await proxiedResponse.arrayBuffer();
          console.log(`[demo-proxy] >>> Buffer size: ${responseBuffer.byteLength}`);
          
          const responseHeaders = new Headers();
          
          // Copy relevant headers
          const headersToProxy = [
            'content-type',
            'cache-control',
            'expires',
            'etag',
            'last-modified',
            // Don't copy content-encoding since Lovable sends gzip and we want to avoid browser decompression issues
            'access-control-allow-origin',
          ];
          
          headersToProxy.forEach(header => {
            const value = proxiedResponse.headers.get(header);
            if (value) {
              responseHeaders.set(header, value);
            }
          });
          
          // Set correct content-length for uncompressed content
          responseHeaders.set('Content-Length', responseBuffer.byteLength.toString());
          
          // Add security headers
          responseHeaders.set('X-Content-Type-Options', 'nosniff');
          responseHeaders.set('X-Frame-Options', 'SAMEORIGIN');
          responseHeaders.set('X-Software-Vala', 'true');
          
          // Handle CORS for assets from different origins
          if (!responseHeaders.has('access-control-allow-origin')) {
            responseHeaders.set('Access-Control-Allow-Origin', '*');
          }
          responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
          
          console.log(`[demo-proxy] >>> Returning asset response`);
          
          // Return the proxied response
          return new Response(responseBuffer, {
            status: proxiedResponse.status,
            statusText: proxiedResponse.statusText,
            headers: responseHeaders,
          });
        } catch (error) {
          console.error('[demo-proxy] Unhandled error:', error);
          return new Response(
            JSON.stringify({ error: 'Internal server error', message: String(error) }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }
      },
    },
  },
});

