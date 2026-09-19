import { createFileRoute } from "@tanstack/react-router";

import {
  catalogConfigured,
  readCatalogRows,
  readCategoryRow,
} from "@/lib/marketplace/catalog.server";

/**
 * The marketplace catalogue, a page at a time, for the home page as the
 * visitor scrolls.
 *
 *   ?rows=N&perRow=M&rowOffset=K   N category rows from row K, M products each
 *   ?category=<slug>&offset=&limit=  more products for one row ("load more")
 *
 * Reads through src/lib/marketplace/catalog.server.ts, the same reader the
 * home page's server-rendered first page uses, so every page respects what
 * the Marketplace Manager configures. There is no fallback to invented data:
 * if the database cannot be reached the response says so.
 */

const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; payload: unknown }>();

const cached = (payload: unknown) =>
  Response.json(payload, { headers: { "Cache-Control": "public, max-age=60" } });

export const Route = createFileRoute("/api/marketplace/catalog")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!catalogConfigured()) {
          return Response.json(
            { error: "The catalogue is not configured on this server.", rows: [] },
            { status: 503 },
          );
        }

        const params = new URL(request.url).searchParams;
        const category = (params.get("category") ?? "").trim();
        const offset = Math.max(Number(params.get("offset") ?? 0) || 0, 0);
        const perRow = Math.min(Math.max(Number(params.get("perRow") ?? 12) || 12, 1), 60);
        const rowCount = Math.min(Math.max(Number(params.get("rows") ?? 8) || 8, 1), 30);
        const rowOffset = Math.max(Number(params.get("rowOffset") ?? 0) || 0, 0);
        // A row asked for at twelve and again at sixty is two different
        // answers, so the limit is part of the cache key.
        const limit = Math.min(Math.max(Number(params.get("limit") ?? perRow) || perRow, 1), 60);
        const key = `${category}|${offset}|${perRow}|${limit}|${rowCount}|${rowOffset}`;
        const hit = cache.get(key);
        if (hit && Date.now() - hit.at < CACHE_MS) return cached(hit.payload);

        try {
          let payload: unknown;
          if (category) {
            const row = await readCategoryRow(category, offset, limit);
            if (!row) {
              return Response.json({ error: "No such category", cards: [] }, { status: 404 });
            }
            payload = {
              ...row,
              offset,
              limit,
              hasMore: offset + row.cards.length < row.total,
            };
          } else {
            const page = await readCatalogRows({ rowOffset, rowCount, perRow });
            if (!page) {
              return Response.json(
                { error: "The catalogue could not be read.", rows: [] },
                { status: 502 },
              );
            }
            payload = { ...page, perRow };
          }
          cache.set(key, { at: Date.now(), payload });
          if (cache.size > 200) cache.clear();
          return cached(payload);
        } catch (error) {
          console.error("[catalog] failed", error);
          return Response.json(
            { error: "The catalogue could not be read.", rows: [] },
            { status: 502 },
          );
        }
      },
    },
  },
});
