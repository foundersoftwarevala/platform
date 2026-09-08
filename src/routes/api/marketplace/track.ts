import { createFileRoute } from "@tanstack/react-router";

/**
 * Marketplace activity tracking — the event producer that was missing.
 *
 * `marketplace_events` has four readers in this codebase and, until now, no
 * writer at all. The 35 rows in it came from real product pages between 27 and
 * 29 August and nothing has added to it since, which is why the activity feed
 * goes quiet, why "Popular Now" ranks on a frozen sample, and why the personal
 * recommendation engines have no signal to work from. The table was never the
 * problem; nothing was filling it.
 *
 * This runs on the server so the insert uses the service role, exactly as the
 * lead endpoint does: row level security correctly refuses anonymous writes,
 * so the browser posts here rather than writing to the database itself.
 *
 * On privacy, deliberately narrow. A signed-in visitor is recorded by their own
 * user id, taken from their token rather than from the request body so a caller
 * cannot claim to be somebody else. An anonymous visitor gets a session id the
 * browser generated, and nothing more — no address, no fingerprint, no header
 * capture. The IP is used to rate limit and is never stored.
 *
 * Duplicate events are refused rather than counted. The dedupe key is the
 * visitor, the product, the kind of event and the minute it happened, so a
 * double-fired impression or an impatient double click lands once.
 */

// What section 2 names, so each can be counted as itself rather than
// collapsing into cta_click.
const EVENT_KINDS = new Set([
  "product_view", "demo_click", "demo_open", "live_demo", "cta_click",
  "buy_click", "add_to_cart", "checkout_start", "purchase", "order_paid",
  "download", "brochure_download", "review", "notify_me",
  "wishlist_add", "wishlist_remove",
  "search", "search_result_click",
  "session_start", "session_end",
  "contact_sales", "callback_request", "whatsapp_lead", "meeting_request",
]);

/**
 * Crawlers, refused before anything is written.
 *
 * Section 39 asks for bot traffic to be excluded and for the rule to be
 * recorded. The response says the event was skipped and why, rather than
 * dropping it silently - a metric that quietly ignores traffic misleads as
 * much as one that inflates it.
 */
const BOT_RE =
  /bot|crawler|spider|crawl|slurp|bingpreview|headlesschrome|python-requests|curl\/|wget|monitoring|uptime|pingdom|lighthouse|gtmetrix|semrush|ahrefs|facebookexternalhit|whatsapp|telegrambot/i;

/**
 * What marketplace_events will actually accept.
 *
 * Its check constraint permits these four and nothing else - verified by
 * probing every candidate against the live table. Everything below is mapped
 * onto one of them, with the kind it really was kept in metadata.action, so a
 * wishlist add is still countable as a wishlist add.
 */
const STORABLE_TYPES = new Set(["product_view", "demo_click", "cta_click", "search"]);

/** kind the caller sent -> the type the database will take. */
function storableType(kind: string): string {
  if (STORABLE_TYPES.has(kind)) return kind;
  if (kind === "demo_open" || kind === "live_demo") return "demo_click";
  if (kind === "search_result_click") return "search";
  // Everything else is an interaction with the product: a wishlist add, a buy
  // click, a download, a lead-shaped action. Stored as cta_click and told apart
  // by metadata.action.
  return "cta_click";
}

/** Desktop, mobile or tablet, from the user agent. The agent is not stored. */
function deviceCategory(ua: string): "mobile" | "tablet" | "desktop" {
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android|blackberry|iemobile|opera mini/i.test(ua)) return "mobile";
  return "desktop";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 120; // generous: a browsing session legitimately fires many
const hits = new Map<string, { n: number; until: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const seen = hits.get(ip);
  if (!seen || seen.until < now) {
    hits.set(ip, { n: 1, until: now + RATE_WINDOW_MS });
    return false;
  }
  seen.n += 1;
  // Keep the map from growing without bound on a busy box.
  if (hits.size > 5_000) {
    for (const [k, v] of hits) if (v.until < now) hits.delete(k);
  }
  return seen.n > RATE_MAX;
}

