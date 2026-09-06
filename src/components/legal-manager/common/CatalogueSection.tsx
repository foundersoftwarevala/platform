import { useMemo, useState } from "react";
import { ArrowUpDown, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AsyncState } from "./AsyncState";
import { RecordDrawer } from "./RecordDrawer";
import type { LegalRecord } from "@/lib/legal-data";

export interface CatalogueColumn {
  key: string;
  header: string;
  className?: string;
  render?: (record: LegalRecord) => React.ReactNode;
}

interface CatalogueSectionProps {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  records: LegalRecord[];
  columns: CatalogueColumn[];
  isLoading?: boolean;
  isError?: boolean;
  error?: { message?: string } | null;
  onRetry?: () => void;
  /** Sub-section label from the sidebar; pre-filters the table and shows a chip. */
  focusLabel?: string | null;
  emptyTitle?: string;
  emptyDescription?: string;
  rowActions?: (record: LegalRecord) => React.ReactNode;
  drawerActions?: (record: LegalRecord) => React.ReactNode;
  pageSize?: number;
}

const statusOf = (record: LegalRecord) => String(record.status ?? "").toLowerCase();

/** Enterprise table: search, status filter, sort, pagination and a detail drawer. */
export const CatalogueSection = ({
  title,
  icon: Icon,
  records,
  columns,
  isLoading,
  isError,
  error,
  onRetry,
  focusLabel,
  emptyTitle,
  emptyDescription,
  rowActions,
  drawerActions,
  pageSize = 8,
}: CatalogueSectionProps) => {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sortKey, setSortKey] = useState<string>(columns[0]?.key ?? "name");
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(0);
  const [focusActive, setFocusActive] = useState(true);
  const [selected, setSelected] = useState<LegalRecord | null>(null);

  const statuses = useMemo(
    () => Array.from(new Set(records.map(statusOf).filter(Boolean))).sort(),
    [records],
  );

  const focusTerms = useMemo(
    () =>
      focusActive && focusLabel
        ? focusLabel
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .filter((word) => word.length > 3)
        : [],
    [focusActive, focusLabel],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = records.filter((record) => {
      const haystack = Object.values(record).join(" ").toLowerCase();
      const matchesQuery = !q || haystack.includes(q);
      const matchesStatus = status === "all" || statusOf(record) === status;
      return matchesQuery && matchesStatus;
    });

    if (focusTerms.length) {
      const focused = rows.filter((record) => {
        const haystack = Object.values(record).join(" ").toLowerCase();
        return focusTerms.some((term) => haystack.includes(term));
      });
      if (focused.length) rows = focused;
    }

    return [...rows].sort((a, b) => {
      const av = String(a[sortKey] ?? "");
      const bv = String(b[sortKey] ?? "");
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [records, query, status, sortKey, sortAsc, focusTerms]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  const toggleSort = (key: string) => {
    if (key === sortKey) setSortAsc((prev) => !prev);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
    setPage(0);
  };

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="gap-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between">
          <CardTitle className="flex min-w-0 items-center gap-2">
            {Icon && <Icon className="h-5 w-5 shrink-0 text-primary" />}
            <span className="truncate">{title}</span>
          </CardTitle>
          <Badge variant="outline" className="shrink-0">
            {filtered.length} of {records.length}
          </Badge>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
              placeholder={`Search ${title.toLowerCase()}`}
              aria-label={`Search ${title}`}
              className="pl-9"
            />
          </div>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-full sm:w-48" aria-label="Filter by status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statuses.map((value) => (
                <SelectItem key={value} value={value}>
                  {value.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {focusLabel && focusActive && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-primary/15 text-primary">Focus: {focusLabel}</Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFocusActive(false)}
              className="h-7 px-2 text-xs"
            >
              <X className="mr-1 h-3 w-3" aria-hidden="true" />
              Show all records
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <AsyncState
          isLoading={isLoading}
          isError={isError}
          error={error ?? null}
          isEmpty={filtered.length === 0}
          onRetry={onRetry}
          emptyTitle={emptyTitle ?? "No matching records"}
          emptyDescription={
            emptyDescription ??
            "Adjust the search or status filter, or wait for new records to be created in the workspace."
          }
          emptyAction={
            (query || status !== "all") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setStatus("all");
                }}
              >
                Clear filters
              </Button>
            )
          }
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  {columns.map((column) => (
                    <TableHead key={column.key} className={column.className}>
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className="inline-flex items-center gap-1 rounded text-left text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`Sort by ${column.header}`}
                      >
                        {column.header}
                        <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </TableHead>
                  ))}
                  <TableHead className="text-right text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((record) => (
                  <TableRow
                    key={record.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`Open details for ${record.name}`}
                    onClick={() => setSelected(record)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelected(record);
                      }
                    }}
                    className="cursor-pointer border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    {columns.map((column) => (
                      <TableCell key={column.key} className={column.className}>
                        {column.render
                          ? column.render(record)
                          : String(record[column.key] ?? "—")}
                      </TableCell>
                    ))}
                    <TableCell
                      className="text-right"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="flex justify-end gap-1">
                        {rowActions?.(record)}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelected(record)}
                        >
                          Details
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Page {currentPage + 1} of {pageCount}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage >= pageCount - 1}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </AsyncState>
      </CardContent>

      <RecordDrawer
        record={selected}
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        actions={selected && drawerActions ? drawerActions(selected) : undefined}
      />
    </Card>
  );
};

export default CatalogueSection;
