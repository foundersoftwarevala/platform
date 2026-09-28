// Data layer for the hero banner.
// Single source of truth = public.home_hero_slides (same table the public homepage reads).
// This module adapts that table to the richer shape used by the Hero Banner Manager UI.
import { supabase } from "@/integrations/supabase/client";
import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type HeroStatus = "draft" | "published" | "scheduled" | "archived";

/** UI-facing slide shape (adapter over home_hero_slides). */
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

const TABLE = "home_hero_slides";

type DbRow = {
  id: string;
  slug: string;
  kicker: string;
  title: string;
  subtitle: string;
  highlight: string;
  cta_primary: string;
  cta_secondary: string;
  cta_link: string;
  gradient: string;
  icon_name: string;
  accent: string;
  position: number;
  visible: boolean;
  published_at: string | null;
  unpublish_at: string | null;
  // The secondary CTA's own address. Before this column existed the manager
  // read the primary link back into it, so both buttons pointed at the same
  // place.
  cta_secondary_link?: string | null;
  // Set when a slide is archived. Without it an archived slide is
  // indistinguishable from a draft, because both have visible = false.
  archived_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  // Written by the database from the verified session, not sent by the browser.
  created_by?: string | null;
  updated_by?: string | null;
};

/** Derive ring/badge classes from a tailwind text-* accent class. */
function ringFromAccent(accent: string) {
  return accent.replace("text-", "border-").replace(/-(\d{3})$/, "-400/40");
}
function badgeFromAccent(accent: string) {
  const base = accent.replace("text-", "bg-").replace(/-(\d{3})$/, "-500/15");
  return `${base} ${accent}`;
}

function statusOf(r: DbRow): HeroStatus {
  // Archived first, and from its own column.
  //
  // Archiving sets visible = false, and so does saving a draft. This checked
  // !visible first and returned "draft" for both, so an archived slide read
  // back as a draft, the Archived tab could never hold anything and Restore
  // was unreachable. archived_at is the only thing that tells them apart.
  if (r.archived_at) return "archived";
  if (!r.visible) return "draft";
  if (r.published_at && new Date(r.published_at) > new Date()) return "scheduled";
  // An expired window means the slide has stopped showing, not that somebody
  // archived it; it goes back to draft until its dates are changed.
  if (r.unpublish_at && new Date(r.unpublish_at) <= new Date()) return "draft";
  return "published";
}

function toRow(r: DbRow): HeroSlideRow {
  const accent = r.accent || "text-cyan-300";
  return {
    id: r.id,
    slug: r.slug,
    kicker: r.kicker ?? "",
    headline: r.title ?? "",
    sub: r.subtitle ?? "",
    highlight: r.highlight ?? "",
    cta_label: r.cta_primary ?? "Learn more",
    cta_href: r.cta_link ?? "/marketplace",
    secondary_label: r.cta_secondary || null,
    // Its own column. This used to read r.cta_link - the PRIMARY button's
    // address - so both buttons went to the same place and whatever an
    // operator typed for the secondary was thrown away on save.
    secondary_href: r.cta_secondary_link ?? null,
    icon: r.icon_name || "Sparkles",
    bg_gradient: r.gradient ?? "",
    accent_class: accent,
    ring_class: ringFromAccent(accent),
    badge_class: badgeFromAccent(accent),
    status: statusOf(r),
    enabled: !!r.visible,
    sort_order: r.position ?? 0,
    publish_at: r.published_at,
    unpublish_at: r.unpublish_at,
    visible_roles: [],
    visible_countries: [],
    visible_languages: [],
    created_at: r.created_at ?? null,
    updated_at: r.updated_at ?? null,
    created_by: r.created_by ?? null,
    updated_by: r.updated_by ?? null,
  };
}

function slugify(s: string) {
  return (
    (s || "slide")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "slide"
  );
}

