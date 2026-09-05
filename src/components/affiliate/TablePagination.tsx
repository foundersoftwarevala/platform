import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PAGE_SIZES = [25, 50, 100, 200];

/**
 * Enterprise table pagination: result window, rows-per-page, first/prev/
 * next/last and a jump-to-page box. Built for 1M+ row tables.
 */
export function TablePagination({
  page,
  pageSize,
  count,
  countIsEstimate,
  totalPages,
  isLoading,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  count: number;
  countIsEstimate?: boolean;
  totalPages: number;
  isLoading?: boolean;
  onPageChange: (p: number) => void;
  onPageSizeChange?: (n: number) => void;
}) {
  const [jump, setJump] = useState("");
  const from = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, count);

  const submitJump = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(jump);
    if (Number.isFinite(n) && n >= 1) onPageChange(Math.min(Math.trunc(n), totalPages));
    setJump("");
  };

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-3">
      <span className="tabular-nums text-muted-foreground" role="status" aria-live="polite">
        {isLoading ? (
          <span className="inline-block h-3 w-40 animate-pulse rounded bg-muted align-middle" />
        ) : count === 0 ? (
          "No results"
        ) : (
          <>
            <span className="font-medium text-foreground">{from.toLocaleString()}–{to.toLocaleString()}</span>
            {" of "}
            <span className="font-medium text-foreground">
              {countIsEstimate ? "~" : ""}
              {count.toLocaleString()}
            </span>
            {countIsEstimate && (
              <span className="ml-1 text-[11px]" title="Approximate total — exact counts are skipped on very large tables for speed">
                (approx.)
              </span>
            )}
          </>
        )}
      </span>

      <div className="flex flex-wrap items-center gap-2">
        {onPageSizeChange && (
          <label className="hidden items-center gap-1.5 text-[12px] text-muted-foreground sm:flex">
            Rows
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-7 rounded-md border border-border bg-surface px-1.5 text-[12px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Rows per page"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        )}

        <form onSubmit={submitJump} className="hidden items-center gap-1.5 text-[12px] text-muted-foreground md:flex">
          <span className="tabular-nums">Page {page} / {totalPages}</span>
          <Input
            value={jump}
            onChange={(e) => setJump(e.target.value.replace(/\D/g, ""))}
            placeholder="Go to"
            aria-label="Jump to page"
            className="h-7 w-16 px-2 text-[12px]"
          />
        </form>

        <div className="flex items-center gap-0.5">
          <Button variant="outline" size="icon" className="size-7" aria-label="First page"
            disabled={page <= 1} onClick={() => onPageChange(1)}>
            <ChevronsLeft className="size-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="size-7" aria-label="Previous page"
            disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft className="size-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="size-7" aria-label="Next page"
            disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
            <ChevronRight className="size-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="size-7" aria-label="Last page"
            disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}>
            <ChevronsRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
