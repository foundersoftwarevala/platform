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
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

type Outcome = { ok?: boolean; reason?: string; message?: string; [k: string]: unknown };

/**
 * Who may change a homepage section through the one write here that uses the
 * service role. These are the roles both requireOperator and mm_is_operator()
 * accept, so nobody gains a write they did not already have through the RPCs.
 */
const SECTION_WRITERS = new Set(["admin", "boss", "founder", "super_admin", "boss_owner"]);

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
  // Every caller of settle() is a write that succeeded: the storefront caches
  // what rows hold, so they are emptied now (catalogue-invalidation.ts).
  void import("@/lib/marketplace/catalogue-invalidation").then((m) => m.catalogueChanged());
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
    z
      .object({
        key: z.string().min(1),
        position: z.number().int().min(1).max(60),
        productId: z.string().uuid(),
        override: z.boolean().optional(),
      })
      .parse(i),
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
    z
      .object({
        key: z.string().min(1),
        from: z.number().int().min(1).max(60),
        to: z.number().int().min(1).max(60),
      })
      .parse(i),
  )
  .handler(async ({ data }) =>
    settle(
      await callAsUser<Outcome>("mm_slot_move", {
        p_key: data.key,
        p_from: data.from,
        p_to: data.to,
      }),
      `Moved to slot ${data.to}`,
    ),
  );

export const pinSlot = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        key: z.string().min(1),
        position: z.number().int().min(1).max(60),
        pinned: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data }) =>
    settle(
      await callAsUser<Outcome>("mm_slot_pin", {
        p_key: data.key,
        p_position: data.position,
        p_pinned: data.pinned,
      }),
      data.pinned ? "Pinned" : "Unpinned",
    ),
  );

export const configureRow = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        key: z.string().min(1),
        patch: z.record(z.string(), z.unknown()),
      })
      .parse(i),
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
  .inputValidator((i: unknown) => z.object({ key: z.string().min(1).max(120) }).parse(i))
  .handler(async ({ data }) => {
    // The RPC gates direct callers too; this check gives the server path the
    // same operator policy before invoking it with the user's credentials.
    const { requireMarketplaceOperator } = await import("./mm-operator.server");
    await requireMarketplaceOperator("Reading row analytics");
    return callAsUser<{
      ok: boolean;
      product_views: number;
      demo_opens: number;
      cta_clicks: number;
      orders: number;
      revenue: number;
      ctr: number | null;
      conversion: number | null;
      measured_from: string | null;
    }>("mm_row_analytics", { p_key: data.key });
  });

/**
 * The product picker. Searches the real catalogue, defaulting to the row's own
 * category so the common case cannot produce a mismatch, while still allowing a
 * deliberate cross-category search.
 */
