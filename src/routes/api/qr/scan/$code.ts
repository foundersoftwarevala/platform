import { createFileRoute } from "@tanstack/react-router";

/**
 * Somebody scanned an influencer's QR.
 *
 * This is what the printed code actually encodes. It could have encoded the
 * product page directly, and then a scan would be indistinguishable from a
 * click - the influencer would never know whether the poster worked. So the QR
 * comes back through here first: the scan is recorded, and the scanner is sent
 * on to the product page carrying the influencer's referral parameter, where
 * /api/track/ref records the visit and sets the attribution cookie exactly as it
 * does for a shared link.
 *
 * What is stored is traffic, not a person: a coarse country from Cloudflare, a
 * device class, a browser family, and a one-way hash that cannot be reversed
 * into an address. product_qr_events carries its own purge date.
 *
 * A code that does not exist, or has been switched off, sends the visitor to
 * the marketplace rather than showing them an error. They scanned something in
 * the real world; a dead end is the platform's problem, not theirs.
 *
 *   GET /api/qr/scan/{code}
 */

function url(): string {
  return (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
}

function admin(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

function siteUrl(): string {
  return (process.env.SV_SITE?.trim() ?? "https://softwarevala.net").replace(/\/+$/, "");
}

/** A device class from the user agent. Never the agent string itself. */
function deviceOf(agent: string): string {
  if (/ipad|tablet/i.test(agent)) return "tablet";
  if (/mobi|android|iphone/i.test(agent)) return "mobile";
  if (!agent) return "unknown";
  return "desktop";
}

/** The browser family, for the same reason. */
function browserOf(agent: string): string {
  if (/edg\//i.test(agent)) return "Edge";
  if (/chrome|crios/i.test(agent)) return "Chrome";
  if (/firefox|fxios/i.test(agent)) return "Firefox";
  if (/safari/i.test(agent)) return "Safari";
  return "other";
}

/**
 * A visitor hash that identifies a repeat scan without identifying a person.
 * One way, salted per day, so it cannot be joined back to anything tomorrow.
 */
async function visitorHash(request: Request): Promise<string> {
  const parts = [
    request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "",
    request.headers.get("user-agent") ?? "",
    new Date().toISOString().slice(0, 10),
  ].join("|");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(parts));
  return Array.from(new Uint8Array(digest).slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const Route = createFileRoute("/api/qr/scan/$code")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const code = String((params as { code?: string }).code ?? "").trim();
        const fallback = Response.redirect(`${siteUrl()}/marketplace`, 302);

        if (!code || !/^[A-Za-z0-9]{4,24}$/.test(code)) return fallback;
        if (!url()) return fallback;

        const agent = request.headers.get("user-agent") ?? "";
        try {
          const response = await fetch(`${url()}/rest/v1/rpc/product_qr_register_scan`, {
            method: "POST",
            headers: admin(),
            body: JSON.stringify({
              p_code: code,
              p_country: request.headers.get("cf-ipcountry"),
              p_device: deviceOf(agent),
              p_browser: browserOf(agent),
              p_visitor_hash: await visitorHash(request),
              p_campaign: new URL(request.url).searchParams.get("c"),
            }),
          });
          if (!response.ok) return fallback;

          const result = (await response.json()) as { ok?: boolean; destination?: string };
          if (!result?.ok || !result.destination) return fallback;

          // Relative by construction, from the product's own slug and the
          // influencer's code, so this can never be pointed off-site.
          const destination = result.destination.startsWith("/")
            ? `${siteUrl()}${result.destination}`
            : `${siteUrl()}/marketplace`;

          return new Response(null, {
            status: 302,
            headers: {
              Location: destination,
              // A scan is a real-world event and must not be served from a
              // cache, or the second person to scan the same poster is never
              // counted.
              "Cache-Control": "no-store, no-cache, must-revalidate",
            },
          });
        } catch (error) {
          console.error("[qr/scan] could not record the scan", error);
          return fallback;
        }
      },
    },
  },
});
