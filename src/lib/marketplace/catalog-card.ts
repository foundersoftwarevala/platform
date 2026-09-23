/**
 * The marketplace product card: which columns of `marketplace_products` a card
 * reads, and how a row becomes a card.
 *
 * One definition for every public list - the home page rows, their paging,
 * search results and the country pages. It used to be copied into each of
 * them, and the copies had started to drift.
 */

/** Only what a card actually draws, so a row of sixty stays small. */
export const CARD_FIELDS =
  "id,slug,name,icon,industry_label,price_label,price_period,rating," +
  "downloads_label,badge,is_featured,is_trending,is_best_seller,is_new_release," +
  "search_keywords," +
  // Real product copy and capability. Coverage across the published
  // catalogue: description 100%, features 67%, tech_stack / licence /
  // deployment / subcategory 67%.
  "description,features,tech_stack,license,deployment,subcategory," +
  // Whether a demo exists. The address itself is never sent to a browser.
  "product_demo_urls(url,status)";

export type CatalogCard = {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  industry: string | null;
  price: string | null;
  period: string | null;
  rating: number | null;
  downloads: string | null;
  badge: string | null;
  featured: boolean;
  trending: boolean;
  bestSeller: boolean;
  newRelease: boolean;
  country: string | null;
  href: string;
  description: string | null;
  features: string[];
  tech: string[];
  license: string | null;
  platform: string | null;
  subcategory: string | null;
  hasDemo: boolean;
};

type Row = Record<string, unknown>;

/** The country a product is targeted at, stored on the row as `country:<name>`. */
function countryOf(keywords: unknown): string | null {
  if (!Array.isArray(keywords)) return null;
  const marker = keywords.find((k) => typeof k === "string" && k.startsWith("country:")) as
    string | undefined;
  return marker ? marker.slice("country:".length) : null;
}

const text = (value: unknown) => (value == null ? null : String(value));
const list = (value: unknown) =>
  Array.isArray(value) ? (value as unknown[]).slice(0, 6).map(String).filter(Boolean) : [];

export function toCard(row: Row): CatalogCard {
  return {
    id: String(row.id),
    slug: String(row.slug ?? ""),
    name: String(row.name ?? ""),
    icon: text(row.icon),
    industry: text(row.industry_label),
    price: text(row.price_label),
    period: text(row.price_period),
    rating: row.rating == null ? null : Number(row.rating),
    downloads: text(row.downloads_label),
    badge: text(row.badge),
    featured: Boolean(row.is_featured),
    trending: Boolean(row.is_trending),
    bestSeller: Boolean(row.is_best_seller),
    newRelease: Boolean(row.is_new_release),
    country: countryOf(row.search_keywords),
    href: `/marketplace/product/${String(row.slug ?? "")}`,
    // Trimmed so the payload stays small; the card clamps it again.
    description:
      typeof row.description === "string" && row.description.trim()
        ? row.description.trim().slice(0, 240)
        : null,
    features: list(row.features),
    tech: list(row.tech_stack),
    license: text(row.license),
    platform: text(row.deployment),
    subcategory: text(row.subcategory),
    // A demo counts only if it is switched on and actually has an address.
    hasDemo: Array.isArray(row.product_demo_urls)
      ? (row.product_demo_urls as { url?: unknown; status?: unknown }[]).some(
          (d) => typeof d?.url === "string" && d.url.trim() !== "" && d?.status === "active",
        )
      : false,
  };
}
