import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { siteUrl } from "./lib/seo/site-url";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

/**
 * The origins a browser may call server functions from.
 *
 * Left to its defaults the CSRF check compares Origin with the request's own
 * URL, and that URL is built from the Host header nginx forwards over plain
 * http - so it trusted whichever host the request claimed to be for. It is now
 * pinned to the configured site (SITE_URL / APP_BASE_URL, the address the
 * canonical URLs and sitemap already use), over https and over http because
 * nginx terminates TLS, with and without www.
 *
 * This is still not authentication: a script can send any Origin and
 * Sec-Fetch-Site it likes. It only stops another website's page from driving a
 * signed-in browser. Every server function that matters checks its caller
 * itself (src/lib/auth/caller-roles.ts, requireSupabaseAuth, mm_is_operator).
 *
 * Built lazily: this module is also evaluated in the browser, where process.env
 * does not exist.
 */
let trustedOrigins: Set<string> | null = null;

function configuredOrigins(): Set<string> {
  if (trustedOrigins) return trustedOrigins;
  const origins = new Set<string>();
  for (const raw of [siteUrl(), process.env.SITE_URL, process.env.APP_BASE_URL]) {
    const value = raw?.trim();
    if (!value) continue;
    let host: string;
    try {
      host = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).host.toLowerCase();
    } catch {
      continue;
    }
    const bare = host.replace(/^www\./, "");
    for (const name of [bare, `www.${bare}`]) {
      origins.add(`https://${name}`);
      origins.add(`http://${name}`);
    }
  }
  trustedOrigins = origins;
  return origins;
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Whether a browser on `origin` may call a server function on this request.
 * The configured site always may. A loopback origin may only when the request
 * itself arrived on that same loopback address - local development on
 * http://localhost:3000, or an operator looking at the VPS through a tunnel.
 */
function isTrustedOrigin(origin: string, request: Request): boolean {
  if (configuredOrigins().has(origin.toLowerCase())) return true;
  try {
    const from = new URL(origin);
    return LOOPBACK.has(from.hostname) && from.origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
  // Browsers that send Origin (and the Referer fallback) must name the site.
  origin: (value, ctx) => isTrustedOrigin(value, ctx.request),
  // Modern browsers send Sec-Fetch-Site, and the library then decides on it
  // alone. It must still say same-origin, and when an Origin header travels
  // with it (every POST from a browser) that Origin must be the site as well.
  secFetchSite: (value, ctx) => {
    if (value !== "same-origin") return false;
    const origin = ctx.request.headers.get("Origin");
    return origin === null || isTrustedOrigin(origin, ctx.request);
  },
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
