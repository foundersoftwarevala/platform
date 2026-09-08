import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, RefreshCw, Search, X } from "lucide-react";
import { authHeaders } from "@/lib/auth/operator-fetch";

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
  /** Columns that may be given a value when a row is created. */
  creatable?: string[];
  /** Of those, the ones that must not be blank. */
  required?: string[];
  /** Whether this resource names a way to take a row out of use. */
  retirable?: boolean;
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
  const [adding, setAdding] = useState<Record<string, string> | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [plan, setPlan] = useState<{ operation: string; records: number; operation_id: string; changes: unknown } | null>(null);
  const [result, setResult] = useState<{
    status: string; done: number; failed: number; invalid: number; unauthorized: number;
    total: number; outcomes: { id: string; status: string; reason?: string }[];
  } | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (term: string, offset: number) => {
      setError(null);
      try {
        const response = await fetch(
          `/api/manager/resource?resource=${encodeURIComponent(resource)}` +
            `&limit=${PAGE}&offset=${offset}&search=${encodeURIComponent(term)}`,
          { headers: await authHeaders() },
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
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
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

  /**
   * Add a row.
   *
   * Only the columns the server named creatable are offered, and the server
   * checks them again; this form cannot invent a field. A refusal is shown as
   * a refusal - nothing is added to the table on screen that is not in the
   * database.
   */
  const create = async () => {
    if (!adding) return;
    setBusy("new");
    setNotice(null);
    try {
      const response = await fetch("/api/manager/resource", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ resource, values: adding }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice(
          response.status === 401 || response.status === 403
            ? "Sign in as an operator to add this."
            : (payload?.error ?? "That row was not added."),
        );
        return;
      }
      setAdding(null);
      setNotice("Added");
      setTimeout(() => setNotice(null), 2500);
      await load(search, page * PAGE);
    } catch {
      setNotice("Could not reach the server. Nothing was added.");
    } finally {
      setBusy(null);
    }
  };

  /** Take a row out of use. Nothing here is deleted; the server decides how. */
  const retire = async (id: string) => {
    if (!window.confirm("Take this row out of use? It stays in the database and can be put back.")) return;
    setBusy(id);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/manager/resource?resource=${encodeURIComponent(resource)}&id=${encodeURIComponent(id)}`,
        { method: "DELETE", headers: await authHeaders() },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice(
          response.status === 401 || response.status === 403
            ? "Sign in as an operator to retire this."
            : (payload?.error ?? "That row was not retired."),
        );
        return;
      }
      setNotice("Retired");
      setTimeout(() => setNotice(null), 2500);
      await load(search, page * PAGE);
    } catch {
      setNotice("Could not reach the server. Nothing was changed.");
    } finally {
      setBusy(null);
    }
  };

  /**
   * Ask the engine what a run would do. Nothing is changed by this.
   */
  const previewBulk = async (operation: "retire") => {
    setNotice(null);
    setResult(null);
    try {
      const response = await fetch("/api/manager/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ resource, ids: picked, operation, preview: true }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice(payload?.error ?? "That selection could not be previewed.");
        return;
      }
      setPlan(payload);
    } catch {
      setNotice("Could not reach the server. Nothing was changed.");
    }
  };

  /** Run the plan that was previewed, under the same operation id. */
  const runBulk = async () => {
    if (!plan) return;
    setBusy("bulk");
    try {
      const response = await fetch("/api/manager/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          resource, ids: picked, operation: plan.operation,
          preview: false, operationId: plan.operation_id,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice(payload?.error ?? "That run did not start.");
        return;
      }
      setResult(payload);
      setPlan(null);
      setPicked([]);
      await load(search, page * PAGE);
    } catch {
      setNotice("Could not reach the server mid-run. Refresh to see what completed.");
    } finally {
      setBusy(null);
    }
  };

  const canCreate = (data?.creatable?.length ?? 0) > 0;
  const canRetire = Boolean(data?.retirable);
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
          {canCreate && (
            <button
              type="button"
              onClick={() =>
                setAdding((current) =>
                  current
                    ? null
                    : Object.fromEntries((data?.creatable ?? []).map((c) => [c, ""])),
                )
              }
              className="rounded-md border border-border bg-background/60 px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:border-accent/40 hover:text-accent"
            >
              {adding ? "Cancel" : "Add row"}
            </button>
          )}
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

      {picked.length > 0 && (
        <div className="mb-3 rounded-xl border border-accent/30 bg-accent/[0.06] px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold">
              {picked.length} selected of {data?.rows.length ?? 0} on this page
            </span>
            {/* Section 14: this says what it covers. Selecting every matching
                record across pages is not offered, because it is not built. */}
            <span className="text-[10px] text-muted-foreground">
              this page only — {data?.total?.toLocaleString() ?? 0} match in total
            </span>
            <button
              onClick={() => setPicked([])}
              className="ml-auto rounded-md border border-border px-2 py-1 text-[10px] font-semibold hover:bg-muted"
            >
              Clear
            </button>
            {canRetire && (
              <button
                onClick={() => void previewBulk("retire")}
                className="rounded-md border border-border px-2.5 py-1 text-[10px] font-semibold hover:bg-muted"
              >
                Retire selected…
              </button>
            )}
          </div>

          {plan && (
            <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-600">
              <div className="font-semibold">
                This would {plan.operation} {plan.records} record(s). Nothing has changed yet.
              </div>
              <div className="mt-1 font-mono text-[10px] opacity-80">operation {plan.operation_id}</div>
              <div className="mt-2 flex gap-2">
                <button
                  disabled={busy === "bulk"}
                  onClick={() => void runBulk()}
                  className="rounded-md bg-amber-500 px-2.5 py-1 text-[10px] font-bold text-background disabled:opacity-40"
                >
                  {busy === "bulk" ? "Running…" : "Run it"}
                </button>
                <button
                  onClick={() => setPlan(null)}
                  className="rounded-md border border-amber-500/40 px-2.5 py-1 text-[10px] font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {result && (
            <div className="mt-2 rounded-lg border border-border bg-background/60 px-3 py-2 text-[11px]">
              {/* Section 26: partial is reported as partial, with the reason
                  for each record that did not go through. */}
              <div className="font-semibold">
                {result.status} — {result.done} of {result.total} done
                {result.failed ? `, ${result.failed} failed` : ""}
                {result.invalid ? `, ${result.invalid} invalid` : ""}
                {result.unauthorized ? `, ${result.unauthorized} refused` : ""}
              </div>
              {result.outcomes.filter((o) => o.status !== "done").slice(0, 6).map((o) => (
                <div key={o.id} className="mt-0.5 truncate text-[10px] text-muted-foreground">
                  {o.id.slice(0, 8)} · {o.status} · {o.reason}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {adding && data && (
        <div className="mb-3 rounded-xl border border-accent/30 bg-accent/[0.04] p-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-accent">
            New {data.label.replace(/s$/, "")}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(data.creatable ?? []).map((column) => (
              <label key={column} className="block">
                <span className="mb-0.5 block text-[10px] uppercase tracking-wider text-muted-foreground">
                  {humanise(column)}
                  {(data.required ?? []).includes(column) && <span className="ml-1 text-accent">required</span>}
                </span>
                <input
                  value={adding[column] ?? ""}
                  onChange={(e) => setAdding({ ...adding, [column]: e.target.value })}
                  className="w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={busy === "new"}
            onClick={() => void create()}
            className="mt-3 rounded-md bg-accent px-3 py-1.5 text-[11px] font-bold text-background disabled:opacity-40"
          >
            {busy === "new" ? "Adding…" : "Add"}
          </button>
        </div>
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
                {canRetire && (
                  <th scope="col" className="border-b border-border px-2 py-2 text-left">
                    <input
                      type="checkbox"
                      aria-label="Select every row on this page"
                      className="accent-accent"
                      checked={Boolean(data.rows.length) && picked.length === data.rows.length}
                      onChange={(e) =>
                        setPicked(e.target.checked ? data.rows.map((r) => String(r.id)) : [])
                      }
                    />
                  </th>
                )}
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
                {canRetire && (
                  <th scope="col" className="border-b border-border px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Row
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => {
                const id = String(row.id);
                return (
                  <tr key={id} className="border-b border-border/60 last:border-0 hover:bg-white/[0.02]">
                    {canRetire && (
                      <td className="px-2 py-1.5">
                        <input
                          type="checkbox"
                          aria-label={`Select row ${id}`}
                          className="accent-accent"
                          checked={picked.includes(id)}
                          onChange={(e) =>
                            setPicked((p) => (e.target.checked ? [...p, id] : p.filter((x) => x !== id)))
                          }
                        />
                      </td>
                    )}
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
                    {canRetire && (
                      <td className="px-2 py-1.5 text-right align-top">
                        <button
                          type="button"
                          disabled={busy === id}
                          onClick={() => void retire(id)}
                          className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-accent disabled:opacity-40"
                          title="Take this row out of use. It is not deleted."
                        >
                          Retire
                        </button>
                      </td>
                    )}
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
