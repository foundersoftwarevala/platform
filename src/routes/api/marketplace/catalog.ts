import { createFileRoute } from "@tanstack/react-router";
import { publicProductFilter } from "@/lib/marketplace/public-visibility";

/**
 * The marketplace catalogue, straight from the database.
 *
 * The home page used to carry its products as a literal array in the source and
 * pad every row out to a fixed size with generated cards. This serves the real
 * rows instead, a page at a time, so the browser never receives thousands of
 * cards and the catalogue can grow to twelve thousand products and beyond
 * without the page changing.
 *
 *   ?rows=N&perRow=M          the first N category rows, M products each
 *   ?category=<slug>&offset=  more products for one row, for infinite loading
 *
 * There is no fallback to invented data. If the database cannot be reached the
 * response says so and the page shows that, rather than quietly showing
 * something that is not real.
 */

const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; payload: unknown }>();

/** Only what a card actually draws, so a row of sixty stays small. */
const CARD_FIELDS =
  "id,slug,name,icon,industry_label,price_label,price_period,rating," +
  "downloads_label,badge,is_featured,is_trending,is_best_seller,is_new_release," +
  "search_keywords," +
  // The card used to be given none of this and invented substitutes for it.
  // Coverage across the published catalogue: description 100%, features 67%,
  // tech_stack / licence / deployment / subcategory 67%.
  "description,features,tech_stack,license,deployment,subcategory," +
  // Whether a demo exists — twelve products in the whole catalogue have one,
  // and the card was claiming a live demo for all of them. The address itself
  // is still never sent.
  "product_demo_urls(url,status)";

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}` };
}

/** The country this product is targeted at, stored on the row itself. */
function countryOf(keywords: unknown): string | null {
  if (!Array.isArray(keywords)) return null;
  const marker = keywords.find(
    (k) => typeof k === "string" && k.startsWith("country:"),
  ) as string | undefined;
  return marker ? marker.slice("country:".length) : null;
}

type Row = Record<string, unknown>;

/**
 * A card carries no demo URL. Whether a demo exists is a boolean; the address
 * itself is never sent to a browser, because that list is the catalogue's one
 * genuinely stealable asset.
 */
function toCard(row: Row) {
  return {
    id: String(row.id),
    slug: String(row.slug ?? ""),
    name: String(row.name ?? ""),
    icon: row.icon ?? null,
    industry: row.industry_label ?? null,
    price: row.price_label ?? null,
    period: row.price_period ?? null,
    rating: row.rating ?? null,
    downloads: row.downloads_label ?? null,
    badge: row.badge ?? null,
    featured: Boolean(row.is_featured),
    trending: Boolean(row.is_trending),
    bestSeller: Boolean(row.is_best_seller),
    newRelease: Boolean(row.is_new_release),
    country: countryOf(row.search_keywords),
    href: `/marketplace/product/${String(row.slug ?? "")}`,

    // Real product copy, rather than a sentence assembled from the industry
    // name. Trimmed here so the payload stays small; the card clamps it again.
    description:
      typeof row.description === "string" && row.description.trim()
        ? row.description.trim().slice(0, 240)
        : null,
    features: Array.isArray(row.features)
      ? (row.features as unknown[]).slice(0, 6).map(String).filter(Boolean)
      : [],
    tech: Array.isArray(row.tech_stack)
      ? (row.tech_stack as unknown[]).slice(0, 6).map(String).filter(Boolean)
      : [],
    license: row.license == null ? null : String(row.license),
    platform: row.deployment == null ? null : String(row.deployment),
    subcategory: row.subcategory == null ? null : String(row.subcategory),

    // A demo counts only if it is switched on and actually has an address.
    hasDemo: Array.isArray(row.product_demo_urls)
      ? (row.product_demo_urls as { url?: unknown; status?: unknown }[]).some(
          (d) =>
            typeof d?.url === "string" &&
            d.url.trim() !== "" &&
            d?.status === "active",
        )
      : false,
  };
}

/* ------------------------------------------------------------------------ */
/* The Homepage Rows registry, honoured on every page - not only the first.   */
/* ------------------------------------------------------------------------ */
//
// The first eight rows are seeded by getHomeCatalog, which asks the registry
// whether each row is live and in what order its products go. Every later page
// came from here, which asked neither, so a row saved as a draft or scheduled
// for next week still appeared from row nine on, and hand-placed products were
// ignored past card twelve. The same two questions are asked here now.

type RegistryEntry = { key: string; row_kind: string; live_now: boolean };
let registryCache: { at: number; byKey: Map<string, RegistryEntry>; configured: Set<string> } | null = null;

async function registry() {
  if (registryCache && Date.now() - registryCache.at < CACHE_MS) return registryCache;
  const byKey = new Map<string, RegistryEntry>();
  const configured = new Set<string>();
  try {
    const [rows, config] = await Promise.all([
      fetch(`${url()}/rest/v1/rpc/mm_rows_list`, {
        method: "POST",
        headers: { ...admin(), "Content-Type": "application/json" },
        body: "{}",
      }),
      fetch(`${url()}/rest/v1/marketplace_row_config?select=category_id`, { headers: admin() }),
    ]);
    if (rows.ok) {
      for (const r of (await rows.json()) as RegistryEntry[]) byKey.set(String(r.key), r);
    }
    if (config.ok) {
      for (const r of (await config.json()) as { category_id: string | null }[]) {
        if (r.category_id) configured.add(String(r.category_id));
      }
    }
  } catch {
    // Unreadable registry: every row behaves as unconfigured and live, which
    // is exactly how the page behaved before the registry existed.
  }
  registryCache = { at: Date.now(), byKey, configured };
  return registryCache;
}

/** Whether the registry lets this row be shown. Unknown to it means live. */
function isLive(reg: Awaited<ReturnType<typeof registry>>, slug: string): boolean {
  const entry = reg.byKey.get(slug);
  return entry ? entry.live_now !== false : true;
}

const orderCache = new Map<string, { at: number; ids: string[] | null }>();

/** The product order the row resolver gives a row, or null. */
async function configuredOrder(key: string): Promise<string[] | null> {
  const hit = orderCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.ids;
  let ids: string[] | null = null;
  try {
    const response = await fetch(`${url()}/rest/v1/rpc/mm_row_products`, {
      method: "POST",
      headers: { ...admin(), "Content-Type": "application/json" },
      body: JSON.stringify({ p_key: key }),
    });
    if (response.ok) {
      const data = (await response.json()) as {
        ok?: boolean;
        products?: { product_id: string; live?: boolean }[];
      };
      if (data?.ok && Array.isArray(data.products)) {
        ids = data.products.filter((x) => x.live !== false).map((x) => String(x.product_id));
      }
    }
  } catch {
    ids = null;
  }
  orderCache.set(key, { at: Date.now(), ids });
  if (orderCache.size > 500) orderCache.clear();
  return ids;
}

/** A slice of a resolved order, fetched and kept in that order. */
async function productsInOrder(order: string[], offset: number, limit: number) {
  const wanted = order.slice(offset, offset + limit);
  if (!wanted.length) return { cards: [], total: order.length, ok: true };
  const response = await fetch(
    `${url()}/rest/v1/marketplace_products?select=${CARD_FIELDS}` +
      `${publicProductFilter()}&id=in.(${wanted.join(",")})`,
    { headers: admin() },
  );
  if (!response.ok) return { cards: [], total: 0, ok: false };
  const rows = (await response.json()) as Row[];
  const index = new Map(rows.map((r) => [String(r.id), r]));
  const cards = wanted
    .map((id) => index.get(id))
    .filter((r): r is Row => Boolean(r))
    .map(toCard);
  return { cards, total: order.length, ok: true };
}

async function productsFor(
  categoryId: string,
  offset: number,
  limit: number,
  configuredKey?: string,
) {
  // A row the manager has configured renders in the resolver order on every
  // page. A configured row that resolves to nothing keeps its catalogue
  // default rather than showing an empty shelf, as the seed does.
  if (configuredKey) {
    const order = await configuredOrder(configuredKey);
    if (order && order.length) return productsInOrder(order, offset, limit);
  }
  const response = await fetch(
    `${url()}/rest/v1/marketplace_products?select=${CARD_FIELDS}` +
      `${publicProductFilter()}` +
      `&category_id=eq.${encodeURIComponent(categoryId)}` +
      `&order=sort_order.asc,name.asc&limit=${limit}&offset=${offset}`,
    { headers: { ...admin(), Prefer: "count=exact" } },
  );
  if (!response.ok) return { cards: [], total: 0, ok: false };
  const rows = (await response.json()) as Row[];
  const range = response.headers.get("content-range") ?? "";
  return {
    cards: rows.map(toCard),
    total: Number(range.split("/")[1]) || rows.length,
    ok: true,
  };
}

export const Route = createFileRoute("/api/marketplace/catalog")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!url() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
          return Response.json(
            { error: "The catalogue is not configured on this server.", rows: [] },
            { status: 503 },
          );
        }

        const params = new URL(request.url).searchParams;
        const category = (params.get("category") ?? "").trim();
        const offset = Math.max(Number(params.get("offset") ?? 0) || 0, 0);
        const perRow = Math.min(Math.max(Number(params.get("perRow") ?? 12) || 12, 1), 60);
        const rowCount = Math.min(Math.max(Number(params.get("rows") ?? 8) || 8, 1), 30);
        const rowOffset = Math.max(Number(params.get("rowOffset") ?? 0) || 0, 0);

        // `limit` is part of the key: a row asked for at twelve and again at
        // sixty is two different answers, and the first must not stand in for
        // the second.
        const askedLimit = Math.min(
          Math.max(Number(params.get("limit") ?? perRow) || perRow, 1), 60,
        );
        const key = `${category}|${offset}|${perRow}|${askedLimit}|${rowCount}|${rowOffset}`;
        const hit = cache.get(key);
        if (hit && Date.now() - hit.at < CACHE_MS) {
          return Response.json(hit.payload, {
            headers: { "Cache-Control": "public, max-age=60" },
          });
        }

        try {
          // ---- one row, paged: what infinite loading asks for ---------------
          if (category) {
            const reg = await registry();
            const categoryResponse = await fetch(
              `${url()}/rest/v1/marketplace_categories?select=id,name,slug` +
                `&slug=eq.${encodeURIComponent(category)}&is_hidden=eq.false&limit=1`,
              { headers: admin() },
            );
            const categories = categoryResponse.ok
              ? ((await categoryResponse.json()) as Row[])
              : [];
            const limit = askedLimit;

            // A curated row (trending-now, new-releases...) is not a category.
            // Its "show more" used to answer 404; it is served from the same
            // resolver that filled its first page.
            const curated = reg.byKey.get(category);
            if (!categories[0] && curated?.row_kind === "curated") {
              if (!isLive(reg, category)) {
                return Response.json({ error: "No such row", cards: [] }, { status: 404 });
              }
              const order = (await configuredOrder(category)) ?? [];
              const result = await productsInOrder(order, offset, limit);
              const payload = {
                category: { name: category, slug: category },
                cards: result.cards,
                total: result.total,
                offset,
                limit,
                hasMore: offset + result.cards.length < result.total,
              };
              cache.set(key, { at: Date.now(), payload });
              return Response.json(payload, {
                headers: { "Cache-Control": "public, max-age=60" },
              });
            }
            if (!categories[0] || !isLive(reg, String(categories[0].slug ?? ""))) {
              return Response.json({ error: "No such category", cards: [] }, { status: 404 });
            }
            const { cards, total, ok } = await productsFor(
              String(categories[0].id),
              offset,
              limit,
              reg.configured.has(String(categories[0].id)) ? String(categories[0].slug ?? "") : undefined,
            );
            if (!ok) {
              return Response.json(
                { error: "The catalogue could not be read.", cards: [] },
                { status: 502 },
              );
            }
            const payload = {
              category: { name: categories[0].name, slug: categories[0].slug },
              cards,
              total,
              offset,
              limit,
              hasMore: offset + cards.length < total,
            };
            cache.set(key, { at: Date.now(), payload });
            return Response.json(payload, {
              headers: { "Cache-Control": "public, max-age=60" },
            });
          }

          // ---- a page of rows for the home page ------------------------------
          const categoryResponse = await fetch(
            `${url()}/rest/v1/marketplace_categories?select=id,name,slug,icon` +
              `&is_hidden=eq.false&order=sort_order.asc,name.asc` +
              `&limit=${rowCount}&offset=${rowOffset}`,
            { headers: { ...admin(), Prefer: "count=exact" } },
          );
          if (!categoryResponse.ok) {
            return Response.json(
              { error: "The catalogue could not be read.", rows: [] },
              { status: 502 },
            );
          }
          const categories = (await categoryResponse.json()) as Row[];
          const range = categoryResponse.headers.get("content-range") ?? "";
          const totalRows = Number(range.split("/")[1]) || categories.length;
          const reg = await registry();

          const rows = await Promise.all(
            categories
              // A row held back as a draft, or outside its schedule, is not
              // shown here either - the same rule the first page follows.
              .filter((c) => isLive(reg, String(c.slug ?? "")))
              .map(async (c) => {
              const { cards, total } = await productsFor(
                String(c.id),
                0,
                perRow,
                reg.configured.has(String(c.id)) ? String(c.slug ?? "") : undefined,
              );
              return {
                id: String(c.id),
                title: String(c.name ?? ""),
                slug: String(c.slug ?? ""),
                icon: c.icon ?? null,
                href: `/marketplace/category/${String(c.slug ?? "")}`,
                cards,
                total,
                hasMore: total > cards.length,
              };
            }),
          );

          // A category with nothing published is not shown as an empty shelf.
          const payload = {
            rows: rows.filter((r) => r.cards.length > 0),
            rowOffset,
            rowCount: categories.length,
            totalRows,
            hasMoreRows: rowOffset + categories.length < totalRows,
            perRow,
          };
          cache.set(key, { at: Date.now(), payload });
          if (cache.size > 200) cache.clear();
          return Response.json(payload, {
            headers: { "Cache-Control": "public, max-age=60" },
          });
        } catch (error) {
          console.error("[catalog] failed", error);
          return Response.json(
            { error: "The catalogue could not be read.", rows: [] },
            { status: 502 },
          );
        }
      },
    },
  },
});
