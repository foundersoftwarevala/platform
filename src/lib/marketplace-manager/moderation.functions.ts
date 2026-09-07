import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

/**
 * Product Moderation Center.
 *
 * One canonical product identity: marketplace_products is the product,
 * marketplace_sellers the author and vendor, marketplace_reviews the reviews,
 * legal_violations Legal Manager's, marketplace_orders and _licenses the money.
 * Moderation controls the state of those records and keeps no copies.
 *
 * Three rules are enforced in the database, not here, because a client cannot
 * be trusted with any of them: publication is refused while a mandatory check
 * fails, a decision carrying a stale lock is refused rather than overwriting
 * another reviewer, and a purge never removes a row that an order, licence,
 * review or merge record still depends on.
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

export type ModerationStatus =
  | "draft" | "submitted" | "under_review" | "changes_requested"
  | "approved" | "rejected" | "suspended" | "archived"
  | "soft_deleted" | "trash";

export type ModerationProduct = {
  id: string;
  name: string;
  slug: string;
  status: ModerationStatus;
  content_status: string;
  visible: boolean;
  /** Send back with a decision. A mismatch means somebody else acted. */
  lock: number;
  seller_id: string | null;
  owner: string | null;
  owner_status: string | null;
  category: string | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  deleted_at: string | null;
  delete_reason: string | null;
  purge_after: string | null;
  merged_into: string | null;
  reports: number;
  duplicate_of: number;
  checks_failing: number;
};

export type DuplicatePair = {
  id: string;
  match: number;
  reasons: { factor: string; weight: number; evidence: string }[];
  status: string;
  scanned_at: string;
  a: Record<string, unknown>;
  b: Record<string, unknown>;
};

export type ProductReport = {
  id: string;
  report_no: string;
  reason: string;
  detail: string | null;
  severity: string;
  status: string;
  created_at: string;
  resolution: string | null;
  legal_reference: string | null;
  product_id: string;
  product: string | null;
};

export type ModerationView = {
  ok: boolean;
  reason?: string;
  tab?: string;
  awaiting?: number;
  duplicates?: number;
  reported_this_week?: number;
  clean?: number;
  by_status?: Record<string, number>;
  total_catalog?: number;
  total?: number;
  policy?: {
    recovery_days: number; dual_approval: boolean; auto_purge: boolean;
    preserve_orders: boolean; preserve_licenses: boolean; preserve_reviews: boolean;
  };
  analytics?: Record<string, number>;
  products?: ModerationProduct[];
  duplicate_pairs?: DuplicatePair[];
  reports?: ProductReport[];
};

const status = z.enum([
  "draft", "submitted", "under_review", "changes_requested",
  "approved", "rejected", "suspended", "archived", "soft_deleted", "trash",
]);

export const getModeration = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) =>
    z.object({
      tab: z.enum(["queue", "duplicates", "reports", "archived", "deleted", "trash", "all"]).optional(),
      search: z.string().max(120).optional(),
      status: status.optional(),
      category: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    }).parse(i ?? {}),
  )
  .handler(async ({ data }): Promise<ModerationView> =>
    callAsUser("mm_moderation", { p_query: data }),
  );

export const getProductModerationDetail = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<Record<string, unknown>> =>
    callAsUser("mm_product_moderation_detail", { p_id: data.id }),
  );

export const moderateProduct = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      status,
      reason: z.string().max(1000).optional(),
      lock: z.number().int().optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{
    ok: boolean; reason?: string; message?: string; public?: boolean;
    recoverable_until?: string; checks?: unknown[];
  }> => callAsUser("mm_product_moderate", {
    p_id: data.id, p_to: data.status,
    p_reason: data.reason ?? null, p_lock: data.lock ?? null,
  }));

/** A new draft with none of the original's orders, licences, reviews or standing. */
export const cloneProduct = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<{
    ok: boolean; reason?: string; product_id?: string; slug?: string; note?: string;
  }> => callAsUser("mm_product_clone", { p_id: data.id }));

/** Real trigram similarity over the catalogue. Proposes; never merges. */
export const runDuplicateScan = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ threshold: z.number().min(1).max(100).optional() }).parse(i ?? {}),
  )
  .handler(async ({ data }): Promise<{
    ok: boolean; reason?: string; matches?: number; recorded?: number;
    open?: number; threshold?: number; note?: string;
  }> => callAsUser("mm_duplicate_scan", { p_threshold: data.threshold ?? 60 }));

