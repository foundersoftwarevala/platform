/**
 * Single source of truth for the Software Vala storefront numbers and pricing.
 * Every surface (home page, banners, manager, meta tags) must read from here so
 * the marketplace never shows conflicting counts or prices again.
 */

export const SITE_STATS = {
  solutions: "12,000+",
  solutionsShort: "12,000+ Software",
  categories: "80+",
  categoriesShort: "80+ Categories",
  liveDemos: "Live Demos",
  businesses: "50K+",
  uptime: "99.99%",
  delivery: "120 min",
} as const;

/** One fixed lifetime price across the entire ecosystem — this is the USP. */
export const LIFETIME_PRICE = "$249";
export const LIFETIME_MRP = "$999";
export const LIFETIME_LABEL = "One-time · Lifetime";
export const LIFETIME_DISCOUNT = "75% OFF";