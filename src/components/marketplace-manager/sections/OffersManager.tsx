import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Tag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, PageHeader, PillButton, StatCard } from "../ui";
import {
  listOffers,
  saveOffer,
  transitionOffer,
  type Offer,
  type SaveOfferInput,
} from "@/lib/marketplace-manager/offers.functions";

/**
 * Offer Manager, on the offer engine the homepage banner reads.
 *
 * An offer that is active, not seed data and inside its dates is returned by
 * sf_active_offers() and shown first in the homepage offer banner. Everything
 * here goes through mm_offer_save / mm_offer_transition, so going live is
 * validated by the database (a title, a discount between 0 and 100, an open
 * window, a code no other live offer uses) and every change is audited.
 * Seed rows are shown for reference and can never be published.
 */
export function OffersManager() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Offer | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["mm-offers"],
    queryFn: () => listOffers({ data: {} }),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["mm-offers"] });

  const save = useMutation({
    mutationFn: (patch: SaveOfferInput) => saveOffer({ data: patch }),
    onSuccess: () => {
      refresh();
      setEditing(null);
      toast.success("Offer saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const move = useMutation({
    mutationFn: (v: { id: string; to: Offer["status"] }) => transitionOffer({ data: v }),
    onSuccess: (_r, v) => {
      refresh();
      toast.success(v.to === "active" ? "Live — it leads the homepage offer banner" : `Moved to ${v.to}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const offers = data?.offers ?? [];

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Offer Manager"
        title="Deals & Promotions"
        description="Offers that go live here lead the offer banner on the marketplace homepage."
        actions={
          <PillButton variant="premium" onClick={() => save.mutate({ title: "New offer" })}>
            + New Offer
          </PillButton>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Offers" value={String(data?.total ?? 0)} />
        <StatCard label="Live on the homepage" value={String(data?.live_now ?? 0)} tone="success" />
        <StatCard label="Real" value={String(data?.real ?? 0)} />
        <StatCard label="Seed (never shown)" value={String(data?.seed ?? 0)} tone="warning" />
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading offers…
        </div>
      )}
      {error && <p className="text-sm text-red-400">{(error as Error).message}</p>}

      {editing && (
        <OfferEditor
          value={editing}
          saving={save.isPending}
          onCancel={() => setEditing(null)}
          onSave={(patch) => save.mutate({ id: editing.id, ...patch })}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {offers.map((o) => (
          <Card key={o.id} className="relative overflow-hidden">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-premium/20 blur-2xl" />
            <div className="relative">
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded bg-premium/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-premium">
                  <Tag className="h-3 w-3" /> {o.festival || o.offer_type || "Offer"}
                </span>
                <span className="rounded bg-muted/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  {o.live_now ? "Live" : o.status}
                </span>
                {o.is_seed && (
                  <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                    Seed
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold">{o.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {o.discount_percent ? `${o.discount_percent}% off` : "No discount set"}
                {o.code ? ` · code ${o.code}` : ""}
              </p>
              <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Starts {o.start_date ?? "—"}</span>
                <span>Ends {o.end_date ?? "—"}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {!o.is_seed && (
                  <PillButton variant="ghost" onClick={() => setEditing(o)}>Edit</PillButton>
                )}
                {!o.is_seed && o.status !== "active" && (
                  <PillButton variant="primary" onClick={() => move.mutate({ id: o.id, to: "active" })}>
                    Publish
                  </PillButton>
                )}
                {o.status === "active" && (
                  <PillButton variant="ghost" onClick={() => move.mutate({ id: o.id, to: "paused" })}>
                    Pause
                  </PillButton>
                )}
                {o.status !== "archived" && (
                  <PillButton variant="ghost" onClick={() => move.mutate({ id: o.id, to: "archived" })}>
                    Archive
                  </PillButton>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function OfferEditor({
  value,
  saving,
  onCancel,
  onSave,
}: {
  value: Offer;
  saving: boolean;
  onCancel: () => void;
  onSave: (patch: {
    title: string;
    festival: string | null;
    discount_percent: number | null;
    code: string | null;
    start_date: string | null;
    end_date: string | null;
    landing_url: string | null;
  }) => void;
}) {
  const [f, setF] = useState({
    title: value.title ?? "",
    festival: value.festival ?? "",
    discount: value.discount_percent == null ? "" : String(value.discount_percent),
    code: value.code ?? "",
    start: value.start_date ?? "",
    end: value.end_date ?? "",
    landing: value.landing_url ?? "",
  });
  const field =
    "w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-accent/60";
  return (
    <Card className="mb-6">
      <div className="grid gap-3 md:grid-cols-2">
        <input className={field} placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <input className={field} placeholder="Occasion (optional)" value={f.festival} onChange={(e) => setF({ ...f, festival: e.target.value })} />
        <input className={field} type="number" min={0} max={100} placeholder="Discount %" value={f.discount} onChange={(e) => setF({ ...f, discount: e.target.value })} />
        <input className={field} placeholder="Code (optional)" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
        <input className={field} type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} />
        <input className={field} type="date" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} />
        <input className={field + " md:col-span-2"} placeholder="Landing link (optional), e.g. /marketplace" value={f.landing} onChange={(e) => setF({ ...f, landing: e.target.value })} />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <PillButton variant="ghost" onClick={onCancel}>Cancel</PillButton>
        <PillButton
          variant="primary"
          onClick={() =>
            onSave({
              title: f.title,
              festival: f.festival || null,
              discount_percent: f.discount === "" ? null : Number(f.discount),
              code: f.code || null,
              start_date: f.start || null,
              end_date: f.end || null,
              landing_url: f.landing || null,
            })
          }
        >
          {saving ? "Saving…" : "Save offer"}
        </PillButton>
      </div>
    </Card>
  );
}
