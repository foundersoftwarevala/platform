import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

/** Marketing counts, with seed and real kept apart, read as the operator. */
async function callAsUser<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Unauthorized: sign in required");

  const { createClient } = await import("@supabase/supabase-js");
  const base = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const key =
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  const client = createClient(base, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const getMarketingSummary = createServerFn({ method: "GET" }).handler(
  async (): Promise<Record<string, unknown>> => {
    const summary = await callAsUser<Record<string, unknown>>("mm_marketing_summary", {});
    // The RPC answers a refusal as { ok: false } rather than an error, and the
    // screen showed it as a row of zero counts.
    if (summary && summary.ok === false) {
      throw new Error(summary.reason === "not_permitted" ? "not_permitted" : String(summary.reason ?? "refused"));
    }
    return summary;
  },
);