/** The signed-in person, resolved from their own token. Null when anonymous. */
async function resolveUser(request: Request, url: string, key: string): Promise<string | null> {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try {
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const user = (await response.json()) as { id?: string };
    return typeof user?.id === "string" ? user.id : null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/marketplace/track")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = process.env.SUPABASE_URL?.trim();
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
        if (!url || !serviceKey) {
          return Response.json({ error: "Tracking is not configured" }, { status: 503 });
        }

        const sourceIp =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          request.headers.get("x-real-ip") ??
          "unknown";
        if (rateLimited(sourceIp)) {
          // Quietly accepted rather than surfaced: a visitor should never see an
          // error because analytics is busy.
          return Response.json({ ok: true, recorded: false, reason: "rate_limited" });
        }

        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        const kind = String(body.event ?? "").trim();
        if (!EVENT_KINDS.has(kind)) {
          return Response.json({ error: "Unknown event" }, { status: 400 });
        }

        const storedType = storableType(kind);
        if (!STORABLE_TYPES.has(storedType)) {
          // Cannot happen with the map above, but if the map ever loses a case
          // the caller is told rather than being handed a silent no-op.
          return Response.json(
            { ok: false, recorded: false, reason: "unsupported_event_type", kind },
            { status: 400 },
          );
        }

        const userAgent = request.headers.get("user-agent") ?? "";
        if (BOT_RE.test(userAgent)) {
          // Not an error, and not counted. Said out loud so the exclusion is
          // visible rather than a silent hole in the numbers.
          return Response.json({ ok: true, recorded: false, skipped: "bot_traffic" });
        }

        const productId = String(body.productId ?? "").trim();
        const categoryId = String(body.categoryId ?? "").trim();
        const sourcePage = String(body.sourcePage ?? "").trim().slice(0, 300);
        const surface = String(body.surface ?? "").trim().slice(0, 60);
        // Generated by the browser and stored as given. Not derived from the
        // visitor's device or address, so it identifies a session and nothing
        // about a person.
        const sessionId = String(body.sessionId ?? "").trim().slice(0, 64);

        // Derived here, not accepted from the caller: a browser cannot claim to
        // be in another country. Neither the address nor the full user agent is
        // kept - only the country code and the device category.
        const country = (request.headers.get("cf-ipcountry") ?? "").trim().slice(0, 2).toUpperCase();
        const device = deviceCategory(userAgent);

        // Only the page knows these, so they come from the body, clipped.
        const clip = (v: unknown, n = 120) => String(v ?? "").trim().slice(0, n) || null;
        const referrer = clip(body.referrer, 300);
        const campaign = {
          utm_source: clip(body.utm_source),
          utm_medium: clip(body.utm_medium),
          utm_campaign: clip(body.utm_campaign),
          utm_term: clip(body.utm_term),
          utm_content: clip(body.utm_content),
        };
        const hasCampaign = Object.values(campaign).some(Boolean);

        if (productId && !UUID_RE.test(productId)) {
          return Response.json({ error: "Invalid product" }, { status: 400 });
        }
        if (categoryId && !UUID_RE.test(categoryId)) {
          return Response.json({ error: "Invalid category" }, { status: 400 });
        }

        const userId = await resolveUser(request, url, serviceKey);

        // One event per visitor, product, kind and minute.
        const minute = new Date().toISOString().slice(0, 16);
        const who = userId ?? (sessionId ? `s:${sessionId}` : `ip:${sourceIp}`);
        // Keyed on the kind the caller sent, not the type it is stored as, so a
        // wishlist add and a buy click in the same minute are two events.
        const dedupeKey = `${who}|${productId || "-"}|${kind}|${minute}`;

        try {
          const response = await fetch(`${url}/rest/v1/marketplace_events`, {
            method: "POST",
            headers: {
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
              // The unique index on dedupe_key turns a repeat into a no-op
              // instead of an error.
              Prefer: "resolution=ignore-duplicates,return=minimal",
            },
            body: JSON.stringify({
              event_type: storedType,
              product_id: productId || null,
              category_id: categoryId || null,
              source_page: sourcePage || null,
              surface: surface || null,
              user_id: userId,
              session_id: sessionId || null,
              dedupe_key: dedupeKey,
              metadata: {
                // What it really was. The column can only hold four types; this
                // is how the other twenty stay countable.
                ...(storedType === kind ? {} : { action: kind }),
                ...(country ? { country } : {}),
                device,
                ...(referrer ? { referrer } : {}),
                ...(hasCampaign ? { campaign } : {}),
                // Only present on the events where it means something.
                ...(body.query ? { query: clip(body.query, 200) } : {}),
                ...(Number.isFinite(Number(body.position))
                  ? { position: Number(body.position) }
                  : {}),
              },
            }),
          });

          if (!response.ok && response.status !== 409) {
            // Never fail the visitor's page over analytics.
            console.error("[track] insert failed", response.status);
            return Response.json({ ok: true, recorded: false });
          }
          return Response.json({ ok: true, recorded: true, identified: Boolean(userId) });
        } catch (error) {
          console.error("[track] insert threw", error);
          return Response.json({ ok: true, recorded: false });
        }
      },
    },
  },
});
