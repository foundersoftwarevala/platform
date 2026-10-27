// Marketplace ↔ Manager server functions. The catalogue admin product writes
// below use the canonical VPS database; legacy public and read-only routes keep
// their existing PostgREST client.
import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SlidingWindowLimiter } from "@/lib/i18n/limits";
import { resolveMarketplacePublicConfig } from "@/lib/marketplace-public-config";
import type { Database, Tables } from "@/integrations/supabase/types";
import { requireJsonObject, type Json } from "@/lib/json";
import { SUPPLIED_DEMOS_16 } from "@/lib/supplied-demos-catalog";
import { catalogueEntries, type CatalogueEntry } from "@/data/catalogue";
import { LIFETIME_PRICE } from "@/lib/site-content/constants";
import { catalogueChanged } from "@/lib/marketplace/catalogue-invalidation";
import { demoCategoryMatches } from "@/lib/demo/category";
import {
  callMarketplaceManagerRpc,
  withMarketplaceManagerDatabase,
} from "@/lib/marketplace-manager/vps-rpc.server";

// These migration-backed RPCs are absent from cloud-generated metadata.
type MarketplaceRpcDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Functions"> & {
    Functions: Database["public"]["Functions"] & {
      mm_layout_history: { Args: { p_limit?: number }; Returns: Json };
      mm_layout_restore: { Args: { p_audit_id: string }; Returns: Json };
      mm_record_public_demo_click: {
        Args: {
          p_product_id: string;
          p_demo_url_id: string;
          p_source_page: string | null;
          p_referrer: string | null;
          p_device_type: string | null;
          p_browser: string | null;
        };
        Returns: boolean;
      };
      mm_recover_marketplace_catalogue: {
        Args: { p_actor_id: string; p_products: Json };
        Returns: Json;
      };
    };
  };
};

export type ProductDemoBinding = {
  id: string;
  demo_name: string;
  role_name: string;
  status: string;
  environment: string;
  url: string;
  detected_category_id?: string | null;
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
  features?: Json;
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
  /** The demo gateway (/demo/<slug>) when the product has a live demo. */
  demo_url?: string | null;
};

export type PublicProductPageData = {
  product: PublicProduct | null;
  active_demos: ProductDemoBinding[];
  seo?: {
    title: string | null;
    meta_title: string | null;
    meta_description: string | null;
    canonical_url: string | null;
    schema_json: Json;
  } | null;
};

function resolveSupabaseEnv() {
  const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const env = typeof process !== "undefined" ? process.env : undefined;
  /**
   * On the server, the server's own SUPABASE_URL wins.
   *
   * VITE_SUPABASE_URL is the address compiled into the browser bundle, and it
   * points at the hosted Supabase project. This resolver preferred it even when
   * running on the server, so publicClient() paired the hosted URL with the
   * VPS service-role key - and hosted Supabase answers that pairing with
   *
   *     401 {"message":"Invalid API key",
   *          "hint":"Double check your Supabase `anon` or `service_role` API key."}
   *
   * getPublicProductsByCategory swallowed the 401 and returned
   * { category: null, products: [] }, so **every category page showed zero
   * products** while eighty or more sat in each category. Measured against the
   * live server before this change: 401 for the categories lookup and 401 for
   * the products lookup, on the URL the running app actually carries.
   *
   * In the browser there is no process.env, so VITE_* is still what is used
   * there and nothing about the client changes.
   */
  return resolveMarketplacePublicConfig(viteEnv, env);
}

// ---------- server-only publishable client (public reads) ----------
function publicClient() {
  const { url, key } = resolveSupabaseEnv();
  const readKey = key;
  return createClient<MarketplaceRpcDatabase>(url, readKey, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (readKey.startsWith("sb_") && h.get("Authorization") === `Bearer ${readKey}`)
          h.delete("Authorization");
        h.set("apikey", readKey);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

function privilegedClient() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Marketplace server write service is not configured.");
  return createClient<MarketplaceRpcDatabase>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

const PRODUCT_COLS =
  "id, slug, name, category_id, industry_label, icon, price_label, price_period, rating, downloads, downloads_label, badge, description, thumbnail_url, public_repo_url, tags, tech_stack, features, content_status";

/** Returns only product slugs with an active Demo Manager URL. */
export const getPublicDemoAvailability = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicDemoAvailability> => {
    const sb = publicClient();
    const { data, error } = await sb
      .from("product_demo_urls")
      .select("product_id, marketplace_products!inner(slug, visible)")
      .eq("status", "active")
      .eq("marketplace_products.visible", true);
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
  if (
    normalized === "NEW" ||
    normalized === "HOT" ||
    normalized === "TOP" ||
    normalized === "DEAL"
  ) {
    return normalized as MarketProduct["badge"];
  }
  return null;
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "product"
  );
}

/**
 * The home page catalogue as product pages.
 *
 * A card on the home page has to open something. Until an author uploads the
 * product for that slug - at which point the database row is found first and
 * this is never reached - the page is built from the catalogue entry itself.
 */
function buildHomeCatalogFallback(): PublicProduct[] {
  return catalogueEntries.map(fallbackFromEntry);
}

function fallbackFromEntry(entry: CatalogueEntry): PublicProduct {
  return {
    id: entry.slug,
    slug: entry.slug,
    name: entry.name,
    category_name: entry.category,
    industry_label: entry.masterCategory,
    icon: "Sparkles",
    price_label: LIFETIME_PRICE,
    price_period: "lifetime",
    rating: 0,
    downloads: 0,
    downloads_label: null,
    badge: null,
    description: entry.description,
    tags: [entry.masterCategory, entry.category].filter(Boolean),
    tech_stack: entry.techStack,
    features: entry.features,
    content_status: "published",
    demo_count: 0,
    demo_urls: [],
  };
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
    demo_urls: [
      {
        id: `${demo.slug}-demo`,
        demo_name: demo.name,
        role_name: "Public",
        status: "active",
        environment: "production",
        url: demo.demoUrl,
      },
    ],
  }));
}