export const searchRowProducts = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) =>
    z
      .object({
        categoryId: z.string().uuid().optional(),
        query: z.string().max(120).optional(),
        onlyPublished: z.boolean().optional(),
        subcategory: z.string().max(120).optional(),
        industry: z.string().max(120).optional(),
        sellerId: z.string().uuid().optional(),
        license: z.string().max(60).optional(),
        featured: z.boolean().optional(),
        trending: z.boolean().optional(),
        bestSeller: z.boolean().optional(),
        newRelease: z.boolean().optional(),
        limit: z.number().int().min(1).max(50).optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data }) => {
    // The service role reads past every policy, so only an operator may ask for
    // drafts and hidden products. Anyone else gets the published catalogue.
    if (data.onlyPublished === false) {
      const { requireMarketplaceOperator } = await import("./mm-operator.server");
      await requireMarketplaceOperator("Searching unpublished products");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("marketplace_products")
      .select(
        "id,name,slug,thumbnail_url,category_id,subcategory,industry_label,visible,content_status,moderation_status,license,is_featured,is_trending,is_best_seller,is_new_release,seller_id",
      )
      .order("sort_order", { ascending: true })
      .limit(data.limit ?? 24);

    if (data.categoryId) q = q.eq("category_id", data.categoryId);
    if (data.onlyPublished !== false) q = q.eq("visible", true).eq("content_status", "published");
    // % and _ are wildcards to ilike; a search for "50%" means the characters.
    if (data.query?.trim())
      q = q.ilike("name", `%${data.query.trim().replace(/[\\%_]/g, "\\$&")}%`);
    if (data.subcategory) q = q.eq("subcategory", data.subcategory);
    if (data.industry) q = q.eq("industry_label", data.industry);
    if (data.sellerId) q = q.eq("seller_id", data.sellerId);
    if (data.featured) q = q.eq("is_featured", true);
    if (data.trending) q = q.eq("is_trending", true);
    if (data.bestSeller) q = q.eq("is_best_seller", true);
    if (data.newRelease) q = q.eq("is_new_release", true);
    // Legal status, section 6. `license` is what the catalogue actually records
    // per product; legal_product_bindings is the Legal Manager link and is
    // empty today, so filtering on it would return nothing and look broken.
    if (data.license) q = q.eq("license", data.license);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true as const, products: rows ?? [] };
  });

/* ------------------------------------------------------------------------ */
/* Create Row, bulk placement, audit — section 9, 14, 15.                     */
/* ------------------------------------------------------------------------ */

/**
 * Create a homepage row that does not exist yet.
 *
 * The database refuses a key that any category slug or existing row already
 * uses, so this cannot produce a second row with the same name — the failure
 * comes back as `row_exists` and the manager is told to manage the existing one
 * instead.
 *
 * A new row is created as a draft on purpose. Creating a row should not put
 * something in front of customers before anybody has looked at it.
 */
export const createRow = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        key: z
          .string()
          .min(1)
          .max(60)
          .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use a lowercase slug such as featured-software"),
        title: z.string().min(1).max(120).optional(),
        row_kind: z.enum(["category", "curated"]).optional(),
        category_id: z.string().uuid().optional(),
        subcategory: z.string().max(120).optional(),
        source_mode: z.enum(["manual", "auto", "hybrid"]).optional(),
        auto_rule: z
          .enum([
            "sort_order",
            "newest",
            "best_selling",
            "trending",
            "rating",
            "featured",
            "new_release",
          ])
          .optional(),
        max_products: z.number().int().min(1).max(60).optional(),
        visible_desktop: z.boolean().optional(),
        visible_tablet: z.boolean().optional(),
        visible_mobile: z.boolean().optional(),
        starts_at: z.string().optional(),
        ends_at: z.string().optional(),
        cta_label: z.string().max(60).optional(),
        cta_href: z.string().max(300).optional(),
        status: z
          .enum(["draft", "review", "scheduled", "published", "unpublished", "archived"])
          .optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) =>
    settle(await callAsUser<Outcome>("mm_row_create", { p_spec: data }), "Row created"),
  );

/**
 * Fill several slots at once.
 *
 * Section 15 asks for bulk actions, and doing it one round trip per product
 * would be slow and would half-apply on a failure. Each assignment still goes
 * through mm_slot_assign, so category validation and duplicate protection apply
 * to every one of them; the results are reported per product rather than as a
 * single success.
 */
export const assignSlotsBulk = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        key: z.string().min(1),
        productIds: z.array(z.string().uuid()).min(1).max(60),
        startAt: z.number().int().min(1).max(60).optional(),
        override: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const results: { productId: string; ok: boolean; reason?: string }[] = [];
    let position = data.startAt ?? 1;
    for (const productId of data.productIds) {
      try {
        const r = await callAsUser<Outcome>("mm_slot_assign", {
          p_key: data.key,
          p_position: position,
          p_product_id: productId,
          p_override: data.override ?? false,
        });
        results.push({ productId, ok: Boolean(r?.ok), reason: r?.reason });
      } catch (error) {
        results.push({ productId, ok: false, reason: (error as Error).message });
      }
      position += 1;
      if (position > 60) break;
    }
    const placed = results.filter((r) => r.ok).length;
    return {
      ok: true as const,
      placed,
      refused: results.length - placed,
      results,
      message: `${placed} placed${results.length - placed ? `, ${results.length - placed} refused` : ""}`,
    };
  });

