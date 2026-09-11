// Marketplace ↔ Manager data layer.
// Public reads use a server publishable client (RLS enforced as anon).
// Admin mutations use requireSupabaseAuth — RLS enforces boss/admin role.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { SUPPLIED_DEMOS_16 } from "@/lib/supplied-demos-catalog";
import { applyPublicProductFilter, isPublicProduct } from "@/lib/marketplace/public-visibility";

export type ProductDemoBinding = {
  id: string;
  demo_name: string;
  role_name: string;
  status: string;
  environment: string;
  url: string;
};

export type MarketProduct = {
  id: string;
  slug: string;
  name: string;
  category_id?: string | null;
  category_name?: string | null;
  industry_label: string | null;
  icon: string;
  price_label: string;
  price_period: string | null;
  rating: number;
  downloads: number;
  downloads_label: string | null;
  badge: "NEW" | "HOT" | "TOP" | "DEAL" | null;
  description?: string | null;
  thumbnail_url?: string | null;
  public_repo_url?: string | null;
  tags?: string[];
  tech_stack?: string[];
  features?: unknown;
  content_status?: string;
  demo_count?: number;
  demo_urls?: ProductDemoBinding[];
};

export type MarketIndustry = {
  id: string;
  slug: string;
  name: string;
  icon: string;
  image_key: string | null;
  product_count: number;
  tone: string;
};

export type MarketVendor = {
  id: string;
  slug: string;
  name: string;
  country: string | null;
  verified: boolean;
  rating: number;
  product_count: number;
};

export type HomepageSection = {
  key: string;
  title: string;
  enabled: boolean;
  sort_order: number;
};

export type PublicDemoAvailability = {
  slugs: string[];
};

export type Marketplace = {
  featured: MarketProduct[];
  trending: MarketProduct[];
  bestSellers: MarketProduct[];
  newReleases: MarketProduct[];
  aiProducts: MarketProduct[];
  industries: MarketIndustry[];
  vendors: MarketVendor[];
  sections: HomepageSection[];
};

export type FeatureStripItem = {
  id: string;
  label: string;
  icon_name: string;
  color_class: string;
  position: number;
  visible: boolean;
};

export type Category = {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  image_key: string | null;
  tone: string | null;
  sort_order: number;
  is_featured?: boolean;
  is_hidden?: boolean;
};

export type PublicProduct = MarketProduct & {
  demo_count?: number;
  demo_urls?: ProductDemoBinding[];
};

export type PublicProductPageData = {
  product: PublicProduct | null;
  active_demos: ProductDemoBinding[];
  seo?: {
    title: string | null;
    meta_title: string | null;
    meta_description: string | null;
    canonical_url: string | null;
    schema_json: string | Record<string, unknown> | null;
  } | null;
  /**
   * True only when the catalogue answered and there is no public product at
   * this slug. An outage never sets it, so the page route can answer 404 for a
   * missing product without ever 404ing a real one the database could not reach.
   */
  not_found?: boolean;
};

/** The category page's answer, with the same "definitely absent" flag. */
export type PublicCategoryPageData = {
  category: Category | null;
  products: PublicProduct[];
  /** True only when the catalogue answered and no public category has this slug. */
  not_found?: boolean;
};

// Product and category pages are the same for every visitor, so each is built
// once a minute rather than on every request - the pattern the home catalogue
// already uses. Only a successful public answer is kept: an error, an outage or
// a missing slug is asked again next time. The size bound stops a crawl of the
// whole catalogue from holding every page in memory indefinitely.
const PUBLIC_PAGE_CACHE_MS = 60_000;
const PUBLIC_PAGE_CACHE_MAX = 5_000;
type PageCache<T> = Map<string, { at: number; payload: T }>;
const productPageCache: PageCache<PublicProductPageData> = new Map();
const categoryPageCache: PageCache<PublicCategoryPageData> = new Map();

function readPageCache<T>(cache: PageCache<T>, key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at >= PUBLIC_PAGE_CACHE_MS) {
    cache.delete(key);
    return null;
  }
  return hit.payload;
}

function writePageCache<T>(cache: PageCache<T>, key: string, payload: T): void {
  if (!cache.has(key) && cache.size >= PUBLIC_PAGE_CACHE_MAX) {
    // A Map iterates in insertion order, so the first key is the oldest entry.
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), payload });
}

function resolveSupabaseEnv() {
  const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const env = typeof process !== "undefined" ? process.env : undefined;
  const url = viteEnv?.VITE_SUPABASE_URL ?? env?.SUPABASE_URL ?? "";
  const key =
    viteEnv?.VITE_SUPABASE_PUBLISHABLE_KEY ??
    viteEnv?.VITE_SUPABASE_ANON_KEY ??
    env?.SUPABASE_PUBLISHABLE_KEY ??
    env?.SUPABASE_ANON_KEY ??
    env?.SUPABASE_SERVICE_ROLE_KEY ??
    "";

  if (!url || !key) {
    throw new Error("Missing Supabase environment configuration: set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY).")
  }

  return { url, key };
}

