import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Info,
  Layers,
  Pin,
  PinOff,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  Trash2,
  X,
  AlertTriangle,
  Wand2,
  Hand,
} from "lucide-react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { richText, useTranslation } from "@/lib/i18n/use-translation";

import { Card, EmptyHint, PageHeader, PillButton, StatCard } from "../ui";
import {
  listHomepageRows,
  getRowProducts,
  searchRowProducts,
  assignSlot,
  removeSlot,
  moveSlot,
  pinSlot,
  configureRow,
  listRecommendationEngines,
  type RowSlot,
} from "@/lib/marketplace-manager/rows.functions";

/**
 * Merchandising Console — the real one.
 *
 * This screen used to be eight hardcoded titles, each over sixty-four empty
 * dashed squares, with an Assign button that had no handler. It described a
 * system accurately — "Pin products into homepage slots, mix manual and
 * rules-based fill" — that it was not connected to.
 *
 * The system it described already existed. mm_slot_assign, mm_slot_move,
 * mm_slot_remove, mm_slot_pin, mm_row_configure and mm_row_products are real,
 * enforce operator rights, validate positions, refuse duplicates with a stated
 * reason and write the audit trail. The homepage resolves its curated rows
 * through mm_row_products — the same function this screen reads — so what a
 * manager sees here is what the page renders.
 *
 * What was missing was that marketplace_row_config held no curated rows at all,
 * so every card named a placement that did not exist. The four real placements
 * now exist and this screen drives them.
 *
 * Four of the original eight cards were never placements and none is invented
 * here. Category Placement selects among the real category rows. Recommended
 * Placement surfaces the recommendation engines, including the ones that
 * honestly cannot run and why. Collection Placement reports that this database
 * has no marketplace collection system rather than pretending to one. Manual
 * and Automatic are source modes on a placement, and are shown as what they
 * are: a cross-placement view of how many slots each mode is filling.
 */

/* ------------------------------------------------------------------ types */

type Row = {
  key: string;
  row_kind: "category" | "curated";
  category_id: string | null;
  title: string;
  status: string;
  live_now: boolean;
  source_mode: "manual" | "auto" | "hybrid";
  auto_rule: string;
  max_products: number;
  filled_slots: number;
  eligible_products: number;
};

type Resolved = {
  ok: boolean;
  source_mode: string;
  auto_rule: string;
  max_products: number;
  filled: number;
  empty: number;
  eligible_total: number;
  products: RowSlot[];
};

const ROWS_KEY = ["marketplace", "merch", "rows"] as const;
const slotsKey = (key: string) => ["marketplace", "merch", "slots", key] as const;

/**
 * The placements this console owns, in the order the cards have always
 * appeared. `rowKey` is the real row behind the card; a card without one is
 * not a row and says so for itself.
 */
const PLACEMENTS: {
  label: string;
  rowKey?: string;
  kind: "row" | "recommend" | "collection" | "category" | "mode";
  mode?: "manual" | "auto";
  note?: string;
}[] = [
  { label: "Homepage Featured", rowKey: "featured-software", kind: "row" },
  { label: "Trending Placement", rowKey: "trending-now", kind: "row" },
  { label: "Top Selling Placement", rowKey: "top-selling", kind: "row" },
  { label: "New Releases Placement", rowKey: "new-releases", kind: "row" },
  { label: "Recommended Placement", kind: "recommend" },
  { label: "Category Placement", kind: "category" },
  { label: "Collection Placement", kind: "collection" },
  { label: "Manual Placement", kind: "mode", mode: "manual" },
  { label: "Automatic Placement", kind: "mode", mode: "auto" },
];

