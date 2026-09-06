import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Filter, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PROMISE_PRIORITIES,
  PROMISE_STATUSES,
  type PromiseWithCategory,
} from "@/lib/promise-tracker/constants";

export const SLA_WINDOWS = [
  { value: "all", label: "Any SLA window" },
  { value: "overdue", label: "Overdue" },
  { value: "6h", label: "Due in 6 hours" },
  { value: "24h", label: "Due in 24 hours" },
  { value: "72h", label: "Due in 3 days" },
  { value: "7d", label: "Due in 7 days" },
  { value: "30d", label: "Due in 30 days" },
] as const;

const SLA_HOURS: Record<string, number> = { "6h": 6, "24h": 24, "72h": 72, "7d": 168, "30d": 720 };

export type PromiseFilterState = {
  search: string;
  status: string;
  priority: string;
  category: string;
  owner: string;
  receiver: string;
  escalation: string;
  sla: string;
  locked: string;
};

export const EMPTY_FILTERS: PromiseFilterState = {
  search: "",
  status: "all",
  priority: "all",
  category: "all",
  owner: "all",
  receiver: "all",
  escalation: "all",
  sla: "all",
  locked: "all",
};

export function usePromiseFilters() {
  const [filters, setFilters] = useState<PromiseFilterState>(EMPTY_FILTERS);
  const update = (patch: Partial<PromiseFilterState>) =>
    setFilters((prev) => ({ ...prev, ...patch }));
  const reset = () => setFilters(EMPTY_FILTERS);
  return { filters, update, reset };
}

