import { toCard, type CatalogCard } from "@/lib/marketplace/catalog-card";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { withVpsPublicDatabase } from "@/lib/marketplace-manager/vps-rpc.server";

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
  try {
    const rows = await withVpsPublicDatabase((tx) =>
      tx<CountryRow[]>`
        select country, product_count::integer as product_count
          from public.marketplace_countries()
      `,
    );
    countryCache = { at: Date.now(), rows };
    return rows;
  } catch (error) {
    console.error("[country seo] country list failed", error);
    throw error;
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

    let categories: CountryCategory[];
    try {
      const rows = await withVpsPublicDatabase((tx) =>
        tx<{
          category_id: string;
          category_name: string;
          category_slug: string;
          product_count: number;
        }[]>`
          select category_id,
                 category_name,
                 category_slug,
                 product_count::integer as product_count
            from public.marketplace_country_categories(${row.country})
        `,
      );
      categories = rows.map((c) => ({
        id: c.category_id,
        name: c.category_name,
        slug: c.category_slug,
        productCount: Number(c.product_count) || 0,
      }));
    } catch (error) {
      console.error("[country seo] categories failed for", row.country, error);
      throw error;
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

// The card is the marketplace's one product card (src/lib/marketplace/catalog-card.ts).
export type CountryCard = CatalogCard;

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
    if (!row) return { country: "", cards: [], total: 0 };

    const offset = data.offset ?? 0;
    const limit = data.limit ?? 24;

    try {
      const { rows, total } = await withVpsPublicDatabase(async (tx) => {
        const [count] = await tx<{ count: number }[]>`
          select count(*)::integer as count
            from public.marketplace_products
           where visible is true
             and content_status = 'published'
             and search_keywords @> array[${`country:${row.country}`}]::text[]
        `;
        const products = await tx<Record<string, unknown>[]>`
          select p.id,
                 p.slug,
                 p.name,
                 p.icon,
                 p.industry_label,
                 p.price_label,
                 p.price_period,
                 p.rating,
                 p.downloads_label,
                 p.badge,
                 p.is_featured,
                 p.is_trending,
                 p.is_best_seller,
                 p.is_new_release,
                 p.search_keywords,
                 p.description,
                 p.features,
                 p.tech_stack,
                 p.license,
                 p.deployment,
                 p.subcategory,
                 p.category_id,
                 coalesce((
                   select jsonb_agg(jsonb_build_object(
                     'url', d.url,
                     'status', d.status,
                     'detected_category_id', d.detected_category_id
                   ))
                     from public.product_demo_urls d
                    where d.product_id = p.id
                 ), '[]'::jsonb) as product_demo_urls
            from public.marketplace_products p
           where p.visible is true
             and p.content_status = 'published'
             and p.search_keywords @> array[${`country:${row.country}`}]::text[]
           order by p.sort_order asc, p.name asc
           limit ${limit} offset ${offset}
        `;
        return { rows: products, total: Number(count?.count ?? 0) };
      });
      return {
        country: row.country,
        cards: rows.map(toCard),
        total: total || rows.length,
      };
    } catch (error) {
      console.error("[country seo] products failed for", row.country, error);
      throw error;
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