/** The product page for a slug no author has uploaded yet, if there is one. */
async function findFallbackProduct(slug: string): Promise<PublicProduct | undefined> {
  const known =
    buildSuppliedCatalogFallback().find((product) => product.slug === slug) ??
    buildHomeCatalogFallback().find((product) => product.slug === slug);
  if (known) return known;
  // The home page's own card list. Its cards link here by the same slug, but
  // only the extraDemos part was known to this page, so most of them opened
  // "Product not found". Read on the server only.
  const { homeCatalogueEntry } = await import("@/lib/marketplace/home-catalogue.server");
  const entry = homeCatalogueEntry(slug);
  return entry ? fallbackFromEntry(entry) : undefined;
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
  const metadata = (row.metadata && typeof row.metadata === "object" ? row.metadata : {}) as Record<
    string,
    unknown
  >;
  const industryLabel =
    (row.industry_label as string | null | undefined) ??
    (typeof metadata.industry_label === "string" ? metadata.industry_label : null);
  const icon =
    (row.icon as string | null | undefined) ??
    (typeof metadata.icon === "string" ? metadata.icon : "Sparkles");
  const priceLabel =
    (row.price_label as string | null | undefined) ??
    (typeof metadata.price_label === "string" ? metadata.price_label : "Custom");
  const pricePeriod =
    (row.price_period as string | null | undefined) ??
    (typeof metadata.price_period === "string" ? metadata.price_period : null);
  const rating = Number(
    (row.rating as number | undefined) ??
      (typeof metadata.rating === "number" ? metadata.rating : 0),
  );
  const downloads = Number(
    (row.downloads as number | undefined) ??
      (typeof metadata.downloads === "number" ? metadata.downloads : 0),
  );
  const downloadsLabel =
    (row.downloads_label as string | null | undefined) ??
    (typeof metadata.downloads_label === "string" ? metadata.downloads_label : null);
  const badge = normalizeBadge(
    (row.badge as string | null | undefined) ??
      metadata.badge ??
      row.live_status ??
      row.demo_status,
  );

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

/**
 * The product behind a public URL - and only if it is actually public.
 *
 * This read the row by slug alone, with the service-role key, so row level
 * security never applied and a product that had been hidden or left in draft
 * still rendered its full page to anyone with the address. Two retired QA
 * products were live proof: both answered 200 with their details, and because
 * the SEO lookup *does* filter on `visible` they also carried no title and no
 * noindex, so they were indexable as well.
 *
 * The filters here are the same ones getProductSeo already applies, plus the
 * publish window that add-to-cart and checkout apply. A product that is not on
 * sale now resolves to nothing, which makes the page say "Product not found"
 * and tells search engines not to index it.
 */
async function loadPublicProductBySlugFromSupabase(sb: any, slug: string) {
  const nowIso = new Date().toISOString();
  const marketplaceResult = await sb
    .from("marketplace_products")
    .select(
      "id, slug, name, industry_label, icon, price_label, price_period, rating, downloads, downloads_label, badge, visible, category_id, marketplace_categories(name)",
    )
    .eq("slug", slug)
    .eq("visible", true)
    .eq("moderation_status", "approved")
    .or("content_status.is.null,content_status.eq.published")
    .or(`publish_at.is.null,publish_at.lte.${nowIso}`)
    .or(`unpublish_at.is.null,unpublish_at.gt.${nowIso}`)
    .maybeSingle();

  if (!marketplaceResult.error && marketplaceResult.data) {
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

async function loadPublicDemosForProduct(sb: any, productId: string) {
  const demoResult = await sb
    .from("product_demo_urls")
    .select("id, demo_name, role_name, status, environment, url, detected_category_id")
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

const DEMO_CLICK_WINDOW_MS = 60_000;
const DEMO_CLICK_LIMIT = 30;
const demoClickLimiter = new SlidingWindowLimiter(DEMO_CLICK_WINDOW_MS, 20_000);

export const recordPublicDemoClick = createServerFn({ method: "POST" })
  .validator((value) =>
    z
      .object({
        productId: z.string().uuid(),
        demoUrlId: z.string().uuid(),
        sourcePage: z.string().max(500).optional(),
        referrer: z.string().max(2000).optional(),
        deviceType: z.string().max(80).optional(),
        browser: z.string().max(120).optional(),
      })
      .parse(value),
  )
  .handler(async ({ data }) => {
    const address = getRequestIP() ?? "unknown";
    if (demoClickLimiter.hit(address, DEMO_CLICK_LIMIT)) {
      return { ok: true, recorded: false, reason: "rate_limited" };
    }

    const sb = publicClient();
    const { data: recorded, error } = await sb.rpc("mm_record_public_demo_click", {
      p_product_id: data.productId,
      p_demo_url_id: data.demoUrlId,
      p_source_page: data.sourcePage || null,
      p_referrer: data.referrer || null,
      p_device_type: data.deviceType || null,
      p_browser: data.browser || null,
    });
    if (error) throw new Error(error.message);
    return recorded
      ? { ok: true, recorded: true }
      : { ok: false, recorded: false, reason: "demo_not_found" };
  });

export const getPublicProduct = createServerFn({ method: "GET" })
  .validator((v) => z.object({ slug: z.string().min(1) }).parse(v ?? {}))
  .handler(async ({ data }): Promise<PublicProductPageData> => {
    try {
      const sb = publicClient();
      const { row: productRow } = await loadPublicProductBySlugFromSupabase(sb, data.slug);

      if (!productRow) {
        const fallbackProduct = await findFallbackProduct(data.slug);
        if (fallbackProduct) {
          const listedProduct = {
            ...fallbackProduct,
            demo_count: 0,
            demo_urls: [],
            demo_url: null,
          };
          return {
            product: listedProduct,
            active_demos: [],
            seo: null,
          };
        }
        return { product: null, active_demos: [], seo: null };
      }

      const activeDemos = withoutAddress(
        (await loadPublicDemosForProduct(sb, productRow.id)).filter((demo) => {
          if (
            !demo.url ||
            !demoCategoryMatches(
              typeof productRow.category_id === "string" ? productRow.category_id : null,
              demo.detected_category_id,
            )
          ) {
            return false;
          }
          return /^https?:\/\//i.test(demo.url);
        }),
      );

      return {
        product: {
          ...mapProductRecord(productRow),
          demo_count: activeDemos.length,
          demo_urls: activeDemos,
          // The page's Live Demo action opens the signed-in demo gateway. It
          // had no address to open, so it always read "unavailable".
          demo_url: activeDemos.length && productRow.slug ? `/demo/${productRow.slug}` : null,
        },
        active_demos: activeDemos,
        seo: await loadPublicSeoForProduct(sb, productRow.id),
      };
    } catch (err) {
      console.error("getPublicProduct error:", err);
      const fallbackProduct = await findFallbackProduct(data.slug);
      if (fallbackProduct) {
        const listedProduct = {
          ...fallbackProduct,
          demo_count: 0,
          demo_urls: [],
          demo_url: null,
        };
        return {
          product: listedProduct,
          active_demos: [],
          seo: null,
        };
      }
      // A failed read is not an absent product. Answering { product: null }
      // here made the route answer 404 "Product Not Found" for a real product
      // whenever the database was unreachable; rejecting lets it tell the two
      // apart.
      throw err instanceof Error ? err : new Error("The product could not be read");
    }
  });

/**
 * What makes a product public: the same filters the product page applies. A
 * category listing a product the product page then refuses sends the visitor
 * to "Product not found" - which is what the ten draft products did.
 */
function onSale<Q extends { eq: Function; or: Function }>(query: Q): Q {
  const nowIso = new Date().toISOString();
  return query
    .eq("visible", true)
    .eq("moderation_status", "approved")
    .or("content_status.is.null,content_status.eq.published")
    .or(`publish_at.is.null,publish_at.lte.${nowIso}`)
    .or(`unpublish_at.is.null,unpublish_at.gt.${nowIso}`) as Q;
}

export const getPublicProductsByCategory = createServerFn({ method: "GET" })
  .validator((v) => z.object({ category_slug: z.string().min(1) }).parse(v ?? {}))
  .handler(async ({ data }): Promise<{ category: Category | null; products: PublicProduct[] }> => {
    try {
      const sb = publicClient();

      // Get category by slug
      const { data: categoryData, error: catError } = await sb
        .from("marketplace_categories")
        .select("id, slug, name, icon, image_key, tone, sort_order")
        .eq("slug", data.category_slug)
        .eq("is_hidden", false)
        .maybeSingle();

      if (catError || !categoryData) {
        return { category: null, products: [] };
      }

      // Get products in this category
      const { data: productRows, error: prodError } = await onSale(
        sb.from("marketplace_products").select(PRODUCT_COLS).eq("category_id", categoryData.id),
      ).order("sort_order");

      if (prodError || !productRows) {
        return { category: categoryData as Category, products: [] };
      }

      const catalogRows = productRows as unknown as { id: string; category_id?: string | null }[];

      // Every product's demos, in one query per batch instead of one per product.
      //
      // The loop below used to await a separate lookup for each row inside a
      // Promise.all, so a category of eighty products opened eighty of them at
      // once and Education & Coaching opened seven thousand.
      //
      // The ids go over in the query string, so they are sent in batches rather
      // than all at once: a category is free to grow past the largest one today
      // without the request growing into a 414.
      const demosByProduct = new Map<string, ProductDemoBinding[]>();
      const ID_BATCH = 200;
      for (let at = 0; at < catalogRows.length; at += ID_BATCH) {
        const ids = catalogRows.slice(at, at + ID_BATCH).map((row) => row.id);
        const { data: demoRows, error: demoError } = await sb
          .from("product_demo_urls")
          .select(
            "id, demo_name, role_name, status, environment, url, product_id, detected_category_id",
          )
          .in("product_id", ids)
          .eq("status", "active")
          .order("sort_order");

        if (demoError || !Array.isArray(demoRows)) continue;
        for (const demo of demoRows as (ProductDemoBinding & { product_id: string })[]) {
          const list = demosByProduct.get(demo.product_id);
          if (list) list.push(demo);
          else demosByProduct.set(demo.product_id, [demo]);
        }
      }

      const productsWithDemos = catalogRows.map((product) => {
        const activeDemos = withoutAddress(
          (demosByProduct.get(product.id) ?? []).filter((demo) => {
            if (
              !demo.url ||
              !demoCategoryMatches(
                typeof product.category_id === "string" ? product.category_id : null,
                demo.detected_category_id,
              )
            ) {
              return false;
            }
            return /^https?:\/\//i.test(demo.url);
          }),
        );

        const mapped = mapProductRecord(product);
        return {
          ...mapped,
          demo_count: activeDemos.length,
          demo_urls: activeDemos,
        } as PublicProduct;
      });

      return {
        category: categoryData as Category,
        products: productsWithDemos,
      };
    } catch (err) {
      console.error("Failed to fetch category products:", err);
      return { category: null, products: [] };
    }
  });

// ---------- Admin CRUD ----------
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
  description: z.string().nullable().optional(),
  demo_url: z.string().nullable().optional(),
  demo_video_url: z.string().nullable().optional(),
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
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    // These fields include publication, visibility and merchandising controls.
    // The direct VPS writer therefore requires the same marketplace operator
    // policy as the homepage-row manager before it reads or writes the product.
    const { productCreationReview, productReviewFields, logProductReview } = await import(
      "@/lib/marketplace/product-safety"
    );
    const result = await withMarketplaceManagerDatabase(context.userId, async (tx) => {
      const [existing] = data.id
        ? await tx<{ id: string }[]>`
            select id from public.marketplace_products where id = ${data.id}::uuid for update
          `
        : await tx<{ id: string }[]>`
            select id from public.marketplace_products where slug = ${data.slug} limit 1
          `;
      if (data.id && !existing) throw new Error("The product does not exist.");
      const review = existing ? null : productCreationReview(data.name);
      const values = { ...data, ...(review ? productReviewFields(review) : {}) };
      const allowedColumns = new Set([
        "id",
        "slug",
        "name",
        "industry_label",
        "icon",
        "price_label",
        "price_period",
        "rating",
        "downloads",
        "downloads_label",
        "badge",
        "description",
        "demo_url",
        "demo_video_url",
        "is_featured",
        "is_trending",
        "is_new_release",
        "is_best_seller",
        "is_ai",
        "category_id",
        "sort_order",
        "visible",
        "publish_at",
        "unpublish_at",
        "content_status",
        "moderation_status",
      ]);
      const entries = Object.entries(values).filter(
        ([column, value]) => allowedColumns.has(column) && value !== undefined,
      );
      if (!entries.some(([column]) => column === "slug") ||
          !entries.some(([column]) => column === "name")) {
        throw new Error("Product slug and name are required.");
      }
      let rows: Tables<"marketplace_products">[];
      if (data.id) {
        const updates = entries.filter(([column]) => column !== "id");
        const assignments = updates.map(([column], index) => `"${column}" = $${index + 1}`);
        const valuesSql = updates.map(([, value]) => value);
        const idParameter = valuesSql.length + 1;
        rows = await tx.unsafe<Tables<"marketplace_products">[]>(
          `update public.marketplace_products set ${assignments.join(", ")}, updated_at = now()` +
            ` where id = $${idParameter}::uuid and deleted_at is null returning *`,
          [...valuesSql, data.id],
        );
      } else {
        const columns = entries.map(([column]) => `"${column}"`).join(", ");
        const placeholders = entries.map((_, index) => `$${index + 1}`).join(", ");
        const updateEntries = entries.filter(([column]) => column !== "slug");
        const conflictSql =
          !review?.review_required && updateEntries.length > 0
            ? `on conflict (slug) do update set ${updateEntries
                .map(([column]) => `"${column}" = excluded."${column}"`)
                .join(", ")}`
            : "";
        rows = await tx.unsafe<Tables<"marketplace_products">[]>(
          `insert into public.marketplace_products (${columns}) values (${placeholders}) ${conflictSql} returning *`,
          entries.map(([, value]) => value),
        );
      }
      const [row] = rows;
      if (!row) throw new Error("Product write could not be verified.");
      return { row, review, productId: row.id };
    });
    if (result.review) logProductReview(result.review, "catalogue upsert", result.productId);
    await catalogueChanged();
    return result.row;
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    const archived = await withMarketplaceManagerDatabase(context.userId, async (tx) => {
      const [product] = await tx<{ moderation_status: string; moderation_lock: number }[]>`
        select moderation_status, moderation_lock
        from public.marketplace_products
        where id = ${data.id}::uuid
        for update
      `;
      if (!product) throw new Error("The product does not exist.");
      if (product.moderation_status === "archived") return false;
      const [result] = await tx<{ response: Json }[]>`
        select public.mm_product_moderate(
          ${data.id}::uuid, 'archived', null, ${product.moderation_lock}
        ) as response
      `;
      if (!result) throw new Error("The product archive could not be verified.");
      const response = requireJsonObject(result.response, "Product archive response");
      if (response.ok !== true) {
        throw new Error(
          typeof response.message === "string"
            ? response.message
            : `The product cannot be archived (${String(response.reason ?? "unknown error")}).`,
        );
      }
      return true;
    });
    if (archived) await catalogueChanged();
    return { ok: true as const, archived: true as const };
  });

export const listProductsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    return withMarketplaceManagerDatabase(context.userId, (tx) =>
      tx<Tables<"marketplace_products">[]>`
        select *
        from public.marketplace_products
        where deleted_at is null
        order by sort_order, created_at desc, id
      `,
    );
  });

