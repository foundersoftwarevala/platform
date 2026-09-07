import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

/**
 * Demo Sandbox Controls.
 *
 * An extension of the Demo Domain Manager: every sandbox belongs to a
 * demo_domains row, which belongs to a marketplace product.
 *
 * Section 4 forbids claiming isolation that has not been implemented, and this
 * module obeys that rather than describing a sandbox that does not exist. There
 * is no deployment runtime, so no container, schema or tenant is created:
 * isolation is reported NOT_IMPLEMENTED, and a database reset, an uploads reset
 * and an infrastructure cleanup are recorded as blocked jobs, never as
 * successes.
 *
 * What is real is real and tested — the sandbox lifecycle, activity and idle
 * expiry, credential generation and rotation with only bcrypt hashes stored,
 * the job lock, and a cleanup that removes what it may while preserving
 * product, audit, legal and deployment history.
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

export type SandboxStatus =
  | "provisioning" | "active" | "resetting" | "disabled" | "expiring"
  | "expired" | "cleanup_pending" | "cleaned" | "failed";

export type SandboxRow = {
  id: string;
  sandbox_ref: string;
  demo_id: string;
  hostname: string | null;
  demo_status: string | null;
  product_id: string;
  product: string | null;
  owner: string | null;
  status: SandboxStatus;
  failure_reason: string | null;
  isolation: string;
  health: string;
  last_activity_at: string | null;
  last_reset_at: string | null;
  next_reset_at: string | null;
  expires_at: string | null;
  cleanup_after: string | null;
  cleanup_status: string;
  hours_remaining: number | null;
  qualifying_hits: number;
  /** Usernames and versions only — a hash is never returned to the browser. */
  credentials: { role: string; username: string; version: number; expires_at: string | null }[];
  baseline_captured: boolean | null;
  last_reset: { outcome: string; stages: Record<string, string>; at: string | null } | null;
  locked: boolean;
  created_at: string;
};

export type Capability = { state: string; detail: string };

export type SandboxView = {
  ok: boolean;
  reason?: string;
  settings?: {
    auto_reset_hours: number; expire_after_idle_hours: number;
    cleanup_at: string; cleanup_timezone: string; grace_hours: number;
    auto_reset_db: boolean; auto_reset_uploads: boolean;
    rotate_credentials: boolean; rotate_credentials_days: number;
    keep_session_logs: boolean; session_log_retention_days: number;
    warning_hours: number[];
  };
  capabilities?: Record<string, Capability | unknown>;
  active?: number;
  resetting?: number;
  expiring_24h?: number;
  cleanups_today?: number;
  by_status?: Record<string, number>;
  total?: number;
  infrastructure?: Record<string, number | string>;
  sandboxes?: SandboxRow[];
};

export const getSandboxes = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) =>
    z.object({
      status: z.string().max(30).optional(),
      search: z.string().max(120).optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }).parse(i ?? {}),
  )
  .handler(async ({ data }): Promise<SandboxView> =>
    callAsUser("mm_sandboxes", { p_query: data }),
  );

export const createSandbox = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ demo_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<{
    ok: boolean; reason?: string; message?: string; note?: string;
    sandbox?: Record<string, unknown>; capabilities?: Record<string, unknown>;
  }> => callAsUser("mm_sandbox_create", { p_demo: data.demo_id }));

/**
 * Reset a sandbox to its baseline.
 *
 * Takes the lock first, so repeated clicks cannot start two resets. Each stage
 * reports what it actually did; a blocked or partial reset leaves the sandbox
 * failed rather than active.
 */
export const resetSandbox = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      trigger: z.enum(["manual", "scheduled", "demo_reset", "expiry"]).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{
    ok: boolean; reason?: string; message?: string; outcome?: string;
    stages?: Record<string, string>;
  }> => callAsUser("mm_sandbox_reset", {
    p_sandbox: data.id, p_trigger: data.trigger ?? "manual",
  }));

/**
 * Rotate a demo credential.
 *
 * The plaintext comes back exactly once, for the operator to copy. Only a
 * bcrypt hash is stored; the previous credential is invalidated in the same
 * statement, and the audit records the rotation without the secret.
 */
export const rotateSandboxCredential = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      role: z.enum(["demo_user", "demo_admin"]),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{
    ok: boolean; reason?: string; message?: string;
    username?: string; password?: string; version?: number;
    previous_invalidated?: boolean; applied_to_demo?: boolean; note?: string;
  }> => callAsUser("mm_sandbox_rotate_credential", {
    p_sandbox: data.id, p_role: data.role,
  }));

/** Record a hit. A heartbeat does not extend the sandbox. */
export const recordSandboxActivity = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      kind: z.enum(["http", "auth", "interaction", "heartbeat"]).optional(),
      path: z.string().max(500).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; qualifies?: boolean; note?: string | null }> =>
    callAsUser("mm_sandbox_activity", {
      p_sandbox: data.id, p_kind: data.kind ?? "http",
      p_path: data.path ?? null, p_status: null, p_latency: null,
    }),
  );

export const extendSandbox = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), hours: z.number().int().min(1).max(8760) }).parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string }> =>
    callAsUser("mm_sandbox_extend", { p_sandbox: data.id, p_hours: data.hours }),
  );

/** Warnings, expiry and the move into cleanup, all from real timestamps. */
export const runSandboxExpiry = createServerFn({ method: "POST" }).handler(
  async (): Promise<{
    ok: boolean; reason?: string; warned?: number; entered_expiring?: number;
    expired?: number; thresholds?: number[]; note?: string;
  }> => callAsUser("mm_sandbox_expiry_run", {}),
);

/** Removes what it may; preserves product, audit, legal and deployment history. */
export const runSandboxCleanup = createServerFn({ method: "POST" }).handler(
  async (): Promise<{
    ok: boolean; reason?: string; status?: string;
    removed?: Record<string, number>; preserved?: Record<string, string>;
  }> => callAsUser("mm_sandbox_cleanup_run", {}),
);

/** Bring a sandbox back in step with its demo domain. */
export const syncSandbox = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ demo_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<{
    ok: boolean; changed?: boolean; from?: string; to?: string; note?: string;
  }> => callAsUser("mm_sandbox_sync", { p_demo: data.demo_id }));

export const setSandboxSettings = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      auto_reset_hours: z.number().int().min(1).max(720).optional(),
      expire_after_idle_hours: z.number().int().min(1).max(720).optional(),
      cleanup_at: z.string().max(8).optional(),
      cleanup_timezone: z.string().max(60).optional(),
      grace_hours: z.number().int().min(0).max(720).optional(),
      auto_reset_db: z.boolean().optional(),
      auto_reset_uploads: z.boolean().optional(),
      rotate_credentials: z.boolean().optional(),
      rotate_credentials_days: z.number().int().min(1).max(365).optional(),
      keep_session_logs: z.boolean().optional(),
      session_log_retention_days: z.number().int().min(1).max(3650).optional(),
      reason: z.string().max(300).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string }> =>
    callAsUser("mm_sandbox_settings_set", { p_patch: data }),
  );
