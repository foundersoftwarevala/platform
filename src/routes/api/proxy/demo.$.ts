import { createFileRoute } from "@tanstack/react-router";
import { DEMO_COOKIE, demoCookiePath, ticketFromRequest } from "@/lib/demo/ticket";
import { originalDemoForSession } from "@/lib/demo/sessions.server";
import { DEMO_BRAND } from "@/lib/demo/brand";
import { initialDemoPath } from "@/lib/demo/entry-path";
import {
  applySurfaceBranding,
  rewriteDemoAssetPaths,
  type PresentationRules,
} from "@/lib/demo/presentation";
import { safeFetchResponse } from "@/lib/demo/safe-fetch.server";
import { rateLimited } from "@/lib/server/rate-limit";

/**
 * Session-scoped proxy for Demo Applications
 *
 * This endpoint routes demo pages and assets through a visitor-specific path.
 * It changes only HTML asset URLs and surface branding; author scripts and
 * data responses are passed through unchanged.
 *
 * Route: GET /api/proxy/demo/{slug}/{visitor_session_id}
 * Returns: Proxied content from the actual demo URL
 */

type OriginalDemo = { url: string; name: string; rules: PresentationRules | null };

function unavailableResponse(): Response {
  const html =
    '<!doctype html><html data-demo-unavailable="true"><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Demo currently unavailable</title><body style="margin:0;background:#020617;color:#e2e8f0;' +
    'font:16px system-ui;display:grid;min-height:100vh;place-items:center">' +
    '<main style="max-width:32rem;padding:2rem;text-align:center"><h1>Demo currently unavailable</h1>' +
    "<p>The demo provider is not responding. Please try again later.</p></main></body></html>";
  return new Response(html, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "frame-ancestors https://softwarevala.net",
    },
  });
}

async function getOriginalDemo(
  slug: string,
  sessionId: string,
  demoId: string,
  categoryId: string,
): Promise<OriginalDemo | null> {
  const demo = await originalDemoForSession(sessionId, slug, demoId, categoryId);
  return demo ? { ...demo, rules: null } : null;
}

function shouldProxyRequest(pathname: string): boolean {
  // Proxy all requests under /api/proxy/demo/{slug}
  return pathname.startsWith("/api/proxy/demo/");
}

function extractDemoSlugFromPath(pathname: string): string {
  // Extract slug from paths like /api/proxy/demo/nepali-school-demo/assets/file.js
  const match = pathname.match(/^\/api\/proxy\/demo\/([^/]+)/);
  return match?.[1] || "";
}

function extractAssetPath(pathname: string, slug: string, sessionId: string): string {
  if (!sessionId) return "/";
  const prefix = `/api/proxy/demo/${slug}/${sessionId}`;
  if (!pathname.startsWith(`${prefix}/`) && pathname !== prefix) return "/";
  return pathname.slice(prefix.length) || "/";
}

function extractDemoSessionIdFromPath(pathname: string): string {
  return pathname.match(/^\/api\/proxy\/demo\/[^/]+\/([0-9a-f-]{36})(?:\/|$)/i)?.[1] ?? "";
}

/**
 * GET an address, following redirects by hand so that every hop is checked.
 *
 * `redirect: "follow"` let the demo's host (or a shortlink) answer with a
 * redirect to a private address - 169.254.169.254, localhost, the database -
 * and the proxy fetched it and handed the body back. Each hop now has to be a
 * public http(s) address on a standard port, the same rules the Demo Manager
 * applies when an address is taken in (safe-fetch.server.ts).
 */
async function fetchPublic(
  raw: string,
  maxRedirects = 5,
): Promise<{ response: Response; url: string } | null> {
  try {
    return await safeFetchResponse(raw, {
      maxBytes: 12_000_000,
      timeoutMs: 15_000,
      maxRedirects,
    });
  } catch (error) {
    console.error(`[demo-proxy] refused ${raw}:`, error);
    return null;
  }
}