/**
 * One page of the catalogue for the admin table, counted in the database.
 *
 * listProductsAdmin selects every column of every row with no limit. Measured
 * against the live console, the Products section arrived as 476,660 characters
 * and 15,297 controls for 7,390 rows, all in one DOM. That is slow now and it
 * stops working later: PostgREST on this server caps a result at 10,000 rows,
 * so past that the table would quietly stop showing newer products with no
 * error anywhere.
 *
 * The total is asked for with count exact, so the figure beside the table is
 * the database's answer and not the length of whatever happened to arrive.
 *
 * listProductsAdmin is left exactly as it is. The demo URL manager builds its
 * product picker from it, and changing its shape would break that.
 */
export const listProductsAdminPage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const raw = (input ?? {}) as { page?: unknown; pageSize?: unknown; search?: unknown };
    const page = Math.max(0, Math.trunc(Number(raw.page ?? 0)) || 0);
    // Bounded at both ends: a page of zero returns nothing useful, and an
    // unbounded one is the defect being fixed.
    const requested = Math.trunc(Number(raw.pageSize ?? 50)) || 50;
    const pageSize = Math.min(200, Math.max(10, requested));
    const search = String(raw.search ?? "")
      .trim()
      .slice(0, 120);
    return { page, pageSize, search };
  })
  .handler(async ({ context, data }) => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    const { page, pageSize, search } = data;
    const term = search.replace(/[%,()]/g, " ").trim();
    const offset = page * pageSize;
    return withMarketplaceManagerDatabase(context.userId, async (tx) => {
      const rows = await tx<Tables<"marketplace_products">[]>`
        select *
        from public.marketplace_products
        where deleted_at is null
          and (${term} = '' or name ilike ${`%${term}%`} or slug ilike ${`%${term}%`})
        order by sort_order, created_at desc, id
        limit ${pageSize} offset ${offset}
      `;
      const [count] = await tx<{ total: number }[]>`
        select count(*)::int as total
        from public.marketplace_products
        where deleted_at is null
          and (${term} = '' or name ilike ${`%${term}%`} or slug ilike ${`%${term}%`})
      `;
      if (!count) throw new Error("The catalogue count could not be verified.");
      return { rows, total: count.total, page, pageSize, ok: true as const };
    });
  });
