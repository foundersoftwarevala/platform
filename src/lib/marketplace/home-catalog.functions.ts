import { createServerFn } from "@tanstack/react-start";

import {
  catalogConfigured,
  readCatalogRows,
  type CatalogPage,
  type CatalogRow,
} from "./catalog.server";

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

// The first page is the same for everybody, so it is built once a minute
// rather than on every visit.
const CACHE_MS = 60_000;
let cached: { at: number; payload: HomeCatalogSeed } | null = null;

export type SeededRow = CatalogRow;
export type HomeCatalogSeed = CatalogPage | null;

export const getHomeCatalog = createServerFn({ method: "GET" }).handler(
  async (): Promise<HomeCatalogSeed> => {
    // A server that cannot reach the catalogue renders nothing here rather
    // than inventing rows; the browser then asks for them itself.
    if (!catalogConfigured()) return null;
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.payload;
    try {
      const payload = await readCatalogRows({ rowOffset: 0, rowCount: ROWS, perRow: PER_ROW });
      if (payload) cached = { at: Date.now(), payload };
      return payload;
    } catch (error) {
      console.error("[home catalogue] seed failed", error);
      return null;
    }
  },
);
