import { createServerFn } from "@tanstack/react-start";

/**
 * The success stories and awards the home page is allowed to show, resolved
 * before the page is sent.
 *
 * Both sections fetched this for themselves from the browser, so neither ever
 * appeared in the HTML that left the server: they were invisible to a crawler,
 * they arrived a moment after everything around them, and when the page's
 * JavaScript did not run they did not appear at all. Every other part of this
 * page is resolved in the home route's loader; these two now are too.
 *
 * It reads the same two tables as /api/marketplace/proof, which still serves
 * the routes that have no home loader, and it answers with published rows only.
 * Nothing published means an empty answer and the sections draw nothing - an
 * empty shelf is honest, an invented customer is not.
 */

export type ProofStory = {
  id: string;
  company: string;
  quote: string;
  author: string;
  role: string;
  metric: string;
  metric_label: string;
  product: string;
  product_slug: string | null;
};

export type ProofAward = {
  id: string;
  category: string;
  winner: string;
  product_slug: string | null;
  year: number | string;
};

export type StorefrontProof = { stories: ProofStory[]; awards: ProofAward[] };

/** Published rows change when an operator publishes, not between requests. */
const CACHE_MS = 60_000;
let cached: { at: number; payload: StorefrontProof } | null = null;

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}` };
}

async function read(table: string, columns: string) {
  const response = await fetch(
    `${url()}/rest/v1/${table}?select=${columns}&published=eq.true` +
      `&order=sort_order.asc&limit=60`,
    { headers: admin() },
  );
  if (!response.ok) return [];
  return (await response.json()) as Record<string, unknown>[];
}

export const getStorefrontProof = createServerFn({ method: "GET" }).handler(
  async (): Promise<StorefrontProof | null> => {
    // Null, not an empty answer: a server that cannot reach the database has
    // not established that there is nothing published, and the browser then
    // asks for itself exactly as it did before.
    if (!url() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.payload;
    try {
      const [stories, awards] = await Promise.all([
        read(
          "marketplace_stories",
          "id,company,quote,author,role,metric,metric_label,product,product_slug",
        ),
        read("marketplace_awards", "id,category,winner,product_slug,year"),
      ]);
      const payload = {
        stories: stories as unknown as ProofStory[],
        awards: awards as unknown as ProofAward[],
      };
      cached = { at: Date.now(), payload };
      return payload;
    } catch (error) {
      console.error("[proof] seed failed", error);
      return null;
    }
  },
);
