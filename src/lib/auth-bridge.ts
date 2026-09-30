import type { RoleKey } from "@/lib/roles";
import { ROLE_ORDER } from "@/lib/roles";
import { supabase } from "@/integrations/supabase/client";

/**
 * The role dashboards' link to the platform's real sign-in.
 *
 * This file shipped as a template: the signed-in role was read from a
 * `sv_active_role` value in the browser's storage, and "sign out" only cleared
 * that value - the Supabase session stayed alive, so pressing Logout on a
 * dashboard left the person signed in. Both now go to the platform's own auth.
 * Access itself is decided by RequireRole in front of every dashboard, from
 * `user_roles`; the role here only chooses whose dashboard to show and which
 * others to offer.
 */

/** The platform's login page. */
export const EXISTING_LOGIN_URL = "/login";

/** Operators may open every dashboard, which the "admin" dashboard role grants. */
const OPERATOR_ROLES = new Set(["boss", "boss_owner", "admin", "super_admin", "founder", "owner"]);

/**
 * The signed-in person's dashboard role, from `user_roles`: "admin" for a
 * platform operator, otherwise the first dashboard role they hold. Null when
 * no one is signed in or they hold no dashboard role.
 */
export async function getAuthenticatedRole(): Promise<RoleKey | null> {
  if (typeof window === "undefined") return null;
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return null;
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw error;
  const held = new Set((data ?? []).map((row) => String(row.role).trim().toLowerCase()));
  if ([...held].some((role) => OPERATOR_ROLES.has(role))) return "admin";
  return ROLE_ORDER.find((role) => held.has(role)) ?? null;
}

/** Ends the Supabase session. */
export async function signOut(): Promise<void> {
  if (typeof window !== "undefined") {
    // The value the old template read; cleared so it cannot linger.
    try {
      window.localStorage.removeItem("sv_active_role");
    } catch {
      /* storage unavailable - nothing to clear */
    }
  }
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
