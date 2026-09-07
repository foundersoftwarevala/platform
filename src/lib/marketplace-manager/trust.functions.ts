import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

/**
 * Review Manager, Trust Manager and FAQ Manager.
 *
 * All three read the canonical tables rather than keeping copies. Reviews live
 * in marketplace_reviews, whose order_item_id is NOT NULL — which is what makes
 * every review a verified purchase: there is no way to record one without the
 * order line behind it. Trust badges are evaluated at read time from that same
 * data, so a badge cannot outlive the fact behind it. FAQs moved out of a
 * browser-local store into a table the storefront actually reads.
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

/* --------------------------------------------------------------- reviews */

export type ReviewRow = {
  id: string;
  rating: number;
  title: string | null;
  content: string;
  status: string;
  type: string;
  helpful: number;
  reports: number;
  created_at: string;
  published_at: string | null;
  moderation_note: string | null;
  product_name: string | null;
  buyer: string | null;
  verified_purchase: boolean;
  replies: { id: string; role: string; content: string; status: string; created_at: string }[];
  open_reports: { id: string; reason: string; detail: string | null; status: string }[];
  media: { id: string; kind: string; processing: string; moderation: string }[];
};

export type ReviewOverview = {
  ok: boolean;
  reason?: string;
  total?: number;
  pending?: number;
  published?: number;
  rejected?: number;
  hidden?: number;
  reported?: number;
  replies?: number;
  video?: number;
  average_rating?: number | null;
  distribution?: Record<string, number>;
  verified_note?: string;
  response_rate?: number | null;
  approval_rate?: number | null;
  reviews?: ReviewRow[];
};

export const getReviews = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) =>
    z.object({
      tab: z.enum(["queue", "latest", "top", "video", "reported", "replies"]).optional(),
      search: z.string().max(120).optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }).parse(i ?? {}),
  )
  .handler(async ({ data }): Promise<ReviewOverview> =>
    callAsUser("mm_reviews", { p_query: data }),
  );

/** Approve, reject, hide or restore. Nothing publishes itself. */
export const moderateReview = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["pending", "published", "rejected", "removed", "hidden", "archived"]),
      note: z.string().max(500).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string; message?: string }> =>
    callAsUser("mm_review_moderate", {
      p_id: data.id, p_to: data.status, p_note: data.note ?? null,
    }),
  );

export const replyToReview = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      content: z.string().min(1).max(4000),
      role: z.enum(["official", "vendor", "author", "reseller"]).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string }> =>
    callAsUser("mm_review_reply", {
      p_review: data.id, p_content: data.content, p_role: data.role ?? "official",
    }),
  );

export const resolveReport = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["investigating", "upheld", "dismissed"]),
      resolution: z.string().max(500),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string; message?: string }> =>
    callAsUser("mm_review_report_resolve", {
      p_report: data.id, p_to: data.status, p_resolution: data.resolution,
    }),
  );

/* ----------------------------------------------------------------- trust */

export type TrustBadge = {
  key: string;
  label: string;
  description: string;
  icon: string | null;
  enabled: boolean;
  priority: number;
  display_locations: string[];
  rule_summary: string;
};

export const getTrustBadges = createServerFn({ method: "GET" }).handler(
  async (): Promise<{
    ok: boolean; reason?: string;
    badges?: TrustBadge[];
    audit?: { badge: string; action: string; at: string; reason: string | null }[];
    sample?: { badges?: unknown[]; all?: unknown[] } | null;
  }> => callAsUser("mm_trust_badges", {}),
);

export const setTrustBadge = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      key: z.string().max(60),
      enabled: z.boolean().optional(),
      label: z.string().max(120).optional(),
      description: z.string().max(500).optional(),
      priority: z.number().int().optional(),
      display_locations: z.array(z.string().max(40)).optional(),
      reason: z.string().max(300).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string }> => {
    const { key, ...patch } = data;
    return callAsUser("mm_trust_badge_set", { p_key: key, p_patch: patch });
  });

/* ------------------------------------------------------------------- faq */

export type FaqRow = {
  id: string;
  question: string;
  answer: string;
  category_id: string | null;
  category: string | null;
  slug: string | null;
  tags: string[];
  language: string;
  status: "draft" | "pending_review" | "scheduled" | "published" | "archived";
  ai_generated: boolean;
  ai_sources: unknown[];
  seo_title: string | null;
  seo_description: string | null;
  scheduled_for: string | null;
  published_at: string | null;
  version: number;
  position: number;
  updated_at: string;
  versions: number;
};

export type FaqOverview = {
  ok: boolean;
  reason?: string;
  total?: number;
  published?: number;
  drafts?: number;
  pending?: number;
  scheduled?: number;
  archived?: number;
  ai_generated?: number;
  categories?: number;
  recently_updated?: number;
  languages?: string[];
  category_rows?: { id: string; slug: string; name: string; faqs: number; enabled: boolean }[];
  faqs?: FaqRow[];
};

export const getFaqs = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) =>
    z.object({
      search: z.string().max(120).optional(),
      status: z.enum(["draft", "pending_review", "scheduled", "published", "archived"]).optional(),
      category: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(500).optional(),
    }).parse(i ?? {}),
  )
  .handler(async ({ data }): Promise<FaqOverview> => callAsUser("mm_faqs", { p_query: data }));

/**
 * Create or update one FAQ.
 *
 * An edit writes the previous text to faq_versions before changing anything, so
 * the history is what the FAQ actually said rather than what it says now.
 */
export const saveFaq = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      question: z.string().min(1).max(500),
      answer: z.string().max(20000),
      category_id: z.string().uuid().optional(),
      tags: z.array(z.string().max(40)).optional(),
      language: z.string().max(8).optional(),
      seo_title: z.string().max(200).optional(),
      seo_description: z.string().max(400).optional(),
      related_product_ids: z.array(z.string().uuid()).optional(),
      position: z.number().int().optional(),
      change_summary: z.string().max(300).optional(),
      ai_generated: z.boolean().optional(),
      ai_sources: z.array(z.string().max(120)).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{
    ok: boolean; reason?: string; message?: string; faq?: FaqRow;
  }> => callAsUser("mm_faq_save", { p_patch: data }));

export const transitionFaq = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["draft", "pending_review", "scheduled", "published", "archived"]),
      when: z.string().optional(),
      reason: z.string().max(300).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string; message?: string }> =>
    callAsUser("mm_faq_transition", {
      p_id: data.id, p_to: data.status,
      p_when: data.when ?? null, p_reason: data.reason ?? null,
    }),
  );

/** Restore an earlier version. The current text is kept first, so this is undoable. */
export const rollbackFaq = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), version: z.number().int().min(1) }).parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string }> =>
    callAsUser("mm_faq_rollback", { p_id: data.id, p_version: data.version }),
  );