/** Clear a whole row's placements at once. */
export const clearRowSlots = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        key: z.string().min(1),
        positions: z.array(z.number().int().min(1).max(60)).min(1),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    // Counted by what was actually removed. An empty or rule-filled slot
    // answers ok with removed 0, and a refusal was counted as nothing yet still
    // reported as success - "5 slot(s) cleared" when none were.
    let cleared = 0;
    let unchanged = 0;
    for (const position of data.positions) {
      const r = await callAsUser<Outcome & { removed?: number }>("mm_slot_remove", {
        p_key: data.key,
        p_position: position,
      });
      if (!r?.ok) settle(r, "The slots could not be cleared.");
      const removed = Number(r?.removed ?? 1);
      if (removed > 0) cleared += 1;
      else unchanged += 1;
    }
    return {
      ok: true as const,
      cleared,
      message:
        `${cleared} slot(s) cleared` +
        (unchanged ? `; ${unchanged} held no hand-placed product and were left as they were` : ""),
    };
  });

/** The audit trail for a row — section 14. */
export const getRowAudit = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ key: z.string().min(1) }).parse(i))
  .handler(async ({ data }) => {
    // The trail carries operator e-mails and full before/after state, read with
    // the service role, so it is for operators only - the console's own
    // operators (mm_is_operator), not requireOperator's wider staff list.
    const { requireMarketplaceOperator } = await import("./mm-operator.server");
    await requireMarketplaceOperator("Reading the row history");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("marketplace_categories")
      .select("id")
      .eq("slug", data.key)
      .maybeSingle();
    const { data: cfg } = await supabaseAdmin
      .from("marketplace_row_config")
      .select("id")
      .eq("key", data.key)
      .maybeSingle();
    const ids = [row?.id, cfg?.id].filter(Boolean) as string[];
    if (!ids.length) return { ok: true as const, entries: [] };

    const { data: entries, error } = await supabaseAdmin
      .from("marketplace_audit_logs")
      .select("action,actor,actor_role,before_state,after_state,reason,created_at")
      .in("entity_id", ids)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { ok: true as const, entries: entries ?? [] };
  });

/* ------------------------------------------------------------------------ */
/* The complete homepage section inventory — sections 3, 12 and 24.          */
/* ------------------------------------------------------------------------ */

export type HomepageSection = {
  key: string;
  title: string;
  row_type: string;
  source: string | null;
  sort_order: number;
  status: string;
  enabled: boolean;
  visible_desktop: boolean;
  visible_mobile: boolean;
  starts_at: string | null;
  ends_at: string | null;
  component: string | null;
  file: string | null;
  /** Which module owns this section's content. */
  owner: string;
  data_source: string | null;
  archived_reason: string | null;
  live_now: boolean;
  /** For catalog-rows, how many category walls it expands into. */
  child_rows: number | null;
};

/**
 * Every section the marketplace homepage renders, in render order.
 *
 * Built by reading HomeIndex.tsx top to bottom rather than by trusting the
 * manager's own list, which is why it is 23 sections and not 16. Only one of
 * them — catalog-rows — expands into the per-category product walls that
 * "Homepage Rows" has been managing; the other twenty-two are the hero,
 * banners, content blocks, curated product rows and the footer.
 *
 * `owner` matters: Marketplace Manager controls placement, order, visibility
 * and publication, but the content of a section frequently belongs to another
 * module — hero slides to the Hero Slides Manager, the offer banner to
 * Marketing, FAQ and Vala TV to Content Studio, awards to AMS. The manager
 * routes there rather than growing a second copy of each.
 */
