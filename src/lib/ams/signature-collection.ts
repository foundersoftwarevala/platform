// Software Vala — Ultra Premium Signature Trophy & Collection Engine (UI only).
// Career-stage collections: every role owns a 10-stage collection per collectible
// type. Every stage has a unique silhouette, base, crown, crystal core, geometry,
// material and rarity — no repeats. Pure presentation metadata, no backend.

import type { RoleSlug } from "./roles";
import {
  ROLE_AWARD, ROLE_BADGE, ROLE_CERTIFICATE, ROLE_FOUNDER_SEAL, ROLE_MEMBERSHIP,
  ROLE_PASSPORT, ROLE_RANK, ROLE_REPUTATION, ROLE_SHIELD, ROLE_TROPHY,
} from "./role-assets";

/* ------------------------------------------------------------------ */
/* Career stages — 10 unique signature designs                         */
/* ------------------------------------------------------------------ */

export interface CareerStage {
  key: string;
  label: string;
  /** Career stage descriptor shown on the spec plate. */
  stage: string;
  rarity: "Standard" | "Rare" | "Epic" | "Ultra Rare" | "Legendary" | "Mythic" | "One of One";
  material: string;
  silhouette: string;
  base: string;
  crown: string;
  core: string;
  geometry: string;
  detail: string;
  hue: string;
  /** Total mint size for the edition line. */
  mint: number;
}

export const CAREER_STAGES: CareerStage[] = [
  {
    key: "bronze", label: "Bronze", stage: "Foundation", rarity: "Standard",
    material: "Cast Bronze & Smoked Crystal", silhouette: "Architectural Monolith",
    base: "Premium Marble Slab", crown: "Open Energy Ring", core: "Static Crystal Shard",
    geometry: "Quantum Geometry — single axis", detail: "Laser-engraved micro texture",
    hue: "#b87333", mint: 5000,
  },
  {
    key: "silver", label: "Silver", stage: "Rising Professional", rarity: "Standard",
    material: "Platinum-brushed Titanium", silhouette: "Twin Infinity Ribbon",
    base: "Brushed Titanium Plinth", crown: "Split Halo Arc", core: "Suspended Glass Prism",
    geometry: "Mirror-symmetric ribbon", detail: "Hidden SV monogram in the fold",
    hue: "#cbd5e1", mint: 3000,
  },
  {
    key: "gold", label: "Gold", stage: "Established Expert", rarity: "Rare",
    material: "24K Gold & Ultra Clear Crystal", silhouette: "Rising Circuit Sculpture",
    base: "Obsidian Stone Block", crown: "Interlocked Hex Crown", core: "Floating Crystal Sphere",
    geometry: "Circuit lattice ascent", detail: "Founder signature on the base plate",
    hue: "#facc15", mint: 1500,
  },
  {
    key: "platinum", label: "Platinum", stage: "Senior Authority", rarity: "Epic",
    material: "Platinum & Diamond Glass", silhouette: "Vertical Light Column",
    base: "Premium Wood & Metal Inlay", crown: "Vaulted Twin Fin", core: "Embedded Light Strip",
    geometry: "Golden-ratio column", detail: "Edge lighting along the full spine",
    hue: "#e5e7eb", mint: 800,
  },
  {
    key: "diamond", label: "Diamond", stage: "Elite Operator", rarity: "Ultra Rare",
    material: "Diamond Glass & Mirror Chrome", silhouette: "Faceted Diamond Core Tower",
    base: "Mirror Chrome Disc", crown: "Rotating Diamond Crown", core: "Rotating Diamond Core",
    geometry: "Multi-layer crystal stack", detail: "Holographic engraving on inner layer",
    hue: "#67e8f9", mint: 400,
  },
  {
    key: "elite", label: "Elite", stage: "Domain Leader", rarity: "Ultra Rare",
    material: "Carbon Fiber & Rose Gold", silhouette: "Asymmetric Energy Wing",
    base: "Carbon Fiber Wedge", crown: "Cantilevered Blade", core: "Internal Glow Chamber",
    geometry: "Aerodynamic luxury curve", detail: "Woven carbon micro-weave texture",
    hue: "#fb7185", mint: 200,
  },
  {
    key: "master", label: "Master", stage: "Master Craft", rarity: "Legendary",
    material: "Black Crystal & White Gold", silhouette: "Nested Infinity Loop",
    base: "Black Crystal Pedestal", crown: "Double Infinity Cap", core: "Digital DNA Helix",
    geometry: "Infinity torus knot", detail: "Micro-milled DNA sequence engraving",
    hue: "#a78bfa", mint: 100,
  },
  {
    key: "legend", label: "Legend", stage: "Industry Legend", rarity: "Legendary",
    material: "Obsidian Stone & 24K Gold Leaf", silhouette: "Monumental Gate Form",
    base: "Luxury Leather & Gold Frame", crown: "Sunburst Aperture", core: "AI Core Orb",
    geometry: "Monumental architecture", detail: "Volumetric internal light bloom",
    hue: "#f59e0b", mint: 50,
  },
  {
    key: "hof", label: "Hall Of Fame", stage: "Hall Of Fame Inductee", rarity: "Mythic",
    material: "Premium Marble & Platinum", silhouette: "Cathedral Spire Cluster",
    base: "Carrara Marble Pillar", crown: "Laurel Halo Ring", core: "Holographic Core",
    geometry: "Spire cluster in ascending thirds", detail: "Induction year deep-etched in stone",
    hue: "#fcd34d", mint: 15,
  },
  {
    key: "founder", label: "Founder", stage: "Founder Legacy", rarity: "One of One",
    material: "Solid 24K Gold & Black Diamond", silhouette: "Origin Seal Obelisk",
    base: "Hand-finished Walnut Vault Box", crown: "Founder Seal Crown", core: "Floating Founder Seal",
    geometry: "Origin obelisk with sealed core", detail: "Hand-signed founder plate, unique serial",
    hue: "#e8d29a", mint: 1,
  },
];