async function fetchFromOriginalDomain(
  demoUrl: string,
  path: string,
  incomingSearch: URLSearchParams,
  sessionId: string,
): Promise<Response | null> {
  try {
    let actualUrl = demoUrl;

    // If demoUrl is a shortlink (like sl1nk.com), follow redirects to get the actual URL
    if (demoUrl.includes("sl1nk.com") || demoUrl.includes("encurtador")) {
      try {
        // Every hop checked: a shortlink that points at a private address is
        // refused rather than followed there.
        const resolved = await fetchPublic(demoUrl);
        if (!resolved) return null;
        actualUrl = resolved.url;
        console.log(`[demo-proxy] Resolved shortlink: ${demoUrl} → ${actualUrl}`);
      } catch (redirectError) {
        console.log(`[demo-proxy] Could not resolve shortlink, using as-is: ${demoUrl}`);
        actualUrl = demoUrl;
      }
    }

    // Parse the actual demo URL to get the base domain
    const url = new URL(actualUrl);
    const baseDomain = url.origin;

    // The demo's own page is its full address (it may live under a path such
    // as /demo); everything the page loads is asked of its host. A host that
    // resolves to a private network is never fetched.
    // fetchPublic checks the host, and every host a redirect points at.
    const upstream = new URL(path === "/" ? actualUrl : baseDomain + path);
    for (const [key, value] of incomingSearch) {
      if (key !== "t" && key !== "visitor_session_id") upstream.searchParams.append(key, value);
    }
    upstream.searchParams.set("sv_session_id", sessionId);
    const assetUrl = upstream.toString();
    console.log(`[demo-proxy] Fetching: ${upstream.origin}${upstream.pathname}`);

    const fetched = await fetchPublic(assetUrl);
    return fetched ? fetched.response : null;
  } catch (error) {
    console.error(`[demo-proxy] Error fetching asset:`, error);
    return null;
  }
}

function rewriteHtmlAssetUrls(html: string, prefix: string): string {
  // Rewrite asset URLs to route through our proxy
  // IMPORTANT: Only rewrite URLs that are NOT already proxied

  let rewritten = html;

  // Rewrite relative asset paths (/path/to/file)
  // Match src="...", href="...", data-src="..." etc
  // But SKIP paths that are already proxied (/api/proxy/demo/...)
  rewritten = rewritten.replace(
    /((?:src|href|data-src)\s*=\s*)"(\/(?!api\/proxy\/demo)[^"]*)"(?=[^\w]|$)/g,
    `$1"${prefix}$2"`,
  );

  // Also handle single quotes
  rewritten = rewritten.replace(
    /((?:src|href|data-src)\s*=\s*)'(\/(?!api\/proxy\/demo)[^']*)'(?=[^\w]|$)/g,
    `$1'${prefix}$2'`,
  );

  return rewritten;
}