/** Map UI patch -> home_hero_slides columns. Only defined keys are written. */
function toDb(patch: Partial<HeroSlideRow>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.slug !== undefined) out.slug = patch.slug;
  if (patch.kicker !== undefined) out.kicker = patch.kicker;
  if (patch.headline !== undefined) out.title = patch.headline;
  if (patch.sub !== undefined) out.subtitle = patch.sub;
  if (patch.highlight !== undefined) out.highlight = patch.highlight;
  if (patch.cta_label !== undefined) out.cta_primary = patch.cta_label;
  if (patch.secondary_label !== undefined) out.cta_secondary = patch.secondary_label ?? "";
  if (patch.cta_href !== undefined) out.cta_link = patch.cta_href;
  if (patch.secondary_href !== undefined) out.cta_secondary_link = patch.secondary_href;
  if (patch.icon !== undefined) out.icon_name = patch.icon;
  if (patch.bg_gradient !== undefined) out.gradient = patch.bg_gradient;
  if (patch.accent_class !== undefined) out.accent = patch.accent_class;
  if (patch.sort_order !== undefined) out.position = patch.sort_order;
  if (patch.publish_at !== undefined) out.published_at = patch.publish_at;
  if (patch.unpublish_at !== undefined) out.unpublish_at = patch.unpublish_at;
  if (patch.enabled !== undefined) out.visible = patch.enabled;
  if (patch.status !== undefined) {
    // status drives visibility on the public homepage
    if (patch.status === "published" || patch.status === "scheduled") out.visible = true;
    if (patch.status === "draft" || patch.status === "archived") out.visible = false;
    // archived_at is what statusOf reads, so archiving has to set it and
    // restoring has to clear it. unpublish_at is left for scheduling, which is
    // a different question from whether a slide is archived.
    if (patch.status === "archived") out.archived_at = new Date().toISOString();
    if (patch.status !== "archived") out.archived_at = null;
    if (patch.status === "published") out.unpublish_at = null;
  }
  if (patch.enabled !== undefined) out.visible = patch.enabled; // explicit toggle wins
  return out;
}

/** Public: slides shown on the homepage (RLS filters to live ones for anon). */
export async function fetchPublicHeroSlides(): Promise<HeroSlideRow[]> {
  const { data, error } = await supabase
    .from(TABLE as never)
    .select("*")
    .eq("visible", true)
    .order("position", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as DbRow[]).map(toRow).filter((s) => s.status !== "archived");
}

/** Admin: every slide, any status. */
export async function fetchAllHeroSlides(): Promise<HeroSlideRow[]> {
  const { data, error } = await supabase
    .from(TABLE as never)
    .select("*")
    .order("position", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as DbRow[]).map(toRow);
}

export async function createHeroSlide(input: HeroSlideInsert): Promise<HeroSlideRow> {
  const payload = {
    slug: input.slug || `${slugify(input.headline ?? "")}-${Date.now().toString(36)}`,
    kicker: input.kicker ?? "",
    title: input.headline ?? "",
    subtitle: input.sub ?? "",
    highlight: input.highlight ?? "",
    cta_primary: input.cta_label ?? "Learn more",
    cta_secondary: input.secondary_label ?? "",
    cta_link: input.cta_href ?? "/marketplace",
    gradient: input.bg_gradient ?? "",
    icon_name: input.icon ?? "Sparkles",
    accent: input.accent_class ?? "text-cyan-300",
    position: input.sort_order ?? 999,
    visible: input.status ? input.status === "published" || input.status === "scheduled" : (input.enabled ?? true),
    published_at: input.publish_at ?? null,
    unpublish_at: input.unpublish_at ?? null,
  };
  const { data, error } = await supabase.from(TABLE as never).insert(payload as never).select("*").single();
  if (error) throw error;
  return toRow(data as unknown as DbRow);
}

export async function updateHeroSlide(id: string, patch: HeroSlideUpdate): Promise<HeroSlideRow> {
  const body = toDb(patch);
  const { data, error } = await supabase
    .from(TABLE as never)
    .update(body as never)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return toRow(data as unknown as DbRow);
}

export async function deleteHeroSlide(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE as never).delete().eq("id", id);
  if (error) throw error;
}

/**
 * One statement, not one per slide.
 *
 * This fired an update for every slide at once and awaited them together, so
 * an interrupted reorder left some renumbered and some not, and two slides
 * could end up sharing a position. mm_hero_reorder renumbers the whole set in
 * a single statement: either every position moves or none does. It also
 * refuses a list containing an id that no longer exists, which is what a
 * stale browser tab would send.
 */
export async function reorderHeroSlides(orderedIds: string[]): Promise<void> {
  const { data, error } = await supabase.rpc("mm_hero_reorder" as never, {
    p_ids: orderedIds,
  } as never);
  if (error) throw error;
  const answer = (data ?? {}) as { ok?: boolean; reason?: string };
  if (answer.ok === false) {
    throw new Error(
      answer.reason === "unknown_slide_in_list"
        ? "One of these slides no longer exists. Refresh and try again."
        : answer.reason === "not_permitted"
          ? "You do not have permission to reorder hero slides."
          : `Could not reorder the slides (${answer.reason ?? "unknown"}).`,
    );
  }
}

export function isSlideLive(s: HeroSlideRow, now = new Date()): boolean {
  if (!s.enabled) return false;
  if (s.status === "draft" || s.status === "archived") return false;
  if (s.publish_at && new Date(s.publish_at) > now) return false;
  if (s.unpublish_at && new Date(s.unpublish_at) <= now) return false;
  return true;
}

export function accentToBg(accent: string): string {
  return accent.replace("text-", "bg-");
}
