import { queryOptions } from "@tanstack/react-query";
import { getHeroSlidesPublic } from "./hero.server";

/**
 * Read through the server rather than the browser client.
 *
 * listHeroSlidesPublic sends the publishable key, which is now the opaque
 * `sb_publishable_...` format that the VPS PostgREST refuses with 401
 * PGRST301. Its error path returns FALLBACK_HERO_SLIDES, so the failure was
 * silent: the homepage has been serving the hardcoded safety-net slides and
 * none of the slides Hero Slides Manager publishes.
 *
 * The server function reads the same table with the same filters and the same
 * fallback, and is how every other public part of this page already loads.
 */
export const heroPublicQuery = () =>
  queryOptions({
    queryKey: ["hero_slides", "public"],
    queryFn: () => getHeroSlidesPublic(),
    staleTime: 30_000,
  });
