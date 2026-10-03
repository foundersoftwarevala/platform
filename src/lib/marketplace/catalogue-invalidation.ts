/**
 * One signal for "the catalogue changed", heard by every storefront cache.
 *
 * The public catalogue, rows, home layout, search and the action layer each
 * keep a short in-process cache, and none of them heard about a Manager write:
 * an operator hid or unpublished a product, was told "Saved", and visitors kept
 * seeing it for one to two minutes. Each cache now registers how to empty
 * itself here, and each Manager write that touches what the storefront shows
 * calls catalogueChanged().
 *
 * It is per process, which is how the caches are. A cache whose module has not
 * been loaded yet has nothing to empty, so registering lazily is enough.
 */
const listeners = new Set<() => void>();

export function onCatalogueChange(drop: () => void): void {
  listeners.add(drop);
}

export function catalogueChanged(): void {
  for (const drop of listeners) {
    try {
      drop();
    } catch {
      /* one cache failing to clear must not stop the others */
    }
  }
}

/** Tables whose rows the storefront reads, directly or through a cache. */
export const STOREFRONT_TABLES = new Set([
  "marketplace_products",
  "marketplace_categories",
  "marketplace_row_config",
  "marketplace_row_slots",
  "marketplace_homepage_sections",
  "marketplace_product_pricing",
  "product_demo_urls",
  "home_hero_slides",
  "system_settings",
]);
