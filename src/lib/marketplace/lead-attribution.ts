/**
 * Turning what a visitor's browser reported into what Lead Manager records.
 *
 * The capture endpoint wrote `source: "marketplace"` for every lead, so the
 * source breakdown on the Sources screen described nothing: a search arrival, a
 * newsletter click and a walk-in were one bucket. `leads.source` is an enum
 * with `seo`, `ads`, `social` and `referral` already in it - the values were
 * there, nothing ever chose between them.
 *
 * These rules are deliberately conservative. Where the signals disagree or say
 * nothing, the lead keeps the caller's own idea of its source rather than being
 * assigned a better-sounding one. An SEO programme judged on leads it did not
 * earn is worse off than one judged on fewer leads it did.
 */

import type { Attribution } from "./attribution";

/** The `lead_source_type` enum, as the database defines it. */
export type LeadSource =
  "website" | "seo" | "social" | "ads" | "marketplace" | "referral" | "manual" | "api" | "whatsapp";

/** Mediums that mean somebody paid for the click. */
const PAID = /^(cpc|ppc|paid|paidsearch|paid_search|paid-social|display|banner|retargeting)$/i;
/** Mediums that mean the click was earned. */
const ORGANIC = /^(organic|organic_search|seo|search)$/i;
/** Mediums that are somebody else's list, not a search engine. */
const REFERRAL_MEDIUM = /^(email|newsletter|affiliate|partner|referral|sms)$/i;

const SOCIAL_HOSTS =
  /(^|\.)(facebook|instagram|linkedin|twitter|x|t|youtube|pinterest|reddit|tiktok|threads|whatsapp|telegram|vk|weibo)\.(com|co|me|org|net|cn|ru)$/i;

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Which source earned this lead.
 *
 * Order matters and is the order of certainty. A paid medium is paid even when
 * the referrer is a search engine - that is exactly what a search ad looks
 * like, and counting it as SEO would credit the free channel for bought
 * traffic, which is the most expensive mistake this function can make.
 */
export function deriveSource(
  attribution: Partial<Attribution> | null | undefined,
  fallback: LeadSource = "marketplace",
): { source: LeadSource; why: string } {
  const a = attribution ?? {};
  const medium = (a.utm_medium ?? "").trim();
  const utmSource = (a.utm_source ?? "").trim();

  if (medium && PAID.test(medium)) {
    return { source: "ads", why: `utm_medium=${medium} is a paid medium` };
  }
  if (medium && ORGANIC.test(medium)) {
    return { source: "seo", why: `utm_medium=${medium}` };
  }
  if (a.search_engine) {
    return { source: "seo", why: `referred by ${a.search_engine}` };
  }

  const host = hostOf(a.referrer ?? null);
  if (host && SOCIAL_HOSTS.test(host)) {
    return { source: "social", why: `referred by ${host}` };
  }
  if (medium && REFERRAL_MEDIUM.test(medium)) {
    return { source: "referral", why: `utm_medium=${medium}` };
  }
  // A campaign parameter with no medium still says somebody sent them.
  if (utmSource) {
    return { source: "referral", why: `utm_source=${utmSource}` };
  }
  if (host) {
    return { source: "referral", why: `referred by ${host}` };
  }

  return { source: fallback, why: "no external signal; kept the caller's source" };
}

/**
 * The card slot path a visit began on, if it began on one.
 *
 * A slot lives at /marketplace/<category>/<country> and its slot_url column is
 * uniquely indexed, so a match is one indexed lookup. The landing page is
 * preferred over the converting page: the slot that earned the visit is the
 * one search ranked, not whichever page the visitor happened to be reading
 * when they finally filled the form in.
 *
 * Product, category and country pages deliberately do not match - they are not
 * slots, and `product_id` and `category` already record those.
 */
export function slotPathFrom(...candidates: (string | null | undefined)[]): string | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    // Strip an origin and any query string; slot_url is a bare path.
    let path = candidate.trim();
    try {
      if (/^https?:\/\//i.test(path)) path = new URL(path).pathname;
    } catch {
      continue;
    }
    path = path.split("?")[0].split("#")[0].replace(/\/+$/, "");

    const match = path.match(/^\/marketplace\/([a-z0-9-]{2,80})\/([a-z0-9-]{2,80})$/i);
    if (!match) continue;
    // These two are real routes that share the shape but are not slots.
    if (/^(product|category|country)$/i.test(match[1])) continue;
    return path.toLowerCase();
  }
  return null;
}
