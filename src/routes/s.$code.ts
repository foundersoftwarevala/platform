import { createFileRoute } from "@tanstack/react-router";

import { createHash } from "node:crypto";

/**
 * The short link resolver.
 *
 * This is what makes a short link real rather than a string in a table: it
 * resolves, it redirects, and it records the click. No vanity domain is
 * configured, so short links live at /s/{code} on this site — which works today
 * and needs nothing bought or delegated.
 *
 * The destination is never taken from the request. It is read from the
 * product's own canonical URL row inside the database function, which is the
 * only way to guarantee section 36's "no open redirect": a caller cannot supply
 * a destination because there is no parameter to supply one through.
 *
 * Visibility is honoured, so a suspended or deleted product does not redirect —
 * it answers 404 or 410 as the case may be.
 *
 * GET /s/{code}
 */

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

/**
 * A daily-rotating hash of the caller, so a repeat visitor can be counted once
 * without their address ever being stored. The salt changes every day, which
 * means the hash cannot be used to follow anybody across days.
 */
function visitorHash(request: Request): string | null {
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  if (!ip) return null;
  const day = new Date().toISOString().slice(0, 10);
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 16) ?? "sv";
  return createHash("sha256")
    .update(`${ip}|${request.headers.get("user-agent") ?? ""}|${day}|${salt}`)
    .digest("hex")
    .slice(0, 32);
}

/** Broad categories only. Nothing here identifies a person. */
function device(ua: string): string {
  if (/bot|crawler|spider|slurp|bingpreview/i.test(ua)) return "bot";
  if (/ipad|tablet|playbook|silk/i.test(ua)) return "tablet";
  if (/mobile|iphone|android.*mobile|windows phone/i.test(ua)) return "mobile";
  if (ua) return "desktop";
  return "unknown";
}

function browser(ua: string): string {
  if (/edg\//i.test(ua)) return "edge";
  if (/opr\//i.test(ua)) return "opera";
  if (/chrome\//i.test(ua) && !/chromium/i.test(ua)) return "chrome";
  if (/safari\//i.test(ua) && !/chrome/i.test(ua)) return "safari";
  if (/firefox\//i.test(ua)) return "firefox";
  return "other";
}

const GONE = (title: string, detail: string, status: number) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><title>${title}</title>` +
      `<style>body{font:16px/1.6 system-ui;margin:8vh auto;max-width:34rem;padding:0 1.25rem;color:#111}` +
      `a{color:#0a7}</style><h1>${title}</h1><p>${detail}</p>` +
      `<p><a href="/marketplace">Browse the marketplace</a></p>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex" } },
  );

export const Route = createFileRoute("/s/$code")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const code = String((params as { code?: string }).code ?? "").trim();
        if (!code || !/^[A-Za-z0-9]{4,24}$/.test(code)) {
          return GONE("Link not found", "That short link is not valid.", 404);
        }
        if (!url()) {
          return GONE("Temporarily unavailable", "Please try again shortly.", 503);
        }

        const ua = request.headers.get("user-agent") ?? "";
        const incoming = new URL(request.url);
        // A scan arrives through the same URL as a click, distinguished only
        // by the marker the printed code carries. Recorded in addition to the
        // click, never instead of it, and it cannot change the destination.
        const qrCode = (incoming.searchParams.get("qr") ?? "").slice(0, 64);

        const utm: Record<string, string> = {};
        for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
          const v = incoming.searchParams.get(key);
          if (v) utm[key] = v.slice(0, 120);
        }

        let result: {
          ok?: boolean; status?: number; destination?: string; reason?: string; detail?: string;
        };
        try {
          const res = await fetch(`${url()}/rest/v1/rpc/mm_short_link_resolve`, {
            method: "POST",
            headers: admin(),
            body: JSON.stringify({
              p_code: code,
              p_referrer: request.headers.get("referer"),
              // Cloudflare puts the country here. No address is passed on.
              p_country: request.headers.get("cf-ipcountry"),
              p_device: device(ua),
              p_browser: browser(ua),
              p_visitor_hash: visitorHash(request),
              p_utm: utm,
            }),
          });
          if (!res.ok) {
            return GONE("Temporarily unavailable", "Please try again shortly.", 503);
          }
          result = (await res.json()) as typeof result;
        } catch {
          return GONE("Temporarily unavailable", "Please try again shortly.", 503);
        }

        // Counted only once the link itself resolved, so a scan is never
        // recorded for a code that went nowhere. A failure here is swallowed:
        // section 40 says analytics must not stop a working link from working.
        if (result.ok && qrCode) {
          void fetch(`${url()}/rest/v1/rpc/mm_qr_scan`, {
            method: "POST",
            headers: admin(),
            body: JSON.stringify({
              p_qr_code: qrCode,
              p_country: request.headers.get("cf-ipcountry"),
              p_device: device(ua),
              p_browser: browser(ua),
              p_visitor_hash: visitorHash(request),
              p_campaign: utm.utm_campaign ?? null,
            }),
          }).catch(() => undefined);
        }

        if (result.ok && result.destination) {
          // The campaign parameters travel to the destination for the site's own
          // analytics, but they were never part of the canonical URL.
          const target = new URL(result.destination);
          for (const [k, v] of Object.entries(utm)) target.searchParams.set(k, v);
          return new Response(null, {
            status: 302,
            headers: {
              location: target.toString(),
              "cache-control": "no-store",
              "x-robots-tag": "noindex",
            },
          });
        }

        if (result.status === 410) {
          return GONE(
            "This link has expired",
            "The product it pointed to is no longer available on the marketplace.",
            410,
          );
        }
        if (result.reason === "product_unavailable") {
          return GONE(
            "Not available",
            "This product is not publicly available at the moment.",
            404,
          );
        }
        return GONE("Link not found", "That short link does not exist.", 404);
      },
    },
  },
});
