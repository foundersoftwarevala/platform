import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

/**
 * Homepage Rows, as operations rather than a list in a component.
 *
 * HomepageRowsSection declared its fifteen rows as a constant, with hardcoded
 * statuses and hardcoded counts like "14 industries". Its controls were honest
 * placeholders because there was nothing behind them to call. The rows now live
 * in marketplace_homepage_sections and these are the calls the screen makes.
 *
 * Two things worth stating plainly, because this module controls the public
 * homepage and that page is the front door of the business.
 *
 * A row set is an override, not a requirement. With nothing published the
 * homepage renders exactly as it does today, so adding control here cannot
 * become a new way for the page to go blank.
 *
 * And publishing is deliberate. Every state change goes through
 * mm_row_set_status, which checks the caller's role, records the before and
 * after, and writes the reason — so a change to what the public sees can always
 * be traced to a person.
 */

const admin = async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
};

/** The signed-in caller. The role check itself lives in the database. */
async function requireUser(): Promise<{ userId: string; token: string }> {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Unauthorized: sign in required");

  const db = await admin();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new Error("Unauthorized: sign in required");
  return { userId: data.user.id, token };
}

/**
 * Calls a database function as the signed-in person rather than as the service
 * role, so mm_is_operator() sees who is actually asking. Using the admin client
 * here would make every caller an operator.
 */
async function asUser<T>(token: string, fn: string, args: Record<string, unknown>): Promise<T> {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const key =
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  const client = createClient(url, key, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

type Outcome = { ok?: boolean; reason?: string };

function settle(result: Outcome | null, whenOk: string): { ok: true; message: string } {
  if (!result?.ok) {
    throw new Error(
      result?.reason === "not_permitted"
        ? "Changing the homepage needs marketplace operator rights."
        : (result?.reason ?? "The change was refused."),
    );
  }
  return { ok: true as const, message: whenOk };
}

/** Every row the Manager can see, in order, with its live counts. */
export const listHomepageRows = createServerFn({ method: "GET" }).handler(async () => {
  await requireUser();
  const db = await admin();
  const { data, error } = await db
    .from("marketplace_homepage_sections")
    .select(
      "id, key, title, subtitle, row_type, source, category_id, item_limit, status, " +
        "enabled, sort_order, priority, visible_desktop, visible_mobile, starts_at, " +
        "ends_at, cta_label, cta_href, impressions, clicks, conversions, " +
        "published_at, updated_at, config",
    )
    .order("sort_order");
  if (error) throw new Error(error.message);
  return { ok: true as const, rows: data ?? [] };
});

export const setHomepageRowStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      rowId: z.string().uuid(),
      status: z.enum(["draft", "review", "scheduled", "published", "unpublished", "archived"]),
      reason: z.string().trim().max(500).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { token } = await requireUser();
    const result = await asUser<Outcome>(token, "mm_row_set_status", {
      p_row_id: data.rowId,
      p_status: data.status,
      p_reason: data.reason ?? null,
    });
    return settle(result, `Row ${data.status}`);
  });

export const reorderHomepageRows = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ orderedIds: z.array(z.string().uuid()).min(1).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { token } = await requireUser();
    const result = await asUser<Outcome>(token, "mm_row_reorder", {
      p_ordered_ids: data.orderedIds,
    });
    return settle(result, "Homepage rows reordered");
  });

export const duplicateHomepageRow = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ rowId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { token } = await requireUser();
    const result = await asUser<Outcome & { key?: string }>(token, "mm_row_duplicate", {
      p_row_id: data.rowId,
    });
    return settle(result, `Duplicated as ${result?.key ?? "a new draft"}`);
  });

/** Section 28: what the homepage would render right now, for the preview. */
export const previewHomepageRows = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ surface: z.enum(["desktop", "mobile"]).default("desktop") }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    await requireUser();
    const db = await admin();
    const { data: rows, error } = await db.rpc("mm_active_rows", { p_surface: data.surface });
    if (error) throw new Error(error.message);
    return {
      ok: true as const,
      surface: data.surface,
      rows: rows ?? [],
      // Said explicitly so the preview cannot be mistaken for a promise about
      // the page when nothing is published.
      note:
        (rows ?? []).length === 0
          ? "No rows are published, so the homepage renders its default sections."
          : `${(rows ?? []).length} row(s) would render on ${data.surface}.`,
    };
  });

/** Sections 12, 30 and 31, read together because the screen shows them together. */
export const marketplaceControlSummary = createServerFn({ method: "GET" }).handler(async () => {
  await requireUser();
  const db = await admin();
  const [health, score, attention] = await Promise.all([
    db.rpc("mm_health_checks"),
    db.rpc("mm_marketplace_score"),
    db.rpc("mm_attention_center"),
  ]);
  if (health.error) throw new Error(health.error.message);
  return {
    ok: true as const,
    health: health.data ?? [],
    score: score.data ?? null,
    attention: attention.data ?? null,
  };
});
