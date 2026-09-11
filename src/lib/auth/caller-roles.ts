import { getRequestHeader } from "@tanstack/react-start/server";

/**
 * Who is calling a server function, decided by the server.
 *
 * A server function is reachable by anyone who can POST to /_serverFn/<id>.
 * The CSRF middleware in src/start.ts only stops a browser on another site; a
 * script can present whatever Origin and Sec-Fetch-Site it likes. So a function
 * that spends AI credit or reads something the public must not see has to ask
 * for the caller itself.
 *
 * This is the same check legal-ai, task-service and promise-tracker already
 * make one by one: the bearer token the browser attaches to every server
 * function call (src/integrations/supabase/auth-attacher.ts) is resolved to a
 * user by Supabase, and that user's roles are read from `user_roles`. Nothing
 * the browser claims about itself is trusted.
 */

/**
 * Platform operators reach every guarded workspace. The same list RequireRole
 * admits in the browser, so a screen that opens for someone never refuses them
 * one layer further in.
 */
export const PLATFORM_OPERATOR_ROLES = [
  "boss",
  "boss_owner",
  "admin",
  "super_admin",
  "founder",
  "owner",
] as const;

export type Caller = {
  userId: string;
  email: string | null;
  roles: string[];
  /** Confirmed address, or a social sign-in - the rule the demo ticket applies. */
  verified: boolean;
};

type AuthUser = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  phone_confirmed_at?: string | null;
  confirmed_at?: string | null;
  app_metadata?: { provider?: string } | null;
};

function isVerified(user: AuthUser): boolean {
  if (user.email_confirmed_at || user.phone_confirmed_at || user.confirmed_at) return true;
  const provider = user.app_metadata?.provider ?? "";
  return provider !== "" && provider !== "email";
}

function normaliseRole(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

/** The caller behind this request, or null when there is no valid session. */
export async function currentCaller(): Promise<Caller | null> {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) return null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  const user = data.user as AuthUser;

  const { data: rows } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  return {
    userId: user.id,
    email: user.email ?? null,
    roles: (rows ?? []).map((row) => normaliseRole((row as { role?: unknown }).role)).filter(Boolean),
    verified: isVerified(user),
  };
}

/** A signed-in caller, or a thrown refusal. */
export async function requireSignedInCaller(): Promise<Caller> {
  const caller = await currentCaller();
  if (!caller) throw new Error("Unauthorized: sign in required");
  return caller;
}

/**
 * A signed-in caller who holds one of `roles`, or a platform operator.
 * Throws with `refusal` when they hold none of them.
 */
export async function requireCallerRole(
  roles: readonly string[],
  refusal = "Your account does not have access to this.",
): Promise<Caller> {
  const caller = await requireSignedInCaller();
  const allowed = new Set([...roles, ...PLATFORM_OPERATOR_ROLES].map(normaliseRole));
  if (!caller.roles.some((role) => allowed.has(role))) throw new Error(refusal);
  return caller;
}
