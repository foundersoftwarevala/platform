import { createFileRoute } from "@tanstack/react-router";
import { absoluteUrl, indexable } from "@/lib/seo/site-url";

/**
 * The pages that are not generated from the catalogue.
 * Only routes that genuinely exist and are meant for the public are listed.
 */

const PUBLIC_PAGES: Array<{ path: string; priority: string; changefreq: string }> = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/marketplace", priority: "0.9", changefreq: "daily" },
  { path: "/ai/finder", priority: "0.7", changefreq: "weekly" },
  { path: "/ai/recommend", priority: "0.6", changefreq: "weekly" },
  { path: "/ai/compare", priority: "0.6", changefreq: "weekly" },
  { path: "/ai/assistant", priority: "0.6", changefreq: "weekly" },
  { path: "/vala-tv", priority: "0.5", changefreq: "weekly" },
  { path: "/academy", priority: "0.5", changefreq: "weekly" },
  { path: "/apply", priority: "0.6", changefreq: "monthly" },
  { path: "/support", priority: "0.5", changefreq: "monthly" },
];

export const Route = createFileRoute("/sitemap-pages.xml")({
  server: {
    handlers: {
      GET: async () => {
        const headers = {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        };
        const open = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
        const close = "</urlset>";
        if (!indexable()) return new Response(`${open}\n${close}`, { headers });

        const today = new Date().toISOString().slice(0, 10);
        const entries = PUBLIC_PAGES.map(
          (p) =>
            `<url><loc>${absoluteUrl(p.path)}</loc><lastmod>${today}</lastmod>` +
            `<changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`,
        );
        return new Response(`${open}\n${entries.join("\n")}\n${close}`, { headers });
      },
    },
  },
});
