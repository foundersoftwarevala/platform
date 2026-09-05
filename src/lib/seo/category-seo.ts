import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * SEO for a marketplace category page.
 *
 * The country plan the SEO manager holds in `seo_keywords` is what this reads,
 * so the page and the manager can never drift apart: change a keyword there and
 * the category page says the same thing. An editor can override the title or
 * description per category through `marketplace_categories.seo`, and that
 * always wins.
 *
 * Runs on the server, so the service key never reaches a browser.
 */

export type CategorySeo = {
  name: string;
  slug: string;
  productCount: number;
  countries: string[];
  keywords: string[];
  /** Editor overrides from marketplace_categories.seo, when set. */
  title?: string;
  description?: string;
};

const CACHE_MS = 300_000;
const cache = new Map<string, { at: number; value: CategorySeo | null }>();
const productCache = new Map<string, { at: number; value: ProductSeo | null }>();

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return { apikey: key, Authorization: `Bearer ${key}` };
}

export const getCategorySeo = createServerFn({ method: "GET" })
  .validator((v) => z.object({ slug: z.string().min(1).max(120) }).parse(v ?? {}))
  .handler(async ({ data }): Promise<CategorySeo | null> => {
    const url = process.env.SUPABASE_URL?.trim();
    if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;

    const hit = cache.get(data.slug);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

    try {
      const categoryResponse = await fetch(
        `${url}/rest/v1/marketplace_categories?select=id,name,slug,seo` +
          `&slug=eq.${encodeURIComponent(data.slug)}&limit=1`,
        { headers: admin() },
      );
      const categories = categoryResponse.ok
        ? ((await categoryResponse.json()) as Record<string, unknown>[])
        : [];
      const category = categories[0];
      if (!category) {
        cache.set(data.slug, { at: Date.now(), value: null });
        return null;
      }

      // How many products the row actually holds.
      const countResponse = await fetch(
        `${url}/rest/v1/marketplace_products?select=id&visible=eq.true` +
          `&category_id=eq.${String(category.id)}&limit=1`,
        { headers: { ...admin(), Prefer: "count=exact" } },
      );
      const range = countResponse.headers.get("content-range") ?? "";
      const productCount = Number(range.split("/")[1]) || 0;

      // The country plan, straight from the SEO manager's own table.
      const keywordResponse = await fetch(
        `${url}/rest/v1/seo_keywords?select=keyword,country` +
          `&industry=eq.${encodeURIComponent(String(category.name))}` +
          `&status=eq.planned&limit=60`,
        { headers: admin() },
      );
      const planned = keywordResponse.ok
        ? ((await keywordResponse.json()) as { keyword: string; country: string }[])
        : [];

      const seo = (category.seo ?? {}) as { title?: string; description?: string };
      const value: CategorySeo = {
        name: String(category.name),
        slug: String(category.slug),
        productCount,
        countries: planned.map((k) => k.country).filter(Boolean),
        keywords: planned.map((k) => k.keyword).filter(Boolean),
        title: typeof seo.title === "string" && seo.title.trim() ? seo.title : undefined,
        description:
          typeof seo.description === "string" && seo.description.trim()
            ? seo.description
            : undefined,
      };

      cache.set(data.slug, { at: Date.now(), value });
      if (cache.size > 200) cache.clear();
      return value;
    } catch (error) {
      console.error("[category seo] failed for", data.slug, error);
      return null;
    }
  });

export type ProductSeo = {
  name: string;
  description: string | null;
  deployment: string | null;
  keywords: string[];
  country?: string;
};

/** The target country is stored on the product as a `country:<name>` keyword. */
function readCountry(keywords: string[]): string | undefined {
  const marker = keywords.find((k) => k.startsWith("country:"));
  return marker ? marker.slice("country:".length) : undefined;
}

/**
 * Everything the product page's head needs, read directly from the catalogue.
 * Kept separate from the product mapper used by the page body so a change to
 * that mapper cannot silently strip the SEO fields again.
 */
export const getProductSeo = createServerFn({ method: "GET" })
  .validator((v) => z.object({ slug: z.string().min(1).max(200) }).parse(v ?? {}))
  .handler(async ({ data }): Promise<ProductSeo | null> => {
    const url = process.env.SUPABASE_URL?.trim();
    if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;

    const hit = productCache.get(data.slug);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

    try {
      const response = await fetch(
        `${url}/rest/v1/marketplace_products` +
          `?select=name,description,deployment,search_keywords` +
          `&slug=eq.${encodeURIComponent(data.slug)}&limit=1`,
        { headers: admin() },
      );
      const rows = response.ok ? ((await response.json()) as Record<string, unknown>[]) : [];
      const row = rows[0];
      if (!row?.name) {
        productCache.set(data.slug, { at: Date.now(), value: null });
        return null;
      }
      const keywords = Array.isArray(row.search_keywords) ? (row.search_keywords as string[]) : [];
      const value: ProductSeo = {
        name: String(row.name),
        description: (row.description as string) ?? null,
        deployment: (row.deployment as string) ?? null,
        // The bookkeeping markers are for our tooling, not for a meta tag.
        keywords: keywords.filter((k) => k !== "geo-targeted" && !k.startsWith("country:")),
        country: readCountry(keywords),
      };
      productCache.set(data.slug, { at: Date.now(), value });
      if (productCache.size > 500) productCache.clear();
      return value;
    } catch (error) {
      console.error("[product seo] failed for", data.slug, error);
      return null;
    }
  });
