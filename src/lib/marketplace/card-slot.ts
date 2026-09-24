import { CARD_FIELDS, toCard, type CatalogCard } from "@/lib/marketplace/catalog-card";

/**
 * One card slot, read on the server.
 *
 * A slot is a permanent address - one category, one country - that owns its URL
 * and its SEO blueprint. The product inside it is a tenant: it can be replaced
 * without the slot moving, renaming or losing what the URL has earned.
 *
 * This reads the slot, whichever product currently occupies it, and the two
 * sets of neighbours a reader and a crawler both need: the same category in
 * every other country, and the same country in every other category. Nothing
 * is invented. A slot with no product is returned as vacant and says so.
 *
 * Server only: it reads with the service role, so it must never be imported
 * into a route loader directly. Go through card-slot.functions.ts.
 */

export type SlotNeighbourCountry = {
  marker: string;
  code: string | null;
  slug: string;
  slotNo: number;
  occupied: boolean;
};

export type SlotNeighbourCategory = {
  name: string;
  slug: string;
  url: string;
  occupied: boolean;
};

export type CardSlot = {
  id: string;
  slotNo: number;
  status: string;

  categoryId: string;
  categoryName: string;
  categorySlug: string;

  country: string;
  countryCode: string | null;
  countrySlug: string;
  region: string | null;

  slotUrl: string;
  slotTitle: string | null;

  /** The blueprint, already filled in with this slot's category and country. */
  h1: string;
  metaTitle: string;
  metaDescription: string;
  primaryKeyword: string | null;
  h2s: string[];
  keywords: string[];
  schemaTypes: string[];
  faqs: { question: string; answer: string }[];
  searchEngines: string[];

  /** The tenant. Null when the slot is vacant, which is a gap, not a missing card. */
  product: CatalogCard | null;

  /** Every country this category has a slot for - the hreflang group. */
  countries: SlotNeighbourCountry[];
  /** Other categories that also have a slot for this country. */
  categories: SlotNeighbourCategory[];
};

type Row = Record<string, unknown>;

