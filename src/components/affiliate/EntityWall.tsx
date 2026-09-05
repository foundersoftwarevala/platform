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
};

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
};

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

  const list = useEntityList<T>({
    table: p.table,
    select: p.select,
    search: p.searchColumns && p.searchColumns.length > 0 ? { q, columns: p.searchColumns } : undefined,
    filters: [...tabFilters, ...appliedFilters],
    order: sort,
    page,
    pageSize,
  });

  const totalPages = list.data?.totalPages ?? 1;
  const count = list.data?.count ?? 0;
  const countIsEstimate = !!list.data?.countIsEstimate;
  const rows = list.data?.rows ?? [];

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
            <KpiCounter key={k.label} table={p.table} spec={k} />
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
            emptyTitle={list.isError ? "Failed to load" : p.emptyTitle}
            emptyDescription={
              list.isError
                ? (list.error instanceof Error ? list.error.message : "Please retry.")
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

function KpiCounter({ table, spec }: { table: string; spec: KpiSpec }) {
  const c = useEntityCount(table, spec.filter);
  const value = c.isLoading
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