// ---------- server-only publishable client (public reads) ----------
function publicClient() {
  const { url, key } = resolveSupabaseEnv();
  const serverKey = typeof process !== "undefined" ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined;
  const readKey = serverKey || key;
  return createClient<Database>(url, readKey, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (readKey.startsWith("sb_") && h.get("Authorization") === `Bearer ${readKey}`) h.delete("Authorization");
        h.set("apikey", readKey);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const PRODUCT_COLS =
  "id, slug, name, industry_label, icon, price_label, price_period, rating, downloads, downloads_label, badge, description, thumbnail_url, public_repo_url, tags, tech_stack, features, content_status";

/** Returns only product slugs with an active Demo Manager URL. */
export const getPublicDemoAvailability = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicDemoAvailability> => {
    const sb = publicClient();
    const { data, error } = await sb
      .from("product_demo_urls")
      .select("product_id, marketplace_products!inner(slug, visible)")
      .eq("status", "active")
      .eq("marketplace_products.visible", true)
      .eq("marketplace_products.content_status", "published");
    if (error) throw error;

    return {
      slugs: (data ?? [])
        .map((row: any) => row.marketplace_products?.slug)
        .filter((slug: unknown): slug is string => typeof slug === "string"),
    };
  },
);

function normalizeBadge(value: unknown): MarketProduct["badge"] {
  const normalized = String(value ?? "").toUpperCase();
  if (normalized === "NEW" || normalized === "HOT" || normalized === "TOP" || normalized === "DEAL") {
    return normalized as MarketProduct["badge"];
  }
  return null;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "product";
}

function buildSuppliedCatalogFallback(): PublicProduct[] {
  return SUPPLIED_DEMOS_16.map((demo) => ({
    id: demo.slug,
    slug: demo.slug,
    name: demo.name,
    industry_label: demo.masterCategory,
    icon: demo.iconName ?? "Sparkles",
    price_label: "₹49,999",
    price_period: "lifetime",
    rating: 4.8,
    downloads: 1200,
    downloads_label: "1.2K+",
    badge: "HOT",
    demo_count: 1,
    demo_urls: [{
      id: `${demo.slug}-demo`,
      demo_name: demo.name,
      role_name: "Public",
      status: "active",
      environment: "production",
      // This copy reaches browsers when the catalogue cannot be read, and the
      // live address never travels to a browser (see withoutAddress). The demo
      // is opened through the gate, which resolves the address on the server.
      url: "",
    }],
  }));
}

function toProduct(r: any): MarketProduct {
  return {
    id: r.id,
    slug: r.slug ?? slugify(r.name ?? "product"),
    name: r.name,
    category_id: r.category_id ?? null,
    category_name: r.category_name ?? r.marketplace_categories?.name ?? null,
    industry_label: r.industry_label,
    icon: r.icon ?? "Sparkles",
    price_label: r.price_label ?? "",
    price_period: r.price_period,
    rating: Number(r.rating ?? 0),
    downloads: Number(r.downloads ?? 0),
    downloads_label: r.downloads_label,
    badge: normalizeBadge(r.badge),
    description: r.description ?? null,
    thumbnail_url: r.thumbnail_url ?? null,
    public_repo_url: r.public_repo_url ?? null,
    tags: Array.isArray(r.tags) ? r.tags : [],
    tech_stack: Array.isArray(r.tech_stack) ? r.tech_stack : [],
    features: r.features ?? [],
    content_status: r.content_status ?? "draft",
  };
}

function mapProductRecord(row: any): PublicProduct {
  const metadata = (row.metadata && typeof row.metadata === "object" ? row.metadata : {}) as Record<string, unknown>;
  const industryLabel = (row.industry_label as string | null | undefined) ?? (typeof metadata.industry_label === "string" ? metadata.industry_label : null);
  const icon = (row.icon as string | null | undefined) ?? (typeof metadata.icon === "string" ? metadata.icon : "Sparkles");
  const priceLabel = (row.price_label as string | null | undefined) ?? (typeof metadata.price_label === "string" ? metadata.price_label : "Custom");
  const pricePeriod = (row.price_period as string | null | undefined) ?? (typeof metadata.price_period === "string" ? metadata.price_period : null);
  const rating = Number((row.rating as number | undefined) ?? (typeof metadata.rating === "number" ? metadata.rating : 0));
  const downloads = Number((row.downloads as number | undefined) ?? (typeof metadata.downloads === "number" ? metadata.downloads : 0));
  const downloadsLabel = (row.downloads_label as string | null | undefined) ?? (typeof metadata.downloads_label === "string" ? metadata.downloads_label : null);
  const badge = normalizeBadge((row.badge as string | null | undefined) ?? metadata.badge ?? row.live_status ?? row.demo_status);

  return {
    ...toProduct({
      id: row.id,
      slug: row.slug ?? slugify(row.name ?? "product"),
      name: row.name,
      category_id: row.category_id,
      category_name: row.marketplace_categories?.name,
      industry_label: industryLabel,
      icon,
      price_label: priceLabel,
      price_period: pricePeriod,
      rating,
      downloads,
      downloads_label: downloadsLabel,
      badge,
    }),
    demo_count: 0,
    demo_urls: [],
  };
}

// PostgREST answers with at most a thousand rows, so that is what a page is.
const PAGE = 1000;

const PUBLIC_PRODUCT_COLUMNS = `
      id,
      slug,
      name,
      industry_label,
      icon,
      price_label,
      price_period,
      rating,
      downloads,
      downloads_label,
      badge,
      visible,
      category_id,
      marketplace_categories(name)
    `;

async function loadPublicProductsFromSupabase(sb: any) {
  const publicQuery = sb
    .from("marketplace_products")
    .select(`
      id,
      slug,
      name,
      industry_label,
      icon,
      price_label,
      price_period,
      rating,
      downloads,
      downloads_label,
      badge,
      visible
      ,category_id,marketplace_categories(name)
    `);
  // Only what the public may see: visible, published and inside its schedule.
  const marketplaceResult = await applyPublicProductFilter(publicQuery)
    .order("sort_order")
    .order("created_at", { ascending: false })
    .range(0, PAGE - 1);

  if (!marketplaceResult.error && Array.isArray(marketplaceResult.data) && marketplaceResult.data.length > 0) {
    const rows = [...marketplaceResult.data];

    // A response is capped at a thousand rows whether or not a limit is asked
    // for, so a catalogue larger than that was being cut off in silence and
    // the products past the cap simply did not exist as far as this was
    // concerned. Keep asking for the next page until one comes back short.
    while (rows.length % PAGE === 0) {
      const next = await applyPublicProductFilter(
        sb.from("marketplace_products").select(PUBLIC_PRODUCT_COLUMNS),
      )
        .order("sort_order")
        .order("created_at", { ascending: false })
        .range(rows.length, rows.length + PAGE - 1);

      if (next.error || !Array.isArray(next.data) || next.data.length === 0) break;
      rows.push(...next.data);
      if (next.data.length < PAGE) break;
    }

    return { rows, source: "marketplace_products" as const };
  }

  return { rows: [], source: "none" as const };
}

async function loadPublicProductBySlugFromSupabase(sb: any, slug: string) {
  const marketplaceResult = await sb
    .from("marketplace_products")
    // `description` is the product's own copy. The page already draws it under
    // "About this software", but it was never selected, so the server-rendered
    // body carried a price and a rating and nothing about the product itself.
    .select("id, slug, name, description, industry_label, icon, price_label, price_period, rating, downloads, downloads_label, badge, visible, content_status, publish_at, unpublish_at, category_id, marketplace_categories(name)")
    .eq("slug", slug)
    .maybeSingle();

  if (marketplaceResult.error) {
    // The catalogue could not be asked at all. Only this - not a product that
    // exists but is unpublished - may fall back to the supplied catalogue.
    return { row: null, source: "unavailable" as const };
  }
  if (marketplaceResult.data) {
    // A product that exists but is not public (hidden, draft, coming soon,
    // outside its schedule) is not shown, and is not replaced by a fallback
    // copy either: the Manager's publish state is the answer.
    if (!isPublicProduct(marketplaceResult.data)) {
      return { row: null, source: "not_public" as const };
    }
    return { row: marketplaceResult.data, source: "marketplace_products" as const };
  }

  return { row: null, source: "none" as const };
}

/**
 * What a visitor is allowed to know about a product's demos.
 *
 * The live address is the catalogue's only sensitive asset - the products
 * themselves are hosted elsewhere - so it never travels to a browser, not even
 * in a field the page does not draw. What is left is enough for the card to say
 * a demo exists and for the gateway to offer it; the address is resolved on the
 * server, behind the sign-in, when the demo is actually opened.
 */
function withoutAddress(demos: ProductDemoBinding[]): ProductDemoBinding[] {
  return demos.map((demo) => ({ ...demo, url: "" }));
}

/**
 * Every listed product's demos in one query.
 *
 * This was a query per product inside a Promise.all, so a page of a thousand
 * products opened a thousand connections at once and the list waited for the
 * slowest of them. One request answers for all of them.
 */
async function loadPublicDemosForProducts(
  sb: any,
  productIds: string[],
): Promise<Map<string, ProductDemoBinding[]>> {
  const grouped = new Map<string, ProductDemoBinding[]>();
  const ids = Array.from(new Set(productIds.filter(Boolean)));
  if (ids.length === 0) return grouped;

  // PostgREST caps a response at a thousand rows, so ask in batches and keep
  // every page rather than silently losing the demos past the cap.
  const CHUNK = 200;
  for (let start = 0; start < ids.length; start += CHUNK) {
    const slice = ids.slice(start, start + CHUNK);
    const result = await sb
      .from("product_demo_urls")
      .select("id, demo_name, role_name, status, environment, url, product_id")
      .in("product_id", slice)
      .eq("status", "active")
      .order("sort_order");

    if (result.error || !Array.isArray(result.data)) continue;
    for (const row of result.data as (ProductDemoBinding & { product_id: string })[]) {
      if (!row.url || !/^https?:\/\//i.test(row.url)) continue;
      const list = grouped.get(row.product_id) ?? [];
      const { product_id: _ignored, ...binding } = row;
      list.push(binding as ProductDemoBinding);
      grouped.set(row.product_id, list);
    }
  }
  return grouped;
}

async function loadPublicDemosForProduct(sb: any, productId: string) {
  const demoResult = await sb
    .from("product_demo_urls")
    .select("id, demo_name, role_name, status, environment, url")
    .eq("product_id", productId)
    .eq("status", "active")
    .order("sort_order")
    .order("created_at", { ascending: false });

  if (!demoResult.error && Array.isArray(demoResult.data)) {
    return demoResult.data as ProductDemoBinding[];
  }

  return [] as ProductDemoBinding[];
}

async function loadPublicSeoForProduct(sb: any, productId: string) {
  const result = await sb
    .from("seo_pages")
    .select("title, meta_title, meta_description, canonical_url, schema_json")
    .eq("product_id", productId)
    .maybeSingle();

  if (result.error || !result.data) return null;
  return result.data;
}

export const recordPublicDemoClick = createServerFn({ method: "POST" })
  .validator((value) => z.object({
    productId: z.string().uuid(),
    demoUrlId: z.string().uuid(),
    sourcePage: z.string().max(500).optional(),
    referrer: z.string().max(2000).optional(),
    deviceType: z.string().max(80).optional(),
    browser: z.string().max(120).optional(),
  }).parse(value))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { error } = await sb.from("demo_clicks").insert({
      product_id: data.productId,
      demo_url_id: data.demoUrlId,
      source_page: data.sourcePage || null,
      referrer: data.referrer || null,
      device_type: data.deviceType || null,
      browser: data.browser || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- PUBLIC: aggregated homepage payload ----------
export const getMarketplace = createServerFn({ method: "GET" }).handler(
  async (): Promise<Marketplace> => {
    try {
      const sb = publicClient();
      // Public payload: only products the public may see. These flag queries
      // had no publish check and handed unpublished products to anyone who
      // called this function.
      const flagged = (flag: string) =>
        (applyPublicProductFilter(
          (sb.from("marketplace_products").select(PRODUCT_COLS) as any).eq(flag, true),
        ) as any)
          .order("sort_order")
          .limit(24);
      const [featured, trending, best, fresh, ai, cats, vends, sections] = await Promise.all([
        flagged("is_featured"),
        flagged("is_trending"),
        flagged("is_best_seller"),
        flagged("is_new_release"),
        flagged("is_ai"),
        sb.from("marketplace_categories").select("id, slug, name, icon, image_key, tone, sort_order").order("sort_order"),
        sb.from("marketplace_vendors").select("id, slug, name, country, verified, rating, product_count").order("rating", { ascending: false }).limit(24),
        sb.from("marketplace_homepage_sections").select("key, title, enabled, sort_order").order("sort_order"),
      ]);
      return {
        featured: (featured.data ?? []).map(toProduct),
        trending: (trending.data ?? []).map(toProduct),
        bestSellers: (best.data ?? []).map(toProduct),
        newReleases: (fresh.data ?? []).map(toProduct),
        aiProducts: (ai.data ?? []).map(toProduct),
        industries: (cats.data ?? []).map((c: any) => ({
          id: c.id, slug: c.slug, name: c.name,
          icon: c.icon ?? "Sparkles",
          image_key: c.image_key,
          product_count: 0,
          tone: c.tone ?? "primary",
        })),
        vendors: (vends.data ?? []).map((v: any) => ({
          id: v.id, slug: v.slug, name: v.name,
          country: v.country, verified: !!v.verified,
          rating: Number(v.rating ?? 0),
          product_count: Number(v.product_count ?? 0),
        })),
        sections: (sections.data ?? []) as HomepageSection[],
      };
    } catch {
      return {
        featured: [],
        trending: [],
        bestSellers: [],
        newReleases: [],
        aiProducts: [],
        industries: [],
        vendors: [],
        sections: [],
      };
    }
  },
);

// This reads the whole catalogue in thousand-row pages plus every demo, and it
// answered anyone who called it: an anonymous request could trigger a full scan
// at will. Nothing public calls it - its only caller is the operator-side
// supplied-demos check - so it now asks for the same signed-in catalogue
// operator as the Manager functions below. The check runs before the try, so a
// refusal is never turned into the fallback catalogue.
export const getPublicProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PublicProduct[]> => {
    await requireCatalogOperator(context);
    try {
      const sb = publicClient();
      const { rows } = await loadPublicProductsFromSupabase(sb);

      if (!rows.length) {
        return buildSuppliedCatalogFallback();
      }

      const demosByProduct = await loadPublicDemosForProducts(
        sb,
        rows.map((product: any) => product.id),
      );

      const productsWithDemos = rows.map((product: any) => {
        const activeDemos = demosByProduct.get(product.id) ?? [];
        const mapped = mapProductRecord(product);
        return {
          ...mapped,
          demo_count: activeDemos.length,
          demo_urls: withoutAddress(activeDemos),
        } as PublicProduct;
      });

      return productsWithDemos.length ? productsWithDemos : buildSuppliedCatalogFallback();
    } catch (err) {
      console.error("getPublicProducts error:", err);
      return buildSuppliedCatalogFallback();
    }
  });

export const getPublicProduct = createServerFn({ method: "GET" })
  .validator((v) => z.object({ slug: z.string().min(1) }).parse(v ?? {}))
  .handler(async ({ data }): Promise<PublicProductPageData> => {
    const cachedPage = readPageCache(productPageCache, data.slug);
    if (cachedPage) return cachedPage;
    try {
      const sb = publicClient();
      const { row: productRow, source } = await loadPublicProductBySlugFromSupabase(sb, data.slug);

      if (!productRow) {
        // The catalogue answered: this slug is either not a product or not a
        // public one. Serving the hardcoded supplied copy here is how draft
        // products such as blinkit-clone kept rendering at their own URL.
        // `not_found` tells the page route it may answer 404; the outage path
        // below never sets it.
        if (source !== "unavailable") {
          return { product: null, active_demos: [], seo: null, not_found: true };
        }
        const fallbackProduct = buildSuppliedCatalogFallback().find((product) => product.slug === data.slug);
        if (fallbackProduct) {
          return {
            product: fallbackProduct,
            active_demos: fallbackProduct.demo_urls ?? [],
            seo: null,
          };
        }
        return { product: null, active_demos: [], seo: null };
      }

      const activeDemos = withoutAddress(
        (await loadPublicDemosForProduct(sb, productRow.id)).filter((demo) => {
          if (!demo.url) return false;
          return /^https?:\/\//i.test(demo.url);
        }),
      );

      const page: PublicProductPageData = {
        product: {
          ...mapProductRecord(productRow),
          // Only this page carries the description; the listings that share
          // mapProductRecord do not draw it and stay the size they were.
          description: (productRow as { description?: string | null }).description ?? null,
          demo_count: activeDemos.length,
          demo_urls: activeDemos,
        },
        active_demos: activeDemos,
        seo: await loadPublicSeoForProduct(sb, productRow.id),
      };
      writePageCache(productPageCache, data.slug, page);
      return page;
    } catch (err) {
      console.error("getPublicProduct error:", err);
      const fallbackProduct = buildSuppliedCatalogFallback().find((product) => product.slug === data.slug);
      if (fallbackProduct) {
        return {
          product: fallbackProduct,
          active_demos: fallbackProduct.demo_urls ?? [],
          seo: null,
        };
      }
      return { product: null, active_demos: [], seo: null };
    }
  });

export const getPublicCategories = createServerFn({ method: "GET" })
  .handler(async (): Promise<Category[]> => {
    try {
      const sb = publicClient();
      const { data, error } = await sb
        .from("marketplace_categories")
        .select("id, slug, name, icon, image_key, tone, sort_order")
        .eq("is_hidden", false)
        .order("sort_order");
      
      if (error) {
        console.error("Error fetching categories:", error);
        return [];
      }
      
      return (data ?? []) as Category[];
    } catch (err) {
      console.error("Failed to fetch categories:", err);
      return [];
    }
  });

export const getPublicFeatureStripItems = createServerFn({ method: "GET" })
  .handler(async (): Promise<FeatureStripItem[]> => {
    try {
      const sb = publicClient();
      const { data, error } = await sb
        .from("feature_strip_items")
        .select("id, label, icon_name, color_class, position, visible")
        .eq("visible", true)
        .order("position", { ascending: true });

      if (error) {
        console.error("Error fetching feature strip items:", error);
        return [];
      }

      return (data ?? []) as FeatureStripItem[];
    } catch (err) {
      console.error("Failed to fetch feature strip items:", err);
      return [];
    }
  });

export const getPublicProductsByCategory = createServerFn({ method: "GET" })
  .validator((v) => z.object({ category_slug: z.string().min(1) }).parse(v ?? {}))
  .handler(async ({ data }): Promise<PublicCategoryPageData> => {
    const cachedPage = readPageCache(categoryPageCache, data.category_slug);
    if (cachedPage) return cachedPage;
    try {
      const sb = publicClient();
      
      // Get category by slug
      const { data: categoryData, error: catError } = await sb
        .from("marketplace_categories")
        .select("id, slug, name, icon, image_key, tone, sort_order")
        .eq("slug", data.category_slug)
        .eq("is_hidden", false)
        .maybeSingle();
      
      // The catalogue answered and has no such public category: say so, so the
      // page route can answer 404. A failed lookup keeps the old answer only.
      if (!catError && !categoryData) {
        return { category: null, products: [], not_found: true };
      }
      if (catError || !categoryData) {
        return { category: null, products: [] };
      }
      
      // Get products in this category. Only what the public may see - visible,
      // published and inside its schedule - the same rule the homepage, search,
      // the sitemap and the product page apply. Filtering on `visible` alone
      // put unpublished products on this page whose own link then answered
      // "Product not found": a card that led nowhere.
      // PostgREST stops at a thousand rows without saying so, so the page asks
      // for an explicit, bounded range instead (the largest category holds 69
      // products, well inside it), and `id` breaks sort_order ties so the order
      // is the same on every request.
      const { data: productRows, error: prodError } = await applyPublicProductFilter(
        sb.from("marketplace_products").select(PRODUCT_COLS).eq("category_id", categoryData.id) as any,
      )
        .order("sort_order")
        .order("id")
        .range(0, 499);

      if (prodError || !productRows) {
        return { category: categoryData as Category, products: [] };
      }

      // Education & Coaching is the public live-demo catalog. Include public
      // products with an active demo even when older rows use a child category.
      // This used to load every visible product in the catalogue - a thousand
      // rows, 3 MB and close to a minute - to find the dozen that have a demo.
      // The demo table names them directly.
      let catalogRows: any[] = productRows;
      if (categoryData.slug === "education-coaching") {
        const { data: demoRows } = await sb
          .from("product_demo_urls")
          .select("product_id")
          .eq("status", "active")
          .limit(1000);
        const demoProductIds = Array.from(
          new Set(((demoRows ?? []) as { product_id: string | null }[]).map((r) => r.product_id).filter(Boolean)),
        ) as string[];
        const known = new Set(productRows.map((row: any) => row.id));
        const missing = demoProductIds.filter((id) => !known.has(id));
        if (missing.length) {
          const { data: liveRows, error: liveError } = await applyPublicProductFilter(
            sb.from("marketplace_products").select(PRODUCT_COLS).in("id", missing.slice(0, 200)) as any,
          ).order("sort_order");
          if (!liveError && Array.isArray(liveRows)) catalogRows = [...productRows, ...liveRows];
        }
      }

      // Enrich products with their demos, in one query for the whole page
      // rather than one per product.
      const demosByProduct = await loadPublicDemosForProducts(
        sb,
        catalogRows.map((product: any) => product.id),
      );
      const productsWithDemos = catalogRows.map((product: any) => {
        const activeDemos = withoutAddress(demosByProduct.get(product.id) ?? []);
        const mapped = mapProductRecord(product);
        return {
          ...mapped,
          demo_count: activeDemos.length,
          demo_urls: activeDemos,
        } as PublicProduct;
      });
      
      const page: PublicCategoryPageData = {
        category: categoryData as Category,
        products: productsWithDemos,
      };
      writePageCache(categoryPageCache, data.category_slug, page);
      return page;
    } catch (err) {
      console.error("Failed to fetch category products:", err);
      return { category: null, products: [] };
    }
  });

// ---------- Admin CRUD ----------

/**
 * Every write and admin read below runs as the signed-in caller, and used to
 * check nothing more than that a caller was signed in - any buyer's session
 * could call them, and the only thing standing between a buyer and the live
 * catalogue was whatever the table policies happened to allow. The operator
 * check the rest of the Marketplace Manager uses (mm_is_operator, evaluated
 * with the caller's own token) now runs first, on the server.
 */
async function requireCatalogOperator(context: any): Promise<void> {
  const sb = context?.supabase;
  if (!sb) throw new Error("Unauthorized: sign in required.");
  const { data, error } = await sb.rpc("mm_is_operator");
  if (error) throw new Error(`Unauthorized: ${error.message}`);
  if (data !== true) throw new Error("Forbidden: Marketplace operator access required.");
}

const productSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(1),
  name: z.string().min(1),
  industry_label: z.string().nullable().optional(),
  icon: z.string().optional(),
  price_label: z.string().optional(),
  price_period: z.string().nullable().optional(),
  rating: z.number().optional(),
  downloads: z.number().int().optional(),
  downloads_label: z.string().nullable().optional(),
  badge: z.enum(["NEW", "HOT", "TOP", "DEAL"]).nullable().optional(),
  is_featured: z.boolean().optional(),
  is_trending: z.boolean().optional(),
  is_new_release: z.boolean().optional(),
  is_best_seller: z.boolean().optional(),
  is_ai: z.boolean().optional(),
  category_id: z.string().uuid().nullable().optional(),
  sort_order: z.number().int().optional(),
  visible: z.boolean().optional(),
  publish_at: z.string().nullable().optional(),
  unpublish_at: z.string().nullable().optional(),
});

export const upsertProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v) => productSchema.parse(v))
  .handler(async ({ data, context }) => {
    if (!context?.supabase) {
      throw new Error("Unauthorized: Supabase context is unavailable.");
    }
    await requireCatalogOperator(context);

    const { error, data: row } = await context.supabase
      .from("marketplace_products")
      .upsert(data as any, { onConflict: "slug" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    if (!context?.supabase) {
      throw new Error("Unauthorized: Supabase context is unavailable.");
    }
    await requireCatalogOperator(context);

    const { error } = await context.supabase.from("marketplace_products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listProductsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      if (!context?.supabase) {
        throw new Error("Unauthorized: Supabase context is unavailable.");
      }
      await requireCatalogOperator(context);

      const { data, error } = await context.supabase
        .from("marketplace_products")
        .select("*")
        .order("sort_order")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[marketplace] listProductsAdmin error:", error);
        return [];
      }

      return data ?? [];
    } catch (error) {
      console.error("[marketplace] listProductsAdmin error:", error);
      return [];
    }
  });