/**
 * Just enough of the catalogue to fill a product picker.
 *
 * The demo URL manager filled its <select> from listProductsAdmin — every
 * column of all 7,365 products, to render a list of names. That is a lot of
 * wire for a dropdown, and a dropdown of 7,365 options is not usable anyway;
 * past 10,000 products PostgREST would cap the read and the missing ones would
 * simply be unselectable, with nothing to say so.
 *
 * p_selected is the important part. A bounded list would otherwise drop the
 * product an existing row already points at, the <select> would fall back to
 * its first option, and saving would quietly reassign the demo to a different
 * product. The current selection is always included, whatever the search says.
 */
export const listProductOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const raw = (input ?? {}) as { search?: unknown; selected?: unknown };
    return {
      search: String(raw.search ?? "")
        .trim()
        .slice(0, 120),
      selected: String(raw.selected ?? "")
        .trim()
        .slice(0, 64),
    };
  })
  .handler(async ({ context, data }) => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    const { search, selected } = data;
    const term = search.replace(/[%,()]/g, " ").trim();
    return withMarketplaceManagerDatabase(context.userId, async (tx) => {
      const options = await tx<{ id: string; name: string; slug: string }[]>`
        select id, name, slug
        from public.marketplace_products
        where deleted_at is null
          and (${term} = '' or name ilike ${`%${term}%`} or slug ilike ${`%${term}%`})
        order by name, id
        limit 200
      `;
      if (selected && !options.some((option) => option.id === selected)) {
        const [current] = await tx<{ id: string; name: string; slug: string }[]>`
          select id, name, slug
          from public.marketplace_products
          where id::text = ${selected} and deleted_at is null
        `;
        if (current) options.unshift(current);
      }
      return options;
    });
  });