/* ------------------------------------------------------------------ */
/* Rarity collections                                                  */
/* ------------------------------------------------------------------ */

export const RARITY_COLLECTIONS = [
  "Developer Collection", "Sales Collection", "Creator Collection", "Innovation Collection",
  "Leadership Collection", "Founder Collection", "Legacy Collection", "Hall Of Fame Collection",
] as const;

export type RarityCollection = (typeof RARITY_COLLECTIONS)[number];

const ROLE_FAMILY: Record<RoleSlug, RarityCollection> = {
  developer: "Developer Collection",
  operator: "Innovation Collection",
  reseller: "Sales Collection",
  franchise: "Leadership Collection",
  author: "Creator Collection",
  vendor: "Sales Collection",
  affiliate: "Sales Collection",
  influencer: "Creator Collection",
  creator: "Creator Collection",
  seo: "Innovation Collection",
  support: "Legacy Collection",
  user: "Legacy Collection",
  manager: "Leadership Collection",
  administrator: "Leadership Collection",
  founder: "Founder Collection",
};

export function roleFamily(slug: RoleSlug): RarityCollection {
  return ROLE_FAMILY[slug] ?? "Legacy Collection";
}

/* ------------------------------------------------------------------ */
/* Collection types                                                    */
/* ------------------------------------------------------------------ */

export interface CollectionTypeDef {
  slug: string;
  title: string;
  singular: string;
  kicker: string;
  suffix: string;
  description: string;
  assets: Record<RoleSlug, string>;
  accent: string;
  display: string;
}

export const COLLECTION_TYPES: CollectionTypeDef[] = [
  {
    slug: "trophies", title: "Signature Trophy Collection", singular: "Trophy", kicker: "Signature Engine",
    suffix: "trophy", description: "Ten signature Software Vala trophies per role — one for every career stage, each with its own silhouette, base, crown and crystal core.",
    assets: ROLE_TROPHY, accent: "#facc15", display: "Luxury Trophy Cabinet",
  },
  {
    slug: "awards", title: "Signature Award Collection", singular: "Award", kicker: "Executive Awards",
    suffix: "award", description: "Executive award line staged as a display wall — sculpted forms, engraved plates and edition numbering.",
    assets: ROLE_AWARD, accent: "#f59e0b", display: "Executive Display Wall",
  },
  {
    slug: "badges", title: "Signature Badge Collection", singular: "Badge", kicker: "Collector Album",
    suffix: "badge", description: "Hard-enamel signature badges collected across the full career ladder.",
    assets: ROLE_BADGE, accent: "#a78bfa", display: "Collector Cabinet",
  },
  {
    slug: "medals", title: "Signature Medal Collection", singular: "Medal", kicker: "Medal Vault",
    suffix: "reputation-medal", description: "Struck reputation medals mounted in ascending career order.",
    assets: ROLE_REPUTATION, accent: "#fb7185", display: "Luxury Vault",
  },
  {
    slug: "passports", title: "Signature Passport Collection", singular: "Digital Passport", kicker: "Identity Series",
    suffix: "passport", description: "Every career stage issues its own passport edition with fresh security artwork.",
    assets: ROLE_PASSPORT, accent: "#38bdf8", display: "Crystal Showcase",
  },
  {
    slug: "certificates", title: "Signature Certificate Collection", singular: "Certificate", kicker: "Credential Hall",
    suffix: "certificate", description: "Framed credential series with gold foil engraving and serialised editions.",
    assets: ROLE_CERTIFICATE, accent: "#e8d29a", display: "Executive Library",
  },
  {
    slug: "membership", title: "Signature Membership Collection", singular: "Membership Card", kicker: "Member Series",
    suffix: "membership", description: "Metal membership tiers from Foundation through Founder Legacy.",
    assets: ROLE_MEMBERSHIP, accent: "#22d3ee", display: "Glass Museum",
  },
  {
    slug: "verification-seals", title: "Signature Verification Collection", singular: "Verification Seal", kicker: "Trust Series",
    suffix: "shield", description: "Trust seals escalating in material and clearance with every career stage.",
    assets: ROLE_SHIELD, accent: "#34d399", display: "Museum Display",
  },
  {
    slug: "rank-emblems", title: "Signature Rank Collection", singular: "Rank Emblem", kicker: "Prestige Ranks",
    suffix: "rank-emblem", description: "Prestige rank emblems cast in ten distinct geometries.",
    assets: ROLE_RANK, accent: "#60a5fa", display: "Premium Collection Shelf",
  },
  {
    slug: "founder", title: "Founder Collection", singular: "Founder Seal", kicker: "Founder Vault",
    suffix: "founder-seal", description: "The sealed founder line — one-of-one pieces finished by hand.",
    assets: ROLE_FOUNDER_SEAL, accent: "#e8d29a", display: "Executive Wooden Box",
  },
];