/** The rules the engine actually implements. Nothing else may be offered. */
const RULES: { value: string; label: string; needs: string }[] = [
  { value: "featured", label: "Featured flag", needs: "products flagged featured" },
  {
    value: "trending",
    label: "Trending flag, ranked by 30-day views",
    needs: "products flagged trending",
  },
  {
    value: "best_selling",
    label: "Top selling, ranked by paid orders",
    needs: "paid orders or the best-seller flag",
  },
  {
    value: "new_release",
    label: "New release flag, newest first",
    needs: "products flagged new release",
  },
  { value: "newest", label: "Recently added", needs: "nothing — every product has a date" },
  { value: "rating", label: "Highest rated", needs: "a rating on the product" },
  { value: "sort_order", label: "Catalogue order", needs: "nothing" },
];

/* -------------------------------------------------------------- data hooks */

function useRows() {
  return useQuery({
    queryKey: ROWS_KEY,
    queryFn: async () => {
      const res = await listHomepageRows();
      return (res.rows ?? []) as unknown as Row[];
    },
    staleTime: 20_000,
  });
}

function useSlots(key: string | undefined) {
  return useQuery({
    queryKey: slotsKey(key ?? ""),
    queryFn: () => getRowProducts({ data: { key: key as string } }) as Promise<Resolved>,
    enabled: Boolean(key),
    staleTime: 10_000,
  });
}

/**
 * Every mutation reports what actually happened. The server functions return a
 * stated reason when they refuse — a category mismatch, a duplicate, missing
 * operator rights — and that reason is what the manager is shown, rather than a
 * success toast over a write that did not happen.
 */
function useSlotMutations(rowKey: string) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: slotsKey(rowKey) });
    void qc.invalidateQueries({ queryKey: ROWS_KEY });
  };
  const onError = (e: Error) => toast.error(e.message || t("storeadmin.merch.change_refused"));

  return {
    assign: useMutation({
      mutationFn: (v: { position: number; productId: string; override?: boolean }) =>
        assignSlot({ data: { key: rowKey, ...v } }),
      onSuccess: (r: { message?: string }) => {
        refresh();
        toast.success(r?.message ?? t("storeadmin.merch.assigned"));
      },
      onError,
    }),
    remove: useMutation({
      mutationFn: (v: { position: number }) => removeSlot({ data: { key: rowKey, ...v } }),
      onSuccess: () => {
        refresh();
        toast.success(t("storeadmin.merch.slot_cleared"));
      },
      onError,
    }),
    move: useMutation({
      mutationFn: (v: { from: number; to: number }) => moveSlot({ data: { key: rowKey, ...v } }),
      onSuccess: () => {
        refresh();
        toast.success(t("storeadmin.merch.reordered"));
      },
      onError,
    }),
    pin: useMutation({
      mutationFn: (v: { position: number; pinned: boolean }) =>
        pinSlot({ data: { key: rowKey, ...v } }),
      onSuccess: () => {
        refresh();
      },
      onError,
    }),
    configure: useMutation({
      mutationFn: (patch: Record<string, unknown>) =>
        configureRow({ data: { key: rowKey, patch } }),
      onSuccess: () => {
        refresh();
        toast.success(t("storeadmin.merch.placement_updated"));
      },
      onError,
    }),
  };
}

/* ------------------------------------------------------------ small pieces */

function Pill({ tone, children }: { tone: "ok" | "warn" | "muted"; children: React.ReactNode }) {
  const cls =
    tone === "ok"
      ? "bg-success/15 text-success"
      : tone === "warn"
        ? "bg-amber-500/15 text-amber-500"
        : "bg-muted/40 text-muted-foreground";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{children}</span>
  );
}

/**
 * One slot in the grid. A hand-placed product reads solid, a rule-filled one
 * reads faint, and an empty slot stays a dashed outline — so the mix of manual
 * and automatic fill is visible at a glance rather than described in a caption.
 */
