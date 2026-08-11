import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Columns3, Search, X,
} from "lucide-react";

export type Column<T> = {
  key: string;
  label: string;
  sortValue?: (row: T) => string | number;
  render: (row: T) => ReactNode;
  className?: string;
  hideOnMobile?: boolean;
};

export type RowAction<T> = {
  label: string;
  icon: ReactNode;
  onClick: (row: T) => void;
  tone?: "default" | "danger";
};

export function DataTable<T extends { id: string }>({
  rows, columns, actions, searchKeys, filters, bulkActions, pageSize = 8, emptyLabel = "No records",
  title,
}: {
  rows: T[];
  columns: Column<T>[];
  actions?: RowAction<T>[];
  searchKeys: (row: T) => string;
  filters?: { label: string; value: string; count?: number }[];
  filterFn?: (row: T, value: string) => boolean;
  bulkActions?: { label: string; icon: ReactNode; onClick: (ids: string[]) => void; tone?: "default" | "danger" }[];
  pageSize?: number;
  emptyLabel?: string;
  title?: string;
} & { filterFn?: (row: T, value: string) => boolean }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [colsOpen, setColsOpen] = useState(false);

  const visibleCols = columns.filter((c) => !hidden.has(c.key));

  const filtered = useMemo(() => {
    let list = rows;
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((r) => searchKeys(r).toLowerCase().includes(q));
    }
    if (filter !== "all") list = list.filter((r) => (searchKeys(r) + JSON.stringify(r)).toLowerCase().includes(filter.toLowerCase()));
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      if (col?.sortValue) {
        list = [...list].sort((a, b) => {
          const av = col.sortValue!(a), bv = col.sortValue!(b);
          const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
          return sortDir === "asc" ? cmp : -cmp;
        });
      }
    }
    return list;
  }, [rows, query, filter, sortKey, sortDir, columns, searchKeys]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const allOnPage = paged.length > 0 && paged.every((r) => selected.has(r.id));

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  return (
    <div className="rounded-2xl border border-border bg-card depth-3d overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-border">
        {title && <div className="text-sm font-semibold mr-1">{title}</div>}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="Search…"
            aria-label={title ? `Search ${title}` : "Search records"}
            type="search"
            className="w-full rounded-lg border border-border bg-background pl-8 pr-7 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand/50"
          />
          {query && (
            <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {filters && (
          <div className="flex flex-wrap gap-1.5">
            {[{ label: "All", value: "all" }, ...filters].map((f) => (
              <button
                key={f.value}
                onClick={() => { setFilter(f.value); setPage(1); }}
                className={`press-3d rounded-full border px-2.5 py-1 text-[11px] capitalize ${
                  filter === f.value ? "bg-brand text-brand-foreground border-transparent" : "bg-background border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}{"count" in f && f.count !== undefined ? ` ${f.count}` : ""}
              </button>
            ))}
          </div>
        )}
        <div className="relative">
          <button
            type="button"
            onClick={() => setColsOpen((v) => !v)}
            aria-expanded={colsOpen}
            className="press-3d inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Columns3 className="h-3.5 w-3.5" /> Columns
          </button>
          {colsOpen && (
            <div className="absolute right-0 z-30 mt-1 w-48 rounded-xl border border-border bg-popover p-2 shadow-xl">
              {columns.map((c) => (
                <label key={c.key} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!hidden.has(c.key)}
                    onChange={() =>
                      setHidden((prev) => {
                        const n = new Set(prev);
                        if (n.has(c.key)) n.delete(c.key); else n.add(c.key);
                        return n;
                      })
                    }
                  />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {selected.size > 0 && bulkActions && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
          <span className="text-xs text-muted-foreground">{selected.size} selected</span>
          {bulkActions.map((b) => (
            <button
              key={b.label}
              onClick={() => { b.onClick([...selected]); setSelected(new Set()); }}
              className={`press-3d inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs ${
                b.tone === "danger" ? "text-destructive hover:bg-destructive/10" : "hover:bg-muted"
              }`}
            >
              {b.icon} {b.label}
            </button>
          ))}
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Clear</button>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="w-9 px-3 py-2">
                <input
                  type="checkbox" checked={allOnPage}
                  aria-label="Select all rows on this page"
                  onChange={() =>
                    setSelected((prev) => {
                      const n = new Set(prev);
                      paged.forEach((r) => (allOnPage ? n.delete(r.id) : n.add(r.id)));
                      return n;
                    })
                  }
                />
              </th>
              {visibleCols.map((c) => (
                <th key={c.key} className={`px-3 py-2 text-left font-medium ${c.className ?? ""}`}>
                  {c.sortValue ? (
                    <button onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:text-foreground">
                      {c.label}
                      {sortKey === c.key ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null}
                    </button>
                  ) : c.label}
                </th>
              ))}
              {actions && <th className="px-3 py-2 text-right font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {paged.map((row) => (
              <tr key={row.id} className="border-b border-border/60 hover:bg-muted/40 transition">
                <td className="px-3 py-2.5">
                  <input
                    type="checkbox" checked={selected.has(row.id)}
                    aria-label="Select row"
                    onChange={() =>
                      setSelected((prev) => {
                        const n = new Set(prev);
                        if (n.has(row.id)) n.delete(row.id); else n.add(row.id);
                        return n;
                      })
                    }
                  />
                </td>
                {visibleCols.map((c) => (
                  <td key={c.key} className={`px-3 py-2.5 ${c.className ?? ""}`}>{c.render(row)}</td>
                ))}
                {actions && (
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {actions.map((a) => (
                        <button
                          key={a.label} type="button" title={a.label} aria-label={a.label} onClick={() => a.onClick(row)}
                          className={`press-3d grid h-7 w-7 place-items-center rounded-lg border border-border ${
                            a.tone === "danger" ? "text-destructive hover:bg-destructive/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          }`}
                        >
                          {a.icon}
                        </button>
                      ))}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-border">
        {paged.map((row) => (
          <div key={row.id} className="p-3 space-y-1.5">
            {visibleCols.filter((c) => !c.hideOnMobile).map((c) => (
              <div key={c.key} className="flex items-start justify-between gap-3 text-xs">
                <span className="text-muted-foreground">{c.label}</span>
                <span className="text-right">{c.render(row)}</span>
              </div>
            ))}
            {actions && (
              <div className="flex gap-1.5 pt-1">
                {actions.map((a) => (
                  <button
                    key={a.label} onClick={() => a.onClick(row)}
                    className={`press-3d inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] ${a.tone === "danger" ? "text-destructive" : ""}`}
                  >
                    {a.icon} {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {paged.length === 0 && (
        <div className="p-10 text-center text-sm text-muted-foreground">{emptyLabel}</div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
        <span>{filtered.length} record{filtered.length === 1 ? "" : "s"}</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button" aria-label="Previous page"
            onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="press-3d grid h-7 w-7 place-items-center rounded-lg border border-border disabled:opacity-40"
          ><ChevronLeft className="h-3.5 w-3.5" /></button>
          <span>Page {page} / {pageCount}</span>
          <button
            type="button" aria-label="Next page"
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount}
            className="press-3d grid h-7 w-7 place-items-center rounded-lg border border-border disabled:opacity-40"
          ><ChevronRight className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </div>
  );
}