import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

/**
 * Offers, through the offer engine the homepage banner already reads.
 *
 * The storefront's offer banner is fed by sf_active_offers() over
 * public.marketing_offers (active, not seed, inside its dates). Marketplace
 * Manager's Offers screen showed six hardcoded "Up to 70% off" cards and a
 * table of marketplace_coupons, which the banner never reads, so nothing done
 * there could reach a customer. These wrap the engine's own functions -
 * mm_offers, mm_offer_save and mm_offer_transition - called as the signed-in
 * person, so the database checks operator rights, validates anything going
 * live and records every change in the audit log.
 */

async function callAsUser<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Unauthorized: sign in required");

  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const key =
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

type Outcome = {
  ok?: boolean;
  reason?: string;
  problems?: string[];
  [k: string]: unknown;
};

function settle<T extends Outcome>(result: T | null): T {
  if (result?.ok) return result;
  if (result?.reason === "not_permitted") {
    throw new Error("Managing offers needs marketplace operator rights.");
  }
  if (result?.reason === "validation_failed" && result.problems?.length) {
    throw new Error(result.problems.join(" "));
  }
  throw new Error(String(result?.reason ?? "The change was refused."));
}

export type Offer = {
  id: string;
  title: string;
  festival: string | null;
  offer_type: string | null;
  discount_percent: number | null;
  code: string | null;
  start_date: string | null;
  end_date: string | null;
  status: "draft" | "scheduled" | "active" | "paused" | "expired" | "archived";
  is_seed: boolean | null;
  priority: number | null;
  landing_url: string | null;
  live_now?: boolean;
};

export type OfferList = {
  ok: true;
  total: number;
  seed: number;
  real: number;
  live_now: number;
  offers: Offer[];
};

export const listOffers = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) =>
    z.object({ status: z.string().max(20).optional(), search: z.string().max(120).optional() }).parse(i ?? {}),
  )
  .handler(async ({ data }): Promise<OfferList> => {
    const result = await callAsUser<Outcome>("mm_offers", {
      p_query: { status: data.status ?? "", search: data.search ?? "", limit: 200 },
    });
    const list = settle(result) as unknown as OfferList;
    return {
      ok: true,
      total: Number(list.total ?? 0),
      seed: Number(list.seed ?? 0),
      real: Number(list.real ?? 0),
      live_now: Number(list.live_now ?? 0),
      offers: Array.isArray(list.offers) ? list.offers : [],
    };
  });

const saveOfferInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().max(200).optional(),
  festival: z.string().max(120).nullable().optional(),
  discount_percent: z.number().min(0).max(100).nullable().optional(),
  code: z.string().max(40).nullable().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  landing_url: z.string().max(500).nullable().optional(),
});
export type SaveOfferInput = z.infer<typeof saveOfferInput>;

export const saveOffer = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => saveOfferInput.parse(i))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) patch[k] = v === null ? "" : v;
    settle(await callAsUser<Outcome>("mm_offer_save", { p_patch: patch }));
    return { ok: true as const };
  });

export const transitionOffer = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        to: z.enum(["draft", "scheduled", "active", "paused", "expired", "archived"]),
      })
      .parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    settle(await callAsUser<Outcome>("mm_offer_transition", { p_id: data.id, p_to: data.to }));
    return { ok: true as const };
  });
