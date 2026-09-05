// Software Vala — Master Presentation & Showcase Engine (UI only).
// Museum environments, display modes, preview modes and showcase registry.
// No backend, no API, no business logic — pure presentation metadata.

import type { RoleSlug } from "./roles";
import {
  ROLE_ACHIEVEMENT, ROLE_AWARD, ROLE_BADGE, ROLE_CERTIFICATE, ROLE_HALL_OF_FAME,
  ROLE_IDENTITY_CARD, ROLE_LEGACY_MEDAL, ROLE_MEMBERSHIP, ROLE_PASSPORT, ROLE_RANK,
  ROLE_RECOGNITION_COIN, ROLE_REPUTATION, ROLE_SHIELD, ROLE_TROPHY,
} from "./role-assets";

/* ------------------------------------------------------------------ */
/* Museum environments — one immersive world per role                  */
/* ------------------------------------------------------------------ */

export interface MuseumEnvironment {
  key: string;
  name: string;
  /** Backdrop gradient layers (CSS). */
  backdrop: string;
  /** Floor tint used by the reflection plane. */
  floor: string;
  /** Ambient light color. */
  ambient: string;
  /** Material of the display plinth. */
  plinth: "marble" | "brushed-steel" | "walnut" | "obsidian" | "leather" | "glass";
  vibe: string;
}

const ENV = (
  key: string, name: string, a: string, b: string,
  plinth: MuseumEnvironment["plinth"], vibe: string,
): MuseumEnvironment => ({
  key,
  name,
  backdrop: `radial-gradient(120% 80% at 50% -10%, ${a}33, transparent 65%), radial-gradient(90% 60% at 15% 110%, ${b}2b, transparent 70%), linear-gradient(180deg, #04060c 0%, #080d17 55%, #03050b 100%)`,
  floor: `${a}55`,
  ambient: a,
  plinth,
  vibe,
});

export const ROLE_ENVIRONMENT: Record<RoleSlug, MuseumEnvironment> = {
  developer: ENV("tech-lab", "Modern Technology Lab", "#38bdf8", "#0ea5e9", "brushed-steel", "Cold light, machined edges, engineered precision."),
  reseller: ENV("exec-lounge", "Executive Business Lounge", "#f59e0b", "#b45309", "leather", "Warm brass, stitched leather, private-club calm."),
  franchise: ENV("global-hq", "Global Corporate Headquarters", "#60a5fa", "#1e3a8a", "marble", "Atrium marble, glass towers, worldwide scale."),
  author: ENV("publishing-studio", "Luxury Publishing Studio", "#a78bfa", "#6d28d9", "walnut", "Ink, gilt edges, hand-bound craftsmanship."),
  vendor: ENV("marketplace-showroom", "Premium Marketplace Showroom", "#34d399", "#047857", "glass", "Lit vitrines, curated shelves, retail theatre."),
  affiliate: ENV("network-center", "Partner Network Center", "#22d3ee", "#0e7490", "brushed-steel", "Linked light paths and signal geometry."),
  influencer: ENV("creator-studio", "Creator Studio", "#f472b6", "#be185d", "glass", "Soft key lights, gradient haze, on-air energy."),
  creator: ENV("design-studio", "Creative Design Studio", "#fb923c", "#c2410c", "walnut", "Studio warmth, paper texture, pigment glow."),
  seo: ENV("analytics-command", "Analytics Command Center", "#4ade80", "#15803d", "obsidian", "Grid lines, telemetry sweep, quiet control."),
  support: ENV("success-center", "Customer Success Center", "#38bdf8", "#0369a1", "marble", "Open light, calm surfaces, human trust."),
  user: ENV("member-hall", "Member Collection Hall", "#e2e8f0", "#64748b", "glass", "Clean neutral gallery, personal pride."),
  manager: ENV("ops-gallery", "Operations Gallery", "#818cf8", "#3730a3", "brushed-steel", "Structured bays, disciplined alignment."),
  administrator: ENV("governance-hall", "Governance Hall", "#f87171", "#991b1b", "obsidian", "Sealed vault doors, authority in stone."),
  founder: ENV("founder-hall", "Executive Founder Hall", "#e8d29a", "#a16207", "marble", "Gold leaf, cathedral height, origin story."),
  operator: ENV("control-deck", "Control Deck Observatory", "#10b981", "#065f46", "obsidian", "Graphite panels, emerald telemetry, live watch."),
};

/* ------------------------------------------------------------------ */
/* Display modes                                                       */
/* ------------------------------------------------------------------ */

