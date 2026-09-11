import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { buildUserMessage, generate, type ProviderBinding } from "@/lib/ai/content-provider";

/**
 * AI Content Generator — the server half.
 *
 * Generation runs here and nowhere else, for two reasons that are the same
 * reason. The credential exists only in the server environment, and the system
 * prompt must never be returned to a browser (section 49). So the flow is:
 * ask the database for the verified product context and the prompt, make the
 * provider call here, hand the answer back to the database to be validated,
 * versioned and governed. What reaches the client is the outcome.
 *
 * Every call is made with the caller's own token, so row-level security and the
 * operator gate apply to an administrator exactly as they would to anyone else.
 * The service key is never used to bypass a permission check.
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

/**
 * The functions that spend AI credit ask for an operator before anything else.
 * mm_ai_generation_start already refuses a non-operator inside the database,
 * but that is one step removed from the provider call; asking mm_is_operator
 * first - the gate every Marketplace Manager function uses - keeps the refusal
 * at the door rather than relying on a later RPC to happen to check it.
 */
async function requireContentOperator(): Promise<void> {
  const isOperator = await callAsUser<boolean>("mm_is_operator", {});
  if (isOperator !== true) throw new Error("Marketplace operator access is required.");
}

const CONTENT_TYPES = [
  "summary", "short_description", "long_description", "seo_description",
  "meta_keywords", "faq", "features", "benefits", "use_cases",
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

export type ConsoleView = {
  ok: boolean;
  reason?: string;
  settings?: Record<string, unknown>;
  binding?: ProviderBinding;
  can_approve?: boolean;
  stats?: Record<string, number>;
  by_status?: Record<string, number>;
  by_type?: Record<string, number>;
  total?: number;
  rows?: Record<string, unknown>[];
  queue?: Record<string, unknown>[];
  jobs?: Record<string, unknown>[];
  usage?: Record<string, unknown>;
  generations?: Record<string, unknown>[];
  templates?: Record<string, unknown>[];
  legal_rules?: Record<string, unknown>[];
  audit?: Record<string, unknown>[];
  /** Added by the server: whether the credential the registry names is present. */
  provider_state?: {
    state: "CONFIGURED" | "NOT_CONFIGURED" | "NOT_ENABLED" | "NOT_REGISTERED";
    detail: string;
    credential_env: string | null;
  };
};

/**
 * 51. Whether generation can run at all. The database knows which environment
 * variable the provider is bound to; only the server can say whether it holds
 * anything. Presence is reported — never a prefix, a length or a value.
 */
function providerState(binding: ProviderBinding | undefined): ConsoleView["provider_state"] {
  if (!binding?.ok || !binding.provider_slug) {
    return {
      state: "NOT_REGISTERED",
      detail: "No provider is selected. Choose one that the AI API Manager already registers.",
      credential_env: null,
    };
  }
  if (!binding.content_generation_enabled) {
    return {
      state: "NOT_ENABLED",
      detail: `${binding.provider_name ?? binding.provider_slug} is registered but is not enabled for content generation.`,
      credential_env: binding.credential_env ?? null,
    };
  }
  const name = binding.credential_env ?? "";
  const present =
    /^[A-Z][A-Z0-9_]{2,63}$/.test(name) && (process.env[name]?.trim().length ?? 0) >= 20;
  return present
    ? {
        state: "CONFIGURED",
        detail: `${binding.provider_name ?? binding.provider_slug} is configured and generation will make a real request.`,
        credential_env: name,
      }
    : {
        state: "NOT_CONFIGURED",
        detail: `AI PROVIDER NOT CONFIGURED — set ${name || "the provider's credential variable"} on the server and restart. Nothing is simulated in the meantime; generation will report this instead of producing content.`,
        credential_env: name || null,
      };
}

export const getAiContentConsole = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) =>
    z.object({
      search: z.string().max(160).optional(),
      product_id: z.string().uuid().optional(),
      content_type: z.enum(CONTENT_TYPES).optional(),
      status: z.string().max(30).optional(),
      language: z.string().max(8).optional(),
      legal_state: z.string().max(30).optional(),
      from: z.string().max(40).optional(),
      to: z.string().max(40).optional(),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    }).parse(i ?? {}),
  )
  .handler(async ({ data }): Promise<ConsoleView> => {
    const view = await callAsUser<ConsoleView>("mm_ai_content_console", { p_query: data });
    if (view?.ok) view.provider_state = providerState(view.binding);
    return view;
  });

