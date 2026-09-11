import { createFileRoute } from "@tanstack/react-router";
import { publicProductFilter } from "@/lib/marketplace/public-visibility";

/**
 * Genuine marketplace activity for the home page.
 *
 * Every row returned here comes from `marketplace_events`, which the storefront
 * writes as visitors browse, open demos and buy. Nothing is invented: if there
 * has been no activity the list simply comes back empty and the caller shows a
 * quiet state rather than a fabricated stream.
 *
 * Product names are resolved from `marketplace_products`. No customer name,
 * email or address is ever exposed — only the event kind, the product and when
 * it happened.
 */

const CACHE_MS = 20_000;
// Keyed by the limit asked for. One shared entry meant whichever caller came
// first decided how many events every other caller got for the next 20 s.
const cache = new Map<number, { at: number; payload: unknown }>();

/** Event kinds the storefront records, mapped to plain language. */
const LABELS: Record<string, string> = {
  product_view: "viewed",
  demo_click: "opened the demo for",
  demo_open: "opened the demo for",
  add_to_cart: "added to cart",
  checkout_start: "started checkout for",
  purchase: "purchased",
  order_paid: "purchased",
  download: "downloaded",
  review: "reviewed",
  notify_me: "asked to be notified about",
  // The tracker stores every interaction that is not a view, a demo or a search
  // as cta_click and keeps what it really was in metadata.action, so these are
  // read from there. Falling back to "viewed" made a buy click read as a view.
  buy_click: "started buying",
  wishlist_add: "saved",
  contact_sales: "asked about",
  callback_request: "requested a call about",
  whatsapp_lead: "asked on WhatsApp about",
  meeting_request: "booked a meeting about",
  brochure_download: "downloaded the brochure for",
  cta_click: "showed interest in",
};

function admin() {
  return {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`,
  };
}

export const Route = createFileRoute("/api/marketplace/activity")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = process.env.SUPABASE_URL?.trim();
        if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
          return Response.json({ events: [], reason: "not_configured" });
        }

        const limit = Math.min(
          Math.max(Number(new URL(request.url).searchParams.get("limit") ?? 12) || 12, 1),
          40,
        );

        const cached = cache.get(limit);
        if (cached && Date.now() - cached.at < CACHE_MS) {
          return Response.json(cached.payload, {
            headers: { "Cache-Control": "public, max-age=20" },
          });
        }

        try {
          const response = await fetch(
            `${url}/rest/v1/marketplace_events` +
              `?select=id,event_type,product_id,created_at,metadata` +
              // Searches and removals are not activity a visitor would call a
              // purchase signal; they stay out of the public feed.
              `&event_type=in.(product_view,demo_click,cta_click)` +
              `&order=created_at.desc&limit=${limit}`,
            { headers: admin() },
          );
          if (!response.ok) {
            console.error("[activity] read failed", response.status);
            return Response.json({ events: [], reason: "unavailable" });
          }

          const rows = (await response.json()) as {
            id: string;
            event_type: string;
            product_id: string | null;
            created_at: string;
            metadata: { action?: string } | null;
          }[];

          // Resolve the product names in one request rather than one per row.
          const ids = Array.from(
            new Set(rows.map((r) => r.product_id).filter(Boolean) as string[]),
          );
          const names = new Map<string, string>();
          if (ids.length) {
            const productResponse = await fetch(
              // Only products the public may see. This read runs on the service
              // key, so without the rule a hidden or unpublished product's name
              // could reach the public feed.
              `${url}/rest/v1/marketplace_products?select=id,name&id=in.(${ids.join(",")})` +
                publicProductFilter(),
              { headers: admin() },
            );
            if (productResponse.ok) {
              for (const p of (await productResponse.json()) as { id: string; name: string }[]) {
                names.set(p.id, p.name);
              }
            }
          }

          const events = rows
            .filter((row) => row.metadata?.action !== "wishlist_remove")
            .map((row) => ({
              id: row.id,
              kind: row.metadata?.action || row.event_type,
              label:
                LABELS[row.metadata?.action ?? ""] ?? LABELS[row.event_type] ?? "viewed",
              product: row.product_id ? (names.get(row.product_id) ?? null) : null,
              at: row.created_at,
            }))
            .filter((e) => e.product);

          const payload = { events, total: events.length };
          cache.set(limit, { at: Date.now(), payload });
          return Response.json(payload, {
            headers: { "Cache-Control": "public, max-age=20" },
          });
        } catch (error) {
          console.error("[activity] threw", error);
          return Response.json({ events: [], reason: "unavailable" });
        }
      },
    },
  },
});
