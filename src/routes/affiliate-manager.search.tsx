import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useMemo, useEffect, useRef } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  Search, SlidersHorizontal, X, ArrowRight, LayoutGrid, Filter as FilterIcon,
  ChevronLeft, ChevronRight, Loader2, Database,
} from "lucide-react";
import { PageHeader } from "@/components/affiliate/PageHeader";
import { WallShell } from "@/components/affiliate/WallShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/affiliate/EmptyState";
import { Highlighted } from "@/components/affiliate/Highlighted";
import {
  runSearch, SEARCH_KINDS, SEARCH_GROUPS, type SearchEntityKind, type SearchGroup,
} from "@/lib/affiliate-search";
import { AFFILIATE_NAV } from "@/lib/affiliate-nav";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/lib/affiliate-permissions";

const PAGE_SIZE = 25;

// Entity types that live in the database and go through the indexed RPC.
const DB_ENTITY_TYPES = ["affiliate", "campaign", "link", "code", "customer"] as const;
type DbEntityType = (typeof DB_ENTITY_TYPES)[number];

type DbHit = {
  entity_type: DbEntityType;
  entity_id: string;
  title: string;
  subtitle: string | null;
  status: string | null;
  route: string;
  score: number;
  total_count: number;
};

const searchSchema = z.object({
  q: z.string().default(""),
  kind: z.array(z.string()).default([]),
  group: z.array(z.string()).default([]),
  wall: z.string().default(""),
  page: z.number().int().min(1).default(1),
  scope: z.enum(["all", "db", "registry"]).default("all"),
});

type SearchValues = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/affiliate-manager/search")({
  head: () => ({ meta: [{ title: "Universal Search — Affiliate Manager" }] }),
  component: UniversalSearchWall,
});

