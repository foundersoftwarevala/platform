import { useMemo, useState } from "react";
import {
  Globe2,
  DollarSign,
  Sparkles,
  LogIn,
  UserCircle,
  Bell,
  Heart,
  CalendarDays,
  Calculator,
  LayoutGrid,
  UserPlus,
  GripVertical,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Smartphone,
  Tablet,
  Monitor,
  PinIcon,
  AlertTriangle,
  Star,
  Search,
  Settings2,
  X,
  Type,
  Megaphone,
  Info,
  Download,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader, PillButton, StatCard, Card, EmptyHint } from "../ui";
import {
  listTopBarModules,
  configureTopBarModule,
  reorderTopBarModules,
  setTopBarItems,
  type TopBarItem,
  type TopBarModule,
} from "@/lib/marketplace-manager/topbar.functions";

/**
 * Storefront Top Bar Manager — the modules the header actually renders.
 *
 * This screen used to list twenty-five modules from a static array under the
 * hardcoded label "Top Bar Manager · 25 modules". Reading TopUtilityBar.tsx
 * settles the real number: it composes ten — ApplyNow, LanguagePicker,
 * CalendarTool, CalculatorTool, LoginPill, CurrencyPicker, Notifications,
 * Favorites, AiChat and DashboardsMenu.
 *
 * Everything below comes from marketplace_topbar_modules, which TopUtilityBar
 * itself reads, so hiding or reordering here changes the storefront.
 *
 * A second scan of the real header added the rest of the inventory. The header
 * also renders a logo, a wordmark and tagline, an offer ticker and a sticky
 * category-and-search strip, and none of those had a row here at all. They do
 * now — but registering something is not the same as controlling it, and the
 * screen draws that line rather than blurring it:
 *
 *   ON THE STOREFRONT   visible on the page right now
 *   NOT ON THE PAGE     a row describing something the header does not have
 *
 * with the owning manager named beside it, and, where this manager cannot yet
 * control it, exactly what is missing. The four navigation menus and Register
 * fall in the second group: the header has a logo, a name and the utility
 * strip, and no navigation bar for a menu to hang from.
 *
 * The database refuses to make a module live while nothing in the header
 * renders it, and says why, so nothing here can be switched on and quietly do
 * nothing.
 */

const KEY = ["marketplace", "topbar"] as const;

const ICONS: Record<string, typeof Globe2> = {
  "apply-now": UserPlus,
  language: Globe2,
  calendar: CalendarDays,
  calculator: Calculator,
  login: LogIn,
  currency: DollarSign,
  notifications: Bell,
  favorites: Heart,
  "ai-chat": Sparkles,
  dashboards: LayoutGrid,
  logo: UserCircle,
  "brand-name": Type,
  "announcement-bar": Megaphone,
  "sticky-filter-bar": Search,
};

const STATUS_TONE: Record<string, string> = {
  live: "text-success border-success/40 bg-success/10",
  draft: "text-warning border-warning/40 bg-warning/10",
  hidden: "text-muted-foreground border-border bg-white/[0.04]",
  archived: "text-muted-foreground border-border bg-white/[0.04]",
};

const STATUSES = ["live", "draft", "hidden", "archived"] as const;
type Status = (typeof STATUSES)[number];

