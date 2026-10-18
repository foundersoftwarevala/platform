import { createServerFn } from "@tanstack/react-start";

import { FALLBACK_HERO_SLIDES, type HeroSlide } from "./hero.functions";

/**
 * The hero slides, read on the server.
 *
 * The homepage hero has been showing FALLBACK_HERO_SLIDES — the hardcoded
 * safety net whose own comment says that seeing it on the site means the query
 * is what to look at. Proven against the live page: the HTML carries
 * "12,000+ Software Solutions" and "One Marketplace. Every Business Need.",
 * which exist only in the fallback, and carries none of the titles that are in
 * home_hero_slides. So Hero Slides Manager has been publishing to a table no
 * visitor ever sees.
 *
 * The cause is the credential. listHeroSlidesPublic reads through the browser
 * Supabase client, which sends the publishable key — now the opaque
 * `sb_publishable_...` format. The VPS PostgREST validates JWTs and refuses it
 * with 401 PGRST301, so the query fails and the fallback is returned, exactly
 * as designed.
 *
 * This reads the same table the same way, with the same filters and the same
 * fallback, through the service role on the server — which is how every other
 * public part of this page already reads: getHomeLayout, getStorefrontChrome,
 * getCardComposition and getHomeStats are all server functions for the same
 * reason. Nothing about the browser's credential is changed and nothing is
 * weakened; the slides are public content that the page already renders to
 * anonymous visitors.
 *
 * listHeroSlidesPublic is left exactly as it is. It is still correct wherever a
 * caller holds a working session, and removing it would take away a path that
 * other screens may rely on.
 */

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}` };
}

export const getHeroSlidesPublic = createServerFn({ method: "GET" }).handler(
  async (): Promise<HeroSlide[]> => {
    const base = url();
    if (!base) return FALLBACK_HERO_SLIDES;

    try {
      const nowIso = new Date().toISOString();
      const query = new URLSearchParams();
      query.set("select", "*");
      // Only slides the manager has actually made visible.
      query.set("visible", "eq.true");
      query.set("order", "position.asc");

      // A null bound means "no bound", so a slide with neither date set is
      // always in window. Two separate `or` groups, which PostgREST ANDs —
      // the same pair of conditions the browser path uses.
      const params =
        `${query.toString()}` +
        `&or=(published_at.is.null,published_at.lte.${encodeURIComponent(nowIso)})` +
        `&or=(unpublish_at.is.null,unpublish_at.gt.${encodeURIComponent(nowIso)})`;

      const res = await fetch(`${base}/rest/v1/home_hero_slides?${params}`, {
        headers: { ...admin(), Accept: "application/json" },
      });
      if (!res.ok) return FALLBACK_HERO_SLIDES;

      const rows = (await res.json()) as HeroSlide[];
      // The fallback is a safety net for a failed or empty query, not a
      // default. The hero is the first thing on the page and an empty carousel
      // there is worse than a stale one.
      return Array.isArray(rows) && rows.length ? rows : FALLBACK_HERO_SLIDES;
    } catch {
      return FALLBACK_HERO_SLIDES;
    }
  },
);
