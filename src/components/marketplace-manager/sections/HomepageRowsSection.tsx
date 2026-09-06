import { useMemo, useState } from "react";
import {
  ChevronUp, ChevronDown, Eye, EyeOff, PinIcon, Search, Plus, X,
  ArrowLeft, Layers, BarChart3, SlidersHorizontal, ExternalLink, Trash2,
  Monitor, Tablet, Smartphone, AlertTriangle, GripVertical, CheckSquare, Square,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader, PillButton, StatCard, Card, EmptyHint } from "../ui";
import {
  listHomepageRows, getRowProducts, getRowAnalytics, searchRowProducts,
  assignSlot, removeSlot, moveSlot, pinSlot, configureRow, reorderRows,
  createRow, assignSlotsBulk, clearRowSlots, getRowAudit,
  type HomepageRow, type RowSlot,
} from "@/lib/marketplace-manager/rows.functions";

/**
 * Homepage Rows — the real ones.
 *
 * This screen used to render a static ROWS array with Card 1 / Card 2
 * placeholders, `Array.from({ length: 12 })` cards, a hardcoded "Last Edit 2h"
 * and notBuilt() actions. None of it touched the front page, and worse, an
 * earlier attempt of mine wired two of its controls to
 * marketplace_homepage_sections — a table the public homepage has never read.
 *
 * The homepage builds its product rows from marketplace_categories:
 * `is_hidden=eq.false`, ordered by `sort_order`, one row per category, filled
 * by `productsFor(category_id)`. So those categories are the rows, their slug
 * is the stable key, and this screen manages them directly. Ordering and
 * visibility write the very columns the homepage reads; placement writes the
 * slots the homepage now resolves through the same function this screen calls.
 *
 * Every number here is counted and every control writes the database. Where a
 * figure has not been measured yet it says so rather than showing a confident
 * zero.
 */

const KEY = ["marketplace", "rows"] as const;

function useRows() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => listHomepageRows(),
    staleTime: 30_000,
  });
}

function useRowMutations(onDone?: () => void) {
  const qc = useQueryClient();
  const done = (msg: string) => {
    void qc.invalidateQueries({ queryKey: KEY });
    void qc.invalidateQueries({ queryKey: ["marketplace", "row-products"] });
    toast.success(msg);
    onDone?.();
  };
  const fail = (e: Error) =>
    toast.error(e.message.startsWith("Product category mismatch")
      ? "Product category mismatch"
      : "That change was refused", { description: e.message });

  return {
    assign: useMutation({
      mutationFn: (v: { key: string; position: number; productId: string; override?: boolean }) =>
        assignSlot({ data: v }),
      onSuccess: (r) => done(String(r.message ?? "Assigned")), onError: fail,
    }),
    remove: useMutation({
      mutationFn: (v: { key: string; position: number }) => removeSlot({ data: v }),
      onSuccess: (r) => done(String(r.message ?? "Cleared")), onError: fail,
    }),
    move: useMutation({
      mutationFn: (v: { key: string; from: number; to: number }) => moveSlot({ data: v }),
      onSuccess: (r) => done(String(r.message ?? "Moved")), onError: fail,
    }),
    pin: useMutation({
      mutationFn: (v: { key: string; position: number; pinned: boolean }) => pinSlot({ data: v }),
      onSuccess: (r) => done(String(r.message ?? "Updated")), onError: fail,
    }),
    configure: useMutation({
      mutationFn: (v: { key: string; patch: Record<string, unknown> }) => configureRow({ data: v }),
      onSuccess: () => done("Row updated"), onError: fail,
    }),
    reorder: useMutation({
      mutationFn: (keys: string[]) => reorderRows({ data: { keys } }),
      onSuccess: () => done("Row order saved"), onError: fail,
    }),
    create: useMutation({
      mutationFn: (spec: Record<string, unknown>) => createRow({ data: spec as never }),
      onSuccess: (r) => done(String(r.message ?? "Row created")), onError: fail,
    }),
    bulkAssign: useMutation({
      mutationFn: (v: { key: string; productIds: string[]; startAt?: number }) =>
        assignSlotsBulk({ data: v }),
      onSuccess: (r) => done(String(r.message ?? "Placed")), onError: fail,
    }),
    bulkClear: useMutation({
      mutationFn: (v: { key: string; positions: number[] }) => clearRowSlots({ data: v }),
      onSuccess: (r) => done(String(r.message ?? "Cleared")), onError: fail,
    }),
  };
}