const SORTS = [
  { key: "position", label: "Position" },
  { key: "name", label: "Name" },
  { key: "updated", label: "Updated" },
  { key: "status", label: "Status" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

/**
 * What the registry says about one module's place on the storefront.
 *
 * Two different facts, kept apart because conflating them is what made the old
 * screen misleading. `rendered` comes from the registry and means a component
 * in the header reads this row, so changing it here changes the page.
 * `onStorefront` comes from the homepage scan and means the element is visible
 * to a visitor right now — which can be true of something this manager does
 * not control, like the offer ticker Marketing owns.
 */
function readPlacement(m: TopBarModule) {
  const c = (m.config ?? {}) as Record<string, unknown>;
  return {
    rendered: m.rendered === true,
    onStorefront: c.on_storefront === true,
    knownPlacement: typeof c.on_storefront === "boolean",
    controlledBy: typeof c.controlled_by === "string" ? c.controlled_by : "",
    needs: m.blocked_reason ?? "",
    source: typeof c.source === "string" ? c.source : "",
    // Only two modules carry a menu: Apply Now and Dashboards. A route pattern
    // is what marks one, because an item key is only meaningful against the
    // route it is substituted into.
    routePattern: typeof c.route_pattern === "string" ? c.route_pattern : "",
    items: Array.isArray(c.items) ? (c.items as TopBarItem[]) : [],
  };
}

/**
 * Download the registry as the database returned it.
 *
 * Exactly the rows on screen, with the filter that produced them recorded
 * alongside, so a file nobody can place later still says what it is. There is
 * no import beside this on purpose: bringing a file back in would overwrite
 * the registry the storefront reads, and a half-validated import is a worse
 * failure than no import at all. Changes are made through Configure, which
 * goes through mm_topbar_configure and is audited.
 */
function exportRegistry(rows: TopBarModule[], total: number) {
  const payload = {
    exported_at: new Date().toISOString(),
    source: "marketplace_topbar_modules, via mm_topbar_modules",
    modules_in_registry: total,
    modules_exported: rows.length,
    modules: rows,
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `top-bar-registry-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${rows.length} module${rows.length === 1 ? "" : "s"}`);
}

export function TopBarManagerSection() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("All");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | Status>("");
  const [placement, setPlacement] = useState<"" | "on" | "off">("");
  const [sort, setSort] = useState<SortKey>("position");
  const [configuring, setConfiguring] = useState<TopBarModule | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: KEY,
    queryFn: () => listTopBarModules(),
    staleTime: 20_000,
  });

  const done = (msg: string) => {
    void qc.invalidateQueries({ queryKey: KEY });
    toast.success(msg);
  };
  const fail = (e: Error) => toast.error("That change was refused", { description: e.message });

  const configure = useMutation({
    mutationFn: (v: { key: string; patch: Record<string, unknown> }) =>
      configureTopBarModule({ data: v as never }),
    onSuccess: (r) => done(String(r.message ?? "Updated")),
    onError: fail,
  });
  const reorder = useMutation({
    mutationFn: (keys: string[]) => reorderTopBarModules({ data: { keys } }),
    onSuccess: () => done("Top bar reordered"),
    onError: fail,
  });

  const modules = useMemo(() => data?.modules ?? [], [data]);
  const groups = useMemo(
    () => ["All", ...Array.from(new Set(modules.map((m) => m.category)))],
    [modules],
  );

  // Search, filter and sort all run over the real records, never over a page
  // of them: the whole registry is in hand, so none of this is capped.
  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = modules.filter((m) => {
      if (tab !== "All" && m.category !== tab) return false;
      if (statusFilter && m.status !== statusFilter) return false;
      if (placement) {
        const { onStorefront, knownPlacement } = readPlacement(m);
        if (placement === "on" && !onStorefront) return false;
        if (placement === "off" && (onStorefront || !knownPlacement)) return false;
      }
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.module_key.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        m.status.toLowerCase().includes(q)
      );
    });
    const sorted = [...filtered];
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "status") sorted.sort((a, b) => a.status.localeCompare(b.status));
    else if (sort === "updated")
      sorted.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    else sorted.sort((a, b) => a.sort_order - b.sort_order);
    return sorted;
  }, [modules, tab, search, statusFilter, placement, sort]);

  // Counted, never declared.
  const live = modules.filter((m) => m.status === "live").length;
  const draft = modules.filter((m) => m.status === "draft").length;
  const hidden = modules.filter((m) => m.status === "hidden").length;
  const onPage = modules.filter((m) => readPlacement(m).onStorefront).length;

  /**
   * Reordering is a property of the whole bar, so it is only offered when the
   * list on screen is the whole bar in its own order. Nudging one row inside a
   * filtered or re-sorted view would write an order derived from a view, which
   * is how orders quietly become wrong.
   */
  const orderable =
    tab === "All" && !search.trim() && !statusFilter && !placement && sort === "position";

  const nudge = (key: string, dir: -1 | 1) => {
    const all = [...modules].sort((a, b) => a.sort_order - b.sort_order);
    const i = all.findIndex((m) => m.module_key === key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= all.length) return;
    [all[i], all[j]] = [all[j], all[i]];
    reorder.mutate(all.map((m) => m.module_key));
  };

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow={
          isLoading
            ? "Storefront top bar"
            : `Storefront top bar · ${modules.length} module${modules.length === 1 ? "" : "s"}`
        }
        title="Storefront Top Bar Manager"
        description="Every element of the storefront header. Hiding, reordering or changing the device rules of a module the utility strip renders changes the storefront; a module marked NOT ON THE PAGE says what is missing before it could."
      />

      {isError && (
        <Card>
          <div className="flex items-start gap-3 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
            <div>
              <div className="font-medium text-destructive">Could not load the top bar modules</div>
              <div className="text-muted-foreground">{(error as Error)?.message}</div>
            </div>
          </div>
        </Card>
      )}

      <div className="mb-6 mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Modules" value={isLoading ? "—" : String(modules.length)} />
        <StatCard label="Live" value={isLoading ? "—" : String(live)} tone="success" />
        <StatCard label="Draft" value={isLoading ? "—" : String(draft)} tone="warning" />
        <StatCard
          label="On the storefront"
          value={isLoading ? "—" : String(onPage)}
          tone="premium"
        />
      </div>

      {!isLoading && hidden > 0 && (
        <div className="mb-3 text-[11px] text-muted-foreground">
          {hidden} module{hidden === 1 ? " is" : "s are"} hidden and not rendered.
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-1.5">
        {groups.map((g) => (
          <button
            key={g}
            onClick={() => setTab(g)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              tab === g
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, key, category or status"
            className="w-full rounded-lg border border-border bg-background/60 py-1.5 pl-8 pr-3 text-[12px] focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "" | Status)}
          className="rounded-lg border border-border bg-background/60 px-2 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">Any status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={placement}
          onChange={(e) => setPlacement(e.target.value as "" | "on" | "off")}
          className="rounded-lg border border-border bg-background/60 px-2 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">Anywhere</option>
          <option value="on">On the storefront</option>
          <option value="off">Not on the page</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-lg border border-border bg-background/60 px-2 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-accent"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              Sort · {s.label}
            </option>
          ))}
        </select>
        {(search || statusFilter || placement || sort !== "position" || tab !== "All") && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStatusFilter("");
              setPlacement("");
              setSort("position");
              setTab("All");
            }}
            className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
        {modules.length > 0 && (
          <button
            type="button"
            onClick={() => exportRegistry(list, modules.length)}
            title="Download the rows shown, exactly as the registry returned them"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        )}
      </div>

      {isLoading && <EmptyHint text="Reading the top bar registry…" />}
      {!isLoading && list.length === 0 && <EmptyHint text="No module matches these filters." />}

      <div className="space-y-2">
        {list.map((m: TopBarModule, i) => {
          const Icon = ICONS[m.module_key] ?? LayoutGrid;
          const { rendered, onStorefront, knownPlacement, controlledBy, needs } = readPlacement(m);
          return (
            <Card key={m.module_key}>
              <div className="flex flex-wrap items-center gap-3 p-3">
                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex flex-col">
                  <button
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    onClick={() => nudge(m.module_key, -1)}
                    disabled={!orderable || i === 0 || reorder.isPending}
                    aria-label={`Move ${m.name} up`}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    onClick={() => nudge(m.module_key, 1)}
                    disabled={!orderable || i === list.length - 1 || reorder.isPending}
                    aria-label={`Move ${m.name} down`}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>

                <Icon className="h-4 w-4 shrink-0 text-accent" />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{m.name}</span>
                    <code className="rounded bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {m.module_key}
                    </code>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${STATUS_TONE[m.status]}`}
                    >
                      {m.status}
                    </span>
                    {knownPlacement && (
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${
                          rendered
                            ? "border-success/40 bg-success/10 text-success"
                            : onStorefront
                              ? "border-warning/40 bg-warning/10 text-warning"
                              : "border-border bg-white/[0.04] text-muted-foreground"
                        }`}
                        title={
                          rendered
                            ? "The header reads this row, so changing it changes the storefront."
                            : onStorefront
                              ? "Visible on the storefront, but this manager does not control it yet."
                              : "The header has no such element."
                        }
                      >
                        {rendered
                          ? "Controls the page"
                          : onStorefront
                            ? "On the storefront"
                            : "Not on the page"}
                      </span>
                    )}
                    {m.featured && <Star className="h-3 w-3 shrink-0 fill-warning text-warning" />}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {m.component ? `${m.component} · ` : ""}
                    {m.description}
                  </div>
                  {needs && (
                    <div className="mt-1 flex items-start gap-1.5 text-[11px] text-warning">
                      <Info className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>
                        Needs {needs}
                        {controlledBy && controlledBy !== "Top Bar Manager"
                          ? ` · controlled by ${controlledBy}`
                          : ""}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <PillButton
                    onClick={() =>
                      configure.mutate({
                        key: m.module_key,
                        patch: { status: m.status === "live" ? "hidden" : "live" },
                      })
                    }
                  >
                    {m.status === "live" ? (
                      <Eye className="h-3.5 w-3.5" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5" />
                    )}
                    {m.status === "live" ? "Visible" : "Hidden"}
                  </PillButton>
                  <PillButton
                    onClick={() =>
                      configure.mutate({
                        key: m.module_key,
                        patch: { desktop_enabled: !m.desktop_enabled },
                      })
                    }
                  >
                    <Monitor className="h-3.5 w-3.5" /> {m.desktop_enabled ? "on" : "off"}
                  </PillButton>
                  <PillButton
                    onClick={() =>
                      configure.mutate({
                        key: m.module_key,
                        patch: { tablet_enabled: !m.tablet_enabled },
                      })
                    }
                  >
                    <Tablet className="h-3.5 w-3.5" /> {m.tablet_enabled ? "on" : "off"}
                  </PillButton>
                  <PillButton
                    onClick={() =>
                      configure.mutate({
                        key: m.module_key,
                        patch: { mobile_enabled: !m.mobile_enabled },
                      })
                    }
                  >
                    <Smartphone className="h-3.5 w-3.5" /> {m.mobile_enabled ? "on" : "off"}
                  </PillButton>
                  <PillButton
                    onClick={() =>
                      configure.mutate({
                        key: m.module_key,
                        patch: { featured: !m.featured },
                      })
                    }
                  >
                    <PinIcon className="h-3.5 w-3.5" /> {m.featured ? "Featured" : "Feature"}
                  </PillButton>
                  <PillButton onClick={() => setConfiguring(m)}>
                    <Settings2 className="h-3.5 w-3.5" /> Configure
                  </PillButton>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {!orderable && list.length > 1 && (
        <div className="mt-3 text-[11px] text-muted-foreground">
          Reordering is available on the All tab with no search, no filter and the Position sort,
          because order is a property of the whole bar.
        </div>
      )}

      {configuring && (
        <ConfigureDrawer
          module={configuring}
          saving={configure.isPending}
          onClose={() => setConfiguring(null)}
          onSave={(patch) =>
            configure.mutate(
              { key: configuring.module_key, patch },
              { onSuccess: () => setConfiguring(null) },
            )
          }
        />
      )}
    </div>
  );
}

/**
 * The per-module configuration panel.
 *
 * Every field here is a column mm_topbar_configure already accepts, so nothing
 * new had to be opened up in the database to make this real. Status offers all
 * four states rather than the visible/hidden flip the row buttons do; the
 * database still refuses `live` for a module nothing renders, and the refusal
 * arrives as the toast rather than as a silent no-op.
 */
/**
 * The items of a header dropdown.
 *
 * Apply Now and Dashboards are the only menus the header has. Their entries
 * were arrays inside TopUtilityBar.tsx, so adding a role meant editing the
 * storefront; they are rows in the registry now and this edits them.
 *
 * It saves through its own server function rather than the patch the rest of
 * the drawer uses, because the database validates a menu differently — a key
 * and a label on every item, no repeated keys, a cap on the length — and those
 * refusals come back with their own message. Nothing here re-implements that
 * check to guess at the answer; the button is disabled only for the two cases
 * a reader can see for themselves.
 */
function MenuEditor({
  module: m,
  pattern,
  initial,
}: {
  module: TopBarModule;
  pattern: string;
  initial: TopBarItem[];
}) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<TopBarItem[]>(initial);

  const save = useMutation({
    mutationFn: (items: TopBarItem[]) =>
      setTopBarItems({ data: { key: m.module_key, items } as never }),
    onSuccess: (r) => {
      toast.success(String(r.message ?? "Menu saved"));
      void qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e: Error) => toast.error("That menu was refused", { description: e.message }),
  });

  const set = (i: number, patch: Partial<TopBarItem>) =>
    setRows((r) => r.map((row, n) => (n === i ? { ...row, ...patch } : row)));
  const move = (i: number, dir: -1 | 1) =>
    setRows((r) => {
      const j = i + dir;
      if (j < 0 || j >= r.length) return r;
      const out = [...r];
      [out[i], out[j]] = [out[j], out[i]];
      return out;
    });

  const blank = rows.some((r) => !r.key.trim() || !r.label.trim());
  const keys = rows.map((r) => r.key.trim());
  const repeated = keys.filter((k) => k).length !== new Set(keys.filter((k) => k)).size;

  return (
    <div className="space-y-2 rounded-lg border border-border bg-background/40 p-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Menu items
        </div>
        <code className="text-[10px] text-muted-foreground">{pattern}</code>
      </div>
      <div className="text-[10px] text-muted-foreground">
        The header renders these, in this order. Each key is substituted into the route above, so it
        has to be one that route accepts.
      </div>

      {rows.map((r, i) => (
        <div key={i} className="space-y-1 rounded-lg border border-border bg-background/60 p-2">
          <div className="flex items-center gap-1.5">
            <input
              value={r.key}
              onChange={(e) => set(i, { key: e.target.value })}
              placeholder="key"
              className="w-28 shrink-0 rounded border border-border bg-background/60 px-2 py-1 font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <input
              value={r.label}
              onChange={(e) => set(i, { label: e.target.value })}
              placeholder="label"
              className="min-w-0 flex-1 rounded border border-border bg-background/60 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <button
              type="button"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              aria-label="Move up"
              className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === rows.length - 1}
              aria-label="Move down"
              className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setRows((rs) => rs.filter((_, n) => n !== i))}
              aria-label="Remove item"
              className="rounded p-0.5 text-muted-foreground hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <input
            value={r.blurb ?? ""}
            onChange={(e) => set(i, { blurb: e.target.value })}
            placeholder="blurb (optional)"
            className="w-full rounded border border-border bg-background/60 px-2 py-1 text-[11px] text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      ))}

      {rows.length === 0 && (
        <div className="text-[11px] text-muted-foreground">
          This menu is empty. The header falls back to the list compiled into it until an item is
          added here.
        </div>
      )}

      {(blank || repeated) && (
        <div className="text-[10px] text-destructive">
          {blank ? "Every item needs a key and a label. " : ""}
          {repeated ? "Two items share a key." : ""}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setRows((r) => [...r, { key: "", label: "", blurb: "" }])}
          disabled={rows.length >= 40}
          className="rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          Add item
        </button>
        <button
          type="button"
          onClick={() =>
            save.mutate(rows.map((r) => ({ ...r, key: r.key.trim(), label: r.label.trim() })))
          }
          disabled={save.isPending || blank || repeated}
          className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-accent disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : "Save menu"}
        </button>
        <span className="text-[10px] text-muted-foreground">{rows.length} / 40</span>
      </div>
    </div>
  );
}

function ConfigureDrawer({
  module: m,
  saving,
  onClose,
  onSave,
}: {
  module: TopBarModule;
  saving: boolean;
  onClose: () => void;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState(m.name);
  const [status, setStatus] = useState<Status>(m.status);
  const [order, setOrder] = useState(String(m.sort_order));
  const [desktop, setDesktop] = useState(m.desktop_enabled);
  const [tablet, setTablet] = useState(m.tablet_enabled);
  const [mobile, setMobile] = useState(m.mobile_enabled);
  const [sticky, setSticky] = useState(m.sticky_enabled);
  const [featured, setFeatured] = useState(m.featured);

  const {
    rendered,
    onStorefront,
    knownPlacement,
    controlledBy,
    needs,
    source,
    routePattern,
    items,
  } = readPlacement(m);
  const orderNum = Number(order);
  const orderValid = Number.isInteger(orderNum) && orderNum >= 1 && orderNum <= 99;

  const save = () => {
    if (!orderValid) return;
    onSave({
      name: name.trim() || m.name,
      status,
      sort_order: orderNum,
      desktop_enabled: desktop,
      tablet_enabled: tablet,
      mobile_enabled: mobile,
      sticky_enabled: sticky,
      featured,
    });
  };

  const Row = ({
    label,
    on,
    set,
    hint,
  }: {
    label: string;
    on: boolean;
    set: (v: boolean) => void;
    hint?: string;
  }) => (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-border bg-background/40 px-3 py-2">
      <span className="min-w-0">
        <span className="block text-[12px] font-semibold">{label}</span>
        {hint && <span className="block text-[10px] text-muted-foreground">{hint}</span>}
      </span>
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => set(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[oklch(0.80_0.13_192)]"
      />
    </label>
  );

  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[460px] flex-col border-l border-border bg-[oklch(0.18_0.035_240)] shadow-[var(--shadow-elegant)]">
        <header className="flex items-start gap-3 border-b border-border p-4">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
              Configure
            </div>
            <div className="truncate text-[15px] font-bold">{m.name}</div>
            <code className="text-[10px] text-muted-foreground">{m.module_key}</code>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:border-destructive/40 hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {knownPlacement && (
            <div
              className={`rounded-lg border p-3 text-[11px] ${
                rendered
                  ? "border-success/40 bg-success/10 text-success"
                  : onStorefront
                    ? "border-warning/40 bg-warning/10 text-warning"
                    : "border-border bg-background/40 text-muted-foreground"
              }`}
            >
              {rendered
                ? "The header reads this row. What you change here changes the storefront."
                : onStorefront
                  ? "This element is on the storefront, but nothing here controls it yet. Changes below are recorded against the row and will not move the page."
                  : "The header does not render this, and nothing here will put it on the page."}
              {controlledBy && <div className="mt-1">Controlled by: {controlledBy}</div>}
              {needs && <div className="mt-1">Needs: {needs}</div>}
              {source && <div className="mt-1">Source: {source}</div>}
            </div>
          )}

          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Name
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-[12px] focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Status
              </div>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
                className="w-full rounded-lg border border-border bg-background/60 px-2 py-2 text-[12px] focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Position
              </div>
              <input
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                inputMode="numeric"
                className={`w-full rounded-lg border bg-background/60 px-3 py-2 text-[12px] focus:outline-none focus:ring-1 ${
                  orderValid
                    ? "border-border focus:ring-accent"
                    : "border-destructive/60 focus:ring-destructive"
                }`}
              />
              {!orderValid && (
                <div className="mt-1 text-[10px] text-destructive">
                  Position is a whole number from 1 to 99.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Row label="Desktop" on={desktop} set={setDesktop} hint="Rendered on wide screens" />
            <Row label="Tablet" on={tablet} set={setTablet} hint="Rendered on medium screens" />
            <Row label="Mobile" on={mobile} set={setMobile} hint="Rendered on small screens" />
            <Row
              label="Sticky"
              on={sticky}
              set={setSticky}
              hint="Stored against the module. The utility strip does not read this yet, so it changes the record and not the page."
            />
            <Row label="Featured" on={featured} set={setFeatured} hint="Pinned for operators" />
          </div>

          {routePattern ? <MenuEditor module={m} pattern={routePattern} initial={items} /> : null}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-border bg-background/40 p-3">
          <button
            onClick={onClose}
            className="rounded-full border border-border bg-background/60 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !orderValid}
            className="rounded-full bg-gradient-to-r from-primary to-accent px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </footer>
      </aside>
    </div>
  );
}

export default TopBarManagerSection;
