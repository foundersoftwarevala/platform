import { createContext, Fragment, useContext, useMemo, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import { PageHeader } from "./PageHeader";
import { KpiCard, KpiGrid } from "./KpiCard";
import { WallShell } from "./WallShell";
import { FilterBar, type AppliedFilter } from "./FilterBar";
import { DataTableShell, type Column, type SortState } from "./DataTableShell";
import { TablePagination } from "./TablePagination";
import { Tabs, StatusBadge } from "./StatusBadge";
import { Button } from "@/components/ui/button";
import { useEntityList, useEntityCount, type EntityFilter } from "@/lib/affiliate-entity";
import { formatDate, formatMoney } from "@/lib/affiliate-format";

export type KpiSpec = {
  label: string;
  icon?: ReactNode;
  tone?: "default" | "primary" | "success" | "warning" | "destructive";
  filter?: EntityFilter[]; // extra head-count filters against `table`
  formatter?: (n: number) => string;
  /** Count a different stored table instead; `filter` is then on that table. */
  table?: string;
  /** Nothing records this figure: the card shows "—" and asks for nothing. */
  unavailable?: boolean;
};

/**
 * Where a wall's records really live, when the page was written against a
 * table of a different name or shape. The page keeps its own field names; the
 * source translates its filters, sort and search onto the stored table and
 * turns stored rows back into the page's shape. A field with no stored
 * equivalent translates to null, and anything that depends on it shows as
 * empty rather than as invented values.
 */
export type EntitySource<T> = {
  table: string;
  select?: string;
  /** Always applied, e.g. scoping a shared ledger to its affiliate rows. */
  fixed?: EntityFilter[];
  /** A filter on a page field, as filters on the stored table; null if it has no source. */
  filter: (f: EntityFilter) => EntityFilter[] | null;
  /** The stored column for a page field, for sorting; null if it has no source. */
  sortColumn: (field: string) => string | null;
  /** Stored columns the search box matches; none means search has no source. */
  searchColumns?: string[];
  order: { column: string; ascending?: boolean };
  toRows: (rows: Record<string, unknown>[]) => T[] | Promise<T[]>;
};

/** A source filter that renames page fields to stored columns; unlisted fields have no source. */
export function renameFilter(columns: Record<string, string>) {
  return (f: EntityFilter): EntityFilter[] | null =>
    columns[f.column] ? [{ ...f, column: columns[f.column] }] : null;
}

export type EntityWallProps<T extends Record<string, unknown>> = {
  title: string;
  description?: string;
  crumbLabel: string;
  table: string;
  select?: string;
  searchColumns?: string[];
  searchPlaceholder?: string;
  filters?: string[];
  tabs?: string[];
  /** Column the tab strip filters on. Defaults to `status`. */
  tabColumn?: string;
  kpis: KpiSpec[];
  columns: Column[];
  renderRow: (row: T) => ReactNode;
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  order?: { column: string; ascending?: boolean };
  /** The stored table and mapping, when it is not `table` itself. */
  source?: EntitySource<T>;
  /**
   * The platform records nothing this wall could show. The reason is shown in
   * place of the table and no request is made.
   */
  unavailable?: string;
};

/** Translate page filters through a source: null when any of them has no source. */
function translate<T>(source: EntitySource<T> | undefined, filters: EntityFilter[]): EntityFilter[] | null {
  if (!source) return filters;
  const out: EntityFilter[] = [...(source.fixed ?? [])];
  for (const f of filters) {
    if (f.value == null || f.value === "" || f.value === "all") continue;
    const mapped = source.filter(f);
    if (!mapped) return null;
    out.push(...mapped);
  }
  return out;
}

/* ---------------------------------------------------------------- selection */

type SelectionCtx = {
  selected: Set<string>;
  toggle: (id: string) => void;
};
const SelectionContext = createContext<SelectionCtx | null>(null);

/* ------------------------------------------------------------------- wall */

/**
 * Generic enterprise wall renderer: PageHeader → Tabs → KPI grid → FilterBar
 * → sortable DataTable → pagination, all bound to a Supabase table via
 * useEntityList + useEntityCount. Loading, empty, error, selection, sorting,
 * density and filter chips are handled here so every wall behaves identically.
 */
export function EntityWall<T extends Record<string, unknown>>(p: EntityWallProps<T>) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [q, setQ] = useState("");
  const [activeTab, setActiveTab] = useState<string | undefined>(p.tabs?.[0]);
  const [density, setDensity] = useState<"compact" | "comfortable">("comfortable");
  const [applied, setApplied] = useState<AppliedFilter[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortState>({
    column: p.order?.column ?? "created_at",
    ascending: p.order?.ascending ?? false,
  });

  const tabColumn = p.tabColumn ?? "status";
  const tabFilters: EntityFilter[] = useMemo(() => {
    if (!activeTab || !p.tabs || activeTab === p.tabs[0]) return [];
    return [{ column: tabColumn, value: activeTab.toLowerCase() }];
  }, [activeTab, p.tabs, tabColumn]);

  const appliedFilters: EntityFilter[] = useMemo(
    () =>
      applied
        .filter((a) => a.value)
        .map((a) => ({ column: a.label.toLowerCase().replace(/\s+/g, "_"), value: a.value })),
    [applied],
  );

  // With a source, the page's filters, search and sort are carried onto the
  // stored table. One that has no stored equivalent leaves nothing to show.
  const source = p.source;
  const storedFilters = translate(source, [...tabFilters, ...appliedFilters]);
  const searchColumns = source ? source.searchColumns ?? [] : p.searchColumns ?? [];
  const searchUnsourced = !!source && !!q && searchColumns.length === 0;
  const unsourced = storedFilters === null || searchUnsourced;
  const storedSortColumn = source ? source.sortColumn(sort.column) : sort.column;
  const storedOrder = source && !storedSortColumn
    ? source.order
    : { column: storedSortColumn ?? sort.column, ascending: sort.ascending };

  const listEnabled = !p.unavailable && !unsourced;
  const list = useEntityList<T>({
    table: source?.table ?? p.table,
    select: source?.select ?? p.select,
    search: searchColumns.length > 0 ? { q, columns: searchColumns } : undefined,
    filters: storedFilters ?? [],
    order: storedOrder,
    page,
    pageSize,
    enabled: listEnabled,
    mapRows: source?.toRows,
  });

  // A disabled query can still hold the previous view's page as placeholder
  // data; a view with no source shows nothing instead.
  const shown = listEnabled ? list.data : undefined;
  const totalPages = shown?.totalPages ?? 1;
  const count = shown?.count ?? 0;
  const countIsEstimate = !!shown?.countIsEstimate;
  const rows = shown?.rows ?? [];

  const reset = () => { setPage(1); setSelected(new Set()); };

  const filterSpecs = useMemo(
    () =>
      (p.filters ?? ["Status", "Country", "Tier", "Date"]).map((label) =>
        label === "Status" && p.tabs && p.tabs.length > 1
          ? {
              label,
              options: p.tabs.slice(1).map((t) => ({ label: t, value: t.toLowerCase() })),
            }
          : { label },
      ),
    [p.filters, p.tabs],
  );

  const selectionCtx: SelectionCtx = {
    selected,
    toggle: (id) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      }),
  };

  const pageIds = rows.map((r) => String((r as { id?: unknown }).id ?? ""));
  const allChecked = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  return (
    <>
      <PageHeader
        title={p.title}
        description={p.description}
        crumbs={[{ label: "Affiliate Manager" }, { label: p.crumbLabel }]}
        actions={
          <>
            <Button variant="outline" size="sm" disabled={selected.size === 0}>
              Bulk Actions{selected.size > 0 ? ` (${selected.size})` : ""}
            </Button>
            {p.primaryActionLabel && (
              <Button size="sm" onClick={p.onPrimaryAction}>{p.primaryActionLabel}</Button>
            )}
          </>
        }
      />
      {p.tabs && (
        <Tabs items={p.tabs} active={activeTab} onChange={(t) => { setActiveTab(t); reset(); }} />
      )}
      <WallShell>
        <KpiGrid>
          {p.kpis.map((k) => (
            <KpiCounter key={k.label} table={p.table} spec={k} source={source} unavailable={!!p.unavailable} />
          ))}
        </KpiGrid>

        <FilterBar
          placeholder={p.searchPlaceholder ?? "Search…"}
          filters={filterSpecs}
          value={q}
          onChange={(v) => { setQ(v); reset(); }}
          applied={applied}
          density={density}
          onDensityChange={setDensity}
          onApply={(label, value, optionLabel) => {
            setApplied((prev) => {
              const rest = prev.filter((a) => a.label !== label);
              return value ? [...rest, { label, value, optionLabel }] : rest;
            });
            reset();
          }}
          onClearAll={() => { setApplied([]); reset(); }}
        />

        <SelectionContext.Provider value={selectionCtx}>
          <DataTableShell
            columns={p.columns}
            density={density}
            isLoading={list.isLoading}
            sort={sort}
            onSortChange={(s) => { setSort(s); setPage(1); }}
            selection={{
              selectedCount: selected.size,
              allChecked,
              onToggleAll: (checked) =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  for (const id of pageIds) checked ? next.add(id) : next.delete(id);
                  return next;
                }),
            }}
            bulkBar={
              selected.size > 0 ? (
                <div className="flex flex-wrap items-center gap-2 border-b border-primary/20 bg-primary-soft px-3 py-2 text-[12px] text-primary">
                  <span className="font-medium tabular-nums">{selected.size} selected</span>
                  <span className="hidden sm:inline opacity-60">·</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 bg-surface">Approve</Button>
                    <Button size="sm" variant="outline" className="h-7 bg-surface">Suspend</Button>
                    <Button size="sm" variant="outline" className="h-7 bg-surface">Message</Button>
                    <Button size="sm" variant="outline" className="h-7 bg-surface">Export</Button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-primary/10"
                  >
                    <X className="size-3" /> Clear
                  </button>
                </div>
              ) : null
            }
            emptyIcon={p.emptyIcon}
            emptyTitle={p.unavailable ? "Not available yet" : list.isError ? "Failed to load" : p.emptyTitle}
            emptyDescription={
              p.unavailable
                ? p.unavailable
                : list.isError
                ? (list.error instanceof Error ? list.error.message : "Please retry.")
                : unsourced
                  ? "This view filters on something the platform does not record yet, so there is nothing to show."
                  : q
                  ? `No results for “${q}”. Try a different query or clear the filters.`
                  : p.emptyDescription
            }
            emptyAction={
              list.isError
                ? { label: "Retry", onClick: () => list.refetch() }
                : p.primaryActionLabel
                  ? { label: p.primaryActionLabel, onClick: p.onPrimaryAction }
                  : undefined
            }
            rows={rows.length ? rows.map((r, i) => (
              <Fragment key={String((r as { id?: unknown }).id ?? i)}>{p.renderRow(r)}</Fragment>
            )) : undefined}
            footer={
              <TablePagination
                page={page}
                pageSize={pageSize}
                count={count}
                countIsEstimate={countIsEstimate}
                totalPages={totalPages}
                isLoading={list.isLoading}
                onPageChange={setPage}
                onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
              />
            }
          />
        </SelectionContext.Provider>
      </WallShell>
    </>
  );
}

