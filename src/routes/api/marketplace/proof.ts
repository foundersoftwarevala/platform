import { createFileRoute } from "@tanstack/react-router";

/**
 * The success stories and awards the home page is allowed to show.
 *
 * Both sections used to draw a written-in list: named companies, named people
 * and specific figures that were never said by anybody. One of the companies
 * is a real healthcare brand. None of it belongs on a live page, so both
 * sections read from here instead, and here answers only with rows an operator
 * has published from Marketplace Manager. When there is nothing published the
 * answer is empty and the sections show nothing - an empty shelf is honest,
 * an invented customer is not.
 */

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}` };
}

const CACHE_MS = 60_000;
let cached: { at: number; payload: unknown } | null = null;

async function read(table: string, columns: string) {
  const response = await fetch(
    `${url()}/rest/v1/${table}?select=${columns}&published=eq.true` +
      `&order=sort_order.asc&limit=60`,
    { headers: admin() },
  );
  if (!response.ok) return [];
  return (await response.json()) as Record<string, unknown>[];
}

export const Route = createFileRoute("/api/marketplace/proof")({
  server: {
    handlers: {
      GET: async () => {
        if (!url() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
          return Response.json({ stories: [], awards: [] }, { status: 200 });
        }
        if (cached && Date.now() - cached.at < CACHE_MS) {
          return Response.json(cached.payload, {
            headers: { "Cache-Control": "public, max-age=60" },
          });
        }
        try {
          const [stories, awards] = await Promise.all([
            read("marketplace_stories",
              "id,company,quote,author,role,metric,metric_label,product,product_slug"),
            read("marketplace_awards", "id,category,winner,product_slug,year"),
          ]);
          const payload = { stories, awards };
          cached = { at: Date.now(), payload };
          return Response.json(payload, {
            headers: { "Cache-Control": "public, max-age=60" },
          });
        } catch (error) {
          console.error("[proof] read failed", error);
          return Response.json({ stories: [], awards: [] }, { status: 200 });
        }
      },
    },
  },
});