export const listProductDemoBindings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((v) => z.object({ product_id: z.string().uuid().optional() }).parse(v ?? {}))
  .handler(async ({ data, context }) => {
    try {
      if (!context?.supabase) {
        throw new Error("Unauthorized: Supabase context is unavailable.");
      }
      await requireCatalogOperator(context);

      let query = context.supabase
        .from("product_demo_urls")
        .select("id, demo_name, role_name, status, environment, url, product_id")
        .order("sort_order")
        .order("created_at", { ascending: false });
      if (data?.product_id) query = query.eq("product_id", data.product_id);
      const { data: rows, error } = await query;
      if (!error && Array.isArray(rows)) {
        return (rows as any[]).map((row) => ({
          id: row.id,
          demo_name: row.demo_name ?? row.name ?? "Live demo",
          role_name: row.role_name ?? "Public",
          status: row.status ?? "active",
          environment: row.environment ?? "production",
          url: row.url ?? "",
        })) as ProductDemoBinding[];
      }

      if (error) throw new Error(error.message);
      return [];
    } catch (err) {
      console.error("[marketplace] listProductDemoBindings error:", err);
      return [];
    }
  });

const categorySchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(1),
  name: z.string().min(1),
  icon: z.string().optional(),
  image_key: z.string().nullable().optional(),
  tone: z.string().nullable().optional(),
  sort_order: z.number().int().optional(),
  is_featured: z.boolean().optional(),
  is_hidden: z.boolean().optional(),
});

