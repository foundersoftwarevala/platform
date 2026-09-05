import { createFileRoute } from "@tanstack/react-router";
import { absoluteUrl, indexable } from "@/lib/seo/site-url";
import { countryRows, countrySlug } from "@/lib/seo/country-seo";

/**
 * The country pages.
 *
 * One entry per country the catalogue is actually written for, taken from the
 * markers on the products themselves. A country with nothing behind it is left
 * out rather than advertised as an empty page.
 */

const OPEN = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
const CLOSE = "</urlset>";
const HEADERS = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, max-age=3600",
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export const Route = createFileRoute("/sitemap-countries.xml")({
  server: {
    handlers: {
      GET: async () => {
        if (!indexable()) {
          return new Response(`${OPEN}\n${CLOSE}`, { headers: HEADERS });
        }
        try {
          const rows = await countryRows();
          const today = new Date().toISOString().slice(0, 10);
          const entries = rows
            .filter((row) => Number(row.product_count) > 0)
            .map((row) => {
              const loc = absoluteUrl(`/marketplace/country/${countrySlug(row.country)}`);
              return (
                `<url><loc>${escapeXml(loc)}</loc><lastmod>${today}</lastmod>` +
                `<changefreq>weekly</changefreq><priority>0.8</priority></url>`
              );
            });
          return new Response(`${OPEN}\n${entries.join("\n")}\n${CLOSE}`, { headers: HEADERS });
        } catch (error) {
          console.error("[sitemap countries] failed", error);
          return new Response(`${OPEN}\n${CLOSE}`, { headers: HEADERS });
        }
      },
    },
  },
});
