import { createServerFn } from "@tanstack/react-start";

/**
 * The first page of the marketplace, rendered with the page itself.
 *
 * The home page fetched its rows from the browser after loading, so the HTML
 * that actually left the server carried no product and no category link at all.
 * A crawler arriving at the front door of a twelve-thousand product catalogue
 * found nothing to follow, and a reader on a slow connection saw an empty
 * shelf until the second request came back.
 *
 * This runs on the server during the first render and hands the same first page
 * the browser would otherwise have asked for. Everything after it still arrives
 * as the reader scrolls, so the page stays small.
 *
 * It reads the same fields, in the same shape, as /api/marketplace/catalog, and
 * like that endpoint it never sends a demo address - whether a demo exists is
 * all a card is told.
 */

const ROWS = 8;
const PER_ROW = 12;

// The first page is the same for everybody, so it is built once a minute
// rather than on every visit. Nine database round trips on each request put a
// second onto the time before anything reached the reader.
const CACHE_MS = 60_000;
let cached: { at: number; payload: HomeCatalogSeed } | null = null;

const CARD_FIELDS =
  "id,slug,name,icon,industry_label,price_label,price_period,rating," +
  "downloads_label,badge,is_featured,is_trending,is_best_seller,is_new_release," +
  "search_keywords";

type Row = Record<string, unknown>;

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}` };
}

function countryOf(keywords: unknown): string | null {
  if (!Array.isArray(keywords)) return null;
  const marker = keywords.find(
    (k) => typeof k === "string" && k.startsWith("country:"),
  ) as string | undefined;
  return marker ? marker.slice("country:".length) : null;
}

function toCard(row: Row) {
  return {
    id: String(row.id),
    slug: String(row.slug ?? ""),
    name: String(row.name ?? ""),
    icon: row.icon == null ? null : String(row.icon),
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
  };
}

async function productsFor(categoryId: string, limit: number) {
  const response = await fetch(
    `${url()}/rest/v1/marketplace_products?select=${CARD_FIELDS}` +
      `&visible=eq.true&content_status=eq.published` +
      `&category_id=eq.${encodeURIComponent(categoryId)}` +
      `&order=sort_order.asc,name.asc&limit=${limit}&offset=0`,
    { headers: { ...admin(), Prefer: "count=exact" } },
  );
  if (!response.ok) return { cards: [], total: 0 };
  const rows = (await response.json()) as Row[];
  const range = response.headers.get("content-range") ?? "";
  return { cards: rows.map(toCard), total: Number(range.split("/")[1]) || rows.length };
}

export type SeededRow = {
  id: string;
  title: string;
  slug: string;
  icon: string | null;
  href: string;
  cards: ReturnType<typeof toCard>[];
  total: number;
  hasMore: boolean;
};

export type HomeCatalogSeed = {
  rows: SeededRow[];
  rowOffset: number;
  rowCount: number;
  totalRows: number;
  hasMoreRows: boolean;
} | null;

export const getHomeCatalog = createServerFn({ method: "GET" }).handler(
  async (): Promise<HomeCatalogSeed> => {
    // A server that cannot reach the catalogue renders nothing here rather
    // than inventing rows; the browser then asks for them as it always did.
    if (!url() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.payload;

    try {
      const categoryResponse = await fetch(
        `${url()}/rest/v1/marketplace_categories?select=id,name,slug,icon` +
          `&is_hidden=eq.false&order=sort_order.asc&limit=${ROWS}&offset=0`,
        { headers: { ...admin(), Prefer: "count=exact" } },
      );
      if (!categoryResponse.ok) return null;

      const categories = (await categoryResponse.json()) as Row[];
      const range = categoryResponse.headers.get("content-range") ?? "";
      const totalRows = Number(range.split("/")[1]) || categories.length;

      const rows = await Promise.all(
        categories.map(async (c) => {
          const { cards, total } = await productsFor(String(c.id), PER_ROW);
          return {
            id: String(c.id),
            title: String(c.name ?? ""),
            slug: String(c.slug ?? ""),
            icon: c.icon == null ? null : String(c.icon),
            href: `/marketplace/category/${String(c.slug ?? "")}`,
            cards,
            total,
            hasMore: total > cards.length,
          };
        }),
      );

      const payload: HomeCatalogSeed = {
        // A category with nothing published is not shown as an empty shelf.
        rows: rows.filter((r) => r.cards.length > 0),
        rowOffset: 0,
        rowCount: categories.length,
        totalRows,
        hasMoreRows: categories.length < totalRows,
      };
      cached = { at: Date.now(), payload };
      return payload;
    } catch (error) {
      console.error("[home catalogue] seed failed", error);
      return null;
    }
  },
);
