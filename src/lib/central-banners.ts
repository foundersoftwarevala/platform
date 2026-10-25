import { supabase } from "@/integrations/supabase/client";

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

export async function fetchCentralBanners(
  bannerTypes: readonly CentralBannerType[],
): Promise<CentralBanner[]> {
  if (bannerTypes.length === 0) return [];
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("home_hero_slides" as never)
    .select(
      "id,slug,banner_type,target_roles,kicker,title,subtitle,cta_primary,cta_secondary,cta_link,cta_secondary_link,gradient,icon_name,accent,position,published_at,unpublish_at",
    )
    .eq("visible", true)
    .in("banner_type", [...bannerTypes])
    .or(`published_at.is.null,published_at.lte.${now}`)
    .or(`unpublish_at.is.null,unpublish_at.gt.${now}`)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as CentralBanner[];
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
