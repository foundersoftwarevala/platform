import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

/**
 * Demo Domain Manager.
 *
 * The position this module is built on, established by calling the APIs rather
 * than reading configuration:
 *
 *   DNS         Cloudflare does not authenticate. CLOUDFLARE_ZONE_ID and
 *               CLOUDFLARE_ACCOUNT_ID are the right shape, but
 *               CLOUDFLARE_API_TOKEN holds a 32-character hex value — the shape
 *               of an ID, not a token — and both auth forms return
 *               "Invalid request headers".
 *   SSL         depends on the same credential.
 *   Deployment  no provider exists at all.
 *
 * So nothing here reports a domain it cannot create. What is real without a
 * provider is real: slug generation and collision handling, hostname
 * reservation, the eligibility gates owned by Moderation, Upload Security,
 * Brand Protection and Legal, expiry from actual timestamps, and health from
 * the monitor that already runs. A demo can never be recorded LIVE without DNS
 * ready, SSL active and a real deployment — a check constraint, not a
 * convention.
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

export type DemoStatus =
  | "draft" | "provisioning" | "dns_pending" | "ssl_pending" | "deploying"
  | "health_check" | "live" | "resetting" | "disabled" | "expired" | "failed";

export type DemoRow = {
  id: string;
  demo_ref: string;
  product_id: string;
  product: string | null;
  owner: string | null;
  slug: string;
  hostname: string;
  url: string;
  status: DemoStatus;
  failure_reason: string | null;
  dns_status: string;
  ssl_status: string;
  ssl_expires_at: string | null;
  health: string;
  last_health_at: string | null;
  password_protected: boolean;
  allow_indexing: boolean;
  expires_at: string | null;
  grace_until: string | null;
  days_remaining: number | null;
  created_at: string;
  updated_at: string;
  qr: { target: string; scan_count: number | null; analytics: string } | null;
  jobs: number;
  last_job: { operation: string; status: string; error: string | null } | null;
};

export type DemoView = {
  ok: boolean;
  reason?: string;
  settings?: {
    base_domain: string; default_pattern: string;
    auto_provision_on_publish: boolean; password_protect_by_default: boolean;
    block_search_indexing: boolean; default_ttl_days: number; grace_days: number;
    reminder_days: number[];
  };
  providers?: {
    dns: string; ssl: string; deployment: string; can_provision: boolean;
    providers: { slug: string; label: string; kind: string; state: string;
                 credential_env: string | null; last_error: string | null }[];
    note: string | null;
  };
  counts?: Record<string, number>;
  external_demos?: { count: number; hosts: Record<string, number>; note: string };
  health?: Record<string, number | string | null>;
  infrastructure?: Record<string, number | string>;
  total?: number;
  demos?: DemoRow[];
  events?: { event: string; at: string; reason: string | null;
             from: string | null; to: string | null }[];
};

export const getDemoDomains = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) =>
    z.object({
      tab: z.enum(["all", "live", "resetting", "disabled", "expired"]).optional(),
      search: z.string().max(120).optional(),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    }).parse(i ?? {}),
  )
  .handler(async ({ data }): Promise<DemoView> =>
    callAsUser("mm_demo_domains", { p_query: data }),
  );

/** Whether a product may have a demo, and which module says no. Read-only. */
export const getDemoEligibility = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ product_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<Record<string, unknown>> =>
    callAsUser("mm_demo_eligibility", { p_product: data.product_id }),
  );

/**
 * Prepare a demo and reserve its hostname.
 *
 * With no provider this reserves the name and records a draft with the reason
 * it could go no further. It never reports a demo as provisioned or live.
 */
export const provisionDemo = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      product_id: z.string().uuid(),
      pattern: z.enum(["isolated", "shared"]).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{
    ok: boolean; reason?: string; message?: string; hostname?: string; url?: string;
    provisioned?: boolean; note?: string | null; demo_id?: string;
    gates?: unknown[]; blocked_by?: string[];
  }> => callAsUser("mm_demo_provision", {
    p_product: data.product_id, p_pattern: data.pattern ?? null,
  }));

/** Enable, disable, reset, regenerate, renew or destroy. */
export const demoOperation = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      op: z.enum(["enable", "disable", "reset", "regenerate", "renew", "destroy"]),
      reason: z.string().max(1000).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{
    ok: boolean; reason?: string; message?: string; note?: string | null;
    providers?: Record<string, unknown>;
  }> => callAsUser("mm_demo_operation", {
    p_demo: data.id, p_op: data.op, p_reason: data.reason ?? null,
  }));

/** Set or clear the demo password. Only a bcrypt hash is stored. */
export const setDemoPassword = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      password: z.string().max(200).nullable(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{
    ok: boolean; reason?: string; message?: string;
    password_protected?: boolean; note?: string;
  }> => callAsUser("mm_demo_password_set", {
    p_demo: data.id, p_password: data.password,
  }));

/** Send the configured reminders and expire what is past its grace period. */
export const runDemoExpiry = createServerFn({ method: "POST" }).handler(
  async (): Promise<{
    ok: boolean; reason?: string; reminded?: number; entered_grace?: number;
    expired?: number; thresholds?: number[]; note?: string;
  }> => callAsUser("mm_demo_expiry_run", {}),
);

export const setDemoSettings = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      base_domain: z.string().max(120).optional(),
      default_pattern: z.enum(["isolated", "shared"]).optional(),
      auto_provision_on_publish: z.boolean().optional(),
      password_protect_by_default: z.boolean().optional(),
      block_search_indexing: z.boolean().optional(),
      default_ttl_days: z.number().int().min(1).max(3650).optional(),
      grace_days: z.number().int().min(0).max(180).optional(),
      reason: z.string().max(300).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string }> =>
    callAsUser("mm_demo_settings_set", { p_patch: data }),
  );
