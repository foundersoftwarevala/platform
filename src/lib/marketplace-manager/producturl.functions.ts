import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

/**
 * Auto Product URL & Sharing.
 *
 * Two things were checked against the running site before this was written.
 *
 * The canonical pattern the specification suggests — /software/{category}/{name}
 * — is served by no route: it returns 404 on the live site, while
 * /marketplace/product/{slug} returns 200 and is what sitemap-products already
 * emits. The pattern is configurable, but it defaults to the one that resolves,
 * and a pattern whose prefix nothing serves is refused rather than saved.
 *
 * And no vanity short domain is configured, so short links are served from
 * /s/{code} on this site. That is a real route with a real redirect and real
 * click recording; a vanity host would only shorten them further.
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

export type UrlRow = {
  product_id: string;
  product: string;
  visible: boolean;
  moderation_status: string;
  canonical: string | null;
  canonical_path: string | null;
  redirects: number;
  short_code: string | null;
  short_url: string | null;
  clicks: number;
  qr_code: string | null;
  scans: number;
};

export type UrlView = {
  ok: boolean;
  reason?: string;
  settings?: {
    canonical_pattern: string; site_url: string;
    lowercase_hyphenate: boolean; strip_stop_words: boolean;
    include_product_id_suffix: boolean;
    short_link_domain: string | null; short_link_domain_verified: boolean;
    track_short_link_clicks: boolean; generate_qr_on_publish: boolean;
    qr_foreground: string; qr_background: string; qr_size: number;
    qr_error_correction: string; analytics_retention_days: number;
  };
  short_domain?: { configured: boolean; state: string; serving_from: string; note: string | null };
  routes?: { prefix: string; note: string; verified_at: string | null }[];
  counts?: Record<string, number>;
  analytics?: {
    clicks_total: number; clicks_today: number; unique_visitors: number;
    scans_total: number; scans_today: number; shares: number;
    top_products: { product: string | null; clicks: number }[];
    top_campaigns: Record<string, number>;
    top_referrers: Record<string, number>;
    devices: Record<string, number>;
    countries: Record<string, number>;
  };
  last_job?: Record<string, unknown> | null;
  total?: number;
  rows?: UrlRow[];
};

export const getProductUrls = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) =>
    z.object({
      search: z.string().max(120).optional(),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    }).parse(i ?? {}),
  )
  .handler(async ({ data }): Promise<UrlView> =>
    callAsUser("mm_product_urls", { p_query: data }),
  );

/**
 * Generate or refresh a product's canonical URL.
 *
 * A collision never overwrites anybody; the losing slug gains a numeric suffix.
 * A changed path leaves the old URL behind as a 301, so links already shared
 * keep working.
 */
export const generateProductUrl = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      product_id: z.string().uuid(),
      reason: z.string().max(500).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{
    ok: boolean; reason?: string; message?: string; changed?: boolean;
    path?: string; url?: string; slug?: string; collision_handled?: boolean;
    previous_path?: string | null; note?: string | null;
  }> => callAsUser("mm_url_generate", {
    p_product: data.product_id, p_reason: data.reason ?? null, p_correlation: null,
  }));

export const createShortLink = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      product_id: z.string().uuid(),
      campaign: z.string().max(80).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{
    ok: boolean; reason?: string; existing?: boolean; code?: string; url?: string;
  }> => callAsUser("mm_short_link_create", {
    p_product: data.product_id, p_campaign: data.campaign ?? null,
  }));

/** Registers the QR. The image itself is rendered at /api/qr/{code}. */
export const createProductQr = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ product_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<{
    ok: boolean; reason?: string; message?: string; target?: string;
    qr?: Record<string, unknown>;
  }> => callAsUser("mm_qr_create", { p_product: data.product_id, p_short_link: null }));

/** Share snippets, built from the product's own values. */
export const getShareSnippets = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ product_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<{
    ok: boolean; reason?: string; message?: string;
    canonical_url?: string; short_url?: string | null;
    qr_code?: string | null; qr_target?: string | null; share_text?: string;
    whatsapp?: string; facebook?: string; x?: string; linkedin?: string; email?: string;
  }> => callAsUser("mm_product_share", { p_product: data.product_id }));

export const recordShare = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      product_id: z.string().uuid(),
      channel: z.enum([
        "copy", "native", "whatsapp", "facebook", "x", "linkedin", "email", "qr_download",
      ]),
      kind: z.enum(["canonical", "short"]).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string }> =>
    callAsUser("mm_share_record", {
      p_product: data.product_id, p_channel: data.channel, p_kind: data.kind ?? "canonical",
    }),
  );

/**
 * Generate URLs across the catalogue, a batch at a time.
 *
 * The caller loops on `remaining` rather than asking the database to do five
 * thousand products in one statement, and the job is resumable: a batch only
 * picks up products that still have no canonical URL.
 */
export const bulkGenerateUrls = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      scope: z.enum(["all", "selected", "category", "published", "unpublished"]).optional(),
      batch: z.number().int().min(1).max(1000).optional(),
      job_id: z.string().uuid().optional(),
      ids: z.array(z.string().uuid()).optional(),
    }).parse(i ?? {}),
  )
  .handler(async ({ data }): Promise<{
    ok: boolean; reason?: string; job_id?: string; batch_processed?: number;
    succeeded?: number; failed?: number; skipped?: number; conflicts?: number;
    remaining?: number; done?: boolean;
  }> => callAsUser("mm_url_bulk", {
    p_scope: data.scope ?? "published", p_batch: data.batch ?? 200,
    p_job: data.job_id ?? null, p_ids: data.ids ?? null,
  }));

export const setUrlSettings = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      canonical_pattern: z.string().max(200).optional(),
      lowercase_hyphenate: z.boolean().optional(),
      strip_stop_words: z.boolean().optional(),
      include_product_id_suffix: z.boolean().optional(),
      short_link_domain: z.string().max(120).nullable().optional(),
      track_short_link_clicks: z.boolean().optional(),
      generate_qr_on_publish: z.boolean().optional(),
      qr_foreground: z.string().max(7).optional(),
      qr_background: z.string().max(7).optional(),
      qr_size: z.number().int().min(64).max(2048).optional(),
      qr_error_correction: z.enum(["L", "M", "Q", "H"]).optional(),
      analytics_retention_days: z.number().int().min(1).max(3650).optional(),
      reason: z.string().max(300).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{
    ok: boolean; reason?: string; message?: string; served_prefixes?: string[];
  }> => callAsUser("mm_url_settings_set", { p_patch: data }));

/** A slug preview, so bulk regeneration can be inspected before it is run. */
export const previewSlug = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) =>
    z.object({ text: z.string().max(300), product_id: z.string().uuid().optional() }).parse(i),
  )
  .handler(async ({ data }): Promise<{
    ok: boolean; slug?: string; stop_words_removed?: string[]; lowercased?: boolean;
  }> => callAsUser("mm_url_slugify", {
    p_text: data.text, p_product: data.product_id ?? null,
  }));
