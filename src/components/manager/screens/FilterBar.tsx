import { useId, type ReactNode } from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const ALL = "__all__";

/** Distinct, sorted, non-empty values for a column of live rows. */
export function optionsFrom<T>(rows: T[], pick: (row: T) => string | null | undefined): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    const value = pick(row);
    if (value) set.add(value);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function humanize(value: string) {
  return value.replace(/[_-]/g, " ");
}

export function SearchFilter({
  value,
  onChange,
  label,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("relative", className)}>
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? label}
        className="w-full pl-9 sm:w-64"
      />
    </div>
  );
}

export function SelectFilter({
  value,
  onChange,
  label,
  options,
  allLabel,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  options: string[];
  allLabel?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} aria-label={label} className="w-full capitalize sm:w-44">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel ?? `All ${label.toLowerCase()}`}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option} className="capitalize">
              {humanize(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function DateFilter({
  value,
  onChange,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Label htmlFor={id} className="whitespace-nowrap text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-40"
      />
    </div>
  );
}

export function FilterBar({
  children,
  onReset,
  active,
  resultLabel,
}: {
  children: ReactNode;
  onReset?: () => void;
  active?: boolean;
  resultLabel?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {children}
      {onReset && active ? (
        <Button variant="ghost" size="sm" onClick={onReset}>
          <X aria-hidden="true" className="h-4 w-4" /> Clear filters
        </Button>
      ) : null}
      {resultLabel ? (
        <p aria-live="polite" className="ml-auto text-xs text-muted-foreground">
          {resultLabel}
        </p>
      ) : null}
    </div>
  );
}
