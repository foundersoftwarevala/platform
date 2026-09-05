import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Inbox } from "lucide-react";
import { EmptyState } from "./EmptyState";

export type Column = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  className?: string;
  /** Enable server-side sorting on this column (key must be a real DB column). */
  sortable?: boolean;
  sortKey?: string;
  /** Hide below the lg breakpoint to keep mobile tables readable. */
  hideOnMobile?: boolean;
};

export type SortState = { column: string; ascending: boolean };

export type TableSelection = {
  selectedCount: number;
  allChecked: boolean;
  onToggleAll: (checked: boolean) => void;
};

export function DataTableShell({
  columns,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
  rows,
  footer,
  isLoading,
  sort,
  onSortChange,
  selection,
  bulkBar,
  density = "comfortable",
}: {
  columns: Column[];
  emptyIcon?: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: { label: string; onClick?: () => void };
  rows?: ReactNode;
  footer?: ReactNode;
  isLoading?: boolean;
  sort?: SortState;
  onSortChange?: (s: SortState) => void;
  selection?: TableSelection;
  bulkBar?: ReactNode;
  density?: "compact" | "comfortable";
}) {
  const pad = density === "compact" ? "py-1.5" : "py-2.5";

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {bulkBar}
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border bg-muted/60 text-[11px] uppercase tracking-[0.08em] text-muted-foreground backdrop-blur">
              <th className={`w-9 px-3 ${pad}`}>
                <input
                  type="checkbox"
                  className="size-3.5 cursor-pointer rounded border-border accent-[var(--primary)]"
                  aria-label="Select all rows on this page"
                  checked={selection?.allChecked ?? false}
                  onChange={(e) => selection?.onToggleAll(e.target.checked)}
                  disabled={!selection}
                />
              </th>
              {columns.map((c) => {
                const key = c.sortKey ?? c.key;
                const active = sort?.column === key;
                const sortable = c.sortable === true && !!onSortChange;
                const align =
                  c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left";
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort!.ascending ? "ascending" : "descending") : "none"}
                    className={[
                      "px-3 font-medium", pad, align,
                      c.hideOnMobile ? "hidden lg:table-cell" : "",
                      c.className ?? "",
                    ].join(" ")}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => onSortChange!({ column: key, ascending: active ? !sort!.ascending : false })}
                        className={[
                          "inline-flex items-center gap-1 rounded-sm uppercase tracking-[0.08em] transition-colors hover:text-foreground",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                          active ? "text-foreground" : "",
                          c.align === "right" ? "flex-row-reverse" : "",
                        ].join(" ")}
                        title={`Sort by ${c.label}`}
                      >
                        {c.label}
                        {active ? (
                          sort!.ascending ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
                        ) : (
                          <ChevronsUpDown className="size-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      <span>{c.label}</span>
                    )}
                  </th>
                );
              })}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border/60 last:border-0">
                  <td className="w-9 px-3 py-3"><div className="size-3.5 rounded bg-muted animate-pulse" /></td>
                  {columns.map((c) => (
                    <td key={c.key} className={["px-3 py-3", c.hideOnMobile ? "hidden lg:table-cell" : ""].join(" ")}>
                      <div
                        className={`h-3.5 rounded bg-muted animate-pulse ${c.align === "right" ? "ml-auto w-16" : "w-3/4"}`}
                        style={{ animationDelay: `${i * 60}ms` }}
                      />
                    </td>
                  ))}
                  <td className="w-10" />
                </tr>
              ))
            ) : rows ?? (
              <tr>
                <td colSpan={columns.length + 2}>
                  <EmptyState
                    icon={emptyIcon ?? Inbox}
                    title={emptyTitle}
                    description={emptyDescription}
                    primaryAction={emptyAction}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {footer && (
        <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2 text-[12px] text-muted-foreground">
          {footer}
        </div>
      )}
    </div>
  );
}