export const getAiContentProducts = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) =>
    z.object({
      search: z.string().max(160).optional(),
      category_id: z.string().uuid().optional(),
      filter: z.enum(["all", "missing_description", "has_content", "no_content", "stale"]).optional(),
      limit: z.number().int().min(1).max(100).optional(),
      offset: z.number().int().min(0).optional(),
    }).parse(i ?? {}),
  )
  .handler(async ({ data }): Promise<{
    ok: boolean; reason?: string; total?: number; rows?: Record<string, unknown>[];
  }> => callAsUser("mm_ai_products", { p_query: data }));

export const getProductContext = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ product_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<Record<string, unknown>> =>
    callAsUser("mm_ai_context", { p_product: data.product_id }),
  );

export const getItemVersions = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ item_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<Record<string, unknown>> =>
    callAsUser("mm_ai_item_versions", { p_item: data.item_id }),
  );

/**
 * 3. One real generation, start to finish.
 *
 * The database opens the run and hands back the verified context and the
 * prompt. The provider is called here. The answer goes straight back to the
 * database, which validates it, versions it and applies the publishing policy.
 * If the provider cannot be called, the run is closed as NOT_CONFIGURED with
 * the reason recorded — the caller never sees a success that did not happen.
 */
async function runOne(
  productId: string,
  types: ContentType[],
  language: string | undefined,
  jobId: string | null,
): Promise<Record<string, unknown>> {
  const start = await callAsUser<{
    ok: boolean; reason?: string; detail?: string;
    generation_id?: string; product_name?: string;
    types?: string[]; language?: string;
    context?: Record<string, unknown>;
    binding?: ProviderBinding;
    system_prompt?: string;
    brand_voice?: Record<string, unknown>;
    limits?: Record<string, unknown>;
  }>("mm_ai_generation_start", {
    p_product: productId,
    p_types: types,
    p_language: language ?? null,
    p_job: jobId,
  });

  if (!start?.ok || !start.generation_id) return start as Record<string, unknown>;

  const outcome = await generate(
    start.binding ?? {},
    start.system_prompt ?? "",
    buildUserMessage({
      context: start.context ?? {},
      types: (start.types ?? types) as string[],
      language: start.language ?? language ?? "en",
      brandVoice: start.brand_voice ?? {},
      limits: start.limits ?? {},
    }),
  );

  if (!outcome.ok) {
    const finished = await callAsUser<Record<string, unknown>>("mm_ai_generation_finish", {
      p_generation: start.generation_id,
      p_status: outcome.status,
      p_parsed: null,
      p_raw: outcome.raw ?? null,
      p_usage: outcome.usage,
      p_error: { code: outcome.code, detail: outcome.detail, http_status: outcome.http_status },
    });
    return { ...finished, product_name: start.product_name };
  }

  const finished = await callAsUser<Record<string, unknown>>("mm_ai_generation_finish", {
    p_generation: start.generation_id,
    p_status: "SUCCEEDED",
    p_parsed: outcome.parsed,
    p_raw: outcome.raw,
    p_usage: outcome.usage,
    p_error: null,
  });
  return { ...finished, product_name: start.product_name };
}

export const generateContent = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      product_id: z.string().uuid(),
      types: z.array(z.enum(CONTENT_TYPES)).min(1).max(9),
      language: z.string().max(8).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<Record<string, unknown>> => {
    await requireContentOperator();
    return runOne(data.product_id, data.types, data.language, null);
  });

/* ------------------------------------------------------------ review actions */

