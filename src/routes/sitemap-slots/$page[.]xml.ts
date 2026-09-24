import { createFileRoute } from "@tanstack/react-router";
import { absoluteUrl, indexable } from "@/lib/seo/site-url";
import { eligibleUrls } from "@/lib/seo/sitemap-gate";

/**
 * One page of card slot URLs.
 *
 * This no longer decides for itself which slots are fit to advertise. It used
 * to ask for the occupied ones, which is a reasonable filter and an incomplete
 * one: a slot can be occupied and still carry a broken canonical, a thin body
 * or the same text as its neighbour with the country swapped. Now it asks the
 * safety gate for the slots that passed every required check, and a slot the
 * gate has never seen does not appear at all.
 *
 * The lastmod is the date the gate last looked, which is the honest answer to
 * "when did this change" for a page whose content follows its tenant.
 */

// PostgREST caps a response at a thousand rows, so a page is a thousand.
const PAGE_SIZE = 1000;

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

        if (!indexable()) {
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

        try {
          const entries = (await eligibleUrls("slot", (page - 1) * PAGE_SIZE, PAGE_SIZE)).map(
            (entry) =>
              `<url><loc>${escapeXml(absoluteUrl(entry.url))}</loc>` +
              (entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : "") +
              `<changefreq>weekly</changefreq><priority>0.8</priority></url>`,
          );
          return new Response(`${open}\n${entries.join("\n")}\n${close}`, { headers });
        } catch (error) {
          console.error("[sitemap slots] failed", page, error);
          return new Response(`${open}\n${close}`, { headers });
        }
      },
    },
  },
});