export const DISPLAY_MODES = [
  { key: "gallery", label: "Gallery View", hint: "Curated wall grid" },
  { key: "museum", label: "Museum View", hint: "Glass cabinets in a lit hall" },
  { key: "showcase", label: "Showcase View", hint: "Single hero pedestal" },
  { key: "fullscreen", label: "Fullscreen View", hint: "Cinematic full-bleed stage" },
  { key: "carousel", label: "Carousel View", hint: "Rotating display turntable" },
  { key: "timeline", label: "Timeline View", hint: "Chronological acquisition rail" },
  { key: "collection", label: "Collection View", hint: "Collector album spreads" },
  { key: "comparison", label: "Comparison View", hint: "Side-by-side inspection" },
  { key: "tabletop", label: "Tabletop View", hint: "Objects laid on a desk" },
  { key: "shelf", label: "Display Shelf View", hint: "Executive display wall" },
] as const;

export type DisplayMode = (typeof DISPLAY_MODES)[number]["key"];

/* ------------------------------------------------------------------ */
/* Preview + premium detail modes                                      */
/* ------------------------------------------------------------------ */

export const PREVIEW_MODES = [
  { key: "auto", label: "Auto Rotate" },
  { key: "manual", label: "Manual Rotate" },
  { key: "zoom", label: "Zoom" },
  { key: "pan", label: "Pan" },
  { key: "inspect", label: "Inspect Mode" },
  { key: "explosion", label: "Explosion View" },
  { key: "wireframe", label: "Wireframe View" },
  { key: "material", label: "Material Preview" },
] as const;

export type PreviewMode = (typeof PREVIEW_MODES)[number]["key"];

export const FACE_VIEWS = [
  { key: "front", label: "Front", rotateY: 0, rotateX: 0 },
  { key: "back", label: "Back", rotateY: 180, rotateX: 0 },
  { key: "side", label: "Side", rotateY: 90, rotateX: 0 },
  { key: "top", label: "Top", rotateY: 0, rotateX: 62 },
  { key: "bottom", label: "Bottom", rotateY: 0, rotateX: -62 },
] as const;

export type FaceView = (typeof FACE_VIEWS)[number]["key"];

export const LIGHTING_PRESETS = [
  { key: "spotlight", label: "Spotlight", intensity: 1, warmth: 0 },
  { key: "ambient", label: "Soft Ambient", intensity: 0.55, warmth: 0.15 },
  { key: "studio", label: "Studio Key", intensity: 0.85, warmth: 0.3 },
  { key: "cinematic", label: "Cinematic Rim", intensity: 1.15, warmth: -0.1 },
  { key: "vault", label: "Vault Low-Key", intensity: 0.35, warmth: 0.05 },
] as const;

export type LightingPreset = (typeof LIGHTING_PRESETS)[number]["key"];

export const SCALE_PRESETS = [
  { key: "display", label: "Display Scale", scale: 1, note: "As shown in cabinet" },
  { key: "real", label: "Real Size", scale: 0.72, note: "≈ 90 mm physical object" },
  { key: "closeup", label: "Premium Close-up", scale: 1.55, note: "Macro engraving detail" },
] as const;

export type ScalePreset = (typeof SCALE_PRESETS)[number]["key"];

/* ------------------------------------------------------------------ */
/* Collection presentation styles                                      */
/* ------------------------------------------------------------------ */

export const COLLECTION_STYLES = [
  "Luxury Cabinet", "Executive Vault", "Digital Safe", "Collector Album",
  "Premium Display Wall", "Executive Library", "Achievement Archive", "Founder Collection",
] as const;

/* ------------------------------------------------------------------ */
/* Showcase registry — 14 premium showcases                            */
/* ------------------------------------------------------------------ */

export interface ShowcaseDef {
  slug: string;
  title: string;
  kicker: string;
  singular: string;
  /** filename suffix used for exports */
  suffix: string;
  description: string;
  assets: Record<RoleSlug, string>;
  collectionStyle: (typeof COLLECTION_STYLES)[number];
  material: string;
  accent: string;
}