function SlotCell({ slot, index }: { slot?: RowSlot; index: number }) {
  const { t } = useTranslation();
  if (!slot) {
    return (
      <div
        title={t("storeadmin.merch.slot_empty_title", { position: index + 1 })}
        className="aspect-square rounded-lg border border-dashed border-border bg-background/40"
      />
    );
  }
  const auto = slot.source === "auto";
  return (
    <div
      title={`${t("storeadmin.merch.slot_title", { position: slot.position, name: slot.name })}${auto ? t("storeadmin.merch.slot_title_rule") : t("storeadmin.merch.slot_title_hand")}${slot.live ? "" : t("storeadmin.merch.slot_title_not_live")}`}
      className={`relative aspect-square overflow-hidden rounded-lg border ${
        auto ? "border-border/60 bg-background/60 opacity-70" : "border-accent/50 bg-accent/10"
      }`}
    >
      {slot.thumbnail_url ? (
        <img
          src={slot.thumbnail_url}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full items-center justify-center px-1 text-center text-[9px] font-semibold leading-tight text-muted-foreground">
          {slot.name.slice(0, 28)}
        </div>
      )}
      {slot.pinned && <Pin className="absolute right-1 top-1 h-3 w-3 text-accent" />}
      {!slot.live && (
        <span className="absolute inset-x-0 bottom-0 bg-destructive/80 px-1 text-center text-[8px] font-bold text-white">
          {t("storeadmin.merch.not_live")}
        </span>
      )}
    </div>
  );
}

/** The eight-square grid the console has always shown, now holding real slots. */
function SlotGrid({ resolved, max }: { resolved?: Resolved; max: number }) {
  const byPosition = new Map((resolved?.products ?? []).map((p) => [p.position, p]));
  return (
    <div className="grid grid-cols-4 gap-2">
      {Array.from({ length: max }).map((_, i) => (
        <SlotCell key={i} index={i} slot={byPosition.get(i + 1)} />
      ))}
    </div>
  );
}

/* --------------------------------------------------------- product picker */

/**
 * Server-side search over the real catalogue.
 *
 * The catalogue holds five and a half thousand published products, so nothing
 * is loaded until the manager types, the query is debounced, and the server
 * returns at most twenty-four rows. Nothing about the browser ever sees the
 * whole catalogue.
 */
