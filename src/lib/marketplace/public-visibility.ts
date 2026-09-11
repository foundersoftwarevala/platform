/**
 * The one definition of "a product the public may see".
 *
 * The catalogue rows asked for visible and published, the search endpoint asked
 * only for visible, and the product page asked for nothing but the slug - so a
 * draft or coming-soon product that was hidden from the homepage was still
 * returned by search and still rendered at its own URL. Every public read now
 * uses this, so the Manager's publish state and schedule mean the same thing
 * everywhere a visitor can reach.
 *
 * A product is public when it is visible, published, already past its
 * publish_at (if it has one) and not yet past its unpublish_at (if it has one).
 */

/** An ISO timestamp PostgREST can compare against, without milliseconds. */
function nowIso(): string {
  return new Date().toISOString().slice(0, 19) + "Z";
}

/**
 * PostgREST query parameters for a public product read, ready to append to a
 * `/rest/v1/marketplace_products?select=...` URL (each begins with "&").
 */
export function publicProductFilter(): string {
  const now = nowIso();
  const window =
    `(or(publish_at.is.null,publish_at.lte."${now}"),` +
    `or(unpublish_at.is.null,unpublish_at.gt."${now}"))`;
  return (
    `&visible=eq.true&content_status=eq.published` +
    `&and=${encodeURIComponent(window)}`
  );
}

/** The same rule for a supabase-js query builder. */
export function applyPublicProductFilter<
  Q extends {
    eq: (column: string, value: unknown) => Q;
    or: (filters: string) => Q;
  },
>(query: Q): Q {
  const now = nowIso();
  return query
    .eq("visible", true)
    .eq("content_status", "published")
    .or(`publish_at.is.null,publish_at.lte.${now}`)
    .or(`unpublish_at.is.null,unpublish_at.gt.${now}`);
}

/** Whether a product row already in hand is public. */
export function isPublicProduct(row: {
  visible?: unknown;
  content_status?: unknown;
  publish_at?: unknown;
  unpublish_at?: unknown;
}): boolean {
  if (row.visible !== true) return false;
  if (row.content_status !== "published") return false;
  const now = Date.now();
  if (row.publish_at && Date.parse(String(row.publish_at)) > now) return false;
  if (row.unpublish_at && Date.parse(String(row.unpublish_at)) <= now) return false;
  return true;
}
