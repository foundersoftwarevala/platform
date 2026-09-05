import { createFileRoute } from "@tanstack/react-router";

/**
 * Catalogue search for the marketplace tools.
 *
 * One endpoint serves the Product Finder, Recommendations and Compare screens
 * so they all read the same real rows from `marketplace_products` and the same
 * real prices from `marketplace_product_pricing`. Nothing here is generated:
 * every product returned exists in the catalogue.
 *
 *   ?q=<free text>          rank products against a described requirement
 *   ?ids=<id,id,id>         fetch a specific set, for side-by-side compare
 *   ?mode=popular           the products the marketplace is actually opening
 *   ?category=<slug>        narrow any of the above to one category
 */

const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; payload: unknown }>();

/** Words that carry no signal when matching a requirement to a product. */
const STOPWORDS = new Set([
  "a", "an", "and", "any", "are", "as", "at", "be", "best", "business", "but", "by",
  "can", "do", "for", "from", "get", "good", "have", "help", "i", "in", "is", "it",
  "me", "my", "need", "of", "on", "or", "our", "software", "solution", "system",
  "that", "the", "to", "want", "we", "what", "which", "will", "with", "you", "your",
]);

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return { apikey: key, Authorization: `Bearer ${key}` };
}

const SELECT =
  "id,slug,name,industry_label,icon,rating,downloads_label,badge,demo_url," +
  "price_label,price_period,description,tech_stack,features,modules,deployment," +
  "license,version,is_featured,is_trending,is_best_seller,is_new_release,category_id";

type ProductRow = Record<string, unknown>;

/** Turn a described requirement into the words worth searching for. */
function terms(query: string): string[] {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .replace(/[^a-z0-9\s+#.-]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
    ),
  ).slice(0, 6);
}

function escapeForFilter(value: string) {
  // PostgREST treats these as syntax inside an or() list.
  return value.replace(/[(),*]/g, " ").trim();
}

/** How well a product answers the requirement, and why. */
function score(product: ProductRow, words: string[]) {
  const name = String(product.name ?? "").toLowerCase();
  const haystack = [
    product.name, product.industry_label, product.description,
    product.tech_stack, product.features, product.modules, product.deployment,
  ]
    .map((v) => (Array.isArray(v) ? v.join(" ") : String(v ?? "")))
    .join(" ")
    .toLowerCase();

  let points = 0;
  const matched: string[] = [];
  for (const word of words) {
    if (name.includes(word)) {
      points += 3;
      matched.push(word);
    } else if (haystack.includes(word)) {
      points += 1;
      matched.push(word);
    }
  }
  if (product.is_best_seller) points += 0.5;
  if (product.is_featured) points += 0.25;
  return { points, matched };
}

/**
 * A demo URL is the one thing in this catalogue worth stealing, so it never
 * leaves the server. Callers are told only whether a demo exists; opening one
 * goes through the gated demo route.
 */
function stripDemoUrls(rows: ProductRow[]) {
  return rows.map((row) => {
    const { demo_url, ...rest } = row;
    return { ...rest, has_demo: Boolean(demo_url) };
  });
}

async function withPricing(url: string, rows: ProductRow[]) {
  if (!rows.length) return rows;
  const ids = rows.map((r) => String(r.id));
  const prices = new Map<string, { amount: number; currency: string }>();
  try {
    const response = await fetch(
      `${url}/rest/v1/marketplace_product_pricing` +
        `?select=product_id,amount,currency,active&active=eq.true&product_id=in.(${ids.join(",")})`,
      { headers: admin() },
    );
    if (response.ok) {
      for (const row of (await response.json()) as ProductRow[]) {
        const id = String(row.product_id);
        if (!prices.has(id)) {
          prices.set(id, { amount: Number(row.amount ?? 0), currency: String(row.currency ?? "USD") });
        }
      }
    }
  } catch {
    /* a missing price falls back to the product's own label */
  }
  return stripDemoUrls(rows).map((row) => ({
    ...row,
    pricing: prices.get(String(row.id)) ?? null,
  }));
}

