import { createFileRoute } from "@tanstack/react-router";
import { absoluteUrl, indexable } from "@/lib/seo/site-url";
import { eligibleCount } from "@/lib/seo/sitemap-gate";

/**
 * The sitemap index.
 *
 * A single sitemap may hold fifty thousand URLs, and the catalogue is heading
 * for far more than that, so this points at paged child sitemaps rather than
 * listing anything itself. Only pages approved by the SEO gate are advertised.
 *
 * A deployment that is not the production domain serves an empty index, so a
 * testing copy can never put a competing set of the same URLs into the index.
 */

const PAGE_SIZE = 1000; // matches the per-page cap in the product sitemap

/**
 * How many card slots the safety gate passed.
 *
 * Not how many are occupied: a slot can hold a product and still carry a
 * broken canonical, a thin body or the same text as its neighbour with the
 * country swapped. The count of pages in the slot map is the count of slots
 * that passed every required check, so a map page is never generated for URLs
 * that will not be in it.
 */
async function countEligibleSlots(): Promise<number> {
  return eligibleCount("slot");
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

        const [products, slots, blogs] = await Promise.all([
          eligibleCount("product"),
          countEligibleSlots(),
          eligibleCount("blog"),
        ]);
        const pages = Math.ceil(products / PAGE_SIZE);
        const slotPages = Math.ceil(slots / PAGE_SIZE);
        const today = new Date().toISOString().slice(0, 10);

        const entries = [
          `<sitemap><loc>${absoluteUrl("/sitemap-pages.xml")}</loc><lastmod>${today}</lastmod></sitemap>`,
          `<sitemap><loc>${absoluteUrl("/sitemap-categories.xml")}</loc><lastmod>${today}</lastmod></sitemap>`,
          `<sitemap><loc>${absoluteUrl("/sitemap-countries.xml")}</loc><lastmod>${today}</lastmod></sitemap>`,
          ...(blogs > 0
            ? [
                `<sitemap><loc>${absoluteUrl("/sitemap-blog.xml")}</loc><lastmod>${today}</lastmod></sitemap>`,
              ]
            : []),
          // The card slots: the canonical address of every category-and-country
          // card. Nothing appears until a slot has a product in it, so this is
          // empty rather than misleading on a fresh database.
          ...Array.from(
            { length: slotPages },
            (_, i) =>
              `<sitemap><loc>${absoluteUrl(`/sitemap-slots/${i + 1}.xml`)}</loc>` +
              `<lastmod>${today}</lastmod></sitemap>`,
          ),
          ...Array.from(
            { length: pages },
            (_, i) =>
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
