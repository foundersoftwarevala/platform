import { ChevronDown, Download, Filter, Search, SlidersHorizontal, Upload, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ReactNode } from "react";

export type FilterSpec = {
  /** Label shown on the trigger, e.g. "Status". */
  label: string;
  /** Column the filter applies to; defaults to a slug of the label. */
  column?: string;
  options?: { label: string; value: string }[];
};

export type AppliedFilter = { label: string; value: string; optionLabel: string };

export function FilterBar({
  placeholder = "Search…",
  filters,
  trailing,
  value,
  onChange,
  showIO = true,
  applied = [],
  onApply,
  onClearAll,
  density,
  onDensityChange,
}: {
  placeholder?: string;
  filters?: (string | FilterSpec)[];
  trailing?: ReactNode;
  value?: string;
  onChange?: (v: string) => void;
  showIO?: boolean;
  applied?: AppliedFilter[];
  onApply?: (label: string, value: string, optionLabel: string) => void;
  onClearAll?: () => void;
  density?: "compact" | "comfortable";
  onDensityChange?: (d: "compact" | "comfortable") => void;
}) {
  const controlled = typeof value === "string";
  const specs: FilterSpec[] = (filters ?? ["Status", "Country", "Tier", "Date"]).map((f) =>
    typeof f === "string" ? { label: f } : f,
  );
  const appliedFor = (label: string) => applied.find((a) => a.label === label);

  return (
    <div className="border-b border-border bg-surface">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 lg:px-6">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={placeholder}
            value={controlled ? value : undefined}
            onChange={(e) => onChange?.(e.target.value)}
            className="h-9 bg-muted/60 pl-8 pr-8"
            aria-label={placeholder}
          />
          {controlled && value && value.length > 0 && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onChange?.("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {specs.map((f) => {
            const current = appliedFor(f.label);
            const options = f.options ?? [];
            return (
              <DropdownMenu key={f.label}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    className={[
                      "h-9 gap-1 font-normal",
                      current ? "border-primary/40 bg-primary-soft text-primary" : "",
                    ].join(" ")}
                  >
                    {f.label}
                    {current && <span className="font-medium">: {current.optionLabel}</span>}
                    <ChevronDown className="size-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Filter by {f.label.toLowerCase()}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {options.length === 0 ? (
                    <div className="px-2 py-3 text-xs text-muted-foreground">
                      No preset values for this column yet — use search instead.
                    </div>
                  ) : (
                    <>
                      <DropdownMenuCheckboxItem
                        checked={!current}
                        onCheckedChange={() => onApply?.(f.label, "", "All")}
                      >
                        All
                      </DropdownMenuCheckboxItem>
                      {options.map((o) => (
                        <DropdownMenuCheckboxItem
                          key={o.value}
                          checked={current?.value === o.value}
                          onCheckedChange={() =>
                            onApply?.(f.label, current?.value === o.value ? "" : o.value, o.label)
                          }
                        >
                          {o.label}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
          {applied.length > 0 && (
            <span className="inline-flex h-9 items-center rounded-md bg-primary-soft px-2 text-[11px] font-medium text-primary">
              <Filter className="mr-1 size-3" /> {applied.length} active
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {trailing}
          {showIO && (
            <>
              <Button asChild variant="ghost" size="sm" className="h-9 gap-1.5 text-muted-foreground">
                <Link to="/affiliate-manager/import"><Upload className="size-3.5" /> <span className="hidden sm:inline">Import</span></Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="h-9 gap-1.5 text-muted-foreground">
                <Link to="/affiliate-manager/export"><Download className="size-3.5" /> <span className="hidden sm:inline">Export</span></Link>
              </Button>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-9" aria-label="Table display settings">
                <SlidersHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Row density
              </DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={density !== "compact"}
                onCheckedChange={() => onDensityChange?.("comfortable")}
              >
                Comfortable
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={density === "compact"}
                onCheckedChange={() => onDensityChange?.("compact")}
              >
                Compact
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {applied.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/70 px-4 py-2 lg:px-6">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Applied</span>
          {applied.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => onApply?.(a.label, "", "All")}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
            >
              {a.label}: <span className="font-medium">{a.optionLabel}</span>
              <X className="size-3 opacity-70" />
            </button>
          ))}
          <button
            type="button"
            onClick={onClearAll}
            className="ml-1 text-[11px] font-medium text-primary hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