export const listProductDemoBindings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((v) => z.object({ product_id: z.string().uuid().optional() }).parse(v ?? {}))
  .handler(async ({ data, context }) => {
    try {
      if (!context?.supabase) {
        throw new Error("Unauthorized: Supabase context is unavailable.");
      }

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

type CategoryAdminRow = Pick<
  Tables<"marketplace_categories">,
  | "id"
  | "slug"
  | "name"
  | "icon"
  | "image_key"
  | "tone"
  | "sort_order"
  | "is_featured"
  | "is_hidden"
>;

export const upsertCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v) => categorySchema.parse(v))
  .handler(async ({ data, context }) => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    const allowedColumns = new Set([
      "id",
      "slug",
      "name",
      "icon",
      "image_key",
      "tone",
      "sort_order",
      "is_featured",
      "is_hidden",
    ]);
    const entries = Object.entries(data).filter(
      ([column, value]) => allowedColumns.has(column) && value !== undefined,
    );
    if (
      !entries.some(([column]) => column === "slug") ||
      !entries.some(([column]) => column === "name")
    ) {
      throw new Error("Category slug and name are required.");
    }

    const row = await withMarketplaceManagerDatabase(context.userId, async (tx) => {
      const id = data.id;
      let saved: Tables<"marketplace_categories"> | undefined;
      if (id) {
        const updates = entries.filter(([column]) => column !== "id");
        const assignments = updates.map(([column], index) => `"${column}" = $${index + 1}`);
        const values = updates.map(([, value]) => value);
        const [updated] = await tx.unsafe<Tables<"marketplace_categories">[]>(
          `update public.marketplace_categories set ${assignments.join(", ")}, updated_at = now()` +
            ` where id = $${values.length + 1}::uuid returning *`,
          [...values, id],
        );
        saved = updated;
      } else {
        const columns = entries.map(([column]) => `"${column}"`).join(", ");
        const placeholders = entries.map((_, index) => `$${index + 1}`).join(", ");
        const updates = entries
          .filter(([column]) => column !== "slug")
          .map(([column]) => `"${column}" = excluded."${column}"`)
          .join(", ");
        const [inserted] = await tx.unsafe<Tables<"marketplace_categories">[]>(
          `insert into public.marketplace_categories (${columns}) values (${placeholders}) ` +
            `on conflict (slug) do update set ${updates} returning *`,
          entries.map(([, value]) => value),
        );
        saved = inserted;
      }
      if (!saved) throw new Error("Category write could not be verified.");
      return saved;
    });
    await catalogueChanged();
    return row;
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    const changed = await withMarketplaceManagerDatabase(context.userId, async (tx) => {
      const [row] = await tx<{ id: string; is_hidden: boolean }[]>`
        update public.marketplace_categories
        set is_hidden = true, updated_at = now()
        where id = ${data.id}::uuid and is_hidden = false
        returning id, is_hidden
      `;
      if (row) return true;
      const [existing] = await tx<{ id: string }[]>`
        select id from public.marketplace_categories where id = ${data.id}::uuid
      `;
      if (!existing) throw new Error("The category does not exist.");
      return false;
    });
    if (changed) await catalogueChanged();
    return { ok: true as const, hidden: true as const, changed };
  });