export const editContent = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      item_id: z.string().uuid(),
      content: z.string().max(20000).optional(),
      items: z.unknown().optional(),
      note: z.string().max(500).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<Record<string, unknown>> =>
    callAsUser("mm_ai_item_edit", {
      p_item: data.item_id,
      p_content: data.content ?? null,
      p_json: data.items ?? null,
      p_note: data.note ?? null,
    }),
  );

export const submitContent = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ item_id: z.string().uuid(), note: z.string().max(500).optional() }).parse(i),
  )
  .handler(async ({ data }): Promise<Record<string, unknown>> =>
    callAsUser("mm_ai_item_submit", { p_item: data.item_id, p_note: data.note ?? null }),
  );

export const approveContent = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ item_id: z.string().uuid(), note: z.string().max(500).optional() }).parse(i),
  )
  .handler(async ({ data }): Promise<Record<string, unknown>> =>
    callAsUser("mm_ai_item_approve", { p_item: data.item_id, p_note: data.note ?? null }),
  );

export const rejectContent = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      item_id: z.string().uuid(),
      code: z.enum([
        "incorrect_information", "unsupported_claim", "poor_quality", "legal_concern",
        "duplicate", "seo_issue", "brand_violation", "out_of_date", "other",
      ]),
      reason: z.string().max(1000).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<Record<string, unknown>> =>
    callAsUser("mm_ai_item_reject", {
      p_item: data.item_id, p_code: data.code, p_reason: data.reason ?? null,
    }),
  );

export const publishContent = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ item_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<Record<string, unknown>> =>
    callAsUser("mm_ai_item_publish", { p_item: data.item_id, p_auto: false }),
  );

export const unpublishContent = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ item_id: z.string().uuid(), reason: z.string().max(500).optional() }).parse(i),
  )
  .handler(async ({ data }): Promise<Record<string, unknown>> =>
    callAsUser("mm_ai_item_unpublish", { p_item: data.item_id, p_reason: data.reason ?? null }),
  );

export const archiveContent = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ item_id: z.string().uuid(), reason: z.string().max(500).optional() }).parse(i),
  )
  .handler(async ({ data }): Promise<Record<string, unknown>> =>
    callAsUser("mm_ai_item_archive", { p_item: data.item_id, p_reason: data.reason ?? null }),
  );

export const rollbackVersion = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ item_id: z.string().uuid(), version: z.number().int().min(1) }).parse(i),
  )
  .handler(async ({ data }): Promise<Record<string, unknown>> =>
    callAsUser("mm_ai_version_rollback", { p_item: data.item_id, p_version: data.version }),
  );

export const legalDecide = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      item_id: z.string().uuid(),
      to: z.enum(["CLEARED", "BLOCKED"]),
      reason: z.string().max(1000).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<Record<string, unknown>> =>
    callAsUser("mm_ai_legal_decide", {
      p_item: data.item_id, p_to: data.to, p_reason: data.reason ?? null,
    }),
  );

/* ---------------------------------------------------------- 28/29. bulk work */

export const createBulkJob = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      scope: z.enum([
        "selected", "category", "missing_description", "missing_seo",
        "rejected_content", "stale", "all_eligible",
      ]),
      types: z.array(z.enum(CONTENT_TYPES)).min(1).max(9),
      ids: z.array(z.string().uuid()).max(500).optional(),
      category_id: z.string().uuid().optional(),
      language: z.string().max(8).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<Record<string, unknown>> =>
    callAsUser("mm_ai_bulk_create", {
      p_scope: data.scope,
      p_types: data.types,
      p_filters: { ids: data.ids ?? [], category_id: data.category_id ?? null },
      p_language: data.language ?? null,
    }),
  );

/**
 * 28. One batch of a bulk job. The browser calls this repeatedly rather than
 * firing thousands of requests itself, and each product is generated in turn so
 * a provider rate limit slows the job down instead of failing all of it.
 */
