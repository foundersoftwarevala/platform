/**
 * Catalogue categories folded into another one.
 *
 * A merged category's pages answer with a permanent redirect to the same page
 * of the category it was merged into, so whatever the old address earned goes
 * with it. Its rows are not deleted: its card slots are set to "reserved",
 * which takes them out of the indexing gate and the sitemap, and its products
 * keep their own pages.
 *
 * event-mgmt: the same name as event-management ("Event Management"), the
 * same slot titles, and 20 of the same products.
 */
export const MERGED_CATEGORIES: Readonly<Record<string, string>> = {
  "event-mgmt": "event-management",
};

/** The category a slug now lives under, or null when it was never merged. */
export function mergedInto(slug: string): string | null {
  return MERGED_CATEGORIES[slug] ?? null;
}
