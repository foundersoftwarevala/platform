import { createFileRoute } from "@tanstack/react-router";
import { absoluteUrl, indexable } from "@/lib/seo/site-url";

/**
 * The sitemap index.
 *
 * A single sitemap may hold fifty thousand URLs, and the catalogue is heading
 * for far more than that, so this points at paged child sitemaps rather than
 * listing anything itself. Adding products changes the page count and nothing
 * else.
 *
 * A deployment that is not the production domain serves an empty index, so a
 * testing copy can never put a competing set of the same URLs into the index.
 */

const PAGE_SIZE = 1000;   // matches the per-page cap in the product sitemap

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}` };
}

async function countPublished(): Promise<number> {
  if (!url()) return 0;
  try {
    const response = await fetch(
      `${url()}/rest/v1/marketplace_products?select=id&visible=eq.true` +
        `&content_status=eq.published&limit=1`,
      { headers: { ...admin(), Prefer: "count=exact" } },
    );
    const range = response.headers.get("content-range") ?? "";
    return Number(range.split("/")[1]) || 0;
  } catch {
    return 0;
  }
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const headers = {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        };

        if (!indexable()) {
          return new Response(
            `<?xml version="1.0" encoding="UTF-8"?>\n` +
              `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></sitemapindex>`,
            { headers },
          );
        }

        const total = await countPublished();
        const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        const today = new Date().toISOString().slice(0, 10);

        const entries = [
          `<sitemap><loc>${absoluteUrl("/sitemap-pages.xml")}</loc><lastmod>${today}</lastmod></sitemap>`,
          `<sitemap><loc>${absoluteUrl("/sitemap-categories.xml")}</loc><lastmod>${today}</lastmod></sitemap>`,
          ...Array.from({ length: pages }, (_, i) =>
            `<sitemap><loc>${absoluteUrl(`/sitemap-products/${i + 1}.xml`)}</loc>` +
            `<lastmod>${today}</lastmod></sitemap>`,
          ),
        ];

        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
            `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
            entries.join("\n") +
            `\n</sitemapindex>`,
          { headers },
        );
      },
    },
  },
});