export const SHOWCASES: ShowcaseDef[] = [
  {
    slug: "trophy-museum", title: "Trophy Museum", kicker: "Museum", singular: "Trophy", suffix: "trophy",
    description: "Sculpted role trophies presented on marble plinths under museum spotlights.",
    assets: ROLE_TROPHY, collectionStyle: "Luxury Cabinet", material: "Polished gold & crystal", accent: "#facc15",
  },
  {
    slug: "award-gallery", title: "Award Gallery", kicker: "Gallery", singular: "Award", suffix: "award",
    description: "Signature awards displayed as a curated gallery wall with cinematic lighting.",
    assets: ROLE_AWARD, collectionStyle: "Premium Display Wall", material: "Brushed metal & glass", accent: "#f59e0b",
  },
  {
    slug: "passport-gallery", title: "Passport Gallery", kicker: "Gallery", singular: "Digital Passport", suffix: "passport",
    description: "Identity passports in lit vitrines with holographic security detailing.",
    assets: ROLE_PASSPORT, collectionStyle: "Digital Safe", material: "Holographic laminate", accent: "#38bdf8",
  },
  {
    slug: "badge-museum", title: "Badge Museum", kicker: "Museum", singular: "Badge", suffix: "badge",
    description: "Hard-enamel badges mounted in a collector cabinet with macro close-ups.",
    assets: ROLE_BADGE, collectionStyle: "Collector Album", material: "Hard enamel & steel", accent: "#a78bfa",
  },
  {
    slug: "medal-gallery", title: "Medal Gallery", kicker: "Gallery", singular: "Medal", suffix: "reputation-medal",
    description: "Struck medals suspended on ribbon mounts with reflection floor.",
    assets: ROLE_REPUTATION, collectionStyle: "Achievement Archive", material: "Struck bronze & silk", accent: "#fb7185",
  },
  {
    slug: "certificate-hall", title: "Certificate Hall", kicker: "Hall", singular: "Certificate", suffix: "certificate",
    description: "Framed credentials in an executive library with gold engraving.",
    assets: ROLE_CERTIFICATE, collectionStyle: "Executive Library", material: "Cotton paper & gold foil", accent: "#e8d29a",
  },
  {
    slug: "legacy-museum", title: "Legacy Museum", kicker: "Museum", singular: "Legacy Medal", suffix: "legacy-medal",
    description: "Lifetime legacy pieces staged in a low-key vault hall.",
    assets: ROLE_LEGACY_MEDAL, collectionStyle: "Executive Vault", material: "Aged gold & obsidian", accent: "#d4af6a",
  },
  {
    slug: "hall-of-fame-gallery", title: "Hall Of Fame Gallery", kicker: "Gallery", singular: "Hall of Fame Emblem", suffix: "hall-of-fame",
    description: "Inducted emblems on a cathedral display wall with orbiting camera.",
    assets: ROLE_HALL_OF_FAME, collectionStyle: "Founder Collection", material: "Marble & gilt", accent: "#fcd34d",
  },
  {
    slug: "membership-gallery", title: "Membership Gallery", kicker: "Gallery", singular: "Membership Card", suffix: "membership",
    description: "Metal member cards floating above a glass shelf, NFC and hologram detail.",
    assets: ROLE_MEMBERSHIP, collectionStyle: "Luxury Cabinet", material: "Anodised metal", accent: "#22d3ee",
  },
  {
    slug: "identity-gallery", title: "Identity Gallery", kicker: "Gallery", singular: "Identity Card", suffix: "identity-card",
    description: "Identity credentials under inspection light with laser-etched serials.",
    assets: ROLE_IDENTITY_CARD, collectionStyle: "Digital Safe", material: "Polycarbonate & laser etch", accent: "#818cf8",
  },
  {
    slug: "verification-gallery", title: "Verification Gallery", kicker: "Gallery", singular: "Verification Shield", suffix: "shield",
    description: "Trust shields mounted in a secure display bay with rim lighting.",
    assets: ROLE_SHIELD, collectionStyle: "Executive Vault", material: "Titanium & sapphire", accent: "#34d399",
  },
  {
    slug: "achievement-gallery", title: "Achievement Gallery", kicker: "Gallery", singular: "Achievement", suffix: "achievement",
    description: "Achievement artefacts on floating platforms with particle reveals.",
    assets: ROLE_ACHIEVEMENT, collectionStyle: "Achievement Archive", material: "Crystal & chrome", accent: "#f472b6",
  },
  {
    slug: "rank-gallery", title: "Rank Gallery", kicker: "Gallery", singular: "Rank Emblem", suffix: "rank-emblem",
    description: "Prestige rank emblems staged in ascending tier order.",
    assets: ROLE_RANK, collectionStyle: "Premium Display Wall", material: "Cast metal & enamel", accent: "#60a5fa",
  },
  {
    slug: "reputation-gallery", title: "Reputation Gallery", kicker: "Gallery", singular: "Recognition Coin", suffix: "recognition-coin",
    description: "Recognition coins on a tabletop stage with milled-edge close-ups.",
    assets: ROLE_RECOGNITION_COIN, collectionStyle: "Collector Album", material: "Milled bullion", accent: "#fbbf24",
  },
];

export const SHOWCASE_SLUGS = SHOWCASES.map((s) => s.slug);

export function getShowcase(slug: string): ShowcaseDef | undefined {
  return SHOWCASES.find((s) => s.slug === slug);
}
