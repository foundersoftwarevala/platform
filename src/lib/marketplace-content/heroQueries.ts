import { queryOptions } from "@tanstack/react-query";
import { listHeroSlidesPublic } from "./hero.functions";

export const heroPublicQuery = () =>
  queryOptions({
    queryKey: ["hero_slides", "public"],
    queryFn: () => listHeroSlidesPublic(),
    staleTime: 30_000,
  });
