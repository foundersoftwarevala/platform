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
  const held = await getHeldRoles();
  if ([...held].some((role) => OPERATOR_ROLES.has(role))) return "admin";
  return ROLE_ORDER.find((role) => held.has(role)) ?? null;
}

/**
 * Every app_role the signed-in account actually holds, lower-cased, from
 * `user_roles`. Empty when no one is signed in (or on the server). Unlike
 * getAuthenticatedRole this does not collapse an operator to "admin", so a
 * caller can ask whether the account itself is, say, a vendor.
 */
export async function getHeldRoles(): Promise<Set<string>> {
  if (typeof window === "undefined") return new Set();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return new Set();
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw error;
  return new Set((data ?? []).map((row) => String(row.role).trim().toLowerCase()));
}

/**
 * Whether the signed-in account itself would be answered by /api/seller/metrics:
 * it owns a `marketplace_sellers` record that is not suspended (the endpoint's
 * requireAuthor gate, with pending allowed). The row is the caller's own, which
 * the marketplace_sellers_member_read policy lets them read. A vendor/author
 * role without a seller record, or an operator viewing a seller dashboard,
 * gets false - the endpoint would only answer them 403.
 */
export async function ownsActiveSellerRecord(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return false;
  // marketplace_sellers is not in the generated client types.
  const client = supabase as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string,
        ) => {
          limit: (
            n: number,
          ) => Promise<{ data: { status: string | null }[] | null; error: unknown }>;
        };
      };
    };
  };
  const { data, error } = await client
    .from("marketplace_sellers")
    .select("status")
    .eq("owner_user_id", userId)
    .limit(1);
  if (error) throw error;
  const row = data?.[0];
  return !!row && row.status !== "suspended";
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
