import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Info } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Card, EmptyHint, PageHeader, StatCard } from "../ui";
import {
  getCardFields, setCardField, reorderCardFields, type CardField,
} from "@/lib/marketplace-manager/cards.functions";
import { DemoCard, toDemo, type CatalogCard } from "@/components/marketplace-home/HomeIndex";

/**
 * Card composition — the screen that already existed, now connected.
 *
 * Every control it used to show is still here, in the same four groups and the
 * same order: 18 visible fields, 11 card actions, 12 badges, 6 platform badges.
 * None has been removed or renamed. What is new is that each one reads and
 * writes marketplace_card_fields, the single registry the storefront card
 * reads, and each carries the figure that decides whether switching it on does
 * anything at all — how many of the 5,469 published products can answer it.
 *
 * That figure is the honest reply to "why does the Premium Thumbnail toggle
 * change nothing": there is not one product image in this database. The switch
 * stays, the number sits beside it, and it is left off until there is something
 * behind it.
 *
 * The Live Preview renders DemoCard — the component the public homepage renders
 * — against a real product from the catalogue, so what is previewed and what
 * ships are the same component reading the same configuration.
 */

const KEY = ["marketplace", "card-fields"] as const;

/** The four groups exactly as the screen has always listed them. */
const VISIBLE_FIELDS = [
  "product-thumbnail", "gallery", "hover-image", "thumbnail-3d",
  "product-name", "category", "industry", "version", "last-updated",
  "product-status", "rating", "reviews", "downloads", "views",
  "price", "license", "delivery-time", "support-status",
];

const CARD_ACTIONS = [
  "view-details", "quick-view", "buy-now", "add-to-cart", "add-to-collection",
  "wishlist", "compare", "share", "live-demo", "watch-video", "notify-me",
];

const BADGES = [
  "badge-new", "badge-trending", "badge-featured", "badge-best-seller",
  "badge-editor-choice", "badge-staff-pick", "badge-ai-ready", "badge-cloud",
  "badge-offline", "badge-saas", "badge-enterprise", "badge-verified",
];

const PLATFORMS = [
  "platform-windows", "platform-macos", "platform-linux",
  "platform-android", "platform-ios", "platform-web",
];

