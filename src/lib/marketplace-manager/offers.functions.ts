import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { callAsUser } from "@/lib/supabase-rpc.server";
import type { Json } from "@/lib/json";

const offerSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  festival: z.string().nullable(),
  offer_type: z.string(),
  discount_percent: z.number().nullable(),
  code: z.string().nullable(),
  start_date: z.string(),
  end_date: z.string(),
  status: z.string(),
  priority: z.number(),
  landing_url: z.string().nullable(),
  is_seed: z.boolean(),
  live_now: z.boolean(),
});

const offerListResponse = z.object({
  ok: z.boolean(),
  reason: z.string().optional(),
  offers: z.array(offerSchema),
});

const offerDraftSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(160),
    festival: z.string().max(100),
    offer_type: z.string().trim().min(1).max(40),
    discount_percent: z.number().min(0.01).max(100),
    code: z.string().max(80),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    priority: z.number().int().min(1).max(100),
    landing_url: z.string().max(500),
  })
  .refine((offer) => offer.end_date >= offer.start_date, {
    message: "The end date must be on or after the start date.",
    path: ["end_date"],
  });

const offerMutationResponse = z.object({
  ok: z.boolean(),
  reason: z.string().optional(),
  problems: z.array(z.string()).optional(),
});

export type MarketplaceOffer = z.infer<typeof offerSchema>;
export type MarketplaceOfferDraft = z.infer<typeof offerDraftSchema>;

function throwIfRefused(result: z.infer<typeof offerMutationResponse>, fallback: string): void {
  if (!result.ok) {
    throw new Error(result.problems?.join(" ") || result.reason || fallback);
  }
}

export const getMarketplaceOffers = createServerFn({ method: "GET" }).handler(
  async (): Promise<MarketplaceOffer[]> => {
    const result = offerListResponse.safeParse(
      await callAsUser<Json>("mm_offers", { p_query: { limit: 100 } }),
    );
    if (!result.success) throw new Error("The campaign list response was invalid.");
    if (!result.data.ok) {
      throw new Error(
        result.data.reason === "not_permitted"
          ? "Campaign management requires marketplace operator access."
          : "Campaigns could not be loaded.",
      );
    }
    return result.data.offers;
  },
);

export const saveMarketplaceOffer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => offerDraftSchema.parse(input))
  .handler(async ({ data }): Promise<void> => {
    const response = offerMutationResponse.safeParse(
      await callAsUser<Json>("mm_offer_save", { p_patch: data }),
    );
    if (!response.success) throw new Error("The campaign save response was invalid.");
    throwIfRefused(response.data, "The campaign was not saved.");
  });

const transitionInput = z.object({
  id: z.string().uuid(),
  status: z.enum(["draft", "scheduled", "active", "paused", "expired", "archived"]),
});

export const transitionMarketplaceOffer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => transitionInput.parse(input))
  .handler(async ({ data }): Promise<void> => {
    const response = offerMutationResponse.safeParse(
      await callAsUser<Json>("mm_offer_transition", { p_id: data.id, p_to: data.status }),
    );
    if (!response.success) throw new Error("The campaign transition response was invalid.");
    throwIfRefused(response.data, "The campaign status was not changed.");
  });