export const upsertCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v) => categorySchema.parse(v))
  .handler(async ({ data, context }) => {
    if (!context?.supabase) {
      throw new Error("Unauthorized: Supabase context is unavailable.");
    }
    await requireCatalogOperator(context);

    const { error, data: row } = await context.supabase
      .from("marketplace_categories")
      .upsert(data as any, { onConflict: "slug" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    if (!context?.supabase) {
      throw new Error("Unauthorized: Supabase context is unavailable.");
    }
    await requireCatalogOperator(context);

    const { error } = await context.supabase.from("marketplace_categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCategoriesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!context?.supabase) {
      throw new Error("Unauthorized: Supabase context is unavailable.");
    }
    await requireCatalogOperator(context);

    const { data, error } = await context.supabase
      .from("marketplace_categories")
      .select("*")
      .order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// Homepage section ordering
export const setSectionEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v) => z.object({ key: z.string(), enabled: z.boolean() }).parse(v))
  .handler(async ({ data, context }) => {
    if (!context?.supabase) {
      throw new Error("Unauthorized: Supabase context is unavailable.");
    }
    await requireCatalogOperator(context);

    // Through the function rather than the table. It refuses out loud when the
    // caller may not write - a filtered update reports zero rows, not an error,
    // so the old direct write reported success while changing nothing - and it
    // publishes a draft it is asked to enable, since a section that is enabled
    // but unpublished is still not live.
    const { data: row, error } = await context.supabase.rpc(
      "mm_section_set_enabled",
      { p_key: data.key, p_enabled: data.enabled },
    );
    if (error) throw new Error(error.message);
    return { ok: true, section: row };
  });

export const reorderSections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v) => z.object({ order: z.array(z.object({ key: z.string(), sort_order: z.number().int() })) }).parse(v))
  .handler(async ({ data, context }) => {
    if (!context?.supabase) {
      throw new Error("Unauthorized: Supabase context is unavailable.");
    }
    await requireCatalogOperator(context);

    // One statement rather than one update per section, so a failure partway
    // through cannot leave the page in an order nobody chose. Unknown or
    // repeated keys are rejected rather than quietly skipped.
    const { data: moved, error } = await context.supabase.rpc(
      "mm_sections_reorder",
      { p_order: data.order },
    );
    if (error) throw new Error(error.message);
    return { ok: true, moved: typeof moved === "number" ? moved : 0 };
  });

