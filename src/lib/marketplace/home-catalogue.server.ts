import { allDemos } from "@/components/sapphire-home/HomeIndex";
import { catalogueSlug, toEntry, type CatalogueEntry } from "@/data/catalogue";

/**
 * The home page's card list, addressable by the slug each card links to.
 *
 * Every card on "/" opens /marketplace/product/<slug of its name>. The product
 * page already fell back to the extraDemos half of that list; this is the rest
 * of it, read from the same array the page renders, so there is one list and
 * not a copy. Server only: the page's loader imports it on demand.
 */
let bySlug: Map<string, CatalogueEntry> | null = null;

export function homeCatalogueEntry(slug: string): CatalogueEntry | undefined {
  if (!bySlug) {
    bySlug = new Map();
    for (const demo of allDemos) {
      const key = catalogueSlug(demo.name);
      // The first card of a name wins, as it does for the rest of the catalogue.
      if (!bySlug.has(key)) bySlug.set(key, toEntry(demo));
    }
  }
  return bySlug.get(slug);
}
