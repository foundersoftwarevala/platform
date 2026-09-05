// Central registry of premium 3D collectible assets per role.
// Asset URLs are collected eagerly so every role/category is available to vault routes.

import type { RoleSlug } from "./roles";

type AssetMap = Record<RoleSlug, string>;

const assets = import.meta.glob<string>("/src/assets/**/*.png", {
  eager: true,
  query: "?url",
  import: "default",
});

function collection(directory: string): AssetMap {
  const entries = Object.entries(assets)
    .filter(([path]) => path.startsWith(`/src/assets/${directory}/`))
    .map(([path, url]) => [path.slice(path.lastIndexOf("/") + 1, -4), url]);
  return Object.fromEntries(entries) as AssetMap;
}

export const ROLE_BADGE = collection("badges");
export const ROLE_PASSPORT = collection("passports");
export const ROLE_CERTIFICATE = collection("certificates");
export const ROLE_MEMBERSHIP = collection("membership");
export const ROLE_RANK = collection("ranks");
export const ROLE_SHIELD = collection("shields");
export const ROLE_AWARD = collection("awards");
export const ROLE_ACHIEVEMENT = collection("achievements");
export const ROLE_REPUTATION = collection("reputation-medals");
export const ROLE_TRUST_SEAL = collection("trust-seals");
export const ROLE_RECOGNITION_COIN = collection("recognition-coins");
export const ROLE_XP_CRYSTAL = collection("xp-crystals");
export const ROLE_REWARD_CHEST = collection("reward-chests");
export const ROLE_HONOR_COIN = collection("honor-coins");
export const ROLE_LEGACY_MEDAL = collection("legacy-medals");
export const ROLE_IDENTITY_CARD = collection("identity-cards");
export const ROLE_LICENSE_CARD = collection("license-cards");
export const ROLE_FOUNDER_SEAL = collection("founder-seals");
export const ROLE_HALL_OF_FAME = collection("hall-of-fame");
export const ROLE_TROPHY = collection("trophies");