export const listSectionsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!context?.supabase) {
      throw new Error("Unauthorized: Supabase context is unavailable.");
    }
    await requireCatalogOperator(context);

    const { data, error } = await context.supabase
      .from("marketplace_homepage_sections")
      .select("*")
      .order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ============================================================================
// DEMO URL CRUD ENDPOINTS
// ============================================================================

export const addProductDemo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v) => z.object({
    product_id: z.string().uuid(),
    demo_name: z.string().min(1),
    role_name: z.string().min(1),
    status: z.enum(["active", "inactive"]).default("active"),
    environment: z.enum(["production", "staging"]).default("production"),
    url: z.string().url(),
  }).parse(v))
  .handler(async ({ data, context }) => {
    if (!context?.supabase) {
      throw new Error("Unauthorized: Supabase context is unavailable.");
    }
    await requireCatalogOperator(context);

    const { data: result, error } = await context.supabase
      .from("product_demo_urls")
      .insert([{
        id: crypto.randomUUID?.() || Date.now().toString(),
        product_id: data.product_id,
        demo_name: data.demo_name,
        role_name: data.role_name,
        status: data.status,
        environment: data.environment,
        url: data.url,
        sort_order: 0,
      }])
      .select()
      .single();
    if (error) {
      console.error("[marketplace] addProductDemo error:", error);
      throw new Error(error.message);
    }
    return result;
  });