function AssignDialog({
  rowKey,
  position,
  onClose,
  onAssign,
  busy,
}: {
  rowKey: string;
  position: number;
  onClose: () => void;
  onAssign: (productId: string, override: boolean) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(timer);
  }, [term]);

  const results = useQuery({
    queryKey: ["marketplace", "merch", "search", debounced],
    queryFn: () => searchRowProducts({ data: { query: debounced, limit: 24 } }),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  });

  const products = results.data?.products ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 md:p-10">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-bold">{t("storeadmin.merch.assign_to_slot", { position })}</h3>
            <p className="text-xs text-muted-foreground">
              {t("storeadmin.merch.assign_intro")}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted" aria-label={t("storeadmin.merch.close")}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={t("storeadmin.merch.search_placeholder")}
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
          />
        </div>

        <div className="max-h-[50vh] space-y-1 overflow-y-auto">
          {debounced.length < 2 && (
            <EmptyHint text={t("storeadmin.merch.type_two")} />
          )}
          {debounced.length >= 2 && results.isLoading && <EmptyHint text={t("storeadmin.merch.searching")} />}
          {debounced.length >= 2 && !results.isLoading && products.length === 0 && (
            <EmptyHint text={t("storeadmin.merch.no_match", { term: debounced })} />
          )}
          {products.map((p: Record<string, unknown>) => {
            const live = Boolean(p.visible) && p.content_status === "published";
            return (
              <div
                key={String(p.id)}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {p.thumbnail_url ? (
                    <img
                      src={String(p.thumbnail_url)}
                      alt=""
                      className="h-9 w-9 flex-none rounded object-cover"
                    />
                  ) : (
                    <div className="h-9 w-9 flex-none rounded bg-muted" />
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{String(p.name)}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {String(p.industry_label ?? p.subcategory ?? "—")}
                      {p.license ? ` · ${String(p.license)}` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex flex-none items-center gap-2">
                  {!live && <Pill tone="warn">{t("storeadmin.merch.not_live")}</Pill>}
                  <PillButton
                    variant="ghost"
                    onClick={() => onAssign(String(p.id), true)}
                    disabled={busy}
                  >
                    {busy ? t("storeadmin.merch.assigning") : t("storeadmin.merch.assign")}
                  </PillButton>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-[11px] text-muted-foreground">
          {richText(t("storeadmin.merch.assign_footnote"), {
            // i18n-ignore: table name
            table: <code>marketplace_row_slots</code>,
          })}
        </p>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- slot editor */

function PlacementEditor({ row, onBack }: { row: Row; onBack: () => void }) {
  const { t } = useTranslation();
  const slots = useSlots(row.key);
  const m = useSlotMutations(row.key);
  const [assigning, setAssigning] = useState<number | null>(null);

  const resolved = slots.data;
  const max = resolved?.max_products ?? row.max_products ?? 8;
  const placed = (resolved?.products ?? []).filter((p) => p.source === "manual");
  const auto = (resolved?.products ?? []).filter((p) => p.source === "auto");

  return (
    <div className="px-4 py-8 md:px-8">
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("storeadmin.merch.all_placements")}
      </button>

      <PageHeader
        eyebrow={t("storeadmin.merch.eyebrow")}
        title={row.title}
        description={t("storeadmin.merch.editor_description", { key: row.key })}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("storeadmin.merch.stat_slots")} value={String(max)} />
        <StatCard label={t("storeadmin.merch.stat_placed_by_hand")} value={String(placed.length)} />
        <StatCard label={t("storeadmin.merch.stat_filled_by_rule")} value={String(auto.length)} />
        <StatCard
          label={t("storeadmin.merch.stat_eligible")}
          value={String(resolved?.eligible_total ?? row.eligible_products ?? 0)}
        />
      </div>

      {!row.live_now && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
          <span>
            {richText(t("storeadmin.merch.not_on_homepage"), { status: <b>{row.status}</b> })}
          </span>
        </div>
      )}

      <Card className="mb-6">
        <h3 className="mb-3 text-base font-bold">{t("storeadmin.merch.fill_mode")}</h3>
        <div className="flex flex-wrap items-center gap-2">
          {(["manual", "hybrid", "auto"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => m.configure.mutate({ source_mode: mode })}
              disabled={m.configure.isPending}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                resolved?.source_mode === mode
                  ? "bg-accent text-accent-foreground"
                  : "border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {mode === "manual"
                ? t("storeadmin.merch.mode_manual")
                : mode === "auto"
                  ? t("storeadmin.merch.mode_auto")
                  : t("storeadmin.merch.mode_hybrid")}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {richText(t("storeadmin.merch.hybrid_explained"), { mode: <b>{t("storeadmin.merch.mode_hybrid")}</b> })}
        </p>

        <h3 className="mb-2 mt-5 text-base font-bold">{t("storeadmin.merch.rule")}</h3>
        <select
          value={resolved?.auto_rule ?? row.auto_rule}
          onChange={(e) => m.configure.mutate({ auto_rule: e.target.value })}
          disabled={m.configure.isPending || resolved?.source_mode === "manual"}
          className="w-full max-w-md rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          {RULES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {t("storeadmin.merch.rules_needs")}{" "}
          {RULES.find((r) => r.value === (resolved?.auto_rule ?? row.auto_rule))?.needs ?? "—"}.
          {resolved && resolved.eligible_total === 0 && (
            <b className="text-amber-600"> {t("storeadmin.merch.none_qualifies")}</b>
          )}
        </p>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold">{t("storeadmin.merch.slots")}</h3>
          <Pill tone="muted">
            {t("storeadmin.merch.filled_of", { filled: resolved?.filled ?? 0, max })}
          </Pill>
        </div>

        {slots.isLoading && <EmptyHint text={t("storeadmin.merch.loading_placement")} />}
        {slots.isError && (
          <EmptyHint text={t("storeadmin.merch.placement_failed")} />
        )}

        {resolved && (
          <div className="space-y-2">
            {Array.from({ length: max }).map((_, i) => {
              const position = i + 1;
              const slot = resolved.products.find((p) => p.position === position);
              return (
                <div
                  key={position}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-6 flex-none text-center text-xs font-bold text-muted-foreground">
                      {position}
                    </span>
                    {slot ? (
                      <>
                        {slot.thumbnail_url ? (
                          <img
                            src={slot.thumbnail_url}
                            alt=""
                            className="h-8 w-8 flex-none rounded object-cover"
                          />
                        ) : (
                          <div className="h-8 w-8 flex-none rounded bg-muted" />
                        )}
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{slot.name}</div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            {slot.source === "manual" ? (
                              <>
                                <Hand className="h-3 w-3" /> {t("storeadmin.merch.placed_by_hand")}
                              </>
                            ) : (
                              <>
                                <Wand2 className="h-3 w-3" /> {t("storeadmin.merch.filled_by_rule")}
                              </>
                            )}
                            {!slot.live && <Pill tone="warn">{t("storeadmin.merch.not_live")}</Pill>}
                          </div>
                        </div>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">{t("storeadmin.merch.empty")}</span>
                    )}
                  </div>

                  <div className="flex flex-none items-center gap-1">
                    {slot?.source === "manual" && (
                      <>
                        <button
                          title={t("storeadmin.merch.move_up")}
                          disabled={position === 1 || m.move.isPending}
                          onClick={() => m.move.mutate({ from: position, to: position - 1 })}
                          className="rounded p-1 hover:bg-muted disabled:opacity-30"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          title={t("storeadmin.merch.move_down")}
                          disabled={position === max || m.move.isPending}
                          onClick={() => m.move.mutate({ from: position, to: position + 1 })}
                          className="rounded p-1 hover:bg-muted disabled:opacity-30"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        <button
                          title={slot.pinned ? t("storeadmin.merch.unpin") : t("storeadmin.merch.pin")}
                          onClick={() => m.pin.mutate({ position, pinned: !slot.pinned })}
                          className="rounded p-1 hover:bg-muted"
                        >
                          {slot.pinned ? (
                            <PinOff className="h-4 w-4" />
                          ) : (
                            <Pin className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          title={t("storeadmin.merch.remove_from_slot")}
                          onClick={() => m.remove.mutate({ position })}
                          disabled={m.remove.isPending}
                          className="rounded p-1 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    <PillButton variant="ghost" onClick={() => setAssigning(position)}>
                      {slot ? t("storeadmin.merch.replace") : t("storeadmin.merch.assign")}
                    </PillButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {resolved && resolved.filled === 0 && (
          <EmptyHint text={t("storeadmin.merch.nothing_fills_editor")} />
        )}
      </Card>

      {assigning !== null && (
        <AssignDialog
          rowKey={row.key}
          position={assigning}
          busy={m.assign.isPending}
          onClose={() => setAssigning(null)}
          onAssign={(productId, override) => {
            m.assign.mutate(
              { position: assigning, productId, override },
              { onSuccess: () => setAssigning(null) },
            );
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------- non-row placements */

function RecommendedCard() {
  const { t } = useTranslation();
  const engines = useQuery({
    queryKey: ["marketplace", "merch", "engines"],
    queryFn: () => listRecommendationEngines(),
    staleTime: 60_000,
  });
  const list = (engines.data?.engines ?? []) as {
    key: string;
    title: string;
    can_run: boolean;
    blocked_reason: string | null;
    /** Whether the data supports it, counted now rather than recorded once. */
    data_ready?: boolean;
    /** What the engine requires, and what actually exists. */
    needs?: string;
    have?: string;
    /** The recorded reason says blocked; the measurement says otherwise. */
    note_is_stale?: boolean;
  }[];
  const runnable = list.filter((e) => e.can_run);
  const stale = list.filter((e) => e.note_is_stale);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-bold">{t("storeadmin.merch.recommended_title")}</h3>
        <Pill tone={runnable.length ? "ok" : "warn"}>
          {t("storeadmin.merch.can_run", { runnable: runnable.length, total: list.length })}
        </Pill>
      </div>
      {engines.isLoading && <EmptyHint text={t("storeadmin.merch.reading_engines")} />}
      {!engines.isLoading && list.length === 0 && (
        <EmptyHint text={t("storeadmin.merch.no_engine")} />
      )}
      <div className="space-y-1">
        {list.map((e) => (
          <div key={e.key} className="rounded-lg border border-border/60 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{e.title}</span>
              <Pill tone={e.can_run ? "ok" : "muted"}>{e.can_run ? t("storeadmin.merch.ready") : t("storeadmin.merch.blocked")}</Pill>
            </div>
            {/* What the engine needs and what exists, counted now. A blocked
                engine should show how far off it is, not only that it is
                blocked. */}
            {e.have && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {e.needs ? <>{t("storeadmin.merch.needs", { needs: e.needs })} </> : null}
                {t("storeadmin.merch.has", { have: e.have })}
              </p>
            )}
            {!e.can_run && e.blocked_reason && (
              <p className="mt-1 text-[11px] text-muted-foreground">{e.blocked_reason}</p>
            )}
            {e.note_is_stale && (
              <p className="mt-1 text-[11px] font-semibold text-warning">
                {t("storeadmin.merch.reason_stale")}
              </p>
            )}
          </div>
        ))}
      </div>
      {stale.length > 0 && (
        <p className="mt-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[11px] text-warning">
          {t("storeadmin.merch.stale_engines", { count: stale.length })}
        </p>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">
        {t("storeadmin.merch.recommended_footnote")}
      </p>
    </Card>
  );
}

function CollectionCard() {
  const { t } = useTranslation();
  return (
    <Card>
      <h3 className="mb-3 text-base font-bold">{t("storeadmin.merch.collection_title")}</h3>
      <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 flex-none" />
        <span>
          {t("storeadmin.merch.collection_none")}
        </span>
      </div>
    </Card>
  );
}

function ModeCard({ mode, rows }: { mode: "manual" | "auto"; rows: Row[] }) {
  const { t } = useTranslation();
  const results = useQueries({
    queries: rows.map((r) => ({
      queryKey: slotsKey(r.key),
      queryFn: () => getRowProducts({ data: { key: r.key } }) as Promise<Resolved>,
      staleTime: 10_000,
    })),
  });

  const per = rows.map((r, i) => {
    const d = results[i]?.data;
    const n = (d?.products ?? []).filter((p) => p.source === mode).length;
    return { title: r.title, key: r.key, n };
  });
  const total = per.reduce((a, b) => a + b.n, 0);
  const loading = results.some((r) => r.isLoading);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-bold">
          {mode === "manual" ? t("storeadmin.merch.manual_title") : t("storeadmin.merch.auto_title")}
        </h3>
        <Pill tone="muted">{loading ? "…" : t("storeadmin.merch.slots_count", { count: total })}</Pill>
      </div>
      <p className="mb-3 text-[11px] text-muted-foreground">
        {mode === "manual"
          ? t("storeadmin.merch.manual_description")
          : t("storeadmin.merch.auto_description")}
      </p>
      <div className="space-y-1">
        {per.map((p) => (
          <div
            key={p.key}
            className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-1.5"
          >
            <span className="truncate text-sm">{p.title}</span>
            <span className="text-sm font-bold">{loading ? "…" : p.n}</span>
          </div>
        ))}
        {per.length === 0 && <EmptyHint text={t("storeadmin.merch.no_placements")} />}
      </div>
    </Card>
  );
}

function CategoryCard({ rows, onOpen }: { rows: Row[]; onOpen: (r: Row) => void }) {
  const { t } = useTranslation();
  const [term, setTerm] = useState("");
  const shown = useMemo(() => {
    const q = term.trim().toLowerCase();
    const list = q ? rows.filter((r) => r.title.toLowerCase().includes(q)) : rows;
    return list.slice(0, 8);
  }, [rows, term]);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-bold">{t("storeadmin.merch.category_title")}</h3>
        <Pill tone="muted">{t("storeadmin.merch.category_rows", { count: rows.length })}</Pill>
      </div>
      <div className="relative mb-2">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={t("storeadmin.merch.find_category_row")}
          className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
        />
      </div>
      <div className="space-y-1">
        {shown.map((r) => (
          <button
            key={r.key}
            onClick={() => onOpen(r)}
            className="flex w-full items-center justify-between rounded-lg border border-border/60 px-3 py-1.5 text-left hover:border-accent/60"
          >
            <span className="truncate text-sm">{r.title}</span>
            <span className="flex-none text-[11px] text-muted-foreground">
              {t("storeadmin.merch.placed_count", { count: r.filled_slots })}
            </span>
          </button>
        ))}
        {shown.length === 0 && <EmptyHint text={t("storeadmin.merch.no_category_match")} />}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {t("storeadmin.merch.category_footnote")}
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------------- screen */

function PlacementCard({ row, onOpen }: { row: Row; onOpen: () => void }) {
  const { t } = useTranslation();
  const slots = useSlots(row.key);
  const max = slots.data?.max_products ?? row.max_products ?? 8;

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold">{row.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Pill tone={row.live_now ? "ok" : "warn"}>{row.live_now ? t("storeadmin.merch.live") : row.status}</Pill>
            <Pill tone="muted">
              {slots.data
                ? t("storeadmin.merch.filled_of", { filled: slots.data.filled, max })
                : slots.isLoading
                  ? t("storeadmin.merch.reading")
                  : t("storeadmin.merch.unavailable")}
            </Pill>
          </div>
        </div>
        <PillButton variant="ghost" onClick={onOpen}>
          {t("storeadmin.merch.assign")}
        </PillButton>
      </div>

      <SlotGrid resolved={slots.data} max={max} />

      {slots.data && slots.data.filled === 0 && (
        <EmptyHint text={t("storeadmin.merch.nothing_fills_card")} />
      )}
      {slots.data && slots.data.filled > 0 && slots.data.empty > 0 && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          {t("storeadmin.merch.empty_slots", { count: slots.data.empty })}
        </p>
      )}
    </Card>
  );
}

export function MerchandisingConsole() {
  const { t } = useTranslation();
  const rows = useRows();
  const [open, setOpen] = useState<Row | null>(null);

  const curated = useMemo(
    () => (rows.data ?? []).filter((r) => r.row_kind === "curated"),
    [rows.data],
  );
  const categories = useMemo(
    () => (rows.data ?? []).filter((r) => r.row_kind === "category"),
    [rows.data],
  );

  if (open) {
    return <PlacementEditor row={open} onBack={() => setOpen(null)} />;
  }

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow={t("storeadmin.merch.eyebrow")}
        title={t("storeadmin.merch.console_title")}
        description={t("storeadmin.merch.console_description")}
      />

      {rows.isLoading && <EmptyHint text={t("storeadmin.merch.reading_placements")} />}
      {rows.isError && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
          <span>
            {t("storeadmin.merch.placements_failed")}
          </span>
        </div>
      )}

      {!rows.isLoading && !rows.isError && curated.length === 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
          <span>
            {t("storeadmin.merch.no_curated")}
          </span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {PLACEMENTS.map((p) => {
          if (p.kind === "row") {
            const row = curated.find((r) => r.key === p.rowKey);
            if (!row) return null;
            return <PlacementCard key={p.label} row={row} onOpen={() => setOpen(row)} />;
          }
          if (p.kind === "recommend") return <RecommendedCard key={p.label} />;
          if (p.kind === "collection") return <CollectionCard key={p.label} />;
          if (p.kind === "category")
            return <CategoryCard key={p.label} rows={categories} onOpen={setOpen} />;
          return <ModeCard key={p.label} mode={p.mode as "manual" | "auto"} rows={curated} />;
        })}
      </div>
    </div>
  );
}

export default MerchandisingConsole;
