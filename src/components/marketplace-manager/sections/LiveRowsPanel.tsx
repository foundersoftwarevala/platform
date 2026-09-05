import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, ExternalLink, Loader2, RefreshCw } from "lucide-react";

/**
 * The real category rows of the marketplace home page.
 *
 * The panel beneath this one shows a designed list that is not connected to
 * anything. This one is the live thing: it reads the rows the storefront
 * actually renders, and moving or hiding one here changes the home page.
 *
 * Writes go through /api/marketplace/rows, which only accepts an operator, so
 * this panel simply reports when the server refuses rather than pretending the
 * change was saved.
 */

type LiveRow = {
  id: string;
  position: number;
  title: string;
  slug: string;
  products: number;
  hidden: boolean;
  href: string;
};

export function LiveRowsPanel() {
  const [rows, setRows] = useState<LiveRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/marketplace/rows");
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Could not load the rows");
      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not load the rows");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Send one change and reload, so the panel always shows what was stored. */
  const save = async (body: Record<string, unknown>, id: string, method: "PATCH" | "PUT") => {
    setBusy(id);
    setNotice(null);
    try {
      const response = await fetch("/api/marketplace/rows", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice(
          response.status === 401 || response.status === 403
            ? "Sign in as an operator to change the home page rows."
            : (data?.error ?? "That change was not saved."),
        );
        return;
      }
      await load();
    } catch {
      setNotice("Could not reach the server. Nothing was changed.");
    } finally {
      setBusy(null);
    }
  };

  const move = (index: number, direction: -1 | 1) => {
    if (!rows) return;
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    void save({ order: next.map((r) => r.id) }, rows[index].id, "PUT");
  };

  return (
    <div className="glass mb-4 rounded-2xl p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-accent">
            Live home page rows
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {rows === null
              ? "Reading the marketplace…"
              : `${rows.length} rows · ${rows.filter((r) => !r.hidden).length} showing on the home page`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-2.5 py-1.5 text-[11px] font-semibold hover:border-accent/40 hover:text-accent"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>

      {notice && (
        <p role="status" className="mb-2 rounded-md border border-border bg-background/60 px-3 py-2 text-[11px] text-muted-foreground">
          {notice}
        </p>
      )}

      {rows === null ? (
        <p className="flex items-center gap-2 px-1 py-6 text-[12px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading the real rows…
        </p>
      ) : error ? (
        <p className="px-1 py-6 text-[12px] text-muted-foreground">{error}</p>
      ) : rows.length === 0 ? (
        <p className="px-1 py-6 text-[12px] text-muted-foreground">
          The marketplace has no category rows yet.
        </p>
      ) : (
        <ul className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
          {rows.map((row, index) => (
            <li
              key={row.id}
              className="flex items-center gap-2 rounded-lg border border-border bg-background/40 px-2.5 py-2"
            >
              <span className="grid h-6 w-8 shrink-0 place-items-center rounded border border-border font-mono text-[11px] font-bold text-accent">
                {row.position}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-semibold">{row.title}</span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {row.products} products · {row.slug}
                </span>
              </span>

              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                  row.hidden
                    ? "bg-secondary text-muted-foreground"
                    : "bg-accent/10 text-accent"
                }`}
              >
                {row.hidden ? "hidden" : "live"}
              </span>

              <span className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0 || busy === row.id}
                  aria-label={`Move ${row.title} up`}
                  className="grid h-6 w-6 place-items-center rounded border border-border text-muted-foreground hover:text-accent disabled:opacity-30"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === rows.length - 1 || busy === row.id}
                  aria-label={`Move ${row.title} down`}
                  className="grid h-6 w-6 place-items-center rounded border border-border text-muted-foreground hover:text-accent disabled:opacity-30"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => void save({ id: row.id, is_hidden: !row.hidden }, row.id, "PATCH")}
                  disabled={busy === row.id}
                  aria-label={row.hidden ? `Show ${row.title}` : `Hide ${row.title}`}
                  className="grid h-6 w-6 place-items-center rounded border border-border text-muted-foreground hover:text-accent disabled:opacity-30"
                >
                  {row.hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
                <a
                  href={row.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${row.title} on the storefront`}
                  className="grid h-6 w-6 place-items-center rounded border border-border text-muted-foreground hover:text-accent"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