export const updateProductDemo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v) => z.object({
    id: z.string().uuid(),
    demo_name: z.string().min(1).optional(),
    role_name: z.string().min(1).optional(),
    status: z.enum(["active", "inactive"]).optional(),
    environment: z.enum(["production", "staging"]).optional(),
    url: z.string().url().optional(),
  }).parse(v))
  .handler(async ({ data, context }) => {
    if (!context?.supabase) {
      throw new Error("Unauthorized: Supabase context is unavailable.");
    }
    await requireCatalogOperator(context);

    const { id, ...updates } = data;
    const { data: result, error } = await context.supabase
      .from("product_demo_urls")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      console.error("[marketplace] updateProductDemo error:", error);
      throw new Error(error.message);
    }
    return result;
  });

export const deleteProductDemo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    if (!context?.supabase) {
      throw new Error("Unauthorized: Supabase context is unavailable.");
    }
    await requireCatalogOperator(context);

    const { error } = await context.supabase
      .from("product_demo_urls")
      .delete()
      .eq("id", data.id);
    if (error) {
      console.error("[marketplace] deleteProductDemo error:", error);
      throw new Error(error.message);
    }
    return { ok: true };
  });

// ============================================================================
// SEARCH & FILTER ENDPOINTS
// ============================================================================

export const searchProducts = createServerFn({ method: "POST" })
  .validator((v) => z.object({
    query: z.string().min(1),
    limit: z.number().int().min(1).max(100).optional().default(20),
  }).parse(v))
  .handler(async ({ data }) => {
    try {
      const sb = publicClient();
      const searchTerm = `%${data.query}%`;
      const { data: results, error } = await (applyPublicProductFilter(
        sb.from("marketplace_products").select(PRODUCT_COLS) as any,
      ) as any)
        .or(`name.ilike.${searchTerm},industry_label.ilike.${searchTerm}`)
        .limit(data.limit);
      if (error) {
        console.error("[marketplace] searchProducts error:", error);
        return [];
      }
      return (results ?? []).map(toProduct);
    } catch (err) {
      console.error("[marketplace] searchProducts error:", err);
      return [];
    }
  });

