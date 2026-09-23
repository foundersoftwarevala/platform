import { extraDemos, type Demo } from "@/data/extraDemos";

/**
 * The home page's catalogue, addressable by URL.
 *
 * Every card on the home page needs a page of its own to open - a product
 * detail, its demo, and the purchase that follows. The entries here stand in
 * until an author or vendor uploads the real product for that slug, at which
 * point the database record wins and this is never consulted.
 */
export type CatalogueEntry = {
  slug: string;
  name: string;
  category: string;
  masterCategory: string;
  description: string;
  features: string[];
  /** What the entry says about its stack, where no stack may be claimed. */
  technologyNote?: string;
  techStack: string[];
  businessType?: string;
  softwareType?: string;
  relatedDetails?: string;
  disclaimer?: string;
};

/** The same shape of slug the marketplace builds for a database product. */
export function catalogueSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "product"
  );
}

function toEntry(demo: Demo): CatalogueEntry {
  return {
    slug: catalogueSlug(demo.name),
    name: demo.name,
    category: demo.category,
    masterCategory: demo.masterCategory,
    description: demo.description,
    features: demo.features,
    technologyNote: demo.technologyNote,
    // An entry that may not claim a stack contributes none.
    techStack: demo.technologyNote ? [] : [...demo.frontend, ...demo.backend],
    businessType: demo.businessType,
    softwareType: demo.softwareType,
    relatedDetails: demo.relatedDetails,
    disclaimer: demo.disclaimer,
  };
}

/** Every catalogue entry, one per slug - the first wins where names repeat. */
export const catalogueEntries: CatalogueEntry[] = (() => {
  const bySlug = new Map<string, CatalogueEntry>();
  for (const demo of extraDemos) {
    const entry = toEntry(demo);
    if (!bySlug.has(entry.slug)) bySlug.set(entry.slug, entry);
  }
  return [...bySlug.values()];
})();

export function findCatalogueEntry(slug: string): CatalogueEntry | undefined {
  return catalogueEntries.find((entry) => entry.slug === slug);
}
