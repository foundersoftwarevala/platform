import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Filter, Info } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Card, EmptyHint, PageHeader, StatCard } from "../ui";
import {
  listStorefrontFilters, configureStorefrontFilter, type FilterGroup,
} from "@/lib/marketplace-manager/filters.functions";

/**
 * Storefront filters — the screen that already existed, now connected.
 *
 * It used to list eight groups with their values typed into the file: ten
 * categories, seven industries, four deployments, five price bands. The
 * catalogue holds 91 categories and prices in three ways. That list was a
 * sample, not a configuration, and every Switch on it had no handler.
 *
 * The groups are stored; the values are not. Categories, industries,
 * deployments, licences, tags and price bands are derived from the product and
 * category tables on every read, with a real product count against each, so
 * there is no second taxonomy to drift. The tag values are the same product
 * flags the Product Card Manager's badges read, so a badge and a filter can
 * never disagree about what "Trending" means.
 *
 * One thing this screen says plainly rather than hiding: the public storefront
 * has no faceted filter surface yet. /marketplace renders the homepage, which
 * offers a search box and category rows. So this configuration is real and its
 * values are real, but there is nowhere for it to appear until that surface is
 * built — and a manager should know that before wondering why a toggle changed
 * nothing.
 */

const KEY = ["marketplace", "storefront-filters"] as const;

export function StorefrontFiltersSection() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);

  const filters = useQuery({
    queryKey: KEY,
    queryFn: () => listStorefrontFilters(),
    staleTime: 30_000,
  });

  const configure = useMutation({
    mutationFn: (v: { key: string; patch: Record<string, unknown> }) =>
      configureStorefrontFilter({ data: v }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message || "The change was refused."),
  });

  const data = filters.data;
  const groups = (data?.groups ?? []) as FilterGroup[];
  const totalValues = groups.reduce((n, g) => n + (g.values?.length ?? 0), 0);
  const enabled = groups.filter((g) => g.enabled).length;

  const move = (group: FilterGroup, delta: number) => {
    const target = group.position + delta;
    if (target < 1 || target > groups.length) return;
    const swap = groups.find((g) => g.position === target);
    if (!swap) return;
    configure.mutate({ key: group.key, patch: { position: target } });
    configure.mutate({ key: swap.key, patch: { position: group.position } });
  };

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Filter Manager"
        title="Storefront Filters"
        description="Faceted filters for category, deployment, platform, tags, price, rating & license."
      />

      {data?.ok === false && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
          <span>
            {data.reason === "not_permitted"
              ? "Changing storefront filters needs marketplace operator rights."
              : "The filters could not be read."}
          </span>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Filter groups" value={String(groups.length)} />
        <StatCard label="Enabled" value={String(enabled)} tone="success" />
        <StatCard label="Filter values" value={String(totalValues)} tone="premium" />
        <StatCard label="Disabled" value={String(groups.length - enabled)} />
      </div>

      {/* The honest state of the public side. */}
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
        <span>
          <b>No public filter surface exists yet.</b> /marketplace renders the
          marketplace homepage, which offers a search box and category rows — there is
          no facet panel, and no control calls setActiveCategory. This configuration is
          saved and its values are real, but nothing on the storefront reads it until
          that surface is built. Nothing here is reported as live.
        </span>
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 flex-none" />
        <span>
          Values are not stored here. They are read from the catalogue every time this
          screen loads, with the real number of published products behind each one, so
          the filter list cannot drift away from the products it filters. Tag values
          are the same product flags the Product Card Manager badges use.
        </span>
      </div>

      {filters.isLoading && <EmptyHint text="Reading the filters…" />}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => {
          const open = expanded === g.key;
          const shown = open ? g.values : (g.values ?? []).slice(0, 8);
          return (
            <Card key={g.key}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="inline-flex min-w-0 items-center gap-2">
                  <Filter className="h-4 w-4 flex-none text-accent" />
                  <h3 className="truncate text-sm font-bold">{g.label}</h3>
                  <span className="flex-none rounded-full bg-muted/40 px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                    {g.values?.length ?? 0}
                  </span>
                </div>
                <div className="flex flex-none items-center gap-1">
                  <button
                    title="Move up" aria-label={`Move ${g.label} up`}
                    disabled={g.position === 1 || configure.isPending}
                    onClick={() => move(g, -1)}
                    className="rounded p-0.5 hover:bg-muted disabled:opacity-25"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    title="Move down" aria-label={`Move ${g.label} down`}
                    disabled={g.position === groups.length || configure.isPending}
                    onClick={() => move(g, 1)}
                    className="rounded p-0.5 hover:bg-muted disabled:opacity-25"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button" role="switch" aria-checked={g.enabled}
                    aria-label={g.label}
                    disabled={configure.isPending}
                    onClick={() => configure.mutate({ key: g.key, patch: { enabled: !g.enabled } })}
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                      g.enabled
                        ? "border-accent/50 bg-accent/15 text-accent"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {g.enabled ? "On" : "Off"}
                  </button>
                </div>
              </div>

              <div className="mb-2 flex flex-wrap gap-1.5">
                {(shown ?? []).map((v) => (
                  <span
                    key={v.value}
                    title={`${v.count.toLocaleString()} published products`}
                    className={`rounded-full border px-2 py-0.5 text-[11px] ${
                      v.count === 0
                        ? "border-border/50 text-muted-foreground/50"
                        : "border-border bg-background/40 text-muted-foreground"
                    }`}
                  >
                    {v.label} <span className="opacity-60">{v.count}</span>
                  </span>
                ))}
                {(g.values?.length ?? 0) === 0 && (
                  <EmptyHint text="No value in the catalogue matches this group." />
                )}
              </div>

              {(g.values?.length ?? 0) > 8 && (
                <button
                  onClick={() => setExpanded(open ? null : g.key)}
                  className="text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                >
                  {open ? "Show fewer" : `Show all ${g.values.length}`}
                </button>
              )}

              <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/50 pt-2">
                <button
                  onClick={() => configure.mutate({
                    key: g.key,
                    patch: { select_mode: g.select_mode === "multi" ? "single" : "multi" },
                  })}
                  className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  {g.select_mode === "multi" ? "Multi-select" : "Single-select"}
                </button>
                <button
                  onClick={() => configure.mutate({
                    key: g.key,
                    patch: { combine: g.combine === "or" ? "and" : "or" },
                  })}
                  className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  Combine: {g.combine.toUpperCase()}
                </button>
                <button
                  onClick={() => configure.mutate({
                    key: g.key, patch: { visible_mobile: !g.visible_mobile },
                  })}
                  className={`rounded-full border px-2 py-0.5 text-[10px] ${
                    g.visible_mobile ? "border-accent/40 text-accent" : "border-border text-muted-foreground"
                  }`}
                >
                  Mobile
                </button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default StorefrontFiltersSection;
