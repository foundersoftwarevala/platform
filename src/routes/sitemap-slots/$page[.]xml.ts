import { createFileRoute } from "@tanstack/react-router";
import { absoluteUrl, indexable } from "@/lib/seo/site-url";

/**
 * One page of card slot URLs.
 *
 * A slot is the canonical address of a card: one category in one country. Only
 * an occupied slot appears here. A vacant slot keeps its URL and its links so
 * the grid stays whole, but it has no product to show yet, so advertising it to
 * a crawler would be advertising an empty page.
 *
 * Each entry carries the date the slot record last changed - which moves when
 * its tenant changes - rather than today's date, so a crawler can tell what
 * actually moved.
 */

// PostgREST caps a response at a thousand rows, so a page is a thousand.
// Asking for more would silently return fewer and drop slots from the map.
const PAGE_SIZE = 1000;

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}` };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const Route = createFileRoute("/sitemap-slots/$page.xml")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const headers = {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        };
        const open = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
        const close = "</urlset>";

        if (!indexable() || !url()) {
          return new Response(`${open}\n${close}`, { headers });
        }

        // The page number comes from the path. The route parameter carries the
        // ".xml" suffix and does not parse, which is what once collapsed every
        // page of the product map to the first.
        const fromPath = new URL(request.url).pathname.match(/sitemap-slots\/(\d+)/);
        const page = Math.max(
          1,
          parseInt(fromPath?.[1] ?? String((params as { page?: string }).page ?? "1"), 10) || 1,
        );
        const offset = (page - 1) * PAGE_SIZE;

        try {
          const response = await fetch(
            `${url()}/rest/v1/marketplace_card_slots?select=slot_url,updated_at` +
              `&status=eq.occupied&order=slot_url.asc&limit=${PAGE_SIZE}&offset=${offset}`,
            { headers: admin() },
          );
          if (!response.ok) return new Response(`${open}\n${close}`, { headers });

          const rows = (await response.json()) as { slot_url: string; updated_at: string }[];
          const entries = rows
            .filter((row) => row.slot_url)
            .map((row) => {
              const lastmod = String(row.updated_at ?? "").slice(0, 10);
              return (
                `<url><loc>${escapeXml(absoluteUrl(row.slot_url))}</loc>` +
                (lastmod ? `<lastmod>${lastmod}</lastmod>` : "") +
                `<changefreq>weekly</changefreq><priority>0.8</priority></url>`
              );
            });

          return new Response(`${open}\n${entries.join("\n")}\n${close}`, { headers });
        } catch (error) {
          console.error("[sitemap slots] failed", page, error);
          return new Response(`${open}\n${close}`, { headers });
        }
      },
    },
  },
});
