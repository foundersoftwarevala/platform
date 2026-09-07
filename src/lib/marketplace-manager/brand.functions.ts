import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

/**
 * Favicon & Branding Protection.
 *
 * Two things shape this module and are worth stating up front.
 *
 * Software Vala has exactly one canonical brand asset on disk — public/favicon.png.
 * A rule whose canonical asset does not exist is reported as unenforceable
 * rather than being given an invented path, so nothing is ever replaced with a
 * broken reference.
 *
 * And enforcement governs marketplace surfaces only. The contents of a
 * downloadable software package are never read or rewritten, so a customer's
 * software keeps its own branding — section 5 of the brief, and the difference
 * between protecting an identity and corrupting somebody's product.
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

export type BrandAsset = {
  key: string;
  name: string;
  type: string;
  path: string | null;
  sha256: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  version: number;
  approved: boolean;
  active: boolean;
  usable: boolean;
  note: string | null;
};

export type BrandRule = {
  key: string;
  label: string;
  target: string;
  action: "replace" | "block" | "flag" | "monitor";
  severity: string;
  enabled: boolean;
  canonical: string | null;
  notes: string | null;
  enforceable: boolean;
};

export type BrandCase = {
  id: string;
  case_no: string;
  rule: string;
  surface: string;
  reference: string | null;
  classification: "approved" | "whitelisted" | "unknown" | "blocked";
  severity: string;
  status: string;
  evidence: { reference?: string; why?: string; enforceable?: boolean }[];
  legal_reference: string | null;
  created_at: string;
  product_id: string;
  product: string | null;
  owner: string | null;
};

export type BrandView = {
  ok: boolean;
  reason?: string;
  settings?: {
    policy_state: "enforce" | "monitor" | "disabled";
    block_third_party_favicons: boolean;
    block_third_party_manifest: boolean;
    block_external_logo_overrides: boolean;
    replace_on_upload: boolean;
    allow_whitelist_exceptions: boolean;
    protect_package_contents: boolean;
  };
  vision_analysis?: string;
  vision_note?: string | null;
  protected_assets?: number;
  replaced_today?: number;
  violations_open?: number;
  whitelist_active?: number;
  surfaces?: Record<string, number>;
  assets?: BrandAsset[];
  rules?: BrandRule[];
  last_run?: Record<string, unknown> | null;
  cases?: BrandCase[];
  whitelist?: Record<string, unknown>[];
  history?: Record<string, unknown>[];
  events?: { event: string; at: string; reason: string | null }[];
  scope_note?: string;
};

export const getBrandProtection = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) =>
    z.object({
      tab: z.enum(["cases", "whitelist", "history"]).optional(),
      search: z.string().max(120).optional(),
      status: z.string().max(40).optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }).parse(i ?? {}),
  )
  .handler(async ({ data }): Promise<BrandView> =>
    callAsUser("mm_brand_protection", { p_query: data }),
  );

/** What is non-compliant about one product's branding, and why. Read-only. */
export const detectBranding = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ product_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<Record<string, unknown>> =>
    callAsUser("mm_brand_detect", { p_product: data.product_id }),
  );

/**
 * Enforce Now.
 *
 * Under MONITOR nothing changes — violations are recorded and left. Under
 * ENFORCE a replacement is applied only where an approved canonical asset
 * exists, and is then read back; a replacement that does not verify is recorded
 * as ENFORCEMENT_FAILED, never as success.
 */
export const enforceBranding = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      product_id: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(5000).optional(),
    }).parse(i ?? {}),
  )
  .handler(async ({ data }): Promise<{
    ok: boolean; reason?: string; message?: string; run_id?: string; policy?: string;
    scanned?: number; compliant?: number; replaced?: number; blocked?: number;
    flagged?: number; whitelisted?: number; failed?: number; note?: string | null;
  }> => callAsUser("mm_brand_enforce", {
    p_product: data.product_id ?? null, p_limit: data.limit ?? 500,
  }));

export const setBrandPolicy = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      policy_state: z.enum(["enforce", "monitor", "disabled"]).optional(),
      block_third_party_favicons: z.boolean().optional(),
      block_third_party_manifest: z.boolean().optional(),
      block_external_logo_overrides: z.boolean().optional(),
      replace_on_upload: z.boolean().optional(),
      allow_whitelist_exceptions: z.boolean().optional(),
      reason: z.string().max(500).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string; message?: string }> =>
    callAsUser("mm_brand_policy_set", { p_patch: data }),
  );

export const requestBrandException = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      product_id: z.string().uuid(),
      rule: z.string().max(60),
      reason: z.string().min(1).max(1000),
      expires: z.string().optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string; message?: string; note?: string }> =>
    callAsUser("mm_brand_whitelist_request", {
      p_product: data.product_id, p_rule: data.rule,
      p_reason: data.reason, p_expires: data.expires ?? null,
    }),
  );

/** Approve or revoke an exception. Admin or boss only — it suspends a rule. */
export const decideBrandException = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["active", "revoked", "expired"]),
      reason: z.string().max(500).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string; message?: string }> =>
    callAsUser("mm_brand_whitelist_decide", {
      p_id: data.id, p_to: data.status, p_reason: data.reason ?? null,
    }),
  );

export const expireBrandExceptions = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: boolean; reason?: string; expired?: number }> =>
    callAsUser("mm_brand_whitelist_expire", {}),
);

export const escalateBrandCase = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), reason: z.string().min(1).max(1000) }).parse(i),
  )
  .handler(async ({ data }): Promise<{
    ok: boolean; reason?: string; message?: string; legal_reference?: string; note?: string;
  }> => callAsUser("mm_brand_case_escalate", { p_case: data.id, p_reason: data.reason }));

/**
 * Confirm a canonical asset still matches its recorded hash.
 *
 * The digest is computed on the server where the file is; this records the
 * comparison and raises a security event on a mismatch.
 */
export const verifyBrandAsset = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ key: z.string().max(60) }).parse(i),
  )
  .handler(async ({ data }): Promise<{
    ok: boolean; state?: string; reason?: string; message?: string;
    expected?: string; observed?: string;
  }> => {
    // Read the file this application actually serves and hash it here, rather
    // than trusting anything the browser reports about it.
    const { createHash } = await import("node:crypto");
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");

    const paths: Record<string, string> = { favicon_png: "favicon.png" };
    const file = paths[data.key];
    if (!file) {
      return {
        ok: false, state: "no_file",
        message: "No file is registered for that asset, so there is nothing to verify.",
      };
    }

    let sha: string;
    let bytes: number;
    try {
      const buf = await readFile(join(process.cwd(), "public", file));
      sha = createHash("sha256").update(buf).digest("hex");
      bytes = buf.byteLength;
    } catch (error) {
      return {
        ok: false, state: "unreadable",
        message: `The canonical asset could not be read: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }

    return callAsUser("mm_brand_asset_verify", {
      p_key: data.key, p_observed_sha: sha, p_observed_bytes: bytes,
    });
  });
