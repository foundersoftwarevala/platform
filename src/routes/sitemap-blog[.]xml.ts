import { createFileRoute } from "@tanstack/react-router";
import { absoluteUrl, indexable } from "@/lib/seo/site-url";
import { readBlogIndex } from "@/lib/seo/blog";

/**
 * The articles.
 *
 * Only a post that is published and actually has a body appears. A row marked
 * published with nothing stored in it would be an empty page, and advertising
 * one to a crawler is how a site teaches search engines that its pages are
 * thin. Those rows are left out, and the manager can see how many there are.
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
          const { posts } = await readBlogIndex(1000);
          const entries = posts.map((post) => {
            const lastmod = String(post.updatedAt ?? post.publishedAt ?? "").slice(0, 10);
            return (
              `<url><loc>${escapeXml(absoluteUrl(post.url))}</loc>` +
              (lastmod ? `<lastmod>${lastmod}</lastmod>` : "") +
              `<changefreq>monthly</changefreq><priority>0.6</priority></url>`
            );
          });
          return new Response(`${OPEN}\n${entries.join("\n")}\n${CLOSE}`, { headers: HEADERS });
        } catch (error) {
          console.error("[sitemap blog] failed", error);
          return new Response(`${OPEN}\n${CLOSE}`, { headers: HEADERS });
        }
      },
    },
  },
});
