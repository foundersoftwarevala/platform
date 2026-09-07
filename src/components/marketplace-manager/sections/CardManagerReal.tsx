import { useMemo, useState } from "react";
import { AlertTriangle, Check, Info, Search } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Card, EmptyHint, PageHeader, StatCard } from "../ui";
import { getCardFields, setCardField, type CardField } from "@/lib/marketplace-manager/cards.functions";

/**
 * Product Card Manager — the real one.
 *
 * The screen used to be three hardcoded arrays and a "Card Templates 6" that
 * counted nothing. It governed no card: DemoCard, which every one of the
 * homepage's category rows renders through, had never heard of it.
 *
 * Each field now carries the figure that decides whether it is worth switching
 * on at all — how many published products actually hold that data, counted from
 * the catalogue on every read. That number is the honest answer to a manager
 * asking why the thumbnail field does nothing: no product has a thumbnail.
 *
 * Templates are not shown as a count. There is no template table in this
 * database, and printing "6" over nothing is what this screen used to do.
 */

const KEY = ["marketplace", "card-fields"] as const;

function Coverage({ field }: { field: CardField }) {
  if (field.have === null) {
    return (
      <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
        no store for this yet
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
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}>
      {field.have.toLocaleString()} of {field.total.toLocaleString()} · {pct}%
    </span>
  );
}

export function CardManagerSection() {
  const qc = useQueryClient();
  const [term, setTerm] = useState("");

  const fields = useQuery({
    queryKey: KEY,
    queryFn: () => getCardFields(),
    staleTime: 30_000,
  });

  const toggle = useMutation({
    mutationFn: (v: { key: string; enabled: boolean }) => setCardField({ data: v }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      toast.success("Saved — the storefront reads this on its next render.");
    },
    onError: (e: Error) => toast.error(e.message || "The change was refused."),
  });

  const data = fields.data;
  const all = useMemo(() => data?.fields ?? [], [data]);

  const shown = useMemo(() => {
    const t = term.trim().toLowerCase();
    return t ? all.filter((f) => f.label.toLowerCase().includes(t)) : all;
  }, [all, term]);

  const group = (kind: CardField["kind"]) => shown.filter((f) => f.kind === kind);
  const countOf = (kind: CardField["kind"]) => all.filter((f) => f.kind === kind).length;
  const onOf = (kind: CardField["kind"]) =>
    all.filter((f) => f.kind === kind && f.enabled).length;

  const unusable = all.filter((f) => f.enabled && f.have === 0).length;

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Product Card Manager"
        title="Card Management"
        description="Govern every visual, metadata and action surface on product cards across the marketplace — homepage, walls, search, recommendations."
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

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Visual Fields" value={`${onOf("visual")} / ${countOf("visual")}`} />
        <StatCard label="Metadata Fields" value={`${onOf("metadata")} / ${countOf("metadata")}`} tone="success" />
        <StatCard label="Action Buttons" value={`${onOf("action")} / ${countOf("action")}`} tone="premium" />
        <StatCard
          label="Published products"
          value={data?.total_products ? data.total_products.toLocaleString() : "—"}
        />
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 flex-none" />
        <span>
          The figure beside each field is how many published products actually carry
          that data, counted from the catalogue. A field switched on for data no
          product has renders nothing — so the count is the thing to read before the
          switch. Fields marked <b>no store for this yet</b> have nowhere in this
          database to come from at all.
        </span>
      </div>

      {unusable > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
          <span>
            {unusable} enabled {unusable === 1 ? "field has" : "fields have"} no product
            data behind {unusable === 1 ? "it" : "them"} and will render nothing.
          </span>
        </div>
      )}

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Find a field"
          className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
        />
      </div>

      {fields.isLoading && <EmptyHint text="Reading the card configuration…" />}

      <div className="grid gap-4 lg:grid-cols-3">
        {(["visual", "metadata", "action"] as const).map((kind) => (
          <Card key={kind}>
            <h3 className="mb-3 text-base font-bold capitalize">
              {kind === "action" ? "Action buttons" : `${kind} fields`}
            </h3>
            <div className="space-y-1.5">
              {group(kind).map((f) => (
                <div
                  key={f.key}
                  className="rounded-lg border border-border/60 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-semibold">{f.label}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={f.enabled}
                      aria-label={f.label}
                      disabled={toggle.isPending}
                      onClick={() => toggle.mutate({ key: f.key, enabled: !f.enabled })}
                      className={`inline-flex flex-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                        f.enabled
                          ? "border-accent/50 bg-accent/15 text-accent"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {f.enabled ? <Check className="h-3 w-3" /> : null}
                      {f.enabled ? "On" : "Off"}
                    </button>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Coverage field={f} />
                    {f.hint && (
                      <span className="text-[10px] text-muted-foreground">{f.hint}</span>
                    )}
                  </div>
                </div>
              ))}
              {group(kind).length === 0 && <EmptyHint text="Nothing matches that." />}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default CardManagerSection;
