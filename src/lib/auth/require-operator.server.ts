/**
 * The operator check for server functions, in one place.
 *
 * `requireSupabaseAuth` only establishes that *somebody* is signed in. Several
 * server functions read or write with the service-role key, which bypasses row
 * level security entirely, and for those "signed in" is not the question - the
 * question is whether this account runs the platform.
 *
 * That check had been written inline more than once, and the copies drifted.
 * This is the single version. It resolves the caller through the shared bearer
 * check, because `auth.getUser()` on a service-role client sends the service key
 * as `apikey` and the auth service refuses it, which is how an earlier copy
 * ended up turning every valid operator away.
 */

/** Roles that run the platform. Kept in step with mm_is_operator() in SQL. */
const OPERATOR_ROLES = new Set([
  "admin",
  "boss",
  "founder",
  "super_admin",
  "boss_owner",
  "employee",
  "sales",
  "support",
  "finance",
  "sales_support_manager",
]);

export type Operator = { userId: string; email: string; roles: string[] };

/**
 * Throws unless the caller is signed in and holds an operator role.
 *
 * The message is deliberately the same for "not signed in" and "signed in but
 * not an operator" from the caller's point of view - it says what is needed
 * without confirming to an anonymous prober that a resource exists.
 */
export async function requireOperator(action = "This"): Promise<Operator> {
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error(`${action} needs an operator account. Please sign in.`);

  const { userFromBearerToken } = await import("@/lib/auth/bearer-user.server");
  const caller = await userFromBearerToken(token);
  if (!caller) throw new Error(`${action} needs an operator account. Please sign in.`);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", caller.id);

  const roles = (rows ?? []).map((r) => String(r.role));
  if (!roles.some((r) => OPERATOR_ROLES.has(r))) {
    throw new Error(`${action} needs operator rights.`);
  }

  return { userId: caller.id, email: caller.email ?? "", roles };
}
