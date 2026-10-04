/**
 * Shared helpers for component tests that render screens reading the database
 * through the supabase client.
 *
 * createFakeSupabase(tables) returns a client whose from(table) answers every
 * query chain (select, eq, in, order, limit, range, ...) with that table's rows,
 * and records which tables were asked for in `calls`. Filters are not applied:
 * the tests pass exactly the rows a screen should see.
 */
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type Rows = Record<string, unknown>[];

function queryFor(rows: Rows) {
  const result = { data: rows, error: null, count: rows.length, status: 200 };
  const single = { data: rows[0] ?? null, error: null, status: 200 };
  const builder: Record<string, unknown> = {};
  const chain = new Proxy(builder, {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject);
      }
      if (prop === "single" || prop === "maybeSingle") {
        return () => Promise.resolve(single);
      }
      return () => chain;
    },
  });
  return chain;
}

export function createFakeSupabase(tables: Record<string, Rows>) {
  const calls: string[] = [];
  const client = {
    from: (table: string) => {
      calls.push(table);
      return queryFor(tables[table] ?? []);
    },
  };
  return { client, calls };
}

export function withQueryClient(node: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}
