import { queryOptions } from "@tanstack/react-query";
import { getHeroSlidesPublic } from "./hero.server";

/**
 * Read the currently published slide projection through the server-side VPS
 * query. A successful empty result stays empty rather than restoring hidden
 * fallback slides.
 */
export const heroPublicQuery = () =>
  queryOptions({
    queryKey: ["hero_slides", "public"],
    queryFn: () => getHeroSlidesPublic(),
    staleTime: 30_000,
  });