/**
 * Create Row — section 9.
 *
 * The database refuses a key any category slug or existing row already uses, so
 * this cannot make a second row with the same name. A new row is created as a
 * draft: creating it should not put anything in front of customers before
 * somebody has looked at it.
 */
function CreateRowDialog({ onClose }: { onClose: () => void }) {
  const m = useRowMutations(onClose);
  const [key, setKey] = useState("");
  const [title, setTitle] = useState("");
  const [rule, setRule] = useState("featured");
  const [maxProducts, setMaxProducts] = useState(60);

  const validKey = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(key);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-16"
         role="dialog" aria-label="Create a homepage row">
      <div className="w-full max-w-lg rounded-xl border border-border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border p-3">
          <div className="text-sm font-medium">Create a homepage row</div>
          <IconBtn title="Close" onClick={onClose}><X className="h-4 w-4" /></IconBtn>
        </div>
        <div className="space-y-3 p-4">
          <Field label="Stable row key" hint="Lowercase slug. Display names can change; this cannot.">
            <input value={key} onChange={(e) => setKey(e.target.value)}
                   placeholder="featured-software"
                   className="h-9 w-full rounded-lg border border-border bg-background/40 px-3 text-sm outline-none focus:border-primary/60" />
          </Field>
          {key && !validKey && (
            <div className="text-[11px] text-destructive">
              Use a lowercase slug such as <code>featured-software</code>.
            </div>
          )}
          <Field label="Display name">
            <input value={title} onChange={(e) => setTitle(e.target.value)}
                   placeholder="Featured Software"
                   className="h-9 w-full rounded-lg border border-border bg-background/40 px-3 text-sm outline-none focus:border-primary/60" />
          </Field>
          <Field label="How it fills">
            <div className="flex flex-wrap gap-1.5">
              {["featured", "trending", "best_selling", "new_release", "newest", "rating"].map((r) => (
                <PillButton key={r} onClick={() => setRule(r)}>
                  {rule === r ? "● " : ""}{r.replace("_", " ")}
                </PillButton>
              ))}
            </div>
          </Field>
          <Field label="Maximum products">
            <input type="number" min={1} max={60} value={maxProducts}
                   onChange={(e) => setMaxProducts(Number(e.target.value))}
                   className="h-9 w-24 rounded-lg border border-border bg-background/40 px-3 text-sm outline-none focus:border-primary/60" />
          </Field>
          <div className="rounded-lg border border-border bg-muted/10 p-2.5 text-[11px] text-muted-foreground">
            The row is created as a draft and will not appear on the homepage until you publish it
            from its Visibility tab.
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <PillButton onClick={onClose}>Cancel</PillButton>
            <PillButton
              variant="primary"
              onClick={() => {
                if (!validKey) return;
                m.create.mutate({
                  key, title: title || undefined, row_kind: "curated",
                  auto_rule: rule, source_mode: "auto", max_products: maxProducts,
                });
              }}
            >
              Create row
            </PillButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium">{label}</span>
      {children}
      {hint && <span className="block text-[10px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

/* ------------------------------------------------------------------ list -- */

export function HomepageRowsSection() {
  const [open, setOpen] = useState<string | null>(null);
  if (open) return <RowWorkspace rowKey={open} onBack={() => setOpen(null)} />;
  return <RowList onOpen={setOpen} />;
}

function RowList({ onOpen }: { onOpen: (key: string) => void }) {
  const { data, isLoading, isError, error } = useRows();
  const m = useRowMutations();
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  // Drag state for reordering rows. Kept here rather than in a library so the
  // reorder writes the same sort_order the homepage reads.
  const [dragKey, setDragKey] = useState<string | null>(null);

  const rows = useMemo(() => {
    const all = data?.rows ?? [];
    const needle = q.trim().toLowerCase();
    return needle
      ? all.filter((r) => r.title.toLowerCase().includes(needle) || r.key.includes(needle))
      : all;
  }, [data, q]);

  const live = (data?.rows ?? []).filter((r) => !r.hidden).length;
  const curated = (data?.rows ?? []).filter((r) => r.configured).length;
  const placed = (data?.rows ?? []).reduce((n, r) => n + r.filled_slots, 0);

  // Reordering writes marketplace_categories.sort_order, which is the column
  // the homepage sorts on, so a move here moves the row on the public page.
  const nudge = (key: string, dir: -1 | 1) => {
    const all = [...(data?.rows ?? [])];
    const i = all.findIndex((r) => r.key === key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= all.length) return;
    [all[i], all[j]] = [all[j], all[i]];
    m.reorder.mutate(all.map((r) => r.key));
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Homepage Rows"
        description="The rows the public marketplace homepage renders, in the order it renders them."
        actions={
          <PillButton variant="primary" onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5" /> Create row
          </PillButton>
        }
      />
      {creating && <CreateRowDialog onClose={() => setCreating(false)} />}

      {isError && (
        <Card>
          <div className="flex items-start gap-3 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
            <div>
              <div className="font-medium text-destructive">Could not load the homepage rows</div>
              <div className="text-muted-foreground">{(error as Error)?.message}</div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Rows on the homepage" value={isLoading ? "—" : String(live)} />
        <StatCard label="Rows in total" value={isLoading ? "—" : String(data?.rows.length ?? 0)} />
        <StatCard label="Curated rows" value={isLoading ? "—" : String(curated)}
                  tone={curated ? "success" : undefined} />
        <StatCard label="Products placed by hand" value={isLoading ? "—" : String(placed)} />
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search rows by name or key"
          className="h-10 w-full rounded-lg border border-border bg-background/40 pl-9 pr-3 text-sm outline-none focus:border-primary/60"
        />
      </div>

      {isLoading && <EmptyHint text={`Loading the homepage rows…`} />}
      {!isLoading && rows.length === 0 && (
        <EmptyHint text={`No row matches “${q}”.`} />
      )}

      <div className="space-y-2">
        {rows.map((r, i) => (
          <Card key={r.key}>
            <div
              className={`flex flex-wrap items-center gap-3 p-3 ${
                dragKey === r.key ? "opacity-40" : ""
              }`}
              draggable
              onDragStart={() => setDragKey(r.key)}
              onDragEnd={() => setDragKey(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!dragKey || dragKey === r.key) return;
                const all = [...(data?.rows ?? [])];
                const from = all.findIndex((x) => x.key === dragKey);
                const to = all.findIndex((x) => x.key === r.key);
                if (from < 0 || to < 0) return;
                const [moved] = all.splice(from, 1);
                all.splice(to, 0, moved);
                m.reorder.mutate(all.map((x) => x.key));
                setDragKey(null);
              }}
            >
              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />
              <div className="flex flex-col">
                <button
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  onClick={() => nudge(r.key, -1)} disabled={i === 0 || m.reorder.isPending}
                  aria-label={`Move ${r.title} up`}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  onClick={() => nudge(r.key, 1)}
                  disabled={i === rows.length - 1 || m.reorder.isPending}
                  aria-label={`Move ${r.title} down`}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <button className="truncate text-sm font-medium hover:underline"
                          onClick={() => onOpen(r.key)}>
                    {r.title}
                  </button>
                  <code className="rounded bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {r.key}
                  </code>
                  {r.hidden && (
                    <span className="rounded-full bg-muted/50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      hidden
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {r.source_mode === "auto"
                    ? `Automatic · ${r.auto_rule.replace("_", " ")}`
                    : `${r.source_mode === "manual" ? "Manual" : "Hybrid"} · ${r.filled_slots} placed`}
                  {" · "}
                  {r.eligible_products} eligible product{r.eligible_products === 1 ? "" : "s"}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <PillButton
                  onClick={() => m.configure.mutate({ key: r.key, patch: { hidden: !r.hidden } })}
                >
                  {r.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {r.hidden ? "Hidden" : "Visible"}
                </PillButton>
                <PillButton onClick={() => onOpen(r.key)}>
                  <Layers className="h-3.5 w-3.5" /> Manage
                </PillButton>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- workspace -- */

const TABS = ["Overview", "Products", "Rules", "Visibility", "Analytics", "Audit"] as const;
type Tab = (typeof TABS)[number];

function RowWorkspace({ rowKey, onBack }: { rowKey: string; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>("Products");
  const { data } = useRows();
  const row = data?.rows.find((r) => r.key === rowKey);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <PillButton onClick={onBack}><ArrowLeft className="h-3.5 w-3.5" /> All rows</PillButton>
        <code className="rounded bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">{rowKey}</code>
      </div>

      <PageHeader
        title={row?.title ?? rowKey}
        description={`This row on the public homepage. ${row?.eligible_products ?? 0} products are eligible for it.`}
      />

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && <RowOverview rowKey={rowKey} row={row} />}
      {tab === "Products" && <SlotWall rowKey={rowKey} row={row} />}
      {tab === "Rules" && <RowRules rowKey={rowKey} row={row} />}
      {tab === "Visibility" && <RowVisibility rowKey={rowKey} row={row} />}
      {tab === "Analytics" && <RowAnalytics rowKey={rowKey} />}
      {tab === "Audit" && <RowAudit rowKey={rowKey} />}
    </div>
  );
}

/* ------------------------------------------------------------- slot wall -- */

const PAGE = 20;

function SlotWall({ rowKey, row }: { rowKey: string; row?: HomepageRow }) {
  const [page, setPage] = useState(0);
  const [picking, setPicking] = useState<number | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const m = useRowMutations(() => setPicking(null));

  const toggle = (pos: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pos)) next.delete(pos); else next.add(pos);
      return next;
    });

  const { data, isLoading } = useQuery({
    queryKey: ["marketplace", "row-products", rowKey],
    queryFn: () => getRowProducts({ data: { key: rowKey } }),
    staleTime: 15_000,
  });

  const max = data?.max_products ?? row?.max_products ?? 60;
  const bySlot = new Map<number, RowSlot>();
  for (const p of data?.products ?? []) bySlot.set(p.position, p);

  // 60 positions, shown a page at a time. A wall of sixty cards in one column
  // is unusable; twenty with paging is what a person can actually work in.
  const start = page * PAGE;
  const positions = Array.from({ length: Math.min(PAGE, max - start) }, (_, i) => start + i + 1);
  const pages = Math.ceil(max / PAGE);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Slots filled" value={isLoading ? "—" : `${data?.filled ?? 0} / ${max}`} />
        <StatCard label="Empty slots" value={isLoading ? "—" : String(data?.empty ?? 0)}
                  tone={(data?.empty ?? 0) > 0 ? "warning" : "success"} />
        <StatCard label="Eligible products" value={isLoading ? "—" : String(data?.eligible_total ?? 0)} />
        <StatCard label="Source" value={data?.source_mode ?? "—"} />
      </div>

      {(data?.empty ?? 0) > 0 && (
        <div className="rounded-lg border border-border bg-muted/10 p-3 text-[11px] text-muted-foreground">
          {data?.eligible_total ?? 0} products are eligible for this row and {data?.filled ?? 0} positions
          are filled. The remaining {data?.empty} are shown as available slots rather than padded with
          anything.
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/5 p-2.5">
          <span className="text-[11px]">{selected.size} slot(s) selected</span>
          <div className="flex gap-1.5">
            <PillButton onClick={() => setSelected(new Set())}>Clear selection</PillButton>
            <PillButton
              onClick={() => {
                m.bulkClear.mutate({ key: rowKey, positions: [...selected] });
                setSelected(new Set());
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Empty selected slots
            </PillButton>
          </div>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {positions.map((pos) => {
          const slot = bySlot.get(pos);
          return (
            <div key={pos}
                 draggable={Boolean(slot && slot.source === "manual")}
                 onDragStart={() => setDragFrom(pos)}
                 onDragEnd={() => setDragFrom(null)}
                 onDragOver={(e) => e.preventDefault()}
                 onDrop={(e) => {
                   e.preventDefault();
                   if (dragFrom && dragFrom !== pos) {
                     m.move.mutate({ key: rowKey, from: dragFrom, to: pos });
                   }
                   setDragFrom(null);
                 }}
                 className={`flex items-center gap-2 rounded-lg border bg-background/40 p-2.5 ${
                   dragFrom === pos ? "opacity-40" : ""
                 } ${selected.has(pos) ? "border-primary/60" : "border-border"}`}>
              <button onClick={() => toggle(pos)} aria-label={`Select slot ${pos}`}
                      className="shrink-0 text-muted-foreground hover:text-foreground">
                {selected.has(pos)
                  ? <CheckSquare className="h-3.5 w-3.5" />
                  : <Square className="h-3.5 w-3.5" />}
              </button>
              <span className="w-6 shrink-0 text-center font-mono text-[11px] text-muted-foreground">
                {String(pos).padStart(2, "0")}
              </span>

              {slot ? (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-medium">{slot.name}</span>
                      {slot.pinned && slot.source === "manual" && (
                        <PinIcon className="h-3 w-3 shrink-0 text-primary" />
                      )}
                      {!slot.live && (
                        <span className="shrink-0 rounded bg-destructive/15 px-1.5 py-0.5 text-[9px] uppercase text-destructive">
                          not live
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {slot.source === "auto" ? "filled automatically" : "placed by hand"}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <IconBtn title="Open product"
                             onClick={() => window.open(`/marketplace/product/${slot.slug}`, "_blank")}>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </IconBtn>
                    {slot.source === "manual" && (
                      <>
                        <IconBtn title="Move up" disabled={pos === 1}
                                 onClick={() => m.move.mutate({ key: rowKey, from: pos, to: pos - 1 })}>
                          <ChevronUp className="h-3.5 w-3.5" />
                        </IconBtn>
                        <IconBtn title="Move down" disabled={pos >= max}
                                 onClick={() => m.move.mutate({ key: rowKey, from: pos, to: pos + 1 })}>
                          <ChevronDown className="h-3.5 w-3.5" />
                        </IconBtn>
                        <IconBtn title={slot.pinned ? "Unpin" : "Pin"}
                                 onClick={() => m.pin.mutate({ key: rowKey, position: pos, pinned: !slot.pinned })}>
                          <PinIcon className="h-3.5 w-3.5" />
                        </IconBtn>
                        <IconBtn title="Remove from slot"
                                 onClick={() => m.remove.mutate({ key: rowKey, position: pos })}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </IconBtn>
                      </>
                    )}
                    <IconBtn title="Replace" onClick={() => setPicking(pos)}>
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                    </IconBtn>
                  </div>
                </>
              ) : (
                <button
                  onClick={() => setPicking(pos)}
                  className="flex flex-1 items-center gap-2 rounded-md border border-dashed border-border/70 px-2 py-1.5 text-[11px] text-muted-foreground hover:border-primary/50 hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" /> Assign a product
                </button>
              )}
            </div>
          );
        })}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Slots {start + 1}–{start + positions.length} of {max}</span>
          <div className="flex gap-1.5">
            <PillButton onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</PillButton>
            <PillButton onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}>Next</PillButton>
          </div>
        </div>
      )}

      {picking !== null && (
        <ProductPicker
          rowKey={rowKey}
          categoryId={row?.category_id}
          position={picking}
          onClose={() => setPicking(null)}
          onPick={(productId, override) =>
            m.assign.mutate({ key: rowKey, position: picking, productId, override })}
          pending={m.assign.isPending}
        />
      )}
    </div>
  );
}

function IconBtn({ children, title, onClick, disabled }: {
  children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button title={title} aria-label={title} onClick={onClick} disabled={disabled}
            className="rounded p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground disabled:opacity-30">
      {children}
    </button>
  );
}

/* ---------------------------------------------------------- product picker */

function ProductPicker({ rowKey, categoryId, position, onClose, onPick, pending }: {
  rowKey: string; categoryId?: string; position: number;
  onClose: () => void; onPick: (id: string, override?: boolean) => void; pending: boolean;
}) {
  const [q, setQ] = useState("");
  // Defaults to this row's own category, so the ordinary case cannot produce a
  // mismatch. Widening the search is a deliberate act.
  const [sameCategory, setSameCategory] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ["marketplace", "product-picker", categoryId, q, sameCategory],
    queryFn: () => searchRowProducts({
      data: {
        categoryId: sameCategory ? categoryId : undefined,
        query: q || undefined,
        limit: 24,
      },
    }),
    staleTime: 10_000,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-16"
         role="dialog" aria-label={`Assign a product to slot ${position}`}>
      <div className="w-full max-w-2xl rounded-xl border border-border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border p-3">
          <div className="text-sm font-medium">
            Assign to slot {String(position).padStart(2, "0")} · <code className="text-xs text-muted-foreground">{rowKey}</code>
          </div>
          <IconBtn title="Close" onClick={onClose}><X className="h-4 w-4" /></IconBtn>
        </div>

        <div className="space-y-3 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search products by name"
              className="h-10 w-full rounded-lg border border-border bg-background/40 pl-9 pr-3 text-sm outline-none focus:border-primary/60"
            />
          </div>

          <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <input type="checkbox" checked={sameCategory}
                   onChange={(e) => setSameCategory(e.target.checked)} />
            Only products from this row’s category
          </label>

          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {isLoading && <EmptyHint text={`Searching the catalogue…`} />}
            {!isLoading && (data?.products.length ?? 0) === 0 && (
              <EmptyHint text={`No published product matches that search.`} />
            )}
            {(data?.products ?? []).map((p) => (
              <button
                key={p.id}
                disabled={pending}
                onClick={() => onPick(p.id, !sameCategory)}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-background/40 p-2 text-left hover:border-primary/50 disabled:opacity-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{p.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {p.subcategory || p.industry_label || "—"}
                    {p.category_id !== categoryId && " · different category"}
                  </div>
                </div>
                <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ rules */

function RowRules({ rowKey, row }: { rowKey: string; row?: HomepageRow }) {
  const m = useRowMutations();
  const set = (patch: Record<string, unknown>) => m.configure.mutate({ key: rowKey, patch });

  return (
    <div className="space-y-4">
      <Card>
        <div className="space-y-3 p-4">
          <div className="text-xs font-medium">How this row is filled</div>
          <div className="flex flex-wrap gap-1.5">
            {(["manual", "auto", "hybrid"] as const).map((mode) => (
              <PillButton key={mode} onClick={() => set({ source_mode: mode })}>
                {row?.source_mode === mode ? "● " : ""}{mode}
              </PillButton>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Manual keeps only what you place. Automatic ignores placement and fills by the rule below.
            Hybrid holds your pinned products in their positions and fills the rest around them.
          </p>
        </div>
      </Card>

      <Card>
        <div className="space-y-3 p-4">
          <div className="text-xs font-medium">Automatic order</div>
          <div className="flex flex-wrap gap-1.5">
            {(["sort_order", "newest", "best_selling", "trending", "rating"] as const).map((rule) => (
              <PillButton key={rule} onClick={() => set({ auto_rule: rule })}>
                {row?.auto_rule === rule ? "● " : ""}{rule.replace("_", " ")}
              </PillButton>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Best selling counts paid orders. Trending counts product views from the last thirty days.
            Neither is random.
          </p>
        </div>
      </Card>

      <Card>
        <div className="space-y-3 p-4">
          <div className="text-xs font-medium">Placement rules</div>
          <label className="flex items-center gap-2 text-[11px]">
            <input type="checkbox" checked={Boolean(row?.["allow_cross_category" as keyof HomepageRow])}
                   onChange={(e) => set({ allow_cross_category: e.target.checked })} />
            Allow products from other categories in this row
          </label>
          <label className="flex items-center gap-2 text-[11px]">
            <input type="checkbox" checked={Boolean(row?.["allow_duplicates" as keyof HomepageRow])}
                   onChange={(e) => set({ allow_duplicates: e.target.checked })} />
            Allow the same product in more than one slot
          </label>
          <p className="text-[11px] text-muted-foreground">
            With cross-category placement off, assigning a product from another category is refused and
            the mismatch is reported rather than silently accepted.
          </p>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------- visibility */

function RowVisibility({ rowKey, row }: { rowKey: string; row?: HomepageRow }) {
  const m = useRowMutations();
  const set = (patch: Record<string, unknown>) => m.configure.mutate({ key: rowKey, patch });

  return (
    <Card>
      <div className="space-y-4 p-4">
        <div className="text-xs font-medium">Where this row appears</div>
        <div className="flex flex-wrap gap-1.5">
          <PillButton onClick={() => set({ hidden: !row?.hidden })}>
            {row?.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {row?.hidden ? "Hidden from the homepage" : "Showing on the homepage"}
          </PillButton>
          <PillButton onClick={() => set({ visible_desktop: !row?.visible_desktop })}>
            <Monitor className="h-3.5 w-3.5" /> Desktop {row?.visible_desktop ? "on" : "off"}
          </PillButton>
          <PillButton onClick={() => set({ visible_tablet: !row?.visible_tablet })}>
            <Tablet className="h-3.5 w-3.5" /> Tablet {row?.visible_tablet ? "on" : "off"}
          </PillButton>
          <PillButton onClick={() => set({ visible_mobile: !row?.visible_mobile })}>
            <Smartphone className="h-3.5 w-3.5" /> Mobile {row?.visible_mobile ? "on" : "off"}
          </PillButton>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Hiding writes <code>marketplace_categories.is_hidden</code>, the column the homepage filters
          on, so the row leaves the public page immediately.
        </p>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------- analytics */

function RowAnalytics({ rowKey }: { rowKey: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["marketplace", "row-analytics", rowKey],
    queryFn: () => getRowAnalytics({ data: { key: rowKey } }),
    staleTime: 30_000,
  });

  const pct = (v: number | null | undefined) =>
    v === null || v === undefined ? "not measured" : `${v}%`;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Product views" value={isLoading ? "—" : String(data?.product_views ?? 0)} />
        <StatCard label="Demo opens" value={isLoading ? "—" : String(data?.demo_opens ?? 0)} />
        <StatCard label="Paid orders" value={isLoading ? "—" : String(data?.orders ?? 0)} />
        <StatCard label="Revenue" value={isLoading ? "—" : String(data?.revenue ?? 0)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard label="Click-through" value={isLoading ? "—" : pct(data?.ctr)} />
        <StatCard label="Conversion" value={isLoading ? "—" : pct(data?.conversion)} />
      </div>
      <div className="rounded-lg border border-border bg-muted/10 p-3 text-[11px] text-muted-foreground">
        {data?.measured_from
          ? `Counted from marketplace_events since ${new Date(data.measured_from).toLocaleDateString()}, and from paid orders.`
          : "No events have been recorded for this row yet, so the rates read “not measured” rather than 0%."}
      </div>
    </div>
  );
}


/* --------------------------------------------------------------- overview */

function RowOverview({ rowKey, row }: { rowKey: string; row?: HomepageRow }) {
  const m = useRowMutations();
  const { data } = useQuery({
    queryKey: ["marketplace", "row-products", rowKey],
    queryFn: () => getRowProducts({ data: { key: rowKey } }),
    staleTime: 15_000,
  });

  const live = row?.["live_now" as keyof HomepageRow];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Showing on the homepage" value={live ? "Yes" : "No"}
                  tone={live ? "success" : "warning"} />
        <StatCard label="Status" value={String(row?.status ?? "—")} />
        <StatCard label="Row kind" value={String(row?.["row_kind" as keyof HomepageRow] ?? "category")} />
        <StatCard label="Stable key" value={rowKey} />
      </div>

      <Card>
        <div className="space-y-2 p-4 text-[11px] text-muted-foreground">
          <div className="text-xs font-medium text-foreground">What this row does right now</div>
          <p>
            It fills <strong>{data?.source_mode ?? "—"}</strong> by
            {" "}<strong>{(data?.auto_rule ?? "").replace("_", " ") || "—"}</strong>, holding
            {" "}{data?.filled ?? 0} of {data?.max_products ?? 60} positions from
            {" "}{data?.eligible_total ?? 0} eligible products.
          </p>
          {!live && (
            <p>
              It is not on the public homepage at the moment. Publish it from the Visibility tab when
              it is ready.
            </p>
          )}
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center gap-1.5 p-4">
          <span className="mr-2 text-xs font-medium">Status</span>
          {(["draft", "review", "scheduled", "published", "unpublished", "archived"] as const).map((st) => (
            <PillButton key={st} onClick={() => m.configure.mutate({ key: rowKey, patch: { status: st } })}>
              {row?.status === st ? "● " : ""}{st}
            </PillButton>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ audit */

function RowAudit({ rowKey }: { rowKey: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["marketplace", "row-audit", rowKey],
    queryFn: () => getRowAudit({ data: { key: rowKey } }),
    staleTime: 20_000,
  });

  if (isLoading) return <EmptyHint text="Loading the audit trail…" />;
  if (!data?.entries.length) {
    return <EmptyHint text="Nothing has been changed on this row yet, so there is nothing to show." />;
  }

  return (
    <div className="space-y-2">
      {data.entries.map((e, i) => (
        <Card key={i}>
          <div className="flex flex-wrap items-baseline justify-between gap-2 p-3">
            <div className="min-w-0">
              <div className="text-xs font-medium">{e.action}</div>
              <div className="text-[11px] text-muted-foreground">
                {e.reason || "—"}
                {e.actor ? ` · ${e.actor}` : ""}
                {e.actor_role ? ` (${e.actor_role})` : ""}
              </div>
            </div>
            <div className="shrink-0 text-[10px] text-muted-foreground">
              {new Date(e.created_at).toLocaleString()}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export default HomepageRowsSection;
