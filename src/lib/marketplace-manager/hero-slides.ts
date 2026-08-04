/**
 * Hero Slides data layer — CRUD, publish/draft/schedule, reorder.
 * Seeded from the storefront's bundled hero slides.
 */
import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { FALLBACK_HERO_SLIDES } from "@/lib/marketplace-content/hero.functions";
import { createTable, slugify, uid } from "./store";

export type HeroStatus = "draft" | "published" | "scheduled" | "archived";

export type HeroSlideRow = {
  id: string;
  slug: string;
  kicker: string;
  headline: string;
  sub: string;
  highlight: string;
  cta_label: string;
  cta_href: string;
  secondary_label: string | null;
  secondary_href: string | null;
  icon: string;
  bg_gradient: string;
  accent_class: string;
  ring_class: string;
  badge_class: string;
  status: HeroStatus;
  enabled: boolean;
  sort_order: number;
  publish_at: string | null;
  unpublish_at: string | null;
  visible_roles: string[];
  visible_countries: string[];
  visible_languages: string[];
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
};

export type HeroSlideInsert = Partial<HeroSlideRow>;
export type HeroSlideUpdate = Partial<HeroSlideRow>;

export const HERO_ICON_CHOICES = [
  "Sparkles","Boxes","Crown","Clock","ShieldCheck","BadgeCheck","Lock",
  "Layers","Cpu","Tag","Briefcase","Building2","Handshake","Megaphone",
  "Rocket","Play","Globe2","Zap",
] as const;

export function iconFromName(name: string): LucideIcon {
  const map = Icons as unknown as Record<string, LucideIcon>;
  return map[name] ?? Icons.Sparkles;
}

function ringFromAccent(accent: string) {
  return accent.replace("text-", "border-").replace(/-(\d{3})$/, "-400/40");
}
function badgeFromAccent(accent: string) {
  const base = accent.replace("text-", "bg-").replace(/-(\d{3})$/, "-500/15");
  return `${base} ${accent}`;
}

const SEED: HeroSlideRow[] = FALLBACK_HERO_SLIDES.map((s, i) => ({
  id: s.id,
  slug: s.slug,
  kicker: s.kicker,
  headline: s.title,
  sub: s.subtitle,
  highlight: "",
  cta_label: s.cta_primary,
  cta_href: s.cta_link,
  secondary_label: s.cta_secondary || null,
  secondary_href: s.cta_link || null,
  icon: s.icon_name,
  bg_gradient: s.gradient,
  accent_class: s.accent,
  ring_class: ringFromAccent(s.accent),
  badge_class: badgeFromAccent(s.accent),
  status: s.visible ? "published" : "draft",
  enabled: s.visible,
  sort_order: s.position ?? i,
  publish_at: s.published_at,
  unpublish_at: s.unpublish_at,
  visible_roles: [],
  visible_countries: [],
  visible_languages: [],
  created_at: null,
  updated_at: null,
  created_by: null,
  updated_by: null,
}));

const slides = createTable<HeroSlideRow>("hero_slides", SEED);

function statusFor(row: HeroSlideRow): HeroStatus {
  if (row.status === "archived" || row.status === "draft") return row.status;
  if (!row.enabled) return "draft";
  if (row.publish_at && new Date(row.publish_at) > new Date()) return "scheduled";
  if (row.unpublish_at && new Date(row.unpublish_at) <= new Date()) return "archived";
  return "published";
}

function normalize(row: HeroSlideRow): HeroSlideRow {
  return { ...row, status: statusFor(row) };
}

export function isSlideLive(s: HeroSlideRow, now = new Date()): boolean {
  if (!s.enabled) return false;
  if (s.publish_at && new Date(s.publish_at) > now) return false;
  if (s.unpublish_at && new Date(s.unpublish_at) <= now) return false;
  return true;
}

export function accentToBg(accent: string): string {
  return accent.replace("text-", "bg-");
}

export async function fetchAllHeroSlides(): Promise<HeroSlideRow[]> {
  return slides.all().map(normalize).sort((a, b) => a.sort_order - b.sort_order);
}

export async function fetchPublicHeroSlides(): Promise<HeroSlideRow[]> {
  return (await fetchAllHeroSlides()).filter((s) => isSlideLive(s));
}

export async function createHeroSlide(input: HeroSlideInsert): Promise<HeroSlideRow> {
  const id = uid();
  const accent = input.accent_class ?? "text-cyan-300";
  const row: HeroSlideRow = {
    id,
    slug: input.slug || slugify(input.headline ?? "slide", "slide"),
    kicker: input.kicker ?? "",
    headline: input.headline ?? "",
    sub: input.sub ?? "",
    highlight: input.highlight ?? "",
    cta_label: input.cta_label ?? "Learn more",
    cta_href: input.cta_href ?? "/marketplace",
    secondary_label: input.secondary_label ?? null,
    secondary_href: input.secondary_href ?? null,
    icon: input.icon ?? "Sparkles",
    bg_gradient: input.bg_gradient ?? "",
    accent_class: accent,
    ring_class: input.ring_class ?? ringFromAccent(accent),
    badge_class: input.badge_class ?? badgeFromAccent(accent),
    status: input.status ?? "draft",
    enabled: input.enabled ?? (input.status === "published"),
    sort_order: input.sort_order ?? slides.all().length,
    publish_at: input.publish_at ?? null,
    unpublish_at: input.unpublish_at ?? null,
    visible_roles: input.visible_roles ?? [],
    visible_countries: input.visible_countries ?? [],
    visible_languages: input.visible_languages ?? [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: null,
    updated_by: null,
  };
  return normalize(slides.upsert(row));
}

export async function updateHeroSlide(id: string, patch: HeroSlideUpdate): Promise<HeroSlideRow> {
  const next: HeroSlideUpdate = { ...patch, updated_at: new Date().toISOString() };
  if (patch.status === "published") {
    next.enabled = true;
    next.unpublish_at = null;
  }
  if (patch.status === "scheduled") next.enabled = true;
  if (patch.status === "draft") next.enabled = false;
  if (patch.status === "archived") {
    next.enabled = false;
    next.unpublish_at = new Date().toISOString();
  }
  if (patch.accent_class) {
    next.ring_class = patch.ring_class ?? ringFromAccent(patch.accent_class);
    next.badge_class = patch.badge_class ?? badgeFromAccent(patch.accent_class);
  }
  const row = slides.patch(id, next);
  if (!row) throw new Error("Slide not found");
  return normalize(row);
}

export async function deleteHeroSlide(id: string): Promise<void> {
  slides.remove(id);
}

export async function reorderHeroSlides(orderedIds: string[]): Promise<void> {
  const order = new Map(orderedIds.map((id, i) => [id, i]));
  slides.replace(
    slides.all().map((s) => (order.has(s.id) ? { ...s, sort_order: order.get(s.id)! } : s)),
  );
}
