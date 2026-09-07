import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

/**
 * The product card configuration.
 *
 * One registry, read by the storefront and written by the Product Card
 * Manager. The coverage figures are counted from the live catalogue rather than
 * declared, so the manager can see that no product has a thumbnail before
 * switching a thumbnail field on.
 */

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

export type CardField = {
  kind: "visual" | "metadata" | "action";
  key: string;
  label: string;
  enabled: boolean;
  position: number;
  hint: string | null;
  requires: string | null;
  data_column: string | null;
  /** How many published products carry the data. Null means no store exists. */
  have: number | null;
  total: number;
  pct: number | null;
};

export const getCardFields = createServerFn({ method: "GET" }).handler(
  async (): Promise<{
    ok: boolean;
    reason?: string;
    total_products?: number;
    fields?: CardField[];
  }> => callAsUser("mm_card_coverage", {}),
);

export const setCardField = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ key: z.string().min(1).max(80), enabled: z.boolean() }).parse(i),
  )
  .handler(async ({ data }) => {
    const result = await callAsUser<{ ok?: boolean; reason?: string }>(
      "mm_card_field_set",
      { p_key: data.key, p_enabled: data.enabled },
    );
    if (!result?.ok) {
      throw new Error(
        result?.reason === "not_permitted"
          ? "Changing the product card needs marketplace operator rights."
          : "The change was refused.",
      );
    }
    return { ok: true as const };
  });
