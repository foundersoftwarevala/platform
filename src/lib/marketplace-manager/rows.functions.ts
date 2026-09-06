import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

/**
 * Marketplace homepage rows — the real ones.
 *
 * The public homepage builds its product rows from marketplace_categories:
 * `is_hidden=eq.false`, ordered by `sort_order`, one row per category, each
 * filled by `productsFor(category_id)`. That is the source of truth, so these
 * functions manage exactly that and nothing beside it.
 *
 * Ordering and visibility are written to marketplace_categories itself, the
 * columns the homepage filters and sorts on. Product placement and row
 * settings live in marketplace_row_slots and marketplace_row_config, which are
 * new because placement genuinely did not exist anywhere before — the homepage
 * simply took whatever `sort_order` gave it.
 *
 * Everything is called as the signed-in person, so the database decides who may
 * change the front page. Using the service role here would make every caller an
 * operator.
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

type Outcome = { ok?: boolean; reason?: string; message?: string; [k: string]: unknown };

/** Turns a refusal into a sentence a person can act on. */
function settle(result: Outcome | null, whenOk: string) {
  if (!result?.ok) {
    if (result?.reason === "category_mismatch") {
      const err = new Error(
        `Product category mismatch — “${result.product}” belongs to ${result.product_category}, ` +
          `this row is ${result.row_category}.` +
          (result.override_allowed
            ? " Cross-category placement is enabled, so it can be forced."
            : " Enable cross-category placement on this row to override."),
      );
      (err as Error & { code?: string }).code = "category_mismatch";
      throw err;
    }
    throw new Error(
      result?.reason === "not_permitted"
        ? "Changing homepage rows needs marketplace operator rights."
        : result?.reason === "duplicate_product"
          ? String(result.message ?? "That product already occupies another slot in this row.")
          : String(result?.message ?? result?.reason ?? "The change was refused."),
    );
  }
  return { ...result, ok: true as const, message: whenOk };
}

export type HomepageRow = {
  key: string;
  category_id: string;
  title: string;
  icon: string | null;
  sort_order_num: number | null;
  hidden: boolean;
  featured: boolean;
  source_mode: "manual" | "auto" | "hybrid";
  auto_rule: string;
  max_products: number;
  status: string;
  visible_desktop: boolean;
  visible_tablet: boolean;
  visible_mobile: boolean;
  starts_at: string | null;
  ends_at: string | null;
  cta_label: string | null;
  cta_href: string | null;
  configured: boolean;
  filled_slots: number;
  pinned_slots: number;
  eligible_products: number;
  updated_at: string | null;
};

/** Every real homepage row, with counted figures rather than declared ones. */
export const listHomepageRows = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ ok: true; rows: HomepageRow[] }> => {
    const rows = await callAsUser<HomepageRow[]>("mm_rows_list", {});
    return { ok: true as const, rows: rows ?? [] };
  },
);

export type RowSlot = {
  position: number;
  product_id: string;
  name: string;
  slug: string;
  thumbnail_url: string | null;
  pinned: boolean;
  source: "manual" | "auto";
  live: boolean;
};

/**
 * A row's positions, resolved exactly as the homepage resolves them — same
 * function, so what the manager sees is what the page renders.
 */
export const getRowProducts = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ key: z.string().min(1).max(120) }).parse(i))
  .handler(async ({ data }) => {
    return callAsUser<{
      ok: boolean;
      row: string;
      source_mode: string;
      auto_rule: string;
      max_products: number;
      filled: number;
      empty: number;
      eligible_total: number;
      products: RowSlot[];
    }>("mm_row_products", { p_key: data.key });
  });

export const assignSlot = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      key: z.string().min(1),
      position: z.number().int().min(1).max(60),
      productId: z.string().uuid(),
      override: z.boolean().optional(),
    }).parse(i),
  )
  .handler(async ({ data }) =>
    settle(
      await callAsUser<Outcome>("mm_slot_assign", {
        p_key: data.key,
        p_position: data.position,
        p_product_id: data.productId,
        p_override: data.override ?? false,
      }),
      `Assigned to slot ${data.position}`,
    ),
  );

export const removeSlot = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ key: z.string().min(1), position: z.number().int().min(1).max(60) }).parse(i),
  )
  .handler(async ({ data }) =>
    settle(
      await callAsUser<Outcome>("mm_slot_remove", { p_key: data.key, p_position: data.position }),
      `Slot ${data.position} cleared`,
    ),
  );

export const moveSlot = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      key: z.string().min(1),
      from: z.number().int().min(1).max(60),
      to: z.number().int().min(1).max(60),
    }).parse(i),
  )
  .handler(async ({ data }) =>
    settle(
      await callAsUser<Outcome>("mm_slot_move", {
        p_key: data.key, p_from: data.from, p_to: data.to,
      }),
      `Moved to slot ${data.to}`,
    ),
  );

export const pinSlot = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      key: z.string().min(1),
      position: z.number().int().min(1).max(60),
      pinned: z.boolean(),
    }).parse(i),
  )
  .handler(async ({ data }) =>
    settle(
      await callAsUser<Outcome>("mm_slot_pin", {
        p_key: data.key, p_position: data.position, p_pinned: data.pinned,
      }),
      data.pinned ? "Pinned" : "Unpinned",
    ),
  );

export const configureRow = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      key: z.string().min(1),
      patch: z.record(z.string(), z.unknown()),
    }).parse(i),
  )
  .handler(async ({ data }) =>
    settle(
      await callAsUser<Outcome>("mm_row_configure", { p_key: data.key, p_patch: data.patch }),
      "Row updated",
    ),
  );

export const reorderRows = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ keys: z.array(z.string().min(1)).min(1).max(200) }).parse(i),
  )
  .handler(async ({ data }) =>
    settle(await callAsUser<Outcome>("mm_rows_reorder", { p_keys: data.keys }), "Rows reordered"),
  );

export const getRowAnalytics = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ key: z.string().min(1) }).parse(i))
  .handler(async ({ data }) =>
    callAsUser<{
      ok: boolean;
      product_views: number;
      demo_opens: number;
      cta_clicks: number;
      orders: number;
      revenue: number;
      ctr: number | null;
      conversion: number | null;
      measured_from: string | null;
    }>("mm_row_analytics", { p_key: data.key }),
  );

/**
 * The product picker. Searches the real catalogue, defaulting to the row's own
 * category so the common case cannot produce a mismatch, while still allowing a
 * deliberate cross-category search.
 */
export const searchRowProducts = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) =>
    z.object({
      categoryId: z.string().uuid().optional(),
      query: z.string().max(120).optional(),
      onlyPublished: z.boolean().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }).parse(i ?? {}),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("marketplace_products")
      .select("id,name,slug,thumbnail_url,category_id,subcategory,industry_label,visible,content_status,moderation_status")
      .order("sort_order", { ascending: true })
      .limit(data.limit ?? 24);

    if (data.categoryId) q = q.eq("category_id", data.categoryId);
    if (data.onlyPublished !== false) q = q.eq("visible", true).eq("content_status", "published");
    if (data.query?.trim()) q = q.ilike("name", `%${data.query.trim()}%`);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true as const, products: rows ?? [] };
  });