export const listCategoriesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    return withMarketplaceManagerDatabase(context.userId, async (tx) => {
      return tx<CategoryAdminRow[]>`
        select id, slug, name, icon, image_key, tone, sort_order, is_featured, is_hidden
        from public.marketplace_categories
        order by sort_order, id
      `;
    });
  });

// Homepage section ordering
export const setSectionEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v) => z.object({ key: z.string(), enabled: z.boolean() }).parse(v))
  .handler(async ({ data, context }) => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    const row = await withMarketplaceManagerDatabase(context.userId, async (tx) => {
      const [before] = await tx<{ state: Json; status: string }[]>`
        select to_jsonb(section) as state, section.status
        from public.marketplace_homepage_sections as section
        where section.key = ${data.key}
        for update
      `;
      if (!before) throw new Error(`Unknown homepage section: ${data.key}`);
      if (before.status === "archived") {
        throw new Error("Archived homepage sections must be restored before changing them.");
      }

      const status = data.enabled ? "published" : "unpublished";
      const [updated] = await tx<Tables<"marketplace_homepage_sections">[]>`
        update public.marketplace_homepage_sections
        set enabled = ${data.enabled},
            status = ${status},
            published_at = case
              when ${data.enabled} then coalesce(published_at, now())
              else published_at
            end,
            updated_at = now()
        where key = ${data.key}
        returning *
      `;
      if (!updated) throw new Error(`Homepage section ${data.key} could not be updated.`);

      await tx`
        select public.mm_audit(
          ${data.enabled ? "section.enable" : "section.disable"},
          'homepage_section',
          ${data.key},
          ${JSON.stringify(before.state)}::jsonb,
          ${JSON.stringify(updated)}::jsonb,
          null
        )
      `;
      return updated;
    });
    await catalogueChanged();
    return { ok: true, section: row };
  });

export const reorderSections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v) =>
    z
      .object({
        order: z
          .array(z.object({ key: z.string().min(1), sort_order: z.number().int() }))
          .min(1)
          .max(200)
          .refine((rows) => new Set(rows.map((row) => row.key)).size === rows.length)
          .refine((rows) => new Set(rows.map((row) => row.sort_order)).size === rows.length),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    const moved = await withMarketplaceManagerDatabase(context.userId, async (tx) => {
      const current = await tx<{ key: string; sort_order: number }[]>`
        select key, sort_order
        from public.marketplace_homepage_sections
        order by sort_order, key
        for update
      `;
      const knownKeys = new Set(current.map((row) => row.key));
      if (
        data.order.length !== current.length ||
        data.order.some((row) => !knownKeys.has(row.key))
      ) {
        throw new Error("Reorder must include every existing homepage section exactly once.");
      }

      const before = JSON.stringify(current);
      const requested = JSON.stringify(data.order);
      const updated = await tx<{ key: string }[]>`
        update public.marketplace_homepage_sections as section
        set sort_order = incoming.sort_order,
            updated_at = now()
        from jsonb_to_recordset(${requested}::jsonb) as incoming(key text, sort_order integer)
        where section.key = incoming.key
          and section.sort_order is distinct from incoming.sort_order
        returning section.key
      `;
      if (updated.length > 0) {
        await tx`
          select public.mm_audit(
            'section.reorder',
            'homepage_section',
            null,
            ${before}::jsonb,
            ${requested}::jsonb,
            null
          )
        `;
      }
      return updated.length;
    });
    await catalogueChanged();
    return { ok: true, moved };
  });

/**
 * The homepage layout's recent changes, and putting one back.
 *
 * There is no "reset to default": nothing records a canonical homepage order,
 * and inventing one would mean choosing the owner's layout for them. Every
 * reorder already writes its complete before and after state into the audit
 * log, so what an operator can do instead is look at the changes actually made
 * and restore any of them.
 *
 * Both go through RPCs that check the role themselves, so a caller who is
 * signed in but not an operator is refused by the database rather than by a
 * hidden button.
 */
export const layoutHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    const result = await callMarketplaceManagerRpc(
      "mm_layout_history",
      { p_limit: 20 },
      context.userId,
    );
    return z
      .object({
        entries: z.array(
          z.object({
            id: z.string(),
            action: z.string(),
            created_at: z.string(),
            actor_email: z.string().nullable(),
            section_key: z.string().nullable(),
            restorable: z.boolean(),
          }),
        ),
      })
      .parse(result);
  });