export const COLLECTION_TYPE_SLUGS = COLLECTION_TYPES.map((t) => t.slug);

export function getCollectionType(slug: string): CollectionTypeDef | undefined {
  return COLLECTION_TYPES.find((t) => t.slug === slug);
}

/* ------------------------------------------------------------------ */
/* Collection layouts                                                  */
/* ------------------------------------------------------------------ */

export const COLLECTION_LAYOUTS = [
  { key: "cabinet", label: "Cabinet Collection", hint: "Luxury trophy cabinet with lit shelves" },
  { key: "horizontal", label: "Horizontal Collection", hint: "Scroll the collection like a watch showroom" },
  { key: "grid", label: "Grid Collection", hint: "Full collection grid" },
  { key: "museum", label: "Museum Collection", hint: "Glass museum with plinths and spotlights" },
  { key: "carousel", label: "Carousel Collection", hint: "Rotating hero carousel" },
  { key: "timeline", label: "Timeline Collection", hint: "Career chronology, stage by stage" },
] as const;

export type CollectionLayout = (typeof COLLECTION_LAYOUTS)[number]["key"];

/* ------------------------------------------------------------------ */
/* Deterministic collection builder                                    */
/* ------------------------------------------------------------------ */

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const B32 = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function code(seed: string, len: number): string {
  let h = hash(seed);
  let out = "";
  for (let i = 0; i < len; i += 1) {
    out += B32[h % B32.length];
    h = Math.floor(h / B32.length) + hash(`${seed}:${i}`) % 97;
  }
  return out;
}

export interface CollectionPiece {
  id: string;
  stage: CareerStage;
  index: number;
  src: string;
  filename: string;
  unlocked: boolean;
  /** SV·DEV·04 · TROPHY */
  collectionNumber: string;
  editionNumber: string;
  serialNumber: string;
  unlockDate: string | null;
  title: string;
  family: RarityCollection;
}

export interface RoleCollection {
  role: RoleSlug;
  roleName: string;
  accent: string;
  passportPrefix: string;
  family: RarityCollection;
  pieces: CollectionPiece[];
  unlockedCount: number;
}

const DATE_FMT = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export interface BuildArgs {
  slug: RoleSlug;
  name: string;
  accent: string;
  passportPrefix: string;
  type: CollectionTypeDef;
}

/** Builds the 10-stage signature collection for one role + collectible type. */
export function buildRoleCollection({ slug, name, accent, passportPrefix, type }: BuildArgs): RoleCollection {
  const seedBase = `${slug}:${type.slug}`;
  const unlockedCount = 3 + (hash(seedBase) % 5); // 3..7 unlocked, rest previewable
  const src = type.assets[slug];
  const family = roleFamily(slug);

  const pieces = CAREER_STAGES.map((stage, index) => {
    const seed = `${seedBase}:${stage.key}`;
    const unlocked = index < unlockedCount;
    const edition = 1 + (hash(`${seed}:ed`) % stage.mint);
    const day = new Date(Date.UTC(2024, 0, 1));
    day.setUTCDate(day.getUTCDate() + (hash(`${seed}:dt`) % 700) + index * 30);
    return {
      id: seed,
      stage,
      index,
      src,
      filename: `${slug}-${stage.key}-${type.suffix}.png`,
      unlocked,
      collectionNumber: `${passportPrefix}·${String(index + 1).padStart(2, "0")}·${type.suffix.toUpperCase()}`,
      editionNumber: `${String(edition).padStart(4, "0")} / ${String(stage.mint).padStart(4, "0")}`,
      serialNumber: `SV-${code(seed, 4)}-${code(`${seed}:s`, 4)}`,
      unlockDate: unlocked ? DATE_FMT.format(day) : null,
      title: `${name} ${stage.label} ${type.singular}`,
      family,
    } satisfies CollectionPiece;
  });

  return { role: slug, roleName: name, accent, passportPrefix, family, pieces, unlockedCount, ...(src ? {} : {}) };
}