export const filterByBadge = createServerFn({ method: "POST" })
  .validator((v) => z.object({
    badge: z.enum(["NEW", "HOT", "TOP", "DEAL"]),
    limit: z.number().int().min(1).max(100).optional().default(20),
  }).parse(v))
  .handler(async ({ data }) => {
    try {
      const sb = publicClient();
      const { data: results, error } = await (applyPublicProductFilter(
        sb.from("marketplace_products").select(PRODUCT_COLS) as any,
      ) as any)
        .eq("badge", data.badge)
        .limit(data.limit);
      if (error) {
        console.error("[marketplace] filterByBadge error:", error);
        return [];
      }
      return (results ?? []).map(toProduct);
    } catch (err) {
      console.error("[marketplace] filterByBadge error:", err);
      return [];
    }
  });

export const sortByRating = createServerFn({ method: "POST" })
  .validator((v) => z.object({
    limit: z.number().int().min(1).max(100).optional().default(20),
  }).parse(v))
  .handler(async ({ data }) => {
    try {
      const sb = publicClient();
      const { data: results, error } = await (applyPublicProductFilter(
        sb.from("marketplace_products").select(PRODUCT_COLS) as any,
      ) as any)
        .order("rating", { ascending: false })
        .limit(data.limit);
      if (error) {
        console.error("[marketplace] sortByRating error:", error);
        return [];
      }
      return (results ?? []).map(toProduct);
    } catch (err) {
      console.error("[marketplace] sortByRating error:", err);
      return [];
    }
  });

