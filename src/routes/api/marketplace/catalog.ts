import { createFileRoute } from "@tanstack/react-router";

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
  "search_keywords";

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
  };
}

async function productsFor(categoryId: string, offset: number, limit: number) {
  const response = await fetch(
    `${url()}/rest/v1/marketplace_products?select=${CARD_FIELDS}` +
      `&visible=eq.true&content_status=eq.published` +
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
            const categoryResponse = await fetch(
              `${url()}/rest/v1/marketplace_categories?select=id,name,slug` +
                `&slug=eq.${encodeURIComponent(category)}&limit=1`,
              { headers: admin() },
            );
            const categories = categoryResponse.ok
              ? ((await categoryResponse.json()) as Row[])
              : [];
            if (!categories[0]) {
              return Response.json({ error: "No such category", cards: [] }, { status: 404 });
            }
            const limit = askedLimit;
            const { cards, total, ok } = await productsFor(String(categories[0].id), offset, limit);
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
              `&is_hidden=eq.false&order=sort_order.asc` +
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

          const rows = await Promise.all(
            categories.map(async (c) => {
              const { cards, total } = await productsFor(String(c.id), 0, perRow);
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
