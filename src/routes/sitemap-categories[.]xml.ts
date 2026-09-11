import { createFileRoute } from "@tanstack/react-router";
import { publicProductFilter } from "@/lib/marketplace/public-visibility";
import { absoluteUrl, indexable } from "@/lib/seo/site-url";

/**
 * Category URLs, and the pages that are not generated from the catalogue.
 *
 * A category with nothing published in it is left out: advertising an empty
 * shelf to a crawler wastes the crawl and puts a thin page in the index.
 */

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

const OPEN = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
const CLOSE = "</urlset>";
const HEADERS = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, max-age=3600",
};

export const Route = createFileRoute("/sitemap-categories.xml")({
  server: {
    handlers: {
      GET: async () => {
        if (!indexable() || !url()) {
          return new Response(`${OPEN}\n${CLOSE}`, { headers: HEADERS });
        }
        try {
          const categoryResponse = await fetch(
            `${url()}/rest/v1/marketplace_categories?select=id,slug,updated_at` +
              `&is_hidden=eq.false&order=sort_order.asc&limit=500`,
            { headers: admin() },
          );
          if (!categoryResponse.ok) {
            return new Response(`${OPEN}\n${CLOSE}`, { headers: HEADERS });
          }
          const categories = (await categoryResponse.json()) as {
            id: string; slug: string; updated_at: string;
          }[];

          // Which categories actually have something published in them.
          // Paged by id so no row is skipped or repeated between pages (an
          // unordered offset is not stable), and read until a short page
          // rather than stopping at 8,000 - the catalogue is heading for 12,000.
          // The bound is only a guard against a runaway loop.
          const populated = new Set<string>();
          for (let offset = 0; offset < 1_000_000; offset += 1000) {
            const productResponse = await fetch(
              `${url()}/rest/v1/marketplace_products?select=category_id` +
                `${publicProductFilter()}&order=id.asc&limit=1000&offset=${offset}`,
              { headers: admin() },
            );
            if (!productResponse.ok) break;
            const page = (await productResponse.json()) as { category_id: string | null }[];
            for (const row of page) if (row.category_id) populated.add(row.category_id);
            if (page.length < 1000) break;
          }

          const entries = categories
            .filter((c) => c.slug && populated.has(c.id))
            .map((c) => {
              const lastmod = String(c.updated_at ?? "").slice(0, 10);
              return (
                `<url><loc>${escapeXml(absoluteUrl(`/marketplace/category/${c.slug}`))}</loc>` +
                (lastmod ? `<lastmod>${lastmod}</lastmod>` : "") +
                `<changefreq>weekly</changefreq><priority>0.8</priority></url>`
              );
            });

          return new Response(`${OPEN}\n${entries.join("\n")}\n${CLOSE}`, { headers: HEADERS });
        } catch (error) {
          console.error("[sitemap categories] failed", error);
          return new Response(`${OPEN}\n${CLOSE}`, { headers: HEADERS });
        }
      },
    },
  },
});