function UniversalSearchWall() {
  const rawSearch = Route.useSearch();
  const searchValues = useMemo(() => {
    const parsed = searchSchema.safeParse(rawSearch);
    return parsed.success ? parsed.data : searchSchema.parse({});
  }, [rawSearch]);

  const { q, kind, group, wall, page, scope } = searchValues;
  const navigate = useNavigate({ from: "/affiliate-manager/search" });
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: perms } = usePermissions();

  useEffect(() => { inputRef.current?.focus(); }, []);

  const kinds = kind as SearchEntityKind[];
  const groups = group as SearchGroup[];

  // Registry (walls/actions/filters) — instant client-side match.
  const registry = useMemo(
    () =>
      scope === "db"
        ? []
        : runSearch({ q, kinds, groups, wall: wall || undefined }, 500),
    [q, kinds, groups, wall, scope],
  );

  // Server-side indexed DB search — paginated, only when a query is present
  // and the caller is authenticated (RPC requires boss role).
  const dbEntityFilter = useMemo(() => {
    const requested = kinds
      .map((k) => k.toLowerCase())
      .filter((k): k is DbEntityType => (DB_ENTITY_TYPES as readonly string[]).includes(k));
    return requested.length ? requested : null;
  }, [kinds]);

  const dbEnabled = !!perms?.is_boss && q.trim().length > 0 && scope !== "registry";

  const dbQuery = useQuery({
    queryKey: ["affiliate", "universal-search", q, dbEntityFilter, page],
    enabled: dbEnabled,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("universal_search", {
        _q: q,
        _entity_types: dbEntityFilter ?? undefined,
        _limit: PAGE_SIZE,
        _offset: (page - 1) * PAGE_SIZE,
      });
      if (error) throw error;
      return (data ?? []) as DbHit[];
    },
  });

  const dbTotal = dbQuery.data?.[0]?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(Number(dbTotal) / PAGE_SIZE));

  const registryByWall = useMemo(() => {
    const map = new Map<string, typeof registry>();
    for (const r of registry) {
      const arr = map.get(r.wall) ?? [];
      arr.push(r);
      map.set(r.wall, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [registry]);

  const setSearch = (patch: Partial<SearchValues>) =>
    navigate({ search: (prev: SearchValues) => ({ ...prev, ...patch }) });

  const toggle = (key: "kind" | "group", value: string) => {
    const current: string[] = key === "kind" ? kind : group;
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    setSearch({ [key]: next, page: 1 } as Partial<z.infer<typeof searchSchema>>);
  };

  const totalsByKind = useMemo(() => {
    const counts: Partial<Record<SearchEntityKind, number>> = {};
    for (const r of registry) counts[r.kind] = (counts[r.kind] ?? 0) + 1;
    return counts;
  }, [registry]);

  const activeFilters = kind.length + group.length + (wall ? 1 : 0);
  const showEmpty = registry.length === 0 && (dbQuery.data?.length ?? 0) === 0 && !dbQuery.isLoading;

  return (
    <>
      <PageHeader
        title="Universal Search"
        description="Server-indexed search across affiliates, campaigns, links, codes and customers — built for 1M+ records."
        crumbs={[{ label: "Affiliate Manager" }, { label: "Universal Search" }]}
        actions={
          activeFilters > 0 ? (
            <Button variant="outline" size="sm" onClick={() => setSearch({ kind: [], group: [], wall: "", page: 1 })}>
              <X className="size-4" /> Clear filters ({activeFilters})
            </Button>
          ) : null
        }
      />

      <WallShell>
        <div className="rounded-2xl border border-border bg-card">
          <div className="flex items-center gap-2 p-3">
            <Search className="size-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={q}
              onChange={(e) => setSearch({ q: e.target.value, page: 1 })}
              placeholder="Search affiliates, campaigns, links, codes, customers…"
              className="h-10 border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
            />
            {dbQuery.isFetching && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            {q && (
              <Button variant="ghost" size="icon" className="size-8" onClick={() => setSearch({ q: "", page: 1 })} aria-label="Clear query">
                <X className="size-4" />
              </Button>
            )}
          </div>

          <div className="border-t border-border p-3">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                <Database className="size-3.5" /> Scope
              </span>
              {(["all", "db", "registry"] as const).map((s) => (
                <Chip key={s} active={scope === s} onClick={() => setSearch({ scope: s, page: 1 })}>
                  {s === "all" ? "Everything" : s === "db" ? "Live records" : "Navigation"}
                </Chip>
              ))}
            </div>
            <FilterSection
              icon={<SlidersHorizontal className="size-3.5" />}
              label="Entity type"
              counts={totalsByKind}
              options={SEARCH_KINDS}
              selected={kind}
              onToggle={(v) => toggle("kind", v)}
            />
            <FilterSection
              className="mt-2"
              icon={<LayoutGrid className="size-3.5" />}
              label="Workspace group"
              options={SEARCH_GROUPS as readonly string[]}
              selected={group}
              onToggle={(v) => toggle("group", v)}
              labelize={(v) => v[0].toUpperCase() + v.slice(1)}
            />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                <FilterIcon className="size-3.5" /> Wall
              </span>
              <Chip active={!wall} onClick={() => setSearch({ wall: "", page: 1 })}>All walls</Chip>
              {AFFILIATE_NAV.map((n) => (
                <Chip key={n.to} active={wall === n.to} onClick={() => setSearch({ wall: n.to, page: 1 })}>
                  {n.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">{registry.length}</span> navigation
              {" · "}
              <span className="font-semibold text-foreground">{Number(dbTotal).toLocaleString()}</span> live records
              {q && <> for &ldquo;<span className="text-foreground">{q}</span>&rdquo;</>}
            </span>
            <span className="hidden md:inline">Indexed via trigram · paginated {PAGE_SIZE}/page</span>
          </div>
        </div>

        {dbQuery.error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            Live search failed: {(dbQuery.error as Error).message}
          </div>
        )}

        {!perms?.authenticated && q && (
          <div className="rounded-2xl border border-border bg-card p-3 text-sm text-muted-foreground">
            Sign in to search live affiliate, campaign, link, code, and customer records.
          </div>
        )}

        {dbEnabled && (dbQuery.data?.length ?? 0) > 0 && (
          <section className="rounded-2xl border border-border bg-card">
            <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-sm font-semibold">Live records</h3>
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {Number(dbTotal).toLocaleString()}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Page {page} of {totalPages}</span>
                <Button variant="outline" size="icon" className="size-7" disabled={page <= 1} onClick={() => setSearch({ page: page - 1 })}>
                  <ChevronLeft className="size-3.5" />
                </Button>
                <Button variant="outline" size="icon" className="size-7" disabled={page >= totalPages} onClick={() => setSearch({ page: page + 1 })}>
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </header>
            <ul className="divide-y divide-border">
              {(dbQuery.data ?? []).map((r) => (
                <li key={`${r.entity_type}:${r.entity_id}`}>
                  <Link to={r.route} className="flex items-start justify-between gap-3 px-4 py-2.5 hover:bg-muted/50">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <KindPill kind={capitalize(r.entity_type) as SearchEntityKind} />
                        <span className="truncate text-sm font-medium">
                          <Highlighted text={r.title || "(untitled)"} q={q} />
                        </span>
                        {r.status && (
                          <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                            {r.status}
                          </span>
                        )}
                      </div>
                      {r.subtitle && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          <Highlighted text={r.subtitle} q={q} />
                        </p>
                      )}
                    </div>
                    <span className="hidden shrink-0 items-center gap-1 text-[11px] text-muted-foreground sm:flex">
                      score {r.score?.toFixed(2)}
                      <ArrowRight className="size-3" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {registryByWall.length > 0 && scope !== "db" && (
          <div className="space-y-4">
            {registryByWall.map(([wallLabel, items]) => (
              <section key={wallLabel} className="rounded-2xl border border-border bg-card">
                <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-sm font-semibold">{wallLabel}</h3>
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{items.length}</Badge>
                  </div>
                  <Link to={items[0].to} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    Open wall <ArrowRight className="size-3" />
                  </Link>
                </header>
                <ul className="divide-y divide-border">
                  {items.slice(0, 12).map((r) => (
                    <li key={r.id}>
                      <Link to={r.to} className="flex items-start justify-between gap-3 px-4 py-2.5 hover:bg-muted/50">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <KindPill kind={r.kind} />
                            <span className="truncate text-sm font-medium">
                              <Highlighted text={r.title} q={q} />
                            </span>
                          </div>
                          {r.subtitle && (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              <Highlighted text={r.subtitle} q={q} />
                            </p>
                          )}
                        </div>
                        <span className="hidden shrink-0 items-center gap-1 text-[11px] text-muted-foreground sm:flex">
                          matched in {r.matchedIn}
                          <ArrowRight className="size-3" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        {showEmpty && (
          <div className="rounded-2xl border border-border bg-card">
            <EmptyState
              icon={Search}
              title={q ? `No matches for "${q}"` : "Start typing to search"}
              description={
                q
                  ? "Try fewer words, different keywords, or clear the active filters."
                  : "Universal Search covers navigation, actions and every affiliate, campaign, link, code and customer in the database."
              }
            />
          </div>
        )}
      </WallShell>
    </>
  );
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

function FilterSection({
  label, icon, options, selected, onToggle, counts, labelize, className,
}: {
  label: string;
  icon: React.ReactNode;
  options: readonly string[];
  selected: string[];
  onToggle: (v: string) => void;
  counts?: Partial<Record<string, number>>;
  labelize?: (v: string) => string;
  className?: string;
}) {
  return (
    <div className={["flex flex-wrap items-center gap-1.5", className].filter(Boolean).join(" ")}>
      <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </span>
      {options.map((opt) => {
        const c = counts?.[opt];
        return (
          <Chip key={opt} active={selected.includes(opt)} onClick={() => onToggle(opt)}>
            {labelize ? labelize(opt) : opt}
            {typeof c === "number" && <span className="ml-1 text-[10px] opacity-70">{c}</span>}
          </Chip>
        );
      })}
    </div>
  );
}

function Chip({
  children, active, onClick,
}: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-surface text-foreground hover:bg-muted",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function KindPill({ kind }: { kind: SearchEntityKind }) {
  return (
    <span className="inline-flex h-5 items-center rounded-sm border border-border bg-muted px-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      {kind}
    </span>
  );
}
