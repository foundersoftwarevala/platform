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


/**
 * Which category rows the manager has actually configured.
 *
 * Returns an empty set — and costs one tiny query — while nothing is
 * configured, which is the state the site is in until somebody curates a row.
 * A failure here returns an empty set too, so the homepage simply behaves as
 * it always did.
 */
async function configuredRows(): Promise<Set<string>> {
  try {
    const response = await fetch(
      `${url()}/rest/v1/marketplace_row_config?select=category_id`,
      { headers: admin() },
    );
    if (!response.ok) return new Set();
    const rows = (await response.json()) as { category_id: string }[];
    return new Set(rows.map((r) => String(r.category_id)));
  } catch {
    return new Set();
  }
}

/**
 * The product order a configured row should render in, from the same resolver
 * the manager writes through. Null means "not configured, or unavailable" and
 * the caller keeps its original behaviour.
 */
async function configuredOrder(slug: string): Promise<string[] | null> {
  try {
    const response = await fetch(`${url()}/rest/v1/rpc/mm_row_products`, {
      method: "POST",
      headers: { ...admin(), "Content-Type": "application/json" },
      body: JSON.stringify({ p_key: slug }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      ok?: boolean;
      products?: { product_id: string; live?: boolean }[];
    };
    if (!data?.ok || !Array.isArray(data.products)) return null;
    // A product placed by hand and later unpublished is dropped here rather
    // than shown to the public; the manager still sees it flagged in the slot.
    return data.products.filter((x) => x.live !== false).map((x) => String(x.product_id));
  } catch {
    return null;
  }
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
 * Every homepage row the manager knows about, with the registry's own answer
 * to whether it is live right now — status published, not hidden, and inside
 * its schedule.
 *
 * Returns null on any failure, and the caller then renders categories the way
 * it always has. A homepage that loses a curated row is a small problem; a
 * homepage that loses its catalogue is an incident.
 */
async function rowRegistry(): Promise<RegistryRow[] | null> {
  try {
    const response = await fetch(`${url()}/rest/v1/rpc/mm_rows_list`, {
      method: "POST",
      headers: { ...admin(), "Content-Type": "application/json" },
      body: "{}",
    });
    if (!response.ok) return null;
    const rows = (await response.json()) as RegistryRow[];
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  }
}

/** The cards for a curated row, in the order the manager's resolver gives. */
async function curatedCards(key: string, limit: number) {
  const order = await configuredOrder(key);
  if (!order || !order.length) return { cards: [], total: 0 };
  const wanted = order.slice(0, limit);
  try {
    const response = await fetch(
      `${url()}/rest/v1/marketplace_products?select=${CARD_FIELDS}` +
        `&visible=eq.true&content_status=eq.published&id=in.(${wanted.join(",")})`,
      { headers: admin() },
    );
    if (!response.ok) return { cards: [], total: 0 };
    const rows = (await response.json()) as Row[];
    const index = new Map(rows.map((r) => [String(r.id), r]));
    const cards = wanted
      .map((id) => index.get(id))
      .filter((r): r is Row => Boolean(r))
      .map(toCard);
    return { cards, total: order.length };
  } catch {
    return { cards: [], total: 0 };
  }
}

async function productsFor(categoryId: string, limit: number, slug?: string, configured?: boolean) {
  // A configured row renders in the order the manager set. The cards
  // themselves are still fetched with the same fields as before, so the shape
  // the page receives never changes — only which products, and in what order.
  if (configured && slug) {
    const order = await configuredOrder(slug);
    if (order && order.length) {
      const wanted = order.slice(0, limit);
      const byId = await fetch(
        `${url()}/rest/v1/marketplace_products?select=${CARD_FIELDS}` +
          `&visible=eq.true&content_status=eq.published` +
          `&id=in.(${wanted.join(",")})`,
        { headers: admin() },
      );
      if (byId.ok) {
        const rows = (await byId.json()) as Row[];
        const index = new Map(rows.map((r) => [String(r.id), r]));
        const cards = wanted
          .map((id) => index.get(id))
          .filter((r): r is Row => Boolean(r))
          .map(toCard);
        if (cards.length) return { cards, total: order.length };
      }
      // Falling through on an empty result is deliberate: a configured row
      // that resolves to nothing renders its catalogue default rather than an
      // empty shelf.
    }
  }

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

      const curated = await configuredRows();
      const registry = await rowRegistry();

      // What the registry says about each row. Absent means unconfigured,
      // which is live — that is the state every category is in today.
      const byKey = new Map((registry ?? []).map((r) => [r.key, r]));
      const isLive = (slug: string) => {
        const r = byKey.get(slug);
        return r ? r.live_now : true;
      };

      const categoryRows = await Promise.all(
        categories
          // A row held back as a draft, or outside its schedule, is not shown.
          .filter((c) => isLive(String(c.slug ?? "")))
          .map(async (c) => {
            const { cards, total } = await productsFor(
              String(c.id), PER_ROW, String(c.slug ?? ""), curated.has(String(c.id)),
            );
            const meta = byKey.get(String(c.slug ?? ""));
            return {
              id: String(c.id),
              title: String(c.name ?? ""),
              slug: String(c.slug ?? ""),
              icon: c.icon == null ? null : String(c.icon),
              href: `/marketplace/category/${String(c.slug ?? "")}`,
              cards,
              total,
              hasMore: total > cards.length,
              order: meta?.effective_order ?? Number(c.sort_order ?? 9999),
            };
          }),
      );

      // Curated rows — featured, trending and the like. They are not
      // categories, so they link to the marketplace rather than to a category
      // page, and only published ones appear at all.
      const curatedLive = (registry ?? []).filter(
        (r) => r.row_kind === "curated" && r.live_now,
      );
      const curatedRows = await Promise.all(
        curatedLive.map(async (r) => {
          const { cards, total } = await curatedCards(r.key, PER_ROW);
          return {
            id: r.key,
            title: r.title,
            slug: r.key,
            icon: null,
            href: r.cta_href ?? "/marketplace",
            cards,
            total,
            hasMore: total > cards.length,
            order: r.effective_order ?? 9999,
          };
        }),
      );

      const rows = [...categoryRows, ...curatedRows]
        .sort((a, b) => a.order - b.order)
        .map(({ order: _order, ...row }) => row);

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