export function applyPromiseFilters(
  promises: PromiseWithCategory[],
  filters: PromiseFilterState,
  now = Date.now(),
) {
  const term = filters.search.trim().toLowerCase();
  return promises.filter((row) => {
    if (term) {
      const haystack = [
        row.code,
        row.title,
        row.description ?? "",
        row.owner,
        row.receiver,
        row.promise_categories?.label ?? "",
        row.sub_category ?? "",
        row.nano_category ?? "",
        row.linked_module ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    if (filters.status !== "all" && row.status !== filters.status) return false;
    if (filters.priority !== "all" && row.priority !== filters.priority) return false;
    if (filters.category !== "all" && (row.promise_categories?.slug ?? "none") !== filters.category)
      return false;
    if (filters.owner !== "all" && row.owner !== filters.owner) return false;
    if (filters.receiver !== "all" && row.receiver !== filters.receiver) return false;
    if (filters.escalation !== "all") {
      if (
        filters.escalation === "none"
          ? row.escalation_level !== 0
          : String(row.escalation_level) !== filters.escalation
      )
        return false;
    }
    if (filters.locked !== "all" && String(row.is_locked) !== filters.locked) return false;
    if (filters.sla !== "all") {
      const diffMs = new Date(row.deadline).getTime() - now;
      if (filters.sla === "overdue") {
        if (diffMs >= 0 || row.status === "fulfilled") return false;
      } else {
        const hours = SLA_HOURS[filters.sla];
        // Unknown SLA key: never let the row bypass the filter.
        if (hours === undefined) return false;
        if (diffMs < 0 || diffMs > hours * 3600000) return false;
      }
    }
    return true;
  });
}

function activeFilterEntries(filters: PromiseFilterState) {
  const entries: { key: keyof PromiseFilterState; label: string }[] = [];
  if (filters.search) entries.push({ key: "search", label: `“${filters.search}”` });
  if (filters.status !== "all") entries.push({ key: "status", label: `Status: ${filters.status}` });
  if (filters.priority !== "all")
    entries.push({ key: "priority", label: `Priority: ${filters.priority}` });
  if (filters.category !== "all")
    entries.push({ key: "category", label: `Category: ${filters.category}` });
  if (filters.owner !== "all") entries.push({ key: "owner", label: `Owner: ${filters.owner}` });
  if (filters.receiver !== "all")
    entries.push({ key: "receiver", label: `Receiver: ${filters.receiver}` });
  if (filters.escalation !== "all")
    entries.push({ key: "escalation", label: `Escalation: ${filters.escalation}` });
  if (filters.locked !== "all")
    entries.push({ key: "locked", label: filters.locked === "true" ? "Locked" : "Unlocked" });
  if (filters.sla !== "all") {
    const window = SLA_WINDOWS.find((entry) => entry.value === filters.sla);
    entries.push({ key: "sla", label: window?.label ?? filters.sla });
  }
  return entries;
}

export function PromiseFilterBar({
  promises,
  filters,
  onChange,
  onReset,
  resultCount,
  actions,
}: {
  promises: PromiseWithCategory[];
  filters: PromiseFilterState;
  onChange: (patch: Partial<PromiseFilterState>) => void;
  onReset: () => void;
  resultCount: number;
  actions?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const wasExpanded = useRef(false);

  // Focus management: move focus into the panel on open, restore it on close.
  useEffect(() => {
    if (expanded) {
      panelRef.current
        ?.querySelector<HTMLElement>("button, [tabindex]:not([tabindex='-1'])")
        ?.focus();
    } else if (wasExpanded.current) {
      toggleRef.current?.focus();
    }
    wasExpanded.current = expanded;
  }, [expanded]);

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    promises.forEach((row) => {
      if (row.promise_categories)
        map.set(row.promise_categories.slug, row.promise_categories.label);
    });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [promises]);

  const owners = useMemo(
    () => [...new Set(promises.map((row) => row.owner))].sort((a, b) => a.localeCompare(b)),
    [promises],
  );
  const receivers = useMemo(
    () => [...new Set(promises.map((row) => row.receiver))].sort((a, b) => a.localeCompare(b)),
    [promises],
  );

  const chips = activeFilterEntries(filters);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(event) => onChange({ search: event.target.value })}
            placeholder="Search code, title, description, owner, receiver, module"
            className="pl-9"
            aria-label="Search promises"
          />
        </div>

        <Select value={filters.status} onValueChange={(value) => onChange({ status: value })}>
          <SelectTrigger className="w-36" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {PROMISE_STATUSES.map((entry) => (
              <SelectItem key={entry} value={entry} className="capitalize">
                {entry}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.category} onValueChange={(value) => onChange({ category: value })}>
          <SelectTrigger className="w-44" aria-label="Filter by category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map(([slug, label]) => (
              <SelectItem key={slug} value={slug}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.sla} onValueChange={(value) => onChange({ sla: value })}>
          <SelectTrigger className="w-44" aria-label="Filter by SLA window">
            <SelectValue placeholder="SLA window" />
          </SelectTrigger>
          <SelectContent>
            {SLA_WINDOWS.map((entry) => (
              <SelectItem key={entry.value} value={entry.value}>
                {entry.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={expanded ? "secondary" : "outline"}
          ref={toggleRef}
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((value) => !value)}
        >
          <Filter className="size-4" />
          More filters
        </Button>

        {actions}
      </div>

      {expanded ? (
        <div
          id={panelId}
          ref={panelRef}
          role="group"
          aria-label="Additional promise filters"
          className="glass-panel grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <Select value={filters.owner} onValueChange={(value) => onChange({ owner: value })}>
            <SelectTrigger aria-label="Filter by owner">
              <SelectValue placeholder="Owner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All owners</SelectItem>
              {owners.map((owner) => (
                <SelectItem key={owner} value={owner}>
                  {owner}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.receiver} onValueChange={(value) => onChange({ receiver: value })}>
            <SelectTrigger aria-label="Filter by receiver">
              <SelectValue placeholder="Receiver" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All receivers</SelectItem>
              {receivers.map((receiver) => (
                <SelectItem key={receiver} value={receiver}>
                  {receiver}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.priority} onValueChange={(value) => onChange({ priority: value })}>
            <SelectTrigger aria-label="Filter by priority">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {PROMISE_PRIORITIES.map((entry) => (
                <SelectItem key={entry} value={entry} className="capitalize">
                  {entry}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.escalation}
            onValueChange={(value) => onChange({ escalation: value })}
          >
            <SelectTrigger aria-label="Filter by escalation level">
              <SelectValue placeholder="Escalation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any escalation</SelectItem>
              <SelectItem value="none">Not escalated</SelectItem>
              <SelectItem value="1">Level 1 · Reminder</SelectItem>
              <SelectItem value="2">Level 2 · Manager</SelectItem>
              <SelectItem value="3">Level 3 · Admin</SelectItem>
              <SelectItem value="4">Level 4 · Legal</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.locked} onValueChange={(value) => onChange({ locked: value })}>
            <SelectTrigger aria-label="Filter by lock state">
              <SelectValue placeholder="Lock state" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Locked & unlocked</SelectItem>
              <SelectItem value="true">Locked only</SelectItem>
              <SelectItem value="false">Unlocked only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          {resultCount} of {promises.length} promises
        </span>
        {chips.map((chip) => (
          <Badge key={chip.key} variant="outline" className="gap-1 font-normal">
            {chip.label}
            <button
              type="button"
              onClick={() => onChange({ [chip.key]: EMPTY_FILTERS[chip.key] })}
              aria-label={`Clear ${chip.key} filter`}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        {chips.length > 0 ? (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onReset}>
            Clear all
          </Button>
        ) : null}
      </div>
    </div>
  );
}