export const layoutRestore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v) => z.object({ auditId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    const result = await callMarketplaceManagerRpc(
      "mm_layout_restore",
      { p_audit_id: data.auditId },
      context.userId,
    );
    const restored = z.object({ ok: z.boolean() }).parse(result);
    if (restored.ok) await catalogueChanged();
    return restored;
  });

export const listSectionsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    return withMarketplaceManagerDatabase(context.userId, async (tx) => {
      return tx<Tables<"marketplace_homepage_sections">[]>`
        select *
        from public.marketplace_homepage_sections
        order by sort_order, key
      `;
    });
  });

// ============================================================================
// DEMO URL CRUD ENDPOINTS
// ============================================================================

export const addProductDemo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v) =>
    z
      .object({
        product_id: z.string().uuid(),
        demo_name: z.string().min(1),
        role_name: z.string().min(1),
        status: z.enum(["active", "inactive"]).default("active"),
        environment: z.enum(["production", "staging"]).default("production"),
        url: z.string().url(),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    if (!context?.supabase) {
      throw new Error("Unauthorized: Supabase context is unavailable.");
    }

    const { data: result, error } = await context.supabase
      .from("product_demo_urls")
      .insert([
        {
          id: crypto.randomUUID?.() || Date.now().toString(),
          product_id: data.product_id,
          demo_name: data.demo_name,
          role_name: data.role_name,
          status: data.status,
          environment: data.environment,
          url: data.url,
          sort_order: 0,
        },
      ])
      .select()
      .single();
    if (error) {
      console.error("[marketplace] addProductDemo error:", error);
      throw new Error(error.message);
    }
    await catalogueChanged();
    return result;
  });

export const updateProductDemo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v) =>
    z
      .object({
        id: z.string().uuid(),
        demo_name: z.string().min(1).optional(),
        role_name: z.string().min(1).optional(),
        status: z.enum(["active", "inactive"]).optional(),
        environment: z.enum(["production", "staging"]).optional(),
        url: z.string().url().optional(),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    if (!context?.supabase) {
      throw new Error("Unauthorized: Supabase context is unavailable.");
    }

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
    await catalogueChanged();
    return result;
  });

export const deleteProductDemo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    if (!context?.supabase) {
      throw new Error("Unauthorized: Supabase context is unavailable.");
    }

    const { error } = await context.supabase.from("product_demo_urls").delete().eq("id", data.id);
    if (error) {
      console.error("[marketplace] deleteProductDemo error:", error);
      throw new Error(error.message);
    }
    await catalogueChanged();
    return { ok: true };
  });

// ============================================================================
// SEARCH & FILTER ENDPOINTS
// ============================================================================