export const listHomepageSections = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ ok: true; sections: HomepageSection[] }> => {
    const rows = await callAsUser<HomepageSection[]>("mm_homepage_sections", {});
    return { ok: true as const, sections: rows ?? [] };
  },
);

/** Placement, order and publication for a homepage section. */
export const configureSection = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        key: z.string().min(1).max(120),
        patch: z.record(z.string(), z.unknown()),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    // This writes with the service role, which bypasses every policy, so the
    // caller is checked here: an operator who may change the front page. It
    // used to accept any signed-in account, a customer included.
    const { requireOperator } = await import("@/lib/auth/require-operator.server");
    const operator = await requireOperator("Changing a homepage section");
    if (!operator.roles.some((r) => SECTION_WRITERS.has(r))) {
      throw new Error("Changing a homepage section needs marketplace operator rights.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const allowed = [
      "status",
      "enabled",
      "sort_order",
      "visible_desktop",
      "visible_mobile",
      "starts_at",
      "ends_at",
      "title",
      "subtitle",
      "cta_label",
      "cta_href",
    ] as const;
    const patch: Record<string, unknown> = {};
    for (const k of allowed) {
      if (k in data.patch) patch[k] = data.patch[k as string];
    }
    if (!Object.keys(patch).length) {
      throw new Error("Nothing in that change is editable from here.");
    }
    patch.updated_at = new Date().toISOString();

    // An archived section is retired on purpose (archived_section_guard); it is
    // not brought back by publishing it from here.
    const { data: current, error: readError } = await supabaseAdmin
      .from("marketplace_homepage_sections")
      .select("status")
      .eq("key", data.key)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!current) throw new Error("There is no homepage section with that key.");
    // status is a real column (20260906210000); the generated types predate it.
    const currentStatus = (current as unknown as { status?: string }).status;
    if (currentStatus === "archived" && ("status" in patch || "enabled" in patch)) {
      throw new Error(
        "This section is archived. Restore it from Layout Order before publishing it.",
      );
    }

    const { error } = await supabaseAdmin
      .from("marketplace_homepage_sections")
      .update(patch)
      .eq("key", data.key);
    if (error) throw new Error(error.message);
    const { catalogueChanged } = await import("@/lib/marketplace/catalogue-invalidation");
    catalogueChanged();
    return { ok: true as const, message: "Section updated" };
  });

/* ------------------------------------------------------------------------ */
/* Recommendation engines — read-only, for Recommended Placement.            */
/* ------------------------------------------------------------------------ */

export type RecommendationEngine = {
  key: string;
  title: string;
  description: string | null;
  strategy: string;
  enabled: boolean;
  /** Whether the data this engine needs actually exists right now. */
  can_run: boolean;
  /** Why it cannot, in words, when it cannot. */
  blocked_reason: string | null;
  /**
   * Readiness, counted at read time rather than recorded once.
   *
   * blocked_reason used to decide can_run on its own, and three of the six
   * engines were held back by notes that had stopped being true —
   * marketplace_events gained user_id and session_id, and the notes still said
   * it carried neither. `data_ready` is measured; `note_is_stale` is the flag
   * for exactly that contradiction.
   */
  data_ready?: boolean;
  needs?: string;
  have?: string;
  note_is_stale?: boolean;
  max_results: number;
  recency_days: number;
};

/**
 * Every recommendation engine, with the database's own answer to whether it can
 * run. An engine whose signal is missing reports the reason instead of quietly
 * returning nothing, which is what lets the console say "blocked, and here is
 * why" rather than showing an empty list that looks broken.
 */
export const listRecommendationEngines = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ ok: true; engines: RecommendationEngine[] }> => {
    const engines = await callAsUser<RecommendationEngine[]>("mm_recommendation_engines", {});
    return { ok: true as const, engines: engines ?? [] };
  },
);
