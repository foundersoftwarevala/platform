import { useEffect, useMemo, useState } from "react";

import { authHeaders } from "@/lib/auth/operator-fetch";

/**
 * Real rows for a screen that was drawing an array.
 *
 * The manager suites each solved this once already - LiveTable for a table an
 * operator edits, LiveModule for a shell of tabs. Neither fits a screen that
 * was designed around its own layout: the SEO Center draws thirty-six module
 * screens with their own cards, rings, sparklines and chips, and replacing any
 * of them with a generic grid would throw away the design rather than connect
 * it.
 *
 * So this returns only the rows, and the screen keeps every pixel it had. It
 * reads through /api/manager/resource, which is where the whitelist lives, so
 * a screen can ask for nothing the endpoint does not already allow.
 *
 * Three states matter and the caller can tell them apart: `loading` while the
 * request is out, `failed` when it came back an error, and rows otherwise -
 * including an empty array, which means the table is genuinely empty and is a
 * different claim from "could not read it".
 */

export type Row = Record<string, unknown>;

export type ResourceState = {
  rows: Row[];
  total: number;
  loading: boolean;
  failed: boolean;
};

const EMPTY: Row[] = [];

export function useResource(
  resource: string,
  options: { limit?: number; search?: string; filters?: string[]; offset?: number } = {},
): ResourceState {
  // The endpoint has accepted an offset all along and nothing ever sent one,
  // so every screen showed the first page of its table and no way to reach the
  // rest. A console over 7,280 card slots that can only ever show fifty of
  // them is a sample, not a console.
  const { limit = 50, search, offset = 0 } = options;
  // Serialised so a caller can pass a fresh array every render without the
  // request being made again on every render.
  const filterKey = (options.filters ?? []).join("|");
  const [rows, setRows] = useState<Row[]>(EMPTY);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFailed(false);
    void (async () => {
      try {
        const query = new URLSearchParams({ resource, limit: String(limit) });
        if (offset > 0) query.set("offset", String(offset));
        if (search) query.set("search", search);
        for (const clause of filterKey ? filterKey.split("|") : []) query.append("filter", clause);
        const headers = await authHeaders();
        const response = await fetch(`/api/manager/resource?${query}`, { headers });
        if (!response.ok) throw new Error(String(response.status));
        const payload = (await response.json()) as { rows?: Row[]; total?: number; error?: string };
        if (!alive) return;
        if (payload.error) throw new Error(payload.error);
        setRows(payload.rows ?? EMPTY);
        setTotal(payload.total ?? payload.rows?.length ?? 0);
      } catch {
        if (!alive) return;
        setRows(EMPTY);
        setTotal(0);
        setFailed(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [resource, limit, search, filterKey, offset]);

  return { rows, total, loading, failed };
}

/** A number as the screen wants to print it, or a placeholder while unknown. */
export function figure(
  value: number | null | undefined,
  state: { loading: boolean; failed: boolean },
): string {
  if (state.loading) return "…";
  if (state.failed || value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-IN").format(Math.round(value));
}

/** Sum one numeric column across rows. */
export function sum(rows: Row[], column: string): number {
  return rows.reduce((total, row) => total + (Number(row[column]) || 0), 0);
}

/** How many rows match a test. */
export function countWhere(rows: Row[], test: (row: Row) => boolean): number {
  return rows.reduce((n, row) => n + (test(row) ? 1 : 0), 0);
}

/** The mean of a numeric column, or null when there is nothing to average. */
export function mean(rows: Row[], column: string): number | null {
  const values = rows.map((row) => Number(row[column])).filter((v) => Number.isFinite(v));
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Text of a column, never undefined, so a cell always renders something. */
export function text(row: Row, column: string, fallback = "—"): string {
  const value = row[column];
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

/** A number from a column, or zero. */
export function num(row: Row, column: string): number {
  return Number(row[column]) || 0;
}

/** Group rows by the value of one column. */
export function groupBy(rows: Row[], column: string): { key: string; rows: Row[] }[] {
  const map = new Map<string, Row[]>();
  for (const row of rows) {
    const key = text(row, column, "Unassigned");
    const bucket = map.get(key);
    if (bucket) bucket.push(row);
    else map.set(key, [row]);
  }
  return [...map.entries()].map(([key, group]) => ({ key, rows: group }));
}

/** The rows a screen shows when it wants the first few of a bigger set. */
export function useTop(resource: string, limit: number): ResourceState {
  return useResource(resource, { limit });
}

/** Stable empty state, for a screen that must render before it has asked. */
export function useResourceMemo(resource: string, limit: number): ResourceState {
  const options = useMemo(() => ({ limit }), [limit]);
  return useResource(resource, options);
}
