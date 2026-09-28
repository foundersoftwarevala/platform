/**
 * The shape of the catalogue counts, and how a count is phrased.
 *
 * Kept apart from home-stats.functions.ts, which holds the server function, so
 * that a component quoting a number never pulls a server module into the
 * browser bundle to do it.
 */

export type HomeStats = {
  products: number;
  categories: number;
  liveDemos: number;
};

/**
 * Rounded down to the nearest thousand with a "+".
 *
 * This is how the site has always phrased these figures, and rounding down is
 * the one direction that cannot overstate: 7,347 products are shown as
 * "7,000+", and the claim stays true as the catalogue grows until the next
 * thousand is genuinely reached. Below a thousand the exact number is used,
 * because "0+" tells a visitor nothing.
 */
export function phrase(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return "0";
  if (count < 1000) return String(count);
  return `${Math.floor(count / 1000).toLocaleString("en-US")},000+`;
}
