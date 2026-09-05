import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * The country pages.
 *
 * Every product in the catalogue is written for one country, and until now that
 * only showed up inside the product's own title. There was nowhere a buyer in
 * Kenya or the UAE could land and see what the catalogue holds for them, and
 * nothing for a crawler to follow from a country search into the catalogue.
 *
 * A country page is worth having because there is real depth behind it: each of
 * the sixty countries carries around ninety products across most of the
 * catalogue's categories. Country and category together is not - almost every
 * such pair holds a single product - so that page is deliberately not built
 * rather than filling the index with thin ones.
 *
 * Nothing here invents a country. The list comes from the markers on the
 * products themselves, through the database, so a country appears when products
 * are written for it and disappears when they are not.
 */

const CACHE_MS = 300_000;

export type CountryCategory = {
  id: string;
  name: string;
  slug: string;
  productCount: number;
};

export type CountrySeo = {
  country: string;
  slug: string;
  productCount: number;
  categories: CountryCategory[];
};

type CountryRow = { country: string; product_count: number };

let countryCache: { at: number; rows: CountryRow[] } | null = null;
const pageCache = new Map<string, { at: number; value: CountrySeo | null }>();

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}` };
}

/** "Trinidad & Tobago" -> "trinidad-tobago". Stable, and safe in a URL. */
export function countrySlug(country: string): string {
  return country
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Every country the catalogue is written for, with how much it holds. */
export async function countryRows(): Promise<CountryRow[]> {
  if (countryCache && Date.now() - countryCache.at < CACHE_MS) return countryCache.rows;
  if (!url() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  try {
    const response = await fetch(`${url()}/rest/v1/rpc/marketplace_countries`, {
      method: "POST",
      headers: { ...admin(), "Content-Type": "application/json" },
      body: "{}",
    });
    if (!response.ok) return countryCache?.rows ?? [];
    const rows = (await response.json()) as CountryRow[];
    countryCache = { at: Date.now(), rows };
    return rows;
  } catch (error) {
    console.error("[country seo] country list failed", error);
    return countryCache?.rows ?? [];
  }
}

/** The country a slug names, or null when no such country is targeted. */
async function resolve(slug: string): Promise<CountryRow | null> {
  const wanted = countrySlug(slug);
  const rows = await countryRows();
  return rows.find((row) => countrySlug(row.country) === wanted) ?? null;
}

export const getCountrySeo = createServerFn({ method: "GET" })
  .validator((v) => z.object({ slug: z.string().min(1).max(120) }).parse(v ?? {}))
  .handler(async ({ data }): Promise<CountrySeo | null> => {
    const key = countrySlug(data.slug);
    const hit = pageCache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

    const row = await resolve(data.slug);
    if (!row) {
      pageCache.set(key, { at: Date.now(), value: null });
      return null;
    }

    let categories: CountryCategory[] = [];
    try {
      const response = await fetch(`${url()}/rest/v1/rpc/marketplace_country_categories`, {
        method: "POST",
        headers: { ...admin(), "Content-Type": "application/json" },
        body: JSON.stringify({ target: row.country }),
      });
      if (response.ok) {
        const rows = (await response.json()) as {
          category_id: string;
          category_name: string;
          category_slug: string;
          product_count: number;
        }[];
        categories = rows.map((c) => ({
          id: c.category_id,
          name: c.category_name,
          slug: c.category_slug,
          productCount: Number(c.product_count) || 0,
        }));
      }
    } catch (error) {
      console.error("[country seo] categories failed for", row.country, error);
    }

    const value: CountrySeo = {
      country: row.country,
      slug: countrySlug(row.country),
      productCount: Number(row.product_count) || 0,
      categories,
    };
    pageCache.set(key, { at: Date.now(), value });
    if (pageCache.size > 200) pageCache.clear();
    return value;
  });

const CARD_FIELDS =
  "id,slug,name,icon,industry_label,price_label,price_period,rating," +
  "downloads_label,badge,is_featured,is_trending,is_best_seller,is_new_release";

export type CountryCard = {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  industry: string | null;
  price: string | null;
  period: string | null;
  badge: string | null;
  href: string;
};

function toCard(row: Record<string, unknown>): CountryCard {
  return {
    id: String(row.id),
    slug: String(row.slug ?? ""),
    name: String(row.name ?? ""),
    icon: row.icon == null ? null : String(row.icon),
    industry: row.industry_label == null ? null : String(row.industry_label),
    price: row.price_label == null ? null : String(row.price_label),
    period: row.price_period == null ? null : String(row.price_period),
    badge: row.badge == null ? null : String(row.badge),
    href: `/marketplace/product/${String(row.slug ?? "")}`,
  };
}

/**
 * The products carrying one country's marker, a page at a time.
 *
 * The marker lives in the product's own keyword list, so this is an array
 * containment match against an indexed column - a lookup rather than a scan,
 * however far the catalogue grows. A card carries no demo address, like every
 * other public list in the marketplace.
 */
export const getCountryProducts = createServerFn({ method: "GET" })
  .validator((v) =>
    z
      .object({
        slug: z.string().min(1).max(120),
        offset: z.number().int().min(0).max(100000).optional(),
        limit: z.number().int().min(1).max(60).optional(),
      })
      .parse(v ?? {}),
  )
  .handler(async ({ data }): Promise<{ country: string; cards: CountryCard[]; total: number }> => {
    const row = await resolve(data.slug);
    if (!row || !url()) return { country: "", cards: [], total: 0 };

    const offset = data.offset ?? 0;
    const limit = data.limit ?? 24;
    const marker = encodeURIComponent(`{"country:${row.country}"}`);

    try {
      const response = await fetch(
        `${url()}/rest/v1/marketplace_products?select=${CARD_FIELDS}` +
          `&visible=eq.true&content_status=eq.published` +
          `&search_keywords=cs.${marker}` +
          `&order=sort_order.asc,name.asc&limit=${limit}&offset=${offset}`,
        { headers: { ...admin(), Prefer: "count=exact" } },
      );
      if (!response.ok) return { country: row.country, cards: [], total: 0 };
      const rows = (await response.json()) as Record<string, unknown>[];
      const range = response.headers.get("content-range") ?? "";
      return {
        country: row.country,
        cards: rows.map(toCard),
        total: Number(range.split("/")[1]) || rows.length,
      };
    } catch (error) {
      console.error("[country seo] products failed for", row.country, error);
      return { country: row.country, cards: [], total: 0 };
    }
  });

/** Every country page that should exist, for the sitemap. */
export const listCountrySlugs = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ slug: string; country: string; productCount: number }[]> => {
    const rows = await countryRows();
    return rows
      .filter((row) => Number(row.product_count) > 0)
      .map((row) => ({
        slug: countrySlug(row.country),
        country: row.country,
        productCount: Number(row.product_count) || 0,
      }));
  },
);
