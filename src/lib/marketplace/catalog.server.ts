import { SingleFlightCache } from "@/lib/server/single-flight-cache";
import { CARD_FIELDS, toCard, type CatalogCard } from "./catalog-card";
import { RAIL_COUNTRIES, RAIL_COUNTRY_BY_MARKER } from "./rail-countries";

/**
 * The marketplace catalogue as the home page shows it: category rows (and the
 * curated rows) with their product cards, straight from the database.
 *
 * The one reader behind the home page's first page (getHomeCatalog, rendered
 * on the server) and every later page and "load more" (/api/marketplace/catalog).
 * They used to be two copies, and only the first applied what the Marketplace
 * Manager configures - a row held back as a draft, its schedule, the product
 * order placed by hand - so scrolling further down showed rows in an order the
 * manager had not set.
 *
 * There is no fallback to invented data: a failure returns nothing and the
 * caller says so.
 */

type Row = Record<string, unknown>;

export type CatalogRow = {
  id: string;
  title: string;
  slug: string;
  icon: string | null;
  href: string;
  cards: CatalogCard[];
  total: number;
  hasMore: boolean;
};

export type CatalogPage = {
  rows: CatalogRow[];
  rowOffset: number;
  rowCount: number;
  totalRows: number;
  hasMoreRows: boolean;
};

