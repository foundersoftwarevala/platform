import { createFileRoute } from "@tanstack/react-router";
import { countryRows, countrySlug, getCountryProducts } from "@/lib/seo/country-seo";

/**
 * More products for a country page.
 *
 * The page renders its first page with the document and asks here for the rest
 * as the reader scrolls. It answers from the same function the page itself
 * used, so the two can never drift apart, and like every other public list a
 * card carries no demo address.
 */

const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; payload: unknown }>();

export const Route = createFileRoute("/api/marketplace/country")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
          return Response.json(
            { error: "The catalogue is not configured on this server.", cards: [] },
            { status: 503 },
          );
        }

        const params = new URL(request.url).searchParams;
        const asked = (params.get("country") ?? "").trim();
        const offset = Math.max(Number(params.get("offset") ?? 0) || 0, 0);
        const limit = Math.min(Math.max(Number(params.get("limit") ?? 24) || 24, 1), 60);
        if (!asked) return Response.json({ error: "Which country?", cards: [] }, { status: 400 });

        const key = `${countrySlug(asked)}|${offset}|${limit}`;
        const hit = cache.get(key);
        if (hit && Date.now() - hit.at < CACHE_MS) {
          return Response.json(hit.payload, { headers: { "Cache-Control": "public, max-age=60" } });
        }

        const wanted = countrySlug(asked);
        const known = await countryRows();
        if (!known.some((row) => countrySlug(row.country) === wanted)) {
          return Response.json({ error: "No such country.", cards: [] }, { status: 404 });
        }

        try {
          const { country, cards, total } = await getCountryProducts({
            data: { slug: asked, offset, limit },
          });
          const payload = {
            country,
            slug: wanted,
            cards,
            total,
            offset,
            limit,
            hasMore: offset + cards.length < total,
          };
          cache.set(key, { at: Date.now(), payload });
          if (cache.size > 300) cache.clear();
          return Response.json(payload, { headers: { "Cache-Control": "public, max-age=60" } });
        } catch (error) {
          console.error("[country catalogue] failed", error);
          return Response.json(
            { error: "The catalogue could not be read.", cards: [] },
            { status: 502 },
          );
        }
      },
    },
  },
});
