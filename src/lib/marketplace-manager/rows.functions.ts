import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  callMarketplaceManagerFunctionFromRequest,
  withMarketplaceManagerDatabaseFromRequest,
  type MarketplaceManagerFunction,
} from "./vps-rpc.server";

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

async function callAsUser<T>(fn: MarketplaceManagerFunction, args: Record<string, unknown>): Promise<T> {
  return callMarketplaceManagerFunctionFromRequest<T>(fn, args);
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
    return withMarketplaceManagerDatabaseFromRequest(async (tx) => {
      const filters = ["deleted_at is null"];
      const values: unknown[] = [];
      const add = (column: string, value: unknown, cast: string) => {
        values.push(value);
        filters.push(`${column} = $${values.length}::${cast}`);
      };
      if (data.categoryId) add("category_id", data.categoryId, "uuid");
      if (data.onlyPublished !== false) {
        filters.push("visible is true", "content_status = 'published'");
      }
      if (data.query?.trim()) {
        values.push(`%${data.query.trim().replace(/[\\%_]/g, "\\$&")}%`);
        filters.push(`name ilike $${values.length} escape E'\\\\'`);
      }
      if (data.subcategory) add("subcategory", data.subcategory, "text");
      if (data.industry) add("industry_label", data.industry, "text");
      if (data.sellerId) add("seller_id", data.sellerId, "uuid");
      if (data.featured) filters.push("is_featured is true");
      if (data.trending) filters.push("is_trending is true");
      if (data.bestSeller) filters.push("is_best_seller is true");
      if (data.newRelease) filters.push("is_new_release is true");
      if (data.license) add("license", data.license, "text");
      values.push(data.limit ?? 24);
      const rows = await tx.unsafe(
        `select id, name, slug, thumbnail_url, category_id, subcategory,
                industry_label, visible, content_status, moderation_status,
                license, is_featured, is_trending, is_best_seller,
                is_new_release, seller_id
           from public.marketplace_products
          where ${filters.join(" and ")}
          order by sort_order asc
          limit $${values.length}`,
        values as never[],
      );
      const products = rows.map((row) => ({
        id: String(row.id),
        name: String(row.name ?? ""),
        slug: String(row.slug ?? ""),
        thumbnail_url: typeof row.thumbnail_url === "string" ? row.thumbnail_url : null,
        category_id: typeof row.category_id === "string" ? row.category_id : null,
        subcategory: typeof row.subcategory === "string" ? row.subcategory : null,
        industry_label: typeof row.industry_label === "string" ? row.industry_label : null,
        visible: row.visible === true,
        content_status: typeof row.content_status === "string" ? row.content_status : null,
        moderation_status:
          typeof row.moderation_status === "string" ? row.moderation_status : null,
        license: typeof row.license === "string" ? row.license : null,
        is_featured: row.is_featured === true,
        is_trending: row.is_trending === true,
        is_best_seller: row.is_best_seller === true,
        is_new_release: row.is_new_release === true,
        seller_id: typeof row.seller_id === "string" ? row.seller_id : null,
      }));
      return { ok: true as const, products };
    });
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
    return withMarketplaceManagerDatabaseFromRequest(async (tx) => {
      const category = await tx<{ id: string }[]>`
        select id from public.marketplace_categories where slug = ${data.key} limit 1
      `;
      const config = await tx<{ id: string }[]>`
        select id from public.marketplace_row_config where key = ${data.key} limit 1
      `;
      const ids = [...category, ...config].map((row) => row.id);
      if (!ids.length) return { ok: true as const, entries: [] };
      const entries = await tx`
        select action, actor, actor_role, before_state, after_state, reason, created_at
          from public.marketplace_audit_logs
         where entity_id = any(${ids}::uuid[])
         order by created_at desc
         limit 50
      `;
      return { ok: true as const, entries: [...entries] };
    });
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
        patch: z.object({
          status: z.string().optional(),
          enabled: z.boolean().optional(),
          sort_order: z.number().int().optional(),
          visible_desktop: z.boolean().optional(),
          visible_mobile: z.boolean().optional(),
          starts_at: z.string().nullable().optional(),
          ends_at: z.string().nullable().optional(),
          title: z.string().optional(),
          subtitle: z.string().nullable().optional(),
          cta_label: z.string().nullable().optional(),
          cta_href: z.string().nullable().optional(),
        }),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    // This writes with the service role, which bypasses every policy, so the
    // caller is checked here: an operator who may change the front page. It
    // used to accept any signed-in account, a customer included.
    if (!Object.keys(data.patch).length) {
      throw new Error("Nothing in that change is editable from here.");
    }
    await withMarketplaceManagerDatabaseFromRequest(async (tx) => {
      const [writer] = await tx<{ allowed: boolean }[]>`
        select exists (
          select 1 from public.user_roles
           where user_id = auth.uid()
             and role = any(${[...SECTION_WRITERS]}::text[])
        ) as allowed
      `;
      if (!writer?.allowed) {
        throw new Error("Changing a homepage section needs marketplace operator rights.");
      }
      const [current] = await tx<{ status: string }[]>`
        select status
          from public.marketplace_homepage_sections
         where key = ${data.key}
         for update
      `;
      if (!current) throw new Error("There is no homepage section with that key.");
      if (current.status === "archived" && ("status" in data.patch || "enabled" in data.patch)) {
        throw new Error(
          "This section is archived. Restore it from Layout Order before publishing it.",
        );
      }

      const columnTypes = {
        status: "text",
        enabled: "boolean",
        sort_order: "integer",
        visible_desktop: "boolean",
        visible_mobile: "boolean",
        starts_at: "timestamptz",
        ends_at: "timestamptz",
        title: "text",
        subtitle: "text",
        cta_label: "text",
        cta_href: "text",
      } as const;
      const fields = Object.entries(data.patch);
      const values: unknown[] = [];
      const assignments = fields.map(([key, value]) => {
        if (!(key in columnTypes)) throw new Error(`The ${key} field cannot be changed here.`);
        values.push(value);
        return `${key} = $${values.length}::${columnTypes[key as keyof typeof columnTypes]}`;
      });
      values.push(data.key);
      const updated = await tx.unsafe(
        `update public.marketplace_homepage_sections
            set ${assignments.join(", ")}, updated_at = now()
          where key = $${values.length}
          returning key`,
        values as never[],
      ) as { key: string }[];
      if (!updated[0]) throw new Error("The homepage section could not be updated.");
    });
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
