import { createFileRoute } from "@tanstack/react-router";
import { absoluteUrl, indexable } from "@/lib/seo/site-url";

/**
 * One page of product URLs.
 *
 * Only products that are visible and published appear, so a draft is never
 * advertised to a crawler. Each entry carries the date the record last changed
 * rather than today's date, so a crawler can tell what actually moved.
 */

// PostgREST caps a response at a thousand rows, so a page is a thousand.
// Asking for more would silently return fewer and drop products from the map.
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
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export const Route = createFileRoute("/sitemap-products/$page.xml")({
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

        // Read the page from the path rather than the route parameter. The
        // parameter carries the ".xml" suffix and did not parse, which
        // collapsed every page to the first and repeated the same thousand
        // products in each one. The path is unambiguous.
        const fromPath = new URL(request.url).pathname.match(/sitemap-products\/(\d+)/);
        const page = Math.max(
          1,
          parseInt(fromPath?.[1] ?? String((params as { page?: string }).page ?? "1"), 10) || 1,
        );
        const offset = (page - 1) * PAGE_SIZE;

        try {
          const response = await fetch(
            `${url()}/rest/v1/marketplace_products?select=slug,updated_at` +
              `&visible=eq.true&content_status=eq.published` +
              `&order=sort_order.asc,name.asc&limit=${PAGE_SIZE}&offset=${offset}`,
            { headers: admin() },
          );
          if (!response.ok) return new Response(`${open}\n${close}`, { headers });

          const rows = (await response.json()) as { slug: string; updated_at: string }[];
          const entries = rows
            .filter((r) => r.slug)
            .map((r) => {
              const lastmod = String(r.updated_at ?? "").slice(0, 10);
              return (
                `<url><loc>${escapeXml(absoluteUrl(`/marketplace/product/${r.slug}`))}</loc>` +
                (lastmod ? `<lastmod>${lastmod}</lastmod>` : "") +
                `<changefreq>weekly</changefreq><priority>0.7</priority></url>`
              );
            });

          return new Response(`${open}\n${entries.join("\n")}\n${close}`, { headers });
        } catch (error) {
          console.error("[sitemap products] failed", error);
          return new Response(`${open}\n${close}`, { headers });
        }
      },
    },
  },
});
