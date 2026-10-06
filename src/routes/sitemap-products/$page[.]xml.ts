import { createFileRoute } from "@tanstack/react-router";
import { absoluteUrl, indexable } from "@/lib/seo/site-url";
import { eligibleUrls } from "@/lib/seo/sitemap-gate";

/**
 * One page of product URLs.
 *
 * Only product pages that passed the central SEO gate appear. Each entry
 * carries the date the gate last evaluated the page.
 */

// The SEO gate is the single source of truth for pages search engines may see.
const PAGE_SIZE = 1000;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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

        if (!indexable()) {
          return new Response(`${open}\n${close}`, { headers });
        }

        // Read the page from the path rather than the route parameter, which
        // carries the ".xml" suffix.
        const fromPath = new URL(request.url).pathname.match(/sitemap-products\/(\d+)/);
        const page = Math.max(
          1,
          parseInt(fromPath?.[1] ?? String((params as { page?: string }).page ?? "1"), 10) || 1,
        );
        const offset = (page - 1) * PAGE_SIZE;

        try {
          const entries = (await eligibleUrls("product", offset, PAGE_SIZE)).map(
            (entry) =>
              `<url><loc>${escapeXml(absoluteUrl(entry.url))}</loc>` +
              (entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : "") +
              `<changefreq>weekly</changefreq><priority>0.7</priority></url>`,
          );

          return new Response(`${open}\n${entries.join("\n")}\n${close}`, { headers });
        } catch (error) {
          console.error("[sitemap products] failed", error);
          return new Response(`${open}\n${close}`, { headers });
        }
      },
    },
  },
});
