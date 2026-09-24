import { createFileRoute } from "@tanstack/react-router";
import { absoluteUrl, indexable } from "@/lib/seo/site-url";
import { eligibleUrls } from "@/lib/seo/sitemap-gate";

/**
 * The articles.
 *
 * Which articles is not decided here. This asks the safety gate for the blog
 * URLs that passed, which already excludes the rows marked published with no
 * body stored - a headline over nothing is a thin page, and telling a crawler
 * about one teaches it what to expect from the rest.
 */

const OPEN = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
const CLOSE = "</urlset>";
const HEADERS = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, max-age=3600",
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const Route = createFileRoute("/sitemap-blog.xml")({
  server: {
    handlers: {
      GET: async () => {
        if (!indexable()) {
          return new Response(`${OPEN}\n${CLOSE}`, { headers: HEADERS });
        }
        try {
          const entries = (await eligibleUrls("blog", 0, 1000)).map(
            (entry) =>
              `<url><loc>${escapeXml(absoluteUrl(entry.url))}</loc>` +
              (entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : "") +
              `<changefreq>monthly</changefreq><priority>0.6</priority></url>`,
          );
          return new Response(`${OPEN}\n${entries.join("\n")}\n${CLOSE}`, { headers: HEADERS });
        } catch (error) {
          console.error("[sitemap blog] failed", error);
          return new Response(`${OPEN}\n${CLOSE}`, { headers: HEADERS });
        }
      },
    },
  },
});