export const decideDuplicate = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      decision: z.enum(["not_duplicate", "dismissed"]),
      reason: z.string().max(500).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string; message?: string }> =>
    callAsUser("mm_duplicate_decide", {
      p_candidate: data.id, p_decision: data.decision, p_reason: data.reason ?? null,
    }),
  );

/**
 * Merge a duplicate into a canonical product.
 *
 * Orders, licences and reviews move so nothing is lost; the duplicate row stays
 * behind pointing at the canonical one so old links still resolve.
 */
export const mergeProducts = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      canonical: z.string().uuid(),
      duplicate: z.string().uuid(),
      reason: z.string().min(1).max(1000),
      candidate: z.string().uuid().optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{
    ok: boolean; reason?: string; message?: string;
    moved?: Record<string, number>; note?: string;
  }> => callAsUser("mm_product_merge", {
    p_canonical: data.canonical, p_duplicate: data.duplicate,
    p_reason: data.reason, p_candidate: data.candidate ?? null,
  }));

export const reportProduct = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      product_id: z.string().uuid(),
      reason: z.enum([
        "copyright", "trademark", "fraudulent_claims", "misleading", "security",
        "malware", "duplicate", "policy_violation", "broken_product",
        "illegal_content", "other",
      ]),
      detail: z.string().max(2000).optional(),
      severity: z.enum(["low", "normal", "high", "critical"]).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string }> =>
    callAsUser("mm_product_report", {
      p_product: data.product_id, p_reason: data.reason,
      p_detail: data.detail ?? null, p_severity: data.severity ?? "normal",
    }),
  );

export const transitionReport = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["under_review", "action_required", "resolved", "dismissed"]),
      resolution: z.string().max(2000).optional(),
      escalate_legal: z.boolean().optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{
    ok: boolean; reason?: string; message?: string; legal_reference?: string; note?: string;
  }> => callAsUser("mm_report_transition", {
    p_report: data.id, p_to: data.status,
    p_resolution: data.resolution ?? null, p_escalate_legal: data.escalate_legal ?? false,
  }));

/** Every record validated on its own; one invalid record never spoils the rest. */
export const bulkProducts = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      ids: z.array(z.string().uuid()).min(1).max(200),
      op: z.enum([
        "approved", "rejected", "suspended", "archived", "soft_deleted",
        "publish", "unpublish", "category", "author",
      ]),
      reason: z.string().max(1000).optional(),
      target: z.string().uuid().optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{
    ok: boolean; reason?: string; message?: string;
    selected?: number; applied?: number; skipped?: number;
    results?: { id: string; product?: string; ok: boolean; reason?: string; message?: string }[];
  }> => callAsUser("mm_products_bulk", {
    p_ids: data.ids, p_op: data.op,
    p_reason: data.reason ?? null, p_target: data.target ?? null,
  }));

/** Read-only. Reports what is wrong with the catalogue and changes nothing. */
export const runCatalogAudit = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ limit: z.number().int().min(1).max(100).optional() }).parse(i ?? {}),
  )
  .handler(async ({ data }): Promise<{
    ok: boolean; reason?: string; scanned?: number; read_only?: boolean; note?: string;
    findings?: {
      key: string; label: string; severity: string; count: number;
      examples: { id?: string; name?: string }[];
    }[];
  }> => callAsUser("mm_catalog_audit", { p_limit: data.limit ?? 25 }));

export const requestPurge = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), reason: z.string().min(1).max(1000) }).parse(i),
  )
  .handler(async ({ data }): Promise<{
    ok: boolean; reason?: string; message?: string; dual_approval_required?: boolean;
  }> => callAsUser("mm_product_purge_request", { p_id: data.id, p_reason: data.reason }));

export const executePurge = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ request: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<{
    ok: boolean; reason?: string; message?: string;
    outcome?: { mode: string; why: string };
  }> => callAsUser("mm_product_purge_execute", { p_request: data.request }));

export const setModerationPolicy = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      recovery_days: z.number().int().min(1).max(3650).optional(),
      dual_approval: z.boolean().optional(),
      auto_purge: z.boolean().optional(),
      preserve_orders: z.boolean().optional(),
      preserve_licenses: z.boolean().optional(),
      preserve_reviews: z.boolean().optional(),
      reason: z.string().max(300).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string }> =>
    callAsUser("mm_moderation_policy_set", { p_patch: data }),
  );
