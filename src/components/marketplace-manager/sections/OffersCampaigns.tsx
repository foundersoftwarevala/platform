import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getMarketplaceOffers,
  saveMarketplaceOffer,
  transitionMarketplaceOffer,
} from "@/lib/marketplace-manager/offers.functions";
import type {
  MarketplaceOffer,
  MarketplaceOfferDraft,
} from "@/lib/marketplace-manager/offers.functions";
import { Card, EmptyHint, PageHeader } from "../ui";

function dateString(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

function newDraft(): MarketplaceOfferDraft {
  return {
    title: "",
    festival: "",
    offer_type: "discount",
    discount_percent: 10,
    code: "",
    start_date: dateString(0),
    end_date: dateString(30),
    priority: 50,
    landing_url: "",
  };
}

export function OffersSection() {
  const queryClient = useQueryClient();
  const offers = useQuery({
    queryKey: ["marketplace", "campaigns"],
    queryFn: () => getMarketplaceOffers(),
    staleTime: 30_000,
  });
  const [draft, setDraft] = useState<MarketplaceOfferDraft | null>(null);
  const save = useMutation({
    mutationFn: (input: MarketplaceOfferDraft) => saveMarketplaceOffer({ data: input }),
    onSuccess: async () => {
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey: ["marketplace", "campaigns"] });
    },
  });
  const transition = useMutation({
    mutationFn: (input: {
      id: string;
      status: "draft" | "scheduled" | "active" | "paused" | "expired" | "archived";
    }) => transitionMarketplaceOffer({ data: input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["marketplace", "campaigns"] });
    },
  });

  const edit = (offer: MarketplaceOffer) => {
    setDraft({
      id: offer.id,
      title: offer.title,
      festival: offer.festival ?? "",
      offer_type: offer.offer_type,
      discount_percent: offer.discount_percent ?? 10,
      code: offer.code ?? "",
      start_date: offer.start_date,
      end_date: offer.end_date,
      priority: offer.priority,
      landing_url: offer.landing_url ?? "",
    });
  };

  const update = <K extends keyof MarketplaceOfferDraft>(
    field: K,
    value: MarketplaceOfferDraft[K],
  ) => setDraft((current) => (current ? { ...current, [field]: value } : current));

  const error = save.error ?? transition.error;

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Offer Manager"
        title="Deals & Promotions"
        description="Create and manage campaigns using the existing marketing-offers records. New campaigns are saved as drafts and never publish automatically."
        actions={
          <button
            type="button"
            onClick={() => {
              save.reset();
              setDraft(newDraft());
            }}
            className="rounded-full bg-accent px-4 py-2 text-xs font-bold text-background"
          >
            New campaign
          </button>
        }
      />

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-destructive/30 p-3 text-sm text-destructive"
        >
          {error.message}
        </p>
      )}

      {draft && (
        <Card className="mb-5">
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate(draft);
            }}
          >
            <label className="grid gap-1 text-xs">
              Campaign title
              <input
                required
                maxLength={160}
                value={draft.title}
                onChange={(event) => update("title", event.target.value)}
                className="rounded border border-border bg-background px-2 py-1.5"
              />
            </label>
            <label className="grid gap-1 text-xs">
              Campaign type
              <input
                required
                maxLength={40}
                value={draft.offer_type}
                onChange={(event) => update("offer_type", event.target.value)}
                className="rounded border border-border bg-background px-2 py-1.5"
              />
            </label>
            <label className="grid gap-1 text-xs">
              Festival / occasion
              <input
                maxLength={100}
                value={draft.festival}
                onChange={(event) => update("festival", event.target.value)}
                className="rounded border border-border bg-background px-2 py-1.5"
              />
            </label>
            <label className="grid gap-1 text-xs">
              Discount percent
              <input
                required
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                value={draft.discount_percent}
                onChange={(event) => update("discount_percent", Number(event.target.value))}
                className="rounded border border-border bg-background px-2 py-1.5"
              />
            </label>
            <label className="grid gap-1 text-xs">
              Coupon code (optional)
              <input
                maxLength={80}
                value={draft.code}
                onChange={(event) => update("code", event.target.value)}
                className="rounded border border-border bg-background px-2 py-1.5"
              />
            </label>
            <label className="grid gap-1 text-xs">
              Priority
              <input
                required
                type="number"
                min="1"
                max="100"
                step="1"
                value={draft.priority}
                onChange={(event) => update("priority", Number(event.target.value))}
                className="rounded border border-border bg-background px-2 py-1.5"
              />
            </label>
            <label className="grid gap-1 text-xs">
              Starts
              <input
                required
                type="date"
                value={draft.start_date}
                onChange={(event) => update("start_date", event.target.value)}
                className="rounded border border-border bg-background px-2 py-1.5"
              />
            </label>
            <label className="grid gap-1 text-xs">
              Ends
              <input
                required
                type="date"
                value={draft.end_date}
                onChange={(event) => update("end_date", event.target.value)}
                className="rounded border border-border bg-background px-2 py-1.5"
              />
            </label>
            <label className="grid gap-1 text-xs md:col-span-2">
              Landing URL (optional)
              <input
                maxLength={500}
                value={draft.landing_url}
                onChange={(event) => update("landing_url", event.target.value)}
                className="rounded border border-border bg-background px-2 py-1.5"
              />
            </label>
            <div className="flex gap-2 md:col-span-2">
              <button
                type="submit"
                disabled={save.isPending}
                className="rounded bg-accent px-3 py-1.5 text-xs font-bold text-background disabled:opacity-50"
              >
                {save.isPending ? "Saving…" : "Save draft"}
              </button>
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="rounded border border-border px-3 py-1.5 text-xs"
              >
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      {offers.isLoading ? (
        <EmptyHint text="Loading campaigns…" />
      ) : offers.isError ? (
        <div className="space-y-2">
          <EmptyHint text="Campaigns could not be loaded." />
          <button
            type="button"
            onClick={() => void offers.refetch()}
            className="text-xs font-semibold text-accent"
          >
            Retry
          </button>
        </div>
      ) : (offers.data ?? []).length === 0 ? (
        <EmptyHint text="No campaign records exist yet." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {(offers.data ?? []).map((offer) => (
            <Card key={offer.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">{offer.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {offer.offer_type} · {offer.discount_percent ?? 0}% · {offer.start_date} to{" "}
                    {offer.end_date}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {offer.code ? `Code ${offer.code} · ` : ""}
                    {offer.festival ?? "No occasion"} · Priority {offer.priority}
                    {offer.is_seed ? " · Seed record" : ""}
                  </p>
                </div>
                <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold uppercase">
                  {offer.status}
                  {offer.live_now ? " · live" : ""}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    save.reset();
                    edit(offer);
                  }}
                  className="rounded border border-border px-3 py-1.5 text-xs"
                >
                  Edit
                </button>
                <button
                  type="button"
                  disabled={transition.isPending || offer.is_seed}
                  title={offer.is_seed ? "Seed records cannot be published." : undefined}
                  onClick={() =>
                    transition.mutate({
                      id: offer.id,
                      status: offer.status === "active" ? "paused" : "active",
                    })
                  }
                  className="rounded border border-border px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {offer.status === "active" ? "Pause" : "Publish"}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