export const Route = createFileRoute("/api/proxy/demo/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const limited = await rateLimited(request, "demoProxy");
        if (limited) return limited;
        try {
          const url = new URL(request.url);
          const pathname = url.pathname;

          console.log(`[demo-proxy] >>> Incoming request: ${pathname}`);

          // Extract slug from URL path manually since route params don't work with catch-all
          const slug = extractDemoSlugFromPath(pathname);
          console.log(`[demo-proxy] >>> Extracted slug: ${slug}`);

          if (!slug) {
            console.log(`[demo-proxy] >>> No slug found, returning 400`);
            return new Response(JSON.stringify({ error: "Invalid demo slug" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const sessionId = extractDemoSessionIdFromPath(pathname);
          const pass = ticketFromRequest(request, slug, sessionId);
          if (!pass) {
            return new Response(
              JSON.stringify({ error: "This demo session is invalid or has expired." }),
              {
                status: 401,
                headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
              },
            );
          }
          const passFromQuery = url.searchParams.get("t");

          const originalDemo = await getOriginalDemo(slug, sessionId, pass.demoId, pass.categoryId);
          if (!originalDemo) {
            console.log(`[demo-proxy] >>> Demo not found for slug: ${slug}`);
            return new Response(JSON.stringify({ error: "Demo not found", slug }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Extract the asset path after the product and session scope.
          const assetPath = extractAssetPath(pathname, slug, sessionId);
          const entryPath = initialDemoPath(slug, assetPath, url.searchParams.has("t"));
          if (entryPath) {
            return Response.redirect(
              new URL(`/api/proxy/demo/${slug}/${sessionId}${entryPath}${url.search}`, url),
              307,
            );
          }

          const originalDemoUrl = originalDemo.url;
          console.log(
            `[demo-proxy] Proxying ${slug}: ${pathname} → ${originalDemoUrl}${assetPath}`,
          );

          // Fetch from original domain
          const proxiedResponse = await fetchFromOriginalDomain(
            originalDemoUrl,
            assetPath,
            url.searchParams,
            sessionId,
          );
          if (!proxiedResponse) {
            console.log(`[demo-proxy] >>> Fetch failed, returning 502`);
            return unavailableResponse();
          }

          console.log(`[demo-proxy] >>> Got response: status=${proxiedResponse.status}`);
          if (proxiedResponse.status === 404 || proxiedResponse.status >= 500) {
            return unavailableResponse();
          }

          // If it's an HTML response, rewrite asset URLs
          const contentType = proxiedResponse.headers.get("content-type") || "";
          if (contentType.includes("text/html")) {
            console.log(`[demo-proxy] >>> Processing HTML response`);
            let html = await proxiedResponse.text();
            console.log(`[demo-proxy] >>> HTML length: ${html.length}`);

            const proxyPrefix = `/api/proxy/demo/${slug}/${sessionId}`;
            html = rewriteHtmlAssetUrls(html, proxyPrefix);
            const rules = originalDemo.rules ?? {
              remove: [],
              rebrand: [],
              logos: [],
              links: [],
            };
            const logoPaths = rules.logos.flatMap((logo) =>
              logo.startsWith("/") ? [logo, `${proxyPrefix}${logo}`] : [logo],
            );
            html = applySurfaceBranding(html, { ...rules, logos: logoPaths }, DEMO_BRAND);

            // Update title
            const demoName = originalDemo.name || "Demo";
            html = html.replace(
              /<title>[^<]*<\/title>/i,
              `<title>Software Vala™ — ${demoName}</title>`,
            );

            console.log(`[demo-proxy] >>> Returning HTML response`);

            const htmlHeaders = new Headers({
              "Content-Type": "text/html; charset=utf-8",
              "X-Software-Vala": "true",
              "X-Demo-Slug": slug,
              // Fetch Headers only accepts ByteString values; product names may contain Unicode.
              "X-Demo-Name": encodeURIComponent(demoName),
              "X-Content-Type-Options": "nosniff",
              "Content-Security-Policy": "frame-ancestors https://softwarevala.net",
            });

            // The path includes this session ID, so concurrent tabs cannot
            // overwrite one another's proxy pass cookie.
            if (passFromQuery) {
              const remaining = Math.max(0, Math.floor((pass.expiresAt - Date.now()) / 1000));
              htmlHeaders.append(
                "Set-Cookie",
                `${DEMO_COOKIE}=${encodeURIComponent(passFromQuery)}; Path=${demoCookiePath(slug, sessionId)}; ` +
                  `Max-Age=${remaining}; HttpOnly; SameSite=Lax; Secure`,
              );
            }

            return new Response(html, { status: 200, headers: htmlHeaders });
          }

          // Do not inspect or rewrite author JavaScript/data responses.
          console.log(`[demo-proxy] >>> Processing non-HTML response (${contentType})`);
          let responseBuffer = await proxiedResponse.arrayBuffer();

          if (/css/i.test(contentType)) {
            const css = new TextDecoder().decode(responseBuffer);
            responseBuffer = new TextEncoder().encode(
              rewriteDemoAssetPaths(css, `/api/proxy/demo/${slug}/${sessionId}`),
            ).buffer as ArrayBuffer;
          }
          console.log(`[demo-proxy] >>> Buffer size: ${responseBuffer.byteLength}`);

          const responseHeaders = new Headers();

          // Copy relevant headers
          const headersToProxy = [
            "content-type",
            "cache-control",
            "expires",
            "etag",
            "last-modified",
            // Don't copy content-encoding since Lovable sends gzip and we want to avoid browser decompression issues
            "access-control-allow-origin",
          ];

          headersToProxy.forEach((header) => {
            const value = proxiedResponse.headers.get(header);
            if (value) {
              responseHeaders.set(header, value);
            }
          });

          if (/css/i.test(contentType)) {
            responseHeaders.set("Cache-Control", "private, no-store");
            responseHeaders.delete("etag");
            responseHeaders.delete("last-modified");
          }

          // Set correct content-length for uncompressed content
          responseHeaders.set("Content-Length", responseBuffer.byteLength.toString());

          // Add security headers
          responseHeaders.set("X-Content-Type-Options", "nosniff");
          responseHeaders.set("X-Frame-Options", "SAMEORIGIN");
          responseHeaders.set("X-Software-Vala", "true");

          // Handle CORS for assets from different origins
          if (!responseHeaders.has("access-control-allow-origin")) {
            responseHeaders.set("Access-Control-Allow-Origin", "*");
          }
          responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");

          console.log(`[demo-proxy] >>> Returning asset response`);

          // Return the proxied response
          return new Response(responseBuffer, {
            status: proxiedResponse.status,
            statusText: proxiedResponse.statusText,
            headers: responseHeaders,
          });
        } catch (error) {
          console.error("[demo-proxy] Unhandled error:", error);
          return new Response(JSON.stringify({ error: "Internal server error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
