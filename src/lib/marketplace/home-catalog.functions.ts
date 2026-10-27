import { createServerFn } from "@tanstack/react-start";

import { type CatalogPage, type CatalogRow } from "./catalog.server";

/**
 * The home page's first page of catalogue rows, rendered on the server so the
 * catalogue reaches the reader in the HTML instead of after hydration and a
 * second round trip.
 *
 * It reads through the same catalogue reader as /api/marketplace/catalog
 * (src/lib/marketplace/catalog.server.ts), which serves every page after this
 * one, so the rows are ordered and filtered the same way however far down the
 * visitor scrolls.
 */

const ROWS = 8;
const PER_ROW = 12;

export type SeededRow = CatalogRow;
export type HomeCatalogSeed = CatalogPage | null;

export const getHomeCatalog = createServerFn({ method: "GET" }).handler(
  async (): Promise<HomeCatalogSeed> => {
    const { readHomeCatalogSeed } = await import("./home-catalog-cache.server");
    return readHomeCatalogSeed(ROWS, PER_ROW);
  },
);
