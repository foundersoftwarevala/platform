import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { withVpsPublicDatabase } from "@/lib/marketplace-manager/vps-rpc.server";

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
    const hit = cache.get(data.slug);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

    try {
      const value = await withVpsPublicDatabase(async (tx) => {
        const [category] = await tx<{
          id: string;
          name: string;
          slug: string;
          seo: { title?: unknown; description?: unknown } | null;
        }[]>`
          select id, name, slug, seo
            from public.marketplace_categories
           where slug = ${data.slug}
           limit 1
        `;
        if (!category) return null;

        const [count] = await tx<{ count: number }[]>`
          select count(*)::integer as count
            from public.marketplace_products
           where visible is true
             and category_id = ${category.id}::uuid
        `;
        const planned = await tx<{ keyword: string; country: string | null }[]>`
          select keyword, country
            from public.seo_keywords
           where industry = ${category.name}
             and status = 'planned'
           limit 60
        `;

        const seo = category.seo ?? {};
        return {
          name: category.name,
          slug: category.slug,
          productCount: Number(count?.count ?? 0),
          countries: planned.map((keyword) => keyword.country).filter((country): country is string => Boolean(country)),
          keywords: planned.map((keyword) => keyword.keyword).filter(Boolean),
          title: typeof seo.title === "string" && seo.title.trim() ? seo.title : undefined,
          description:
            typeof seo.description === "string" && seo.description.trim()
              ? seo.description
              : undefined,
        } satisfies CategorySeo;
      });
      if (!value) {
        cache.set(data.slug, { at: Date.now(), value: null });
        return null;
      }
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
    const hit = productCache.get(data.slug);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

    try {
      const row = await withVpsPublicDatabase(async (tx) => {
        const [product] = await tx<{
          name: string;
          description: string | null;
          deployment: string | null;
          search_keywords: string[] | null;
        }[]>`
          select name, description, deployment, search_keywords
            from public.marketplace_products
           where slug = ${data.slug}
             and visible is true
             and moderation_status = 'approved'
             and (content_status is null or content_status = 'published')
             and (publish_at is null or publish_at <= now())
             and (unpublish_at is null or unpublish_at > now())
           limit 1
        `;
        return product ?? null;
      });
      if (!row?.name) {
        productCache.set(data.slug, { at: Date.now(), value: null });
        return null;
      }
      const keywords = row.search_keywords ?? [];
      const value: ProductSeo = {
        name: row.name,
        description: row.description,
        deployment: row.deployment,
        // The bookkeeping markers are for our tooling, not for a meta tag.
        // The markers are bookkeeping for our own tooling - which country a
        // product targets, which region and which city it was written for.
        // They are not search terms and never belong in a meta tag.
        keywords: keywords.filter(
          (k) =>
            k !== "geo-targeted" &&
            !k.startsWith("country:") &&
            !k.startsWith("region:") &&
            !k.startsWith("city:"),
        ),
        country: readCountry(keywords),
      };
      productCache.set(data.slug, { at: Date.now(), value });
      if (productCache.size > 500) productCache.clear();
      return value;
    } catch (error) {
      console.error("[product seo] failed for", data.slug, error);
      throw error instanceof Error ? error : new Error("product SEO read failed");
    }
  });
