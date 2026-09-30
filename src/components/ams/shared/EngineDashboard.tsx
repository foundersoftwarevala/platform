import { type ReactNode, isValidElement, useEffect, useMemo, useState } from "react";
import {
  Search, Plus, Download, Filter, MoreHorizontal, TrendingUp, TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ams/shared/PageHeader";


export interface KpiCard {
  label: string;
  value: string | number;
  delta?: string;
  trend?: "up" | "down";
  accent?: string;
}

export interface DashboardRow {
  id: string;
  [k: string]: ReactNode;
}

/** An action on one row. Offered only where `when` allows it. */
export interface RowAction {
  label: string;
  danger?: boolean;
  when?: (row: DashboardRow) => boolean;
  onSelect: (row: DashboardRow) => void;
}

export interface DashboardColumn {
  key: string;
  label: string;
  width?: string;
  align?: "left" | "right" | "center";
}

export interface FilterChip {
  label: string;
  values: string[];
  /** The column it filters; the label, lower-cased, when not given. */
  key?: string;
}

export interface EngineDashboardProps {
  kicker: string;
  title: string;
  description?: string;
  primaryAction?: string;
  kpis: KpiCard[];
  filters?: FilterChip[];
  columns: DashboardColumn[];
  rows: DashboardRow[];
  emptyLabel?: string;
  extraPanels?: ReactNode;
  /** The primary action. Without one, no primary button is shown. */
  onPrimary?: () => void;
  rowActions?: RowAction[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const PAGE_SIZE = 25;

/** A cell's text, for search, filters and export: a string, a number, or a chip's own text. */
function textOf(value: unknown): string {
  if (value == null || typeof value === "boolean") return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(textOf).join(" ");
  if (isValidElement(value)) return textOf((value.props as { children?: unknown }).children);
  return "";
}

function exportCsv(title: string, columns: DashboardColumn[], rows: DashboardRow[]) {
  const quote = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [
    columns.map((c) => quote(c.label)).join(","),
    ...rows.map((r) => columns.map((c) => quote(textOf(r[c.key]))).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
}

/**
 * The AMS engine screens' shared layout.
 *
 * Every button on it used to be inert - Import, Export, New, the bulk actions
 * and every row action - and paging was two permanently disabled buttons.
 * Export now writes the rows on screen to a CSV file, paging pages, and the
 * primary and row actions are the ones a screen actually supplies: a screen
 * that supplies none shows none. Filters search the values a column really
 * holds.
 */
export function EngineDashboard({
  kicker, title, description, primaryAction = "New",
  kpis, filters = [], columns, rows,
  emptyLabel = "No records yet.",
  extraPanels, onPrimary, rowActions = [], loading = false, error = null, onRetry,
}: EngineDashboardProps) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (needle) {
        const hay = Object.values(r).map(textOf).join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      for (const [k, v] of Object.entries(active)) {
        if (v && textOf(r[k]).toLowerCase() !== v.toLowerCase()) return false;
      }
      return true;
    });
  }, [rows, q, active]);

  // The filter's choices are the values the column holds, not a fixed list.
  const filterValues = useMemo(
    () =>
      filters.map((f) => {
        const key = f.key ?? f.label.toLowerCase();
        const present = [...new Set(rows.map((r) => textOf(r[key])).filter(Boolean))].sort();
        return { label: f.label, key, values: present.length ? present : f.values };
      }),
    [filters, rows],
  );

  useEffect(() => { setPage(0); }, [q, active, rows]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const shown = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);


  return (
    <div className="space-y-6">
      {/* Banner header */}
      <PageHeader
        kicker={kicker}
        title={title}
        description={description}
        actions={
          <>
            <Button
              variant="outline" size="sm" className="gap-1.5"
              disabled={!filtered.length}
              onClick={() => exportCsv(title, columns, filtered)}
            >
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            {onPrimary && (
              <Button size="sm" className="gap-1.5" onClick={onPrimary}><Plus className="h-3.5 w-3.5" /> {primaryAction}</Button>
            )}
          </>
        }
      />


      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="surface-card motion-card motion-fade p-4">
            <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{k.label}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <div className="text-2xl font-bold tracking-tight" style={{ color: k.accent }}>{k.value}</div>
              {k.delta && (
                <span className={cn(
                  "text-[11px] flex items-center gap-0.5",
                  k.trend === "down" ? "text-destructive" : "text-emerald-500",
                )}>
                  {k.trend === "down" ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                  {k.delta}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {extraPanels}

      {/* Filter + search bar */}
      <div className="surface-card p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-9 h-9 bg-muted/30" />
        </div>
        {filterValues.map((f) => (
          <DropdownMenu key={f.label}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                {f.label}{active[f.key] ? `: ${active[f.key]}` : ""}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-44">
              <DropdownMenuItem onClick={() => setActive((a) => ({ ...a, [f.key]: "" }))}>
                All
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {f.values.map((v) => (
                <DropdownMenuItem key={v} onClick={() => setActive((a) => ({ ...a, [f.key]: v }))}>
                  {v}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
      </div>

      {/* Table */}
      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-border/60 bg-[oklch(0.2_0.032_260)] backdrop-blur text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                {columns.map((c) => (
                  <th key={c.key} scope="col" className={cn("px-3 py-2 font-medium", c.align === "right" && "text-right", c.align === "center" && "text-center")} style={{ width: c.width }}>
                    {c.label}
                  </th>
                ))}
                {rowActions.length > 0 && <th scope="col" className="w-10 px-3 py-2"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {loading || error || filtered.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (rowActions.length ? 1 : 0)} className="px-3 py-16 text-center">
                    <div className="motion-fade mx-auto flex max-w-sm flex-col items-center gap-3" role={error ? "alert" : undefined}>
                      <span className="grid h-12 w-12 place-items-center rounded-xl border border-border bg-muted/30 text-muted-foreground">
                        <Filter className="h-5 w-5" />
                      </span>
                      <p className="text-sm text-muted-foreground">
                        {loading ? "Loading…" : error ? error : rows.length ? "Nothing matches the search or filters." : emptyLabel}
                      </p>
                      {error && onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Try again</Button>}
                      {!loading && !error && !rows.length && onPrimary && (
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={onPrimary}><Plus className="h-3.5 w-3.5" /> {primaryAction}</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : shown.map((r) => (
                <tr
                  key={r.id}
                  className="motion-row border-b border-border/40 hover:bg-muted/25"
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-3 py-2.5", c.align === "right" && "text-right", c.align === "center" && "text-center")}>
                      {r[c.key]}
                    </td>
                  ))}
                  {rowActions.length > 0 && (
                    <td className="px-3 py-2.5">
                      {rowActions.some((a) => !a.when || a.when(r)) && (
                        <DropdownMenu>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${textOf(r[columns[0]?.key ?? "id"]) || r.id}`} sound="dropdown">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent>Row actions</TooltipContent>
                          </Tooltip>
                          <DropdownMenuContent align="end" className="w-44">
                            {rowActions.filter((a) => !a.when || a.when(r)).map((a) => (
                              <DropdownMenuItem key={a.label} className={a.danger ? "text-destructive" : undefined} onClick={() => a.onSelect(r)}>
                                {a.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border/60 px-3 py-2 flex items-center justify-between text-xs text-muted-foreground">
          <div>
            {filtered.length
              ? `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, filtered.length)} of ${filtered.length}`
              : `Showing 0 of ${rows.length}`}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</Button>
            <span className="px-1">{page + 1} / {pages}</span>
            <Button variant="ghost" size="sm" disabled={page >= pages - 1} onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}>Next</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StatusChip({ tone, children }: { tone: "success" | "warn" | "info" | "muted" | "danger"; children: ReactNode }) {
  const map: Record<string, string> = {
    success: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
    warn:    "bg-amber-500/10 text-amber-500 border-amber-500/30",
    info:    "bg-sky-500/10 text-sky-500 border-sky-500/30",
    muted:   "bg-muted/40 text-muted-foreground border-border",
    danger:  "bg-destructive/10 text-destructive border-destructive/30",
  };
  return <Badge variant="outline" className={cn("text-[10px] uppercase tracking-wider", map[tone])}>{children}</Badge>;
}
