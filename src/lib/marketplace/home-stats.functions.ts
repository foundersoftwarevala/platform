import { createServerFn } from "@tanstack/react-start";

/**
 * The catalogue numbers the storefront quotes, counted by the database.
 *
 * The badge under the search bar, the footer line and the AI Zone blurb all
 * read SITE_STATS, a frozen object in src/lib/site-content/constants.ts that
 * says "12,000+" products and "80+" categories. The catalogue holds 7,347
 * published products in 91 categories, so the site overstates its range by
 * nearly five thousand and understates its categories — and neither figure can
 * correct itself, because both are compiled into the bundle.
 *
 * Counted in the database rather than from a fetched list, because every list
 * here is capped at 10,000 rows by PostgREST and a count taken from a capped
 * list is wrong without saying so.
 *
 * SITE_STATS is not removed and is still the fallback. If this lookup fails the
 * page renders exactly what it rendered before, which is what makes putting it
 * on a live homepage safe.
 */

import type { HomeStats } from "@/lib/marketplace/home-stats";

export type { HomeStats };
export { phrase } from "@/lib/marketplace/home-stats";

const CACHE_MS = 60_000;
let cached: { at: number; payload: HomeStats | null } | null = null;

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}` };
}

export const getHomeStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<HomeStats | null> => {
    const now = Date.now();
    if (cached && now - cached.at < CACHE_MS) return cached.payload;

    const base = url();
    if (!base) return null;

    try {
      const res = await fetch(`${base}/rest/v1/rpc/mm_marketplace_stats`, {
        method: "POST",
        headers: { ...admin(), "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) return null;

      const raw = (await res.json()) as Record<string, unknown> | null;
      const products = Number(raw?.products ?? 0);
      const categories = Number(raw?.categories ?? 0);
      const liveDemos = Number(raw?.live_demos ?? 0);

      // A zero count is a failed lookup as far as the storefront is concerned:
      // the catalogue is never empty, so rendering "0 Software" would be a
      // worse answer than the old constant.
      if (!Number.isFinite(products) || products <= 0) return null;

      const payload: HomeStats = { products, categories, liveDemos };
      cached = { at: now, payload };
      return payload;
    } catch {
      return null;
    }
  },
);
