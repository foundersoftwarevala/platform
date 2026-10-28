import { createServerFn } from "@tanstack/react-start";

import { listHeroSlidesPublic, type HeroSlide } from "./hero.functions";

/**
 * The hero slides, read on the server.
 *
 * The server function reads the public slide projection directly from the VPS.
 * An empty result remains empty so hidden, unpublished, or absent slides do not
 * reappear from a hardcoded fallback.
 */

export const getHeroSlidesPublic = createServerFn({ method: "GET" }).handler(
  async (): Promise<HeroSlide[]> => listHeroSlidesPublic(),
);