function Coverage({ field }: { field: CardField }) {
  if (field.have === null) {
    return (
      <span className="rounded-full bg-muted/40 px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
        no store
      </span>
    );
  }
  const pct = field.pct ?? 0;
  const tone =
    field.have === 0
      ? "bg-destructive/15 text-destructive"
      : pct >= 90
        ? "bg-success/15 text-success"
        : "bg-amber-500/15 text-amber-600";
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${tone}`} title={`${field.have.toLocaleString()} of ${field.total.toLocaleString()} products`}>
      {field.have === 0 ? "0" : `${pct}%`}
    </span>
  );
}

/**
 * The keys the storefront card actually checks (HomeIndex.tsx, every
 * `shows(...)` call). The registry holds 65 fields and all of them save, but
 * the other 57 have no effect on the card, so an operator switching one off
 * saw nothing change and reasonably took the control for broken. They are
 * labelled rather than hidden, and the card's own gates are left as they are:
 * gating more fields now would immediately change live cards on the protected
 * homepage.
 */
const DRAWN_BY_CARD = new Set([
  "product-name",
  "category",
  "short-description",
  "price",
  "rating",
  "license",
  "live-demo",
  "platform-web",
]);

function ControlToggle({
  field, onToggle, onMove, busy, index, last,
}: {
  field: CardField;
  onToggle: () => void;
  onMove: (delta: number) => void;
  busy: boolean;
  index: number;
  last: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-1.5 rounded-lg border border-border/60 px-2 py-1.5">
      <button
        type="button"
        role="switch"
        aria-checked={field.enabled}
        aria-label={field.label}
        disabled={busy}
        onClick={onToggle}
        className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:opacity-50"
      >
        <span
          className={`h-2 w-2 flex-none rounded-full ${field.enabled ? "bg-accent" : "bg-muted-foreground/40"}`}
        />
        <span className={`truncate text-xs font-semibold ${field.enabled ? "" : "text-muted-foreground"}`}>
          {field.label}
        </span>
      </button>
      {!DRAWN_BY_CARD.has(field.key) && (
        <span
          className="flex-none text-[9px] font-medium text-amber-600"
          title="Saved, but the storefront card does not draw this field yet, so switching it changes nothing a visitor sees."
        >
          not drawn yet
        </span>
      )}
      <Coverage field={field} />
      <div className="flex flex-none">
        <button
          type="button" title="Move up" aria-label={`Move ${field.label} up`}
          disabled={index === 0 || busy} onClick={() => onMove(-1)}
          className="rounded p-0.5 hover:bg-muted disabled:opacity-25"
        >
          <ChevronUp className="h-3 w-3" />
        </button>
        <button
          type="button" title="Move down" aria-label={`Move ${field.label} down`}
          disabled={last || busy} onClick={() => onMove(1)}
          className="rounded p-0.5 hover:bg-muted disabled:opacity-25"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

/** A real product, so the preview is of something that exists. */
function useSampleProduct(): CatalogCard | null {
  const [card, setCard] = useState<CatalogCard | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/marketplace/catalog?rows=1&perRow=1");
        if (!response.ok) return;
        const data = (await response.json()) as { rows?: { cards?: CatalogCard[] }[] };
        const first = data.rows?.[0]?.cards?.[0];
        if (!cancelled && first) setCard(first);
      } catch {
        /* the preview simply says it could not load one */
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return card;
}

export function CardComposition() {
  const qc = useQueryClient();

  const fields = useQuery({
    queryKey: KEY,
    queryFn: () => getCardFields(),
    staleTime: 20_000,
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: KEY });
  const onError = (e: Error) => toast.error(e.message || "The change was refused.");

  const toggle = useMutation({
    mutationFn: (v: { key: string; enabled: boolean }) => setCardField({ data: v }),
    onSuccess: () => { refresh(); toast.success("Saved — the storefront reads this on its next render."); },
    onError,
  });

  const reorder = useMutation({
    mutationFn: (v: { kind: string; keys: string[] }) => reorderCardFields({ data: v }),
    onSuccess: () => { refresh(); },
    onError,
  });

  const data = fields.data;
  const byKey = useMemo(() => {
    const m = new Map<string, CardField>();
    for (const f of data?.fields ?? []) m.set(f.key, f);
    return m;
  }, [data]);

  const sample = useSampleProduct();

  const group = (keys: string[]) =>
    keys.map((k) => byKey.get(k)).filter((f): f is CardField => Boolean(f));

  const onOf = (keys: string[]) => group(keys).filter((f) => f.enabled).length;

  const move = (keys: string[], kind: string, index: number, delta: number) => {
    const present = group(keys).map((f) => f.key);
    const to = index + delta;
    if (to < 0 || to >= present.length) return;
    [present[index], present[to]] = [present[to], present[index]];
    reorder.mutate({ kind, keys: present });
  };

  const busy = toggle.isPending || reorder.isPending;

  const renderGroup = (title: string, keys: string[], kind: string) => {
    const items = group(keys);
    return (
      <>
        <h3 className="mb-2 mt-6 flex items-center gap-2 text-base font-bold first:mt-0">
          {title}
          <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {onOf(keys)} of {items.length} on
          </span>
        </h3>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((f, i) => (
            <ControlToggle
              key={f.key}
              field={f}
              index={i}
              last={i === items.length - 1}
              busy={busy}
              onToggle={() => toggle.mutate({ key: f.key, enabled: !f.enabled })}
              onMove={(d) => move(keys, kind, i, d)}
            />
          ))}
          {items.length === 0 && <EmptyHint text="Nothing configured in this group." />}
        </div>
      </>
    );
  };

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Product Card Manager"
        title="Card composition"
        description="Toggle fields, badges, platforms and actions shown on every product card across the storefront."
      />

      {data?.ok === false && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
          <span>
            {data.reason === "not_permitted"
              ? "Changing the product card needs marketplace operator rights."
              : "The card configuration could not be read."}
          </span>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Visible Fields" value={`${onOf(VISIBLE_FIELDS)} / ${VISIBLE_FIELDS.length}`} />
        <StatCard label="Card Actions" value={`${onOf(CARD_ACTIONS)} / ${CARD_ACTIONS.length}`} tone="success" />
        <StatCard label="Badges" value={`${onOf(BADGES)} / ${BADGES.length}`} tone="premium" />
        <StatCard label="Platform Badges" value={`${onOf(PLATFORMS)} / ${PLATFORMS.length}`} tone="warning" />
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 flex-none" />
        <span>
          The figure beside each control is how many of the{" "}
          {data?.total_products ? data.total_products.toLocaleString() : "published"} products can
          actually answer it, counted from the catalogue on every read.{" "}
          <b>no store</b> means there is nowhere in this database for it to come from at
          all. A control switched on above data that does not exist renders nothing, so
          the number is the thing to read before the switch.
        </span>
      </div>

      {fields.isLoading && <EmptyHint text="Reading the card configuration…" />}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card>
          {renderGroup("Visible Fields", VISIBLE_FIELDS, "metadata")}
          {renderGroup("Card Actions", CARD_ACTIONS, "action")}
          {renderGroup("Badges", BADGES, "badge")}
          {renderGroup("Platform Badges", PLATFORMS, "platform")}
        </Card>

        <Card className="overflow-hidden">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Live Preview
          </div>
          {sample ? (
            <div className="w-full max-w-[330px]">
              <DemoCard
                demo={toDemo(sample, 0)}
                index={0}
                isFavorite={false}
                onToggleFavorite={() => {}}
              />
            </div>
          ) : (
            <EmptyHint text="Loading a real product to preview…" />
          )}
          <div className="mt-3 text-[10px] text-muted-foreground">
            This is DemoCard — the component the public homepage renders — drawn against a
            real catalogue product, not a mockup. It shows what a card looks like today;
            fields that no product can answer do not appear on it.
          </div>
        </Card>
      </div>
    </div>
  );
}

export default CardComposition;
