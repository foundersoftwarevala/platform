import { createFileRoute } from "@tanstack/react-router";
import { SUPPLIED_DEMOS_16 } from "@/lib/supplied-demos-catalog";

/**
 * Demo proxy API - simpler endpoint using query parameters
 * GET /api/demo-proxy?slug=demo-slug&path=/asset/path
 */

async function fetchFromOriginalDomain(demoUrl: string, path: string): Promise<Response | null> {
  try {
    let actualUrl = demoUrl;
    
    // If demoUrl is a shortlink, resolve it
    if (demoUrl.includes('sl1nk.com') || demoUrl.includes('encurtador')) {
      try {
        const redirectResp = await fetch(demoUrl, {
          headers: { 'User-Agent': 'Software Vala Demo Proxy/1.0' },
          redirect: 'follow',
        });
        actualUrl = redirectResp.url || demoUrl;
      } catch (e) {
        actualUrl = demoUrl;
      }
    }
    
    const url = new URL(actualUrl);
    const assetUrl = url.origin + path;
    
    const response = await fetch(assetUrl, {
      headers: { 'User-Agent': 'Software Vala Demo Proxy/1.0' },
      redirect: 'follow',
    });
    
    return response;
  } catch (error) {
    console.error('[demo-proxy-api] Error fetching:', error);
    return null;
  }
}

export const Route = createFileRoute('/proxy/demo/')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const slug = url.searchParams.get('slug');
          const path = url.searchParams.get('path') || '/';
          
          console.log(`[demo-proxy-api] Request: slug=${slug}, path=${path}`);
          
          if (!slug) {
            return new Response(JSON.stringify({ error: 'slug required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          
          const demo = SUPPLIED_DEMOS_16.find(d => d.slug === slug);
          if (!demo) {
            console.log(`[demo-proxy-api] Demo not found: ${slug}`);
            return new Response(JSON.stringify({ error: 'demo not found' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          
          console.log(`[demo-proxy-api] Demo found: ${demo.name}`);
          
          const response = await fetchFromOriginalDomain(demo.demoUrl, path);
          if (!response) {
            console.log(`[demo-proxy-api] Fetch failed`);
            return new Response(JSON.stringify({ error: 'fetch failed' }), {
              status: 502,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          
          const contentType = response.headers.get('content-type') || '';
          console.log(`[demo-proxy-api] Response content-type: ${contentType}`);
          
          if (contentType.includes('text/html')) {
            console.log(`[demo-proxy-api] Processing HTML response`);
            let html = await response.text();
            console.log(`[demo-proxy-api] HTML size: ${html.length} bytes`);
            
            // Rewrite asset URLs in the initial HTML
            html = html.replace(
              /((?:src|href|data-src)\s*=\s*)"(\/(?!api\/demo-proxy)[^"]*)"(?=[^\w]|$)/g,
              `$1"/api/demo-proxy?slug=${slug}&path=$2"`
            );
            html = html.replace(
              /((?:src|href|data-src)\s*=\s*)'(\/(?!api\/demo-proxy)[^']*)'(?=[^\w]|$)/g,
              `$1'/api/demo-proxy?slug=${slug}&path=$2'`
            );
            
            // Inject a script to intercept dynamic requests and rewrite relative URLs
            const rewriteScript = `
              <script>
              (function() {
                const demoSlug = "${slug}";
                
                // Intercept fetch calls
                const originalFetch = window.fetch;
                window.fetch = function(...args) {
                  let url = args[0];
                  if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('/api/demo-proxy')) {
                    args[0] = '/api/demo-proxy?slug=' + demoSlug + '&path=' + url;
                    console.log('[demo-proxy-interceptor] Rewriting fetch:', url, '→', args[0]);
                  }
                  return originalFetch.apply(this, args);
                };
                
                // Intercept import() calls
                const originalImport = window.import || null;
                if (originalImport) {
                  window.import = function(url) {
                    if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('/api/demo-proxy')) {
                      const rewrittenUrl = '/api/demo-proxy?slug=' + demoSlug + '&path=' + url;
                      console.log('[demo-proxy-interceptor] Rewriting import:', url, '→', rewrittenUrl);
                      return originalImport.call(this, rewrittenUrl);
                    }
                    return originalImport.call(this, url);
                  };
                }
              })();
              </script>
            `;
            
            // Insert the interception script right after the opening head tag
            html = html.replace(/<head[^>]*>/i, (match) => {
              return match + rewriteScript;
            });
            
            // Strip Lovable branding
            html = html.replace(/powered by lovable/gi, '');
            html = html.replace(/Powered by Lovable/gi, '');
            html = html.replace(/Built on Lovable/gi, '');
            
            // Update title
            const demoName = demo.name || 'Demo';
            html = html.replace(/<title>[^<]*<\/title>/i, `<title>Software Vala™ — ${demoName}</title>`);
            
            return new Response(html, {
              status: 200,
              headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'X-Software-Vala': 'true',
                'X-Demo-Name': demoName,
              },
            });
          }
          
          // Non-HTML response - just proxy through
          console.log(`[demo-proxy-api] Processing asset response`);
          const buffer = await response.arrayBuffer();
          console.log(`[demo-proxy-api] Buffer size: ${buffer.byteLength} bytes`);
          
          const headers = new Headers();
          
          // Copy relevant headers
          ['content-type', 'cache-control', 'expires', 'etag', 'last-modified'].forEach(h => {
            const v = response.headers.get(h);
            if (v) headers.set(h, v);
          });
          
          headers.set('Content-Length', buffer.byteLength.toString());
          headers.set('Access-Control-Allow-Origin', '*');
          headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
          
          return new Response(buffer, {
            status: response.status,
            statusText: response.statusText,
            headers,
          });
        } catch (error) {
          console.error('[demo-proxy-api] Unhandled error:', error);
          return new Response(JSON.stringify({ error: 'server error', message: String(error) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      },
    },
  },
});