export const searchProducts = createServerFn({ method: "POST" })
  .validator((v) =>
    z
      .object({
        query: z.string().min(1),
        limit: z.number().int().min(1).max(100).optional().default(20),
      })
      .parse(v),
  )
  .handler(async ({ data }) => {
    try {
      const sb = publicClient();
      // Escaped as the admin searches are: a comma, parenthesis or quote would
      // otherwise be read as PostgREST filter syntax, letting a caller add
      // conditions of their own to a service-role query.
      const term = data.query.replace(/[%,()"*\\]/g, " ").trim();
      if (!term) return [];
      const searchTerm = `%${term}%`;
      // On sale now, as the product page decides it: visible alone also matched
      // drafts, unapproved and scheduled products, read with the service role.
      const { data: results, error } = await onSale(
        sb.from("marketplace_products").select(PRODUCT_COLS),
      )
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
  .validator((v) =>
    z
      .object({
        badge: z.enum(["NEW", "HOT", "TOP", "DEAL"]),
        limit: z.number().int().min(1).max(100).optional().default(20),
      })
      .parse(v),
  )
  .handler(async ({ data }) => {
    try {
      const sb = publicClient();
      // On sale now, as the product page decides it: visible alone also matched
      // drafts, unapproved and scheduled products, read with the service role.
      const { data: results, error } = await onSale(
        sb.from("marketplace_products").select(PRODUCT_COLS),
      )
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
  .validator((v) =>
    z
      .object({
        limit: z.number().int().min(1).max(100).optional().default(20),
      })
      .parse(v),
  )
  .handler(async ({ data }) => {
    try {
      const sb = publicClient();
      // On sale now, as the product page decides it: visible alone also matched
      // drafts, unapproved and scheduled products, read with the service role.
      const { data: results, error } = await onSale(
        sb.from("marketplace_products").select(PRODUCT_COLS),
      )
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
  .validator((v) =>
    z
      .object({
        limit: z.number().int().min(1).max(100).optional().default(20),
      })
      .parse(v),
  )
  .handler(async ({ data }) => {
    try {
      const sb = publicClient();
      // On sale now, as the product page decides it: visible alone also matched
      // drafts, unapproved and scheduled products, read with the service role.
      const { data: results, error } = await onSale(
        sb.from("marketplace_products").select(PRODUCT_COLS),
      )
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

/**
 * Every demo the catalogue has, for Demo Manager.
 *
 * This was open to anyone. It is a GET server function with no middleware, it
 * reads with the service-role key, and it selected `*` from product_demo_urls -
 * a table that carries `username` and `password` for demos behind a login. So an
 * unauthenticated caller received every demo's real address and its credentials,
 * while the whole point of the demo proxy and its ticket system is that the real
 * address is never handed out.
 *
 * Now: operator only, and the credential columns are not selected at all. Demo
 * Manager, which is the only caller, is an operator console and is unaffected.
 * The columns it does not get are the two it never displayed.
 */
export const listProductDemos = createServerFn({ method: "GET" }).handler(async () => {
  const { requireOperator } = await import("@/lib/auth/require-operator.server");
  await requireOperator("Reading the demo list");

  const supabase = privilegedClient();
  const { data: results, error } = await supabase
    .from("product_demo_urls")
    .select(
      "id,product_id,demo_name,role_name,url,description,environment,status,sort_order," +
        "last_checked_at,last_response_ms,last_http_status,last_result,ssl_valid," +
        "processing_status,processing,processed_at,detected_category_id,created_at,updated_at",
    )
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[marketplace] listProductDemos error:", error);
    return [];
  }
  return results ?? [];
});

/**
 * Writes sample products into the live catalogue. Operator only.
 *
 * This was a POST server function with no middleware that writes with the
 * service-role key, so anyone who found its id in the browser bundle could
 * insert products into the live storefront and make them visible. The screen
 * that triggers it is behind a route gate, but a route gate hides a screen - it
 * does not guard the function, which is callable directly.
 */
export const recoverMarketplaceData = createServerFn({ method: "POST" }).handler(async () => {
  const { requireOperator } = await import("@/lib/auth/require-operator.server");
  const operator = await requireOperator("Marketplace data recovery");

  const supabase = privilegedClient();

  const products = [
    {
      slug: "school-management",
      name: "School Management Software",
      category_id: null,
      price_label: "₹59,999",
      rating: 4.8,
      downloads: 2150,
      badge: "HOT",
      is_featured: true,
      is_trending: true,
      sort_order: 1,
    },
    {
      slug: "gym-fitness",
      name: "Gym & Fitness Center Management",
      category_id: null,
      price_label: "₹44,999",
      rating: 4.6,
      downloads: 1200,
      badge: "HOT",
      is_featured: true,
      is_trending: true,
      sort_order: 2,
    },
    {
      slug: "salon-spa",
      name: "Salon & Spa Management",
      category_id: null,
      price_label: "₹39,999",
      rating: 4.5,
      downloads: 980,
      badge: null,
      is_featured: false,
      is_trending: false,
      sort_order: 3,
    },
    {
      slug: "restaurant-pos",
      name: "Restaurant POS",
      category_id: null,
      price_label: "₹54,999",
      rating: 4.7,
      downloads: 1950,
      badge: "TOP",
      is_featured: true,
      is_trending: true,
      sort_order: 4,
    },
    {
      slug: "crm-software",
      name: "CRM Software",
      category_id: null,
      price_label: "₹59,999",
      rating: 4.7,
      downloads: 2050,
      badge: "TOP",
      is_featured: true,
      is_trending: true,
      sort_order: 5,
    },
    {
      slug: "hotel-management",
      name: "Hotel Management System",
      category_id: null,
      price_label: "₹89,999",
      rating: 4.8,
      downloads: 1920,
      badge: "TOP",
      is_featured: true,
      is_trending: false,
      sort_order: 6,
    },
    {
      slug: "fleet-management",
      name: "Fleet Management System",
      category_id: null,
      price_label: "₹69,999",
      rating: 4.7,
      downloads: 1750,
      badge: "HOT",
      is_featured: true,
      is_trending: false,
      sort_order: 7,
    },
    {
      slug: "hospital-hms",
      name: "Hospital Management System",
      category_id: null,
      price_label: "₹99,999",
      rating: 4.8,
      downloads: 2300,
      badge: "TOP",
      is_featured: true,
      is_trending: false,
      sort_order: 8,
    },
    {
      slug: "petcare-veterinary",
      name: "Pet Care & Veterinary Software",
      category_id: null,
      price_label: "₹44,999",
      rating: 4.6,
      downloads: 890,
      badge: "DEAL",
      is_featured: false,
      is_trending: true,
      sort_order: 9,
    },
    {
      slug: "college-erp",
      name: "College / University ERP",
      category_id: null,
      price_label: "₹89,999",
      rating: 4.5,
      downloads: 750,
      badge: "NEW",
      is_featured: false,
      is_trending: false,
      sort_order: 10,
    },
  ];

  let transactionOutcome: "rolled_back" | "unknown" = "unknown";
  try {
    const { data, error } = await supabase.rpc("mm_recover_marketplace_catalogue", {
      p_actor_id: operator.userId,
      p_products: products,
    });
    if (error) {
      transactionOutcome = error.code ? "rolled_back" : "unknown";
      throw new Error(error.message);
    }
    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      typeof data.productsInserted !== "number"
    ) {
      throw new Error("Recovery RPC returned an invalid result.");
    }
    return {
      success: true,
      productsInserted: data.productsInserted,
      message: "Marketplace data recovery completed",
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Unknown recovery failure";
    const { error: auditError } = await supabase.from("marketplace_audit_logs").insert({
      actor_id: operator.userId,
      action: "marketplace.recovery.failed",
      entity_type: "marketplace_data_recovery",
      entity_id: null,
      reason: reason.slice(0, 500),
      metadata: {
        products_requested: products.length,
        transaction_outcome: transactionOutcome,
      },
    });
    if (auditError) {
      throw new Error(
        `Marketplace recovery failed and its failure audit could not be persisted: ${auditError.message}`,
        { cause: err },
      );
    }
    throw new Error(
      transactionOutcome === "rolled_back"
        ? "Marketplace recovery failed; the transaction was rolled back and the failed attempt was audited."
        : "Marketplace recovery failed; the transaction outcome is unknown and the failed attempt was audited.",
      { cause: err },
    );
  }
});