export const sortByDownloads = createServerFn({ method: "POST" })
  .validator((v) => z.object({
    limit: z.number().int().min(1).max(100).optional().default(20),
  }).parse(v))
  .handler(async ({ data }) => {
    try {
      const sb = publicClient();
      const { data: results, error } = await (applyPublicProductFilter(
        sb.from("marketplace_products").select(PRODUCT_COLS) as any,
      ) as any)
        .order("downloads", { ascending: false })
        .limit(data.limit);
      if (error) {
        console.error("[marketplace] sortByDownloads error:", error);
        return [];
      }
      return (results ?? []).map(toProduct);
    } catch (err) {
      console.error("[marketplace] sortByDownloads error:", err);
      return [];
    }
  });

// Demo Manager's list. It returns the live demo addresses - the one thing the
// rest of the storefront keeps on the server - so it had to stop answering
// anyone who called it: with no sign-in it fell back to the service key and
// handed every address, draft products' included, to an anonymous caller.
export const listProductDemos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireCatalogOperator(context);
    const supabase = context.supabase;
    const { data: results, error } = await supabase
      .from("product_demo_urls")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[marketplace] listProductDemos error:", error);
      return [];
    }
    return results ?? [];
  });

// Writes into the live catalogue, so only an operator may run it. It used to
// accept any caller and fall back to the service key.
export const recoverMarketplaceData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireCatalogOperator(context);
    const supabase = context.supabase;
    console.log("[marketplace] Starting marketplace data recovery...");
    
    try {
      // Sample products data
      const products = [
        { slug: "school-management", name: "School Management Software", category_id: null, price_label: "₹59,999", rating: 4.8, downloads: 2150, badge: "HOT", is_featured: true, is_trending: true, sort_order: 1 },
        { slug: "gym-fitness", name: "Gym & Fitness Center Management", category_id: null, price_label: "₹44,999", rating: 4.6, downloads: 1200, badge: "HOT", is_featured: true, is_trending: true, sort_order: 2 },
        { slug: "salon-spa", name: "Salon & Spa Management", category_id: null, price_label: "₹39,999", rating: 4.5, downloads: 980, badge: null, is_featured: false, is_trending: false, sort_order: 3 },
        { slug: "restaurant-pos", name: "Restaurant POS", category_id: null, price_label: "₹54,999", rating: 4.7, downloads: 1950, badge: "TOP", is_featured: true, is_trending: true, sort_order: 4 },
        { slug: "crm-software", name: "CRM Software", category_id: null, price_label: "₹59,999", rating: 4.7, downloads: 2050, badge: "TOP", is_featured: true, is_trending: true, sort_order: 5 },
        { slug: "hotel-management", name: "Hotel Management System", category_id: null, price_label: "₹89,999", rating: 4.8, downloads: 1920, badge: "TOP", is_featured: true, is_trending: false, sort_order: 6 },
        { slug: "fleet-management", name: "Fleet Management System", category_id: null, price_label: "₹69,999", rating: 4.7, downloads: 1750, badge: "HOT", is_featured: true, is_trending: false, sort_order: 7 },
        { slug: "hospital-hms", name: "Hospital Management System", category_id: null, price_label: "₹99,999", rating: 4.8, downloads: 2300, badge: "TOP", is_featured: true, is_trending: false, sort_order: 8 },
        { slug: "petcare-veterinary", name: "Pet Care & Veterinary Software", category_id: null, price_label: "₹44,999", rating: 4.6, downloads: 890, badge: "DEAL", is_featured: false, is_trending: true, sort_order: 9 },
        { slug: "college-erp", name: "College / University ERP", category_id: null, price_label: "₹89,999", rating: 4.5, downloads: 750, badge: "NEW", is_featured: false, is_trending: false, sort_order: 10 },
      ];

      let insertCount = 0;
      for (const prod of products) {
        const { error } = await supabase
          .from("marketplace_products")
          .insert({
            slug: prod.slug,
            name: prod.name,
            industry_label: prod.name,
            category_id: prod.category_id,
            icon: "Sparkles",
            price_label: prod.price_label,
            price_period: "lifetime",
            rating: prod.rating,
            downloads: prod.downloads,
            downloads_label: Math.floor(prod.downloads / 1000) + "k",
            badge: prod.badge,
            is_featured: prod.is_featured,
            is_trending: prod.is_trending,
            is_best_seller: false,
            is_new_release: prod.badge === "NEW",
            is_ai: false,
            visible: true,
            sort_order: prod.sort_order,
          });

        if (!error) {
          insertCount++;
        }
      }

      console.log(`[marketplace] Recovery complete: ${insertCount} products inserted`);
      
      return {
        success: true,
        productsInserted: insertCount,
        message: "Marketplace data recovery completed",
      };
    } catch (err) {
      console.error("[marketplace] Recovery error:", err);
      return {
        success: false,
        error: String(err),
        message: "Recovery failed",
      };
    }
  });
