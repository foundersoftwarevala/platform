import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, RefreshCw, Search, X } from "lucide-react";

/**
 * The Marketplace Manager's live table.
 *
 * Most manager sections were drawing hardcoded arrays, so nothing an operator
 * did reached the storefront. This reads the real rows through
 * /api/manager/resource and writes changes straight back, which is what makes a
 * section a control rather than a picture of one.
 *
 * Only columns the server marks editable can be changed; everything else is
 * shown read-only. A save that the server refuses is reported as refused — the
 * row snaps back rather than showing a change that did not happen.
 *
 * It uses the console's own tokens (border, background, accent, muted) so it
 * matches whatever theme is in force; no colour of its own.
 */

type Row = Record<string, unknown>;

type Payload = {
  label: string;
  columns: string[];
  editable: string[];
  rows: Row[];
  total: number;
  limit: number;
  offset: number;
  error?: string;
};

const PAGE = 25;

/** Columns worth showing first when a table is wide. */
function orderColumns(columns: string[], preferred?: string[]): string[] {
  if (!preferred?.length) return columns;
  const lead = preferred.filter((c) => columns.includes(c));
  return [...lead, ...columns.filter((c) => !lead.includes(c))];
}

function humanise(column: string): string {
  return column.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function display(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value).slice(0, 60);
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return new Date(text).toLocaleDateString();
  return text.length > 64 ? text.slice(0, 64) + "…" : text;
}

export function LiveTable({
  resource,
  title,
  columns: preferred,
  description,
}: {
  resource: string;
  title?: string;
  /** Columns to show first; the rest follow. */
  columns?: string[];
  description?: string;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<{ id: string; column: string } | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (term: string, offset: number) => {
      setError(null);
      try {
        const response = await fetch(
          `/api/manager/resource?resource=${encodeURIComponent(resource)}` +
            `&limit=${PAGE}&offset=${offset}&search=${encodeURIComponent(term)}`,
        );
        const payload = (await response.json()) as Payload;
        if (!response.ok) {
          setError(
            response.status === 401 || response.status === 403
              ? "Sign in as an operator to manage this."
              : (payload.error ?? "Could not load this list."),
          );
          setData(null);
          return;
        }
        setData(payload);
      } catch {
        setError("Could not reach the server.");
        setData(null);
      }
    },
    [resource],
  );

  useEffect(() => {
    void load(search, page * PAGE);
  }, [load, page]);

  // Typing filters the real table, not just what is on screen.
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setPage(0);
      void load(search, 0);
    }, 350);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [search, load]);

  const columns = useMemo(
    () => orderColumns(data?.columns ?? [], preferred).filter((c) => c !== "id"),
    [data?.columns, preferred],
  );

  const save = async (id: string, column: string, value: unknown) => {
    setBusy(id);
    setNotice(null);
    try {
      const response = await fetch("/api/manager/resource", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource, id, changes: { [column]: value } }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice(
          response.status === 401 || response.status === 403
            ? "Sign in as an operator to change this."
            : (payload?.error ?? "That change was not saved."),
        );
        return;
      }
      // Take the server's copy of the row, never the optimistic one.
      setData((current) =>
        current
          ? { ...current, rows: current.rows.map((r) => (String(r.id) === id ? payload.row : r)) }
          : current,
      );
      setNotice(`Saved · ${humanise(column)}`);
      setTimeout(() => setNotice(null), 2500);
    } catch {
      setNotice("Could not reach the server. Nothing was changed.");
    } finally {
      setBusy(null);
      setEditing(null);
    }
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;

  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wider text-accent">
            {title ?? data?.label ?? resource}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {data
              ? `${data.total.toLocaleString()} rows in the marketplace${
                  data.editable.length ? ` · ${data.editable.length} fields editable here` : " · read only"
                }`
              : description ?? "Reading the marketplace…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              aria-label={`Search ${title ?? resource}`}
              className="w-40 rounded-md border border-border bg-background/60 py-1.5 pl-8 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent sm:w-56"
            />
          </div>
          <button
            type="button"
            onClick={() => void load(search, page * PAGE)}
            aria-label="Refresh"
            className="grid h-8 w-8 place-items-center rounded-md border border-border bg-background/60 text-muted-foreground hover:border-accent/40 hover:text-accent"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {notice && (
        <p role="status" className="mb-2 rounded-md border border-border bg-background/60 px-3 py-1.5 text-[11px] text-muted-foreground">
          {notice}
        </p>
      )}

      {error ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-[12px] text-muted-foreground">
          {error}
        </p>
      ) : !data ? (
        <p className="flex items-center gap-2 px-1 py-8 text-[12px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </p>
      ) : data.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-[12px] text-muted-foreground">
          {search ? "Nothing matched that search." : "There is nothing here yet."}
        </p>
      ) : (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[640px] border-collapse text-[12px]">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className="whitespace-nowrap border-b border-border px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    {humanise(column)}
                    {data.editable.includes(column) && (
                      <span className="ml-1 text-accent" title="Editable">·</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => {
                const id = String(row.id);
                return (
                  <tr key={id} className="border-b border-border/60 last:border-0 hover:bg-white/[0.02]">
                    {columns.map((column) => {
                      const editable = data.editable.includes(column);
                      const value = row[column];
                      const isEditing = editing?.id === id && editing.column === column;

                      if (editable && typeof value === "boolean") {
                        return (
                          <td key={column} className="px-2 py-1.5">
                            <button
                              type="button"
                              disabled={busy === id}
                              onClick={() => void save(id, column, !value)}
                              aria-pressed={value}
                              className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-40 ${
                                value
                                  ? "bg-accent/15 text-accent"
                                  : "bg-secondary text-muted-foreground"
                              }`}
                            >
                              {value ? "Yes" : "No"}
                            </button>
                          </td>
                        );
                      }

                      if (editable && isEditing) {
                        return (
                          <td key={column} className="px-2 py-1.5">
                            <span className="inline-flex items-center gap-1">
                              <input
                                autoFocus
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    void save(id, column, typeof value === "number" ? Number(draft) : draft);
                                  }
                                  if (e.key === "Escape") setEditing(null);
                                }}
                                className="w-36 rounded border border-accent/50 bg-background px-1.5 py-1 text-[12px] focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => void save(id, column, typeof value === "number" ? Number(draft) : draft)}
                                aria-label="Save"
                                className="grid h-6 w-6 place-items-center rounded border border-border text-accent"
                              >
                                <Check className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditing(null)}
                                aria-label="Cancel"
                                className="grid h-6 w-6 place-items-center rounded border border-border text-muted-foreground"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          </td>
                        );
                      }

                      return (
                        <td key={column} className="px-2 py-1.5 align-top">
                          {editable ? (
                            <button
                              type="button"
                              onClick={() => {
                                setEditing({ id, column });
                                setDraft(value === null || value === undefined ? "" : String(value));
                              }}
                              className="max-w-[220px] truncate rounded px-1 text-left hover:bg-white/[0.06] hover:text-accent"
                              title="Click to edit"
                            >
                              {display(value)}
                            </button>
                          ) : (
                            <span className="block max-w-[220px] truncate text-muted-foreground">
                              {display(value)}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > PAGE && (
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            {data.offset + 1}–{data.offset + data.rows.length} of {data.total.toLocaleString()}
          </span>
          <span className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="grid h-6 w-6 place-items-center rounded border border-border hover:text-accent disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <span className="px-1 font-mono">{page + 1} / {pages}</span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              disabled={page >= pages - 1}
              className="grid h-6 w-6 place-items-center rounded border border-border hover:text-accent disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
