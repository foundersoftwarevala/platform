import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

/**
 * Storefront filters.
 *
 * Only the group configuration is stored. The values are derived from the
 * canonical product and category tables on every read, so there is no second
 * copy of the taxonomy to drift out of step with the catalogue.
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

export type FilterValue = { value: string; label: string; count: number };

export type FilterGroup = {
  key: string;
  label: string;
  source: string;
  enabled: boolean;
  position: number;
  select_mode: "single" | "multi";
  combine: "and" | "or";
  visible_desktop: boolean;
  visible_mobile: boolean;
  values: FilterValue[];
};

export const listStorefrontFilters = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ ok: boolean; reason?: string; groups?: FilterGroup[] }> =>
    callAsUser("mm_filters", {}),
);

export const configureStorefrontFilter = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      key: z.string().min(1).max(60),
      patch: z.record(z.string(), z.unknown()),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const result = await callAsUser<{ ok?: boolean; reason?: string }>("mm_filter_set", {
      p_key: data.key,
      p_patch: data.patch,
    });
    if (!result?.ok) {
      throw new Error(
        result?.reason === "not_permitted"
          ? "Changing storefront filters needs marketplace operator rights."
          : "The change was refused.",
      );
    }
    return { ok: true as const };
  });