export const Route = createFileRoute("/api/marketplace/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = process.env.SUPABASE_URL?.trim();
        if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
          return Response.json({ products: [], error: "Catalogue is not configured" }, { status: 503 });
        }

        const params = new URL(request.url).searchParams;
        const query = (params.get("q") ?? "").trim().slice(0, 300);
        const ids = (params.get("ids") ?? "").trim();
        const mode = (params.get("mode") ?? "").trim();
        const category = (params.get("category") ?? "").trim();
        const limit = Math.min(Math.max(Number(params.get("limit") ?? 12) || 12, 1), 40);

        const cacheKey = `${query}|${ids}|${mode}|${category}|${limit}`;
        const hit = cache.get(cacheKey);
        if (hit && Date.now() - hit.at < CACHE_MS) return Response.json(hit.payload);

        const base = `${url}/rest/v1/marketplace_products?select=${SELECT}&visible=eq.true`;
        // PostgREST has no subqueries, so a category slug is resolved to its id.
        let categoryFilter = "";
        if (category) {
          const categoryResponse = await fetch(
            `${url}/rest/v1/marketplace_categories?select=id&slug=eq.${encodeURIComponent(category)}&limit=1`,
            { headers: admin() },
          );
          const found = categoryResponse.ok ? ((await categoryResponse.json()) as ProductRow[]) : [];
          if (found[0]?.id) categoryFilter = `&category_id=eq.${String(found[0].id)}`;
        }

        try {
          // ---- a specific set, for compare -----------------------------------
          if (ids) {
            const wanted = ids
              .split(",")
              .map((s) => s.trim())
              .filter((s) => /^[0-9a-f-]{36}$/i.test(s))
              .slice(0, 4);
            if (!wanted.length) return Response.json({ products: [] });
            const response = await fetch(`${base}&id=in.(${wanted.join(",")})`, { headers: admin() });
            const rows = response.ok ? ((await response.json()) as ProductRow[]) : [];
            const payload = { products: await withPricing(url, rows) };
            cache.set(cacheKey, { at: Date.now(), payload });
            return Response.json(payload);
          }

          // ---- what the marketplace is really opening ------------------------
          if (mode === "popular") {
            const eventResponse = await fetch(
              `${url}/rest/v1/marketplace_events?select=product_id&order=created_at.desc&limit=400`,
              { headers: admin() },
            );
            const counts = new Map<string, number>();
            if (eventResponse.ok) {
              for (const row of (await eventResponse.json()) as ProductRow[]) {
                const id = row.product_id ? String(row.product_id) : "";
                if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
              }
            }
            const ranked = Array.from(counts.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, limit)
              .map(([id]) => id);

            // Real interest first; the marketplace's own best sellers fill any gap.
            let rows: ProductRow[] = [];
            if (ranked.length) {
              const response = await fetch(`${base}&id=in.(${ranked.join(",")})`, { headers: admin() });
              if (response.ok) rows = (await response.json()) as ProductRow[];
              rows.sort((a, b) => ranked.indexOf(String(a.id)) - ranked.indexOf(String(b.id)));
              rows = rows.map((r) => ({ ...r, reason: "Most opened on the marketplace" }));
            }
            if (rows.length < limit) {
              const response = await fetch(
                `${base}${categoryFilter}&is_best_seller=eq.true&limit=${limit - rows.length}`,
                { headers: admin() },
              );
              if (response.ok) {
                const seen = new Set(rows.map((r) => String(r.id)));
                for (const row of (await response.json()) as ProductRow[]) {
                  if (!seen.has(String(row.id))) rows.push({ ...row, reason: "Best seller" });
                }
              }
            }
            const payload = { products: await withPricing(url, rows.slice(0, limit)) };
            cache.set(cacheKey, { at: Date.now(), payload });
            return Response.json(payload);
          }

          // ---- match a described requirement ---------------------------------
          const words = terms(query);
          if (!words.length) {
            const response = await fetch(`${base}&is_featured=eq.true&limit=${limit}`, { headers: admin() });
            const rows = response.ok ? ((await response.json()) as ProductRow[]) : [];
            return Response.json({ products: await withPricing(url, rows), terms: [] });
          }

          const or = words
            .map((w) => {
              const safe = escapeForFilter(w);
              return `name.ilike.*${safe}*,industry_label.ilike.*${safe}*,search_text.ilike.*${safe}*`;
            })
            .join(",");

          const response = await fetch(
            `${base}&or=(${encodeURIComponent(or)})&limit=200`,
            { headers: admin() },
          );
          if (!response.ok) {
            console.error("[search] failed", response.status, await response.text());
            return Response.json({ products: [], terms: words }, { status: 502 });
          }

          const rows = (await response.json()) as ProductRow[];
          const ranked = rows
            .map((row) => ({ row, ...score(row, words) }))
            .filter((r) => r.points > 0)
            .sort((a, b) => b.points - a.points)
            .slice(0, limit)
            .map((r) => ({
              ...r.row,
              reason: r.matched.length
                ? `Matches ${r.matched.slice(0, 3).join(", ")}`
                : "Related to your requirement",
            }));

          const payload = { products: await withPricing(url, ranked), terms: words, scanned: rows.length };
          cache.set(cacheKey, { at: Date.now(), payload });
          if (cache.size > 300) cache.clear();
          return Response.json(payload);
        } catch (error) {
          console.error("[search] threw", error);
          return Response.json({ products: [], error: "Search is unavailable" }, { status: 502 });
        }
      },
    },
  },
});
