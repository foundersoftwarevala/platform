import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { withVpsPublicDatabase } from "@/lib/marketplace-manager/vps-rpc.server";

export const CENTRAL_BANNER_TYPES = [
  "marketplace_slider",
  "dashboard_welcome",
  "festival_wish",
  "officer_notice",
] as const;

export type CentralBannerType = (typeof CENTRAL_BANNER_TYPES)[number];

export type CentralBanner = {
  id: string;
  slug: string;
  banner_type: CentralBannerType;
  target_roles: string[] | null;
  kicker: string;
  title: string;
  subtitle: string;
  cta_primary: string;
  cta_secondary: string;
  cta_link: string;
  cta_secondary_link: string | null;
  gradient: string;
  icon_name: string;
  accent: string;
  position: number;
  published_at: string | null;
  unpublish_at: string | null;
};

const fetchCentralBannersFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ bannerTypes: z.array(z.enum(CENTRAL_BANNER_TYPES)).max(4) }).parse(input),
  )
  .handler(async ({ data }): Promise<CentralBanner[]> => {
    if (data.bannerTypes.length === 0) return [];
    return withVpsPublicDatabase((tx) =>
      tx<CentralBanner[]>`
        select id, slug, banner_type, target_roles, kicker, title, subtitle,
               cta_primary, cta_secondary, cta_link, cta_secondary_link,
               gradient, icon_name, accent, position, published_at, unpublish_at
          from public.home_hero_slides
         where visible is true
           and archived_at is null
           and banner_type = any(${data.bannerTypes}::text[])
           and (published_at is null or published_at <= now())
           and (unpublish_at is null or unpublish_at > now())
         order by position asc, id
      `,
    );
  });

export function fetchCentralBanners(
  bannerTypes: readonly CentralBannerType[],
): Promise<CentralBanner[]> {
  return fetchCentralBannersFn({ data: { bannerTypes: [...bannerTypes] } });
}

export function bannersForRole(banners: readonly CentralBanner[], role: string): CentralBanner[] {
  return bannersForRoles(banners, [role]);
}

export function bannersForRoles(
  banners: readonly CentralBanner[],
  roles: readonly string[],
): CentralBanner[] {
  const normalizedRoles = new Set(roles.map((role) => role.trim().toLowerCase()));
  return banners.filter(
    (banner) =>
      banner.target_roles === null ||
      banner.target_roles.length === 0 ||
      banner.target_roles.some((target) => normalizedRoles.has(target.trim().toLowerCase())),
  );
}
