import { callAsUser } from "@/lib/supabase-rpc.server";
import type { JsonObject } from "@/lib/json";
import { createServerFn } from "@tanstack/react-start";

/** Marketing counts, with seed and real kept apart, read as the operator. */

export const getMarketingSummary = createServerFn({ method: "GET" }).handler(
  async (): Promise<JsonObject> => {
    const summary = await callAsUser<JsonObject>("mm_marketing_summary", {});
    // The RPC answers a refusal as { ok: false } rather than an error, and the
    // screen showed it as a row of zero counts.
    if (summary && summary.ok === false) {
      throw new Error(summary.reason === "not_permitted" ? "not_permitted" : String(summary.reason ?? "refused"));
    }
    return summary;
  },
);