export function catalogConfigured(): boolean {
  return Boolean(url() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}` };
}

const PUBLISHED = "&visible=eq.true&content_status=eq.published";

/**
 * The manager's row configuration - which rows exist, whether each is live,
 * the order of hand-placed products - changes only when an operator edits it,
 * but was read from the database for every page of rows built: mm_rows_list()
 * alone was 37% of the database's total query time (343 ms a call). It is
 * kept here briefly - 30 s for the registry, 60 s for a row's order, no longer
 * than the catalogue's own responses are cached - and each is read once
 * however many pages are being built at the same moment. A failed read is not
 * kept: the next request asks the database again.
 */
const registryCache = new SingleFlightCache<RegistryRow[]>(30_000, 4);
const configuredCache = new SingleFlightCache<Set<string>>(30_000, 4);
const orderCache = new SingleFlightCache<string[]>(60_000, 500);

class Unavailable extends Error {}

async function cachedOrNull<T>(
  cache: SingleFlightCache<T>,
  key: string,
  read: () => Promise<T | null>,
): Promise<T | null> {
  try {
    return await cache.get(key, async () => {
      const value = await read();
      if (value === null) throw new Unavailable();
      return value;
    });
  } catch {
    return null;
  }
}

/** Categories with a row configured in the manager. Empty on any failure. */
async function configuredRows(): Promise<Set<string>> {
  const rows = await cachedOrNull(configuredCache, "configured", async () => {
    const response = await fetch(`${url()}/rest/v1/marketplace_row_config?select=category_id`, {
      headers: admin(),
    });
    if (!response.ok) return null;
    const list = (await response.json()) as { category_id: string }[];
    return new Set(list.map((r) => String(r.category_id)));
  });
  return rows ?? new Set();
}

/**
 * The product order a configured row renders in, from the resolver the manager
 * writes through. Null means "not configured, or unavailable".
 */
async function configuredOrder(key: string): Promise<string[] | null> {
  return cachedOrNull(orderCache, key, async () => {
    const response = await fetch(`${url()}/rest/v1/rpc/mm_row_products`, {
      method: "POST",
      headers: { ...admin(), "Content-Type": "application/json" },
      body: JSON.stringify({ p_key: key }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      ok?: boolean;
      products?: { product_id: string; live?: boolean }[];
    };
    if (!data?.ok || !Array.isArray(data.products)) return null;
    // A product placed by hand and later unpublished is not shown.
    return data.products.filter((x) => x.live !== false).map((x) => String(x.product_id));
  });
}

type RegistryRow = {
  key: string;
  row_kind: "category" | "curated";
  category_id: string | null;
  title: string;
  effective_order: number;
  live_now: boolean;
  cta_label: string | null;
  cta_href: string | null;
};

/**
 * Every homepage row the manager knows about, with whether it is live now
 * (published, not hidden, inside its schedule). Null on failure: categories
 * then render as they are ordered in the catalogue.
 */
async function rowRegistry(): Promise<RegistryRow[] | null> {
  return cachedOrNull(registryCache, "registry", async () => {
    const response = await fetch(`${url()}/rest/v1/rpc/mm_rows_list`, {
      method: "POST",
      headers: { ...admin(), "Content-Type": "application/json" },
      body: "{}",
    });
    if (!response.ok) return null;
    const rows = (await response.json()) as RegistryRow[];
    return Array.isArray(rows) ? rows : null;
  });
}

/** Cards for the given product ids, in that order. */
async function cardsById(ids: string[]): Promise<CatalogCard[] | null> {
  if (!ids.length) return [];
  const response = await fetch(
    `${url()}/rest/v1/marketplace_products?select=${CARD_FIELDS}${PUBLISHED}&id=in.(${ids.join(",")})`,
    { headers: admin() },
  );
  if (!response.ok) return null;
  const rows = (await response.json()) as Row[];
  const index = new Map(rows.map((r) => [String(r.id), r]));
  return ids
    .map((id) => index.get(id))
    .filter((r): r is Row => Boolean(r))
    .map(toCard);
}

/** A page of one category's products in catalogue order. */
async function categoryCards(categoryId: string, offset: number, limit: number) {
  const response = await fetch(
    `${url()}/rest/v1/marketplace_products?select=${CARD_FIELDS}${PUBLISHED}` +
      `&category_id=eq.${encodeURIComponent(categoryId)}` +
      `&order=sort_order.asc,name.asc&limit=${limit}&offset=${offset}`,
    { headers: { ...admin(), Prefer: "count=exact" } },
  );
  if (!response.ok) return null;
  const rows = (await response.json()) as Row[];
  const range = response.headers.get("content-range") ?? "";
  return { cards: rows.map(toCard), total: Number(range.split("/")[1]) || rows.length };
}

/**
 * A page of one row's products: in the order the manager placed them when the
 * row is configured, otherwise in catalogue order. Null when it cannot be read.
 */
async function rowCards(
  categoryId: string,
  slug: string,
  configured: boolean,
  offset: number,
  limit: number,
): Promise<{ cards: CatalogCard[]; total: number } | null> {
  if (configured) {
    const order = await configuredOrder(slug);
    if (order && order.length) {
      const cards = await cardsById(order.slice(offset, offset + limit));
      // A configured row that resolves to nothing falls back to the
      // catalogue rather than showing an empty shelf.
      if (cards && (cards.length || offset > 0)) return { cards, total: order.length };
    }
  }
  return categoryCards(categoryId, offset, limit);
}

/**
 * A page of home page rows: `rowCount` categories from `rowOffset`, each with
 * its first `perRow` cards. The first page also carries the manager's curated
 * rows (featured, trending, ...) in their configured positions.
 */
export async function readCatalogRows(options: {
  rowOffset: number;
  rowCount: number;
  perRow: number;
}): Promise<CatalogPage | null> {
  const { rowOffset, rowCount, perRow } = options;
  const categoryResponse = await fetch(
    `${url()}/rest/v1/marketplace_categories?select=id,name,slug,icon,sort_order` +
      `&is_hidden=eq.false&order=sort_order.asc&limit=${rowCount}&offset=${rowOffset}`,
    { headers: { ...admin(), Prefer: "count=exact" } },
  );
  if (!categoryResponse.ok) return null;
  const categories = (await categoryResponse.json()) as Row[];
  const range = categoryResponse.headers.get("content-range") ?? "";
  const totalRows = Number(range.split("/")[1]) || categories.length;

  const [curated, registry] = await Promise.all([configuredRows(), rowRegistry()]);
  // Absent from the registry means unconfigured, which is live.
  const byKey = new Map((registry ?? []).map((r) => [r.key, r]));
  const isLive = (slug: string) => byKey.get(slug)?.live_now ?? true;

  const categoryRows = await Promise.all(
    categories
      .filter((c) => isLive(String(c.slug ?? "")))
      .map(async (c) => {
        const slug = String(c.slug ?? "");
        const page = await rowCards(String(c.id), slug, curated.has(String(c.id)), 0, perRow);
        const cards = page?.cards ?? [];
        const total = page?.total ?? 0;
        return {
          id: String(c.id),
          title: String(c.name ?? ""),
          slug,
          icon: c.icon == null ? null : String(c.icon),
          href: `/marketplace/category/${slug}`,
          cards,
          total,
          hasMore: total > cards.length,
          order: byKey.get(slug)?.effective_order ?? Number(c.sort_order ?? 9999),
        };
      }),
  );

  // Curated rows are not categories; they appear once, on the first page, and
  // only when published.
  const curatedRows =
    rowOffset === 0
      ? await Promise.all(
          (registry ?? [])
            .filter((r) => r.row_kind === "curated" && r.live_now)
            .map(async (r) => {
              const order = (await configuredOrder(r.key)) ?? [];
              const cards = (await cardsById(order.slice(0, perRow))) ?? [];
              return {
                id: r.key,
                title: r.title,
                slug: r.key,
                icon: null,
                href: r.cta_href ?? "/marketplace",
                cards,
                total: order.length,
                hasMore: order.length > cards.length,
                order: r.effective_order ?? 9999,
              };
            }),
        )
      : [];

  const rows = [...categoryRows, ...curatedRows]
    .sort((a, b) => a.order - b.order)
    .map(({ order: _order, ...row }) => row)
    // A category with nothing published is not shown as an empty shelf.
    .filter((r) => r.cards.length > 0);

  return {
    rows,
    rowOffset,
    rowCount: categories.length,
    totalRows,
    hasMoreRows: rowOffset + categories.length < totalRows,
  };
}

/**
 * More products for one category row ("load more"), respecting the manager's
 * configured order. Null when the category does not exist or cannot be read.
 */
export async function readCategoryRow(
  slug: string,
  offset: number,
  limit: number,
): Promise<{
  category: { name: string; slug: string };
  cards: CatalogCard[];
  total: number;
} | null> {
  const categoryResponse = await fetch(
    `${url()}/rest/v1/marketplace_categories?select=id,name,slug` +
      `&slug=eq.${encodeURIComponent(slug)}&limit=1`,
    { headers: admin() },
  );
  if (!categoryResponse.ok) return null;
  const category = ((await categoryResponse.json()) as Row[])[0];
  if (!category) return null;
  const configured = (await configuredRows()).has(String(category.id));
  const page = await rowCards(String(category.id), slug, configured, offset, limit);
  if (!page) return null;
  return {
    category: { name: String(category.name ?? ""), slug: String(category.slug ?? "") },
    ...page,
  };
}
/**
 * One row's products in country order.
 *
 * A home page row is one category and every card in it is one country, so the
 * fifth card has to be the same country in every row: a visitor in Kenya
 * scrolling the page sees sixty different products, each one targeted at
 * Kenya. The catalogue already holds that relationship - one product per
 * category per country, the country written on the product as
 * "country:<name>" in search_keywords - and this reads it in the order
 * src/lib/marketplace/rail-countries.ts publishes.
 *
 * It does not replace readCategoryRow, which orders a row the way the
 * Marketplace Manager places it and is what /marketplace uses. This is a
 * second way of reading the same rows, asked for by ?order=country.
 *
 * A product with no country marker is not dropped - it goes after the
 * country cards, in catalogue order, so nothing already on a shelf leaves it.
 * PostgREST cannot sort by an arbitrary list, so the row is read once and
 * ordered here; a row is sixty to a hundred products, and the answer is
 * cached for a minute by the route that asks for it.
 */
export async function readCountryRow(
  slug: string,
  limit: number,
): Promise<{
  category: { name: string; slug: string };
  cards: CatalogCard[];
  total: number;
  countries: number;
  /** Countries in the rail that this category has no published product for. */
  missing: string[];
} | null> {
  const categoryResponse = await fetch(
    `${url()}/rest/v1/marketplace_categories?select=id,name,slug` +
      `&slug=eq.${encodeURIComponent(slug)}&limit=1`,
    { headers: admin() },
  );
  if (!categoryResponse.ok) return null;
  const category = ((await categoryResponse.json()) as Row[])[0];
  if (!category) return null;

  // The whole row, once. A category holds sixty to a hundred and twelve
  // products today and the ceiling is the country list, so this is bounded by
  // how many countries the platform targets rather than by the catalogue.
  const ceiling = Math.max(limit, RAIL_COUNTRIES.length) + 40;
  const response = await fetch(
    `${url()}/rest/v1/marketplace_products?select=${CARD_FIELDS}${PUBLISHED}` +
      `&category_id=eq.${encodeURIComponent(String(category.id))}` +
      `&order=sort_order.asc,name.asc&limit=${ceiling}`,
    { headers: { ...admin(), Prefer: "count=exact" } },
  );
  if (!response.ok) return null;
  const rows = (await response.json()) as Row[];
  const range = response.headers.get("content-range") ?? "";
  const total = Number(range.split("/")[1]) || rows.length;

  const cards = rows.map(toCard);
  const placed: CatalogCard[] = [];
  const unplaced: CatalogCard[] = [];
  const takenByCountry = new Map<string, CatalogCard>();
  for (const card of cards) {
    const marker = card.country;
    if (!marker || !RAIL_COUNTRY_BY_MARKER.has(marker)) {
      unplaced.push(card);
      continue;
    }
    // Two products marked for the same country: the first in catalogue order
    // takes the country's place and the second goes after the country cards,
    // so no product disappears and no country gets two cards.
    if (takenByCountry.has(marker)) unplaced.push(card);
    else takenByCountry.set(marker, card);
  }
  for (const country of RAIL_COUNTRIES) {
    const card = takenByCountry.get(country.marker);
    if (card) placed.push(card);
  }

  // Which countries this row cannot show. A card is never invented to fill a
  // gap; the gap is reported so it can be filled with a real product.
  const missing = RAIL_COUNTRIES.filter((c) => !takenByCountry.has(c.marker)).map((c) => c.marker);

  return {
    category: { name: String(category.name ?? ""), slug: String(category.slug ?? "") },
    cards: [...placed, ...unplaced].slice(0, limit),
    total,
    countries: placed.length,
    missing,
  };
}