function KpiCounter<T>({
  table, spec, source, unavailable,
}: { table: string; spec: KpiSpec; source?: EntitySource<T>; unavailable?: boolean }) {
  // A KPI counted on its own table takes its filters as stored filters; one on
  // the wall's table goes through the wall's source like the list does.
  const own = !!spec.table;
  const filters = own ? spec.filter ?? [] : translate(source, spec.filter ?? []);
  const countTable = spec.table ?? source?.table ?? table;
  const noSource = unavailable || !!spec.unavailable || filters === null;
  const c = useEntityCount(countTable, filters ?? [], "estimated", !noSource, own ? "*" : source?.select ?? "*");
  const value = noSource ? "—"
    : c.isLoading
    ? <span className="inline-block h-6 w-16 animate-pulse rounded bg-muted align-middle" />
    : c.isError ? "—"
    : spec.formatter ? spec.formatter(c.data ?? 0)
    : (c.data ?? 0).toLocaleString();
  return <KpiCard label={spec.label} value={value} icon={spec.icon} tone={spec.tone} />;
}

/** Convenience cell renderer for status columns across walls. */
export function StatusCell({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const tone: "success" | "warning" | "destructive" | "info" | "neutral" | "primary" =
    /^(verified|approved|active|paid|resolved|completed|sent|connected)$/i.test(value) ? "success"
    : /^(pending|reviewing|processing|scheduled|open|draft)$/i.test(value) ? "warning"
    : /^(suspended|rejected|failed|error|revoked|cancelled|no_show|closed|disconnected)$/i.test(value) ? "destructive"
    : /^(info|new)$/i.test(value) ? "info"
    : "neutral";
  return <StatusBadge tone={tone}>{value.replace(/_/g, " ")}</StatusBadge>;
}

/** Standard tbody row wrapper matching DataTableShell's checkbox column. */
export function Row({
  id,
  children,
  onOpen,
}: { id: string; children: ReactNode; onOpen?: () => void }) {
  const ctx = useContext(SelectionContext);
  const checked = ctx?.selected.has(id) ?? false;
  return (
    <tr
      className={[
        "border-b border-border/60 transition-colors last:border-0",
        checked ? "bg-primary-soft/60" : "hover:bg-muted/40",
        onOpen ? "cursor-pointer" : "",
      ].join(" ")}
      onClick={onOpen}
      data-state={checked ? "selected" : undefined}
    >
      <td className="w-9 px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          className="size-3.5 cursor-pointer rounded border-border accent-[var(--primary)]"
          aria-label={`Select row ${id}`}
          checked={checked}
          onChange={() => ctx?.toggle(id)}
        />
      </td>
      {children}
      <td className="w-10" />
    </tr>
  );
}

export function Cell({
  children,
  align,
  className,
}: { children: ReactNode; align?: "left" | "right" | "center"; className?: string }) {
  return (
    <td className={[
      "px-3 py-2.5",
      align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left",
      className ?? "",
    ].join(" ")}>{children}</td>
  );
}

export function fmtMoney(cents: number | null | undefined) {
  return formatMoney(cents);
}

export function fmtDate(v: string | null | undefined) {
  return formatDate(v);
}