export const runBulkBatch = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      job_id: z.string().uuid(),
      batch: z.number().int().min(1).max(25).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{
    ok: boolean; reason?: string; done?: boolean; processed?: number;
    results?: { product: string; ok: boolean; detail?: string }[];
    progress?: Record<string, unknown>;
  }> => {
    // Each batch makes one provider call per product, so it is gated like
    // generateContent above.
    await requireContentOperator();
    const claim = await callAsUser<{
      ok: boolean; reason?: string; done?: boolean;
      types?: string[]; language?: string;
      products?: { product_id: string; product: string }[];
    }>("mm_ai_bulk_claim", { p_job: data.job_id, p_limit: data.batch ?? null });

    if (!claim?.ok) return claim as { ok: boolean; reason?: string };
    const products = claim.products ?? [];
    if (products.length === 0) return { ok: true, done: true, processed: 0, results: [] };

    const results: { product: string; ok: boolean; detail?: string }[] = [];
    let progress: Record<string, unknown> = {};

    for (const row of products) {
      let outcome: Record<string, unknown>;
      try {
        outcome = await runOne(
          row.product_id,
          (claim.types ?? []) as ContentType[],
          claim.language,
          data.job_id,
        );
      } catch (error) {
        outcome = { ok: false, reason: error instanceof Error ? error.message : String(error) };
      }

      const succeeded = outcome.ok === true;
      // 29. A product that produced content but needs a person to look at it is
      // NEEDS_REVIEW, not COMPLETED, so the job's counts mean what they say.
      const needsReview =
        succeeded &&
        Array.isArray(outcome.results) &&
        (outcome.results as { status?: string }[]).some((x) => x.status === "IN_REVIEW");

      progress = await callAsUser<Record<string, unknown>>("mm_ai_bulk_mark", {
        p_job: data.job_id,
        p_product: row.product_id,
        p_status: succeeded ? (needsReview ? "NEEDS_REVIEW" : "COMPLETED") : "FAILED",
        p_generation: (outcome.generation_id as string) ?? null,
        p_error: succeeded ? null : String(outcome.detail ?? outcome.reason ?? "Generation failed."),
        p_skip_reason: null,
      });

      results.push({
        product: row.product,
        ok: succeeded,
        detail: succeeded ? undefined : String(outcome.detail ?? outcome.reason ?? ""),
      });
    }

    return {
      ok: true,
      done: Number(progress.remaining ?? 0) <= 0,
      processed: results.length,
      results,
      progress,
    };
  });

export const retryBulkJob = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ job_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<Record<string, unknown>> =>
    callAsUser("mm_ai_bulk_retry", { p_job: data.job_id }),
  );

export const cancelBulkJob = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ job_id: z.string().uuid(), reason: z.string().max(300).optional() }).parse(i),
  )
  .handler(async ({ data }): Promise<Record<string, unknown>> =>
    callAsUser("mm_ai_bulk_cancel", { p_job: data.job_id, p_reason: data.reason ?? null }),
  );

/* ---------------------------------------------------------------- settings */

export const setAiContentSettings = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      blocks: z.record(z.string(), z.boolean()).optional(),
      limits: z.unknown().optional(),
      publish_policy: z.enum([
        "MANUAL_APPROVAL", "AUTO_PUBLISH", "ROLE_BASED_APPROVAL", "LEGAL_REVIEW_REQUIRED",
      ]).optional(),
      legal_review_types: z.array(z.enum(CONTENT_TYPES)).optional(),
      brand_voice: z.unknown().optional(),
      default_language: z.string().max(8).optional(),
      allowed_languages: z.array(z.string().max(8)).optional(),
      provider_slug: z.string().max(60).optional(),
      model_id: z.string().max(120).optional(),
      temperature: z.number().min(0).max(2).optional(),
      max_output_tokens: z.number().int().min(256).max(32000).optional(),
      request_timeout_ms: z.number().int().min(5000).max(300000).optional(),
      daily_request_cap: z.number().int().min(0).max(100000).optional(),
      bulk_batch_size: z.number().int().min(1).max(100).optional(),
      duplicate_threshold: z.number().min(0.3).max(1).optional(),
      high_similarity_threshold: z.number().min(0.3).max(1).optional(),
      overwrite_existing_product_copy: z.boolean().optional(),
      reason: z.string().max(300).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<Record<string, unknown>> =>
    callAsUser("mm_ai_settings_set", { p_patch: data }),
  );
