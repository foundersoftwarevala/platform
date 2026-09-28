import { createServerFn } from "@tanstack/react-start";

/**
 * How big the catalogue is, for the storefront's own metadata.
 *
 * The homepage title, description and Open Graph tags said "147 Software
 * Solutions". The catalogue holds 7,357 visible products across 91 categories.
 * The number was written by hand when it was true and has been wrong ever since,
 * in the one line of text a search engine reads first.
 *
 * Read from sf_catalogue_headline(), which counts in SQL. Two things matter about
 * how this is used:
 *
 *   * it is allowed to fail. The homepage has real visitors on it, and a title
 *     is not worth a blank page, so a failure returns null and the page falls
 *     back to copy that carries no number at all. A missing number is a small
 *     loss; a wrong number is what this is fixing, and a broken homepage would
 *     be worse than both.
 *
 *   * it is bounded. The call is abandoned after a second and a half, so a slow
 *     database delays nobody. The homepage's HTML is micro-cached at nginx for
 *     sixty seconds, so in practice this runs about once a minute however much
 *     traffic arrives.
 */

export type CatalogueHeadline = {
  products: number;
  categories: number;
  visibleCategories: number;
};

export const getCatalogueHeadline = createServerFn({ method: "GET" }).handler(
  async (): Promise<CatalogueHeadline | null> => {
    const base = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
      process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ??
      "";
    if (!base || !key) return null;

    try {
      const response = await fetch(`${base}/rest/v1/rpc/sf_catalogue_headline`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: "{}",
        signal: AbortSignal.timeout(1500),
      });
      if (!response.ok) return null;
      const row = (await response.json()) as Record<string, unknown>;
      const products = Number(row.products ?? 0) || 0;
      const categories = Number(row.categories ?? 0) || 0;
      // A zero count is not a catalogue, it is a failed read dressed as one.
      if (products <= 0 || categories <= 0) return null;
      return {
        products,
        categories,
        visibleCategories: Number(row.visible_categories ?? categories) || categories,
      };
    } catch {
      return null;
    }
  },
);