function base() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}` };
}

/** The same slug the country pages already use, so the two agree. */
export function slotCountrySlug(country: string): string {
  return country
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const str = (value: unknown) => (value == null ? null : String(value));
const arr = (value: unknown) =>
  Array.isArray(value) ? (value as unknown[]).map(String).filter(Boolean) : [];

/**
 * Fill {category}, {country} and {product} in a stored template.
 *
 * A template that mentions a product a vacant slot does not have would read as
 * a claim about nothing, so an unfilled variable collapses the phrase around it
 * rather than printing a brace.
 */
function fill(template: string, values: Record<string, string | null>): string {
  let out = template;
  for (const [name, value] of Object.entries(values)) {
    out = out.split(`{${name}}`).join(value ?? "");
  }
  out = out
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .trim();

  // A separator left holding nothing. "Healthcare Software in Kenya — |
  // Price…" is what a vacant slot would read as when its title names the
  // product, so each part between the bars is cleaned of a dangling dash and
  // any part left with nothing but punctuation is dropped.
  return out
    .split("|")
    .map((part) =>
      part
        .trim()
        .replace(/^[—–-]+\s*/, "")
        .replace(/\s*[—–-]+$/, "")
        .trim(),
    )
    .filter((part) => /\p{L}|\p{N}/u.test(part))
    .join(" | ");
}

/**
 * The blueprint a slot falls back to before one has been written for it.
 *
 * It is built from the two things a slot always has - its category and its
 * country - so a slot is never without a heading, a title or a description,
 * and never carries a claim about a product that is not there.
 */
function defaultBlueprint(category: string, country: string) {
  return {
    h1: `${category} Software in ${country}`,
    metaTitle: `${category} Software in ${country} | Price, Demo & Source Code`,
    metaDescription:
      `${category} software for businesses in ${country}. One-time lifetime licence, ` +
      `full source code and a live demo on Software Vala.`,
    h2s: [
      `Best ${category} Software for ${country} Businesses`,
      `What ${country} Businesses Need From ${category} Software`,
      `Features and Modules`,
      `Pricing in ${country}`,
      `Local Implementation and Support in ${country}`,
      `Search and Discovery in ${country}`,
      `Integrations`,
      `Frequently Asked Questions`,
    ],
    primaryKeyword: `${category.toLowerCase()} software ${country.toLowerCase()}`,
  };
}

async function get(path: string): Promise<Row[]> {
  const response = await fetch(`${base()}/rest/v1/${path}`, { headers: admin() });
  if (!response.ok) {
    throw new Error(`${path} -> HTTP ${response.status}`);
  }
  return (await response.json()) as Row[];
}

/**
 * One slot by its two URL segments.
 *
 * Four reads, all indexed: the slot with its category, the tenant, the
 * category's other countries and the country's other categories. The
 * neighbours are ids and names only - a slot page links to its siblings, it
 * does not draw them - so the payload stays small however many there are.
 */
export async function readCardSlot(
  categorySlug: string,
  countrySlug: string,
): Promise<CardSlot | null> {
  if (!base()) return null;

  const slotUrl = `/marketplace/${categorySlug}/${countrySlug}`;
  const slots = await get(
    `marketplace_card_slots?select=*,marketplace_categories(name,slug)` +
      `&slot_url=eq.${encodeURIComponent(slotUrl)}&limit=1`,
  );
  const slot = slots[0];
  if (!slot) return null;

  const category = (slot.marketplace_categories ?? {}) as Row;
  const categoryName = String(category.name ?? categorySlug);
  const country = String(slot.country_marker ?? "");
  const fallback = defaultBlueprint(categoryName, country);

  // The tenant, read through the same card definition every other public list
  // uses, so a slot shows a product exactly as the catalogue records it.
  let product: CatalogCard | null = null;
  if (slot.current_product_id) {
    const rows = await get(
      `marketplace_products?select=${CARD_FIELDS}` +
        `&id=eq.${encodeURIComponent(String(slot.current_product_id))}` +
        `&visible=eq.true&content_status=eq.published&limit=1`,
    );
    if (rows[0]) product = toCard(rows[0]);
  }

  const [countryRows, categoryRows] = await Promise.all([
    get(
      `marketplace_card_slots?select=country_marker,country_code,slot_no,slot_url,status` +
        `&category_id=eq.${encodeURIComponent(String(slot.category_id))}&order=slot_no.asc`,
    ),
    get(
      `marketplace_card_slots?select=slot_url,status,marketplace_categories(name,slug)` +
        `&country_marker=eq.${encodeURIComponent(country)}` +
        `&category_id=neq.${encodeURIComponent(String(slot.category_id))}` +
        `&order=slot_url.asc`,
    ),
  ]);

  const countries: SlotNeighbourCountry[] = countryRows.map((row) => {
    const marker = String(row.country_marker ?? "");
    return {
      marker,
      code: str(row.country_code),
      slug: slotCountrySlug(marker),
      slotNo: Number(row.slot_no ?? 0),
      occupied: row.status === "occupied",
    };
  });

  const categories: SlotNeighbourCategory[] = categoryRows.map((row) => {
    const linked = (row.marketplace_categories ?? {}) as Row;
    return {
      name: String(linked.name ?? ""),
      slug: String(linked.slug ?? ""),
      url: String(row.slot_url ?? ""),
      occupied: row.status === "occupied",
    };
  });

  const values = { category: categoryName, country, product: product?.name ?? "" };
  const storedH2s = arr(slot.h2_templates);
  const storedKeywords = Array.isArray(slot.keyword_set)
    ? (slot.keyword_set as unknown[]).map(String).filter(Boolean)
    : [];
  const storedFaqs = Array.isArray(slot.faq_set)
    ? (slot.faq_set as { question?: unknown; answer?: unknown }[])
        .filter((f) => f && typeof f.question === "string" && typeof f.answer === "string")
        .map((f) => ({ question: String(f.question), answer: String(f.answer) }))
    : [];

  return {
    id: String(slot.id),
    slotNo: Number(slot.slot_no ?? 0),
    status: String(slot.status ?? "vacant"),

    categoryId: String(slot.category_id),
    categoryName,
    categorySlug: String(category.slug ?? categorySlug),

    country,
    countryCode: str(slot.country_code),
    countrySlug,
    region: str(slot.region),

    slotUrl,
    slotTitle: str(slot.slot_title),

    h1: slot.h1_template ? fill(String(slot.h1_template), values) : fallback.h1,
    metaTitle: slot.meta_title_template
      ? fill(String(slot.meta_title_template), values)
      : fallback.metaTitle,
    metaDescription: slot.meta_description_template
      ? fill(String(slot.meta_description_template), values)
      : fallback.metaDescription,
    primaryKeyword: str(slot.primary_keyword) ?? fallback.primaryKeyword,
    h2s: (storedH2s.length ? storedH2s : fallback.h2s).map((h) => fill(h, values)),
    keywords: storedKeywords,
    schemaTypes: arr(slot.schema_types),
    faqs: storedFaqs,
    searchEngines: arr(slot.search_engines),

    product,
    countries,
    categories,
  };
}
