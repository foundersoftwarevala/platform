import { supabase } from "@/integrations/supabase/client";
import type { RoleKey } from "@/lib/roles";
import { isRoleKey } from "@/lib/roles";

/**
 * ───────────────────────────────────────────────────────────────────────────
 * AUTH BRIDGE — WIRE YOUR EXISTING AUTH HERE
 * ───────────────────────────────────────────────────────────────────────────
 *
 * This is the ONLY integration point. No duplicate login UI is created.
 *
 * Replace the body of `getAuthenticatedRole()` and `signOut()` to call your
 * existing authentication system (cookie session, JWT, SSO, etc.) and return
 * the active role for the currently signed-in user.
 *
 * Expected return values from getAuthenticatedRole():
 *   - one of: "author" | "vendor" | "reseller" | "affiliate"
 *           | "influencer" | "franchise" | "seo" | "admin"
 *   - null  → user not signed in (we will redirect to your existing login URL)
 *
 * EXAMPLES:
 *
 *   // Cookie / session based:
 *   const res = await fetch("/api/me", { credentials: "include" });
 *   if (!res.ok) return null;
 *   const me = await res.json();
 *   return me.activeRole;
 *
 *   // JWT in storage:
 *   const token = localStorage.getItem("auth_token");
 *   if (!token) return null;
 *   const claims = JSON.parse(atob(token.split(".")[1]));
 *   return claims.role;
 * ───────────────────────────────────────────────────────────────────────────
 */

/** URL of your existing login page (external to this UI project). */
export const EXISTING_LOGIN_URL = "/login";

export async function getAuthenticatedRoles(): Promise<RoleKey[]> {
  if (typeof window === "undefined") return [];

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (userError || !userId) return [];

  const { data: rows, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw error;

  return rows
    ?.map((row) => String(row.role ?? "").trim().toLowerCase())
    .filter(isRoleKey) ?? [];
}

export async function getAuthenticatedRole(): Promise<RoleKey | null> {
  const roles = await getAuthenticatedRoles();

  const preferred = window.localStorage.getItem("sv_active_role");
  if (isRoleKey(preferred) && roles.includes(preferred)) return preferred;

  return roles[0] ?? null;
}

/**
 * The router's React Query cache, so signing out can empty it.
 *
 * The cache is created per router rather than as a module singleton, so this is
 * how the one that is actually in use becomes reachable from here. It is a
 * registration rather than an import to avoid a cycle: the router builds the
 * cache, and this file must not build the router.
 */
type ClearableCache = { clear: () => void };
let activeCache: ClearableCache | null = null;

export function registerSignOutCache(cache: ClearableCache): void {
  activeCache = cache;
}

/**
 * Browser keys that belong to the person who was signed in.
 *
 * Only these are removed. A signed-out browser keeps its language and its
 * currency, because those are the reader's own settings and wiping them turns
 * signing out into a small act of vandalism. What must not survive is anything
 * that describes *who* was here or what they were doing.
 */
const PRIVATE_KEYS = [
  "sv_active_role", // which role this person was operating as
  "sv.lastPaymentMethod", // payment-session data
  "sv_notif_seen", // which notifications they had read
  "sv_reminders", // their own reminders
];

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();

  // Emptying the query cache is the part that was missing, and it is the part
  // that matters on a shared computer. Without it every answer the previous
  // customer's session fetched — their purchases, their orders, their licence
  // keys, their cart — stays in memory, and the next person to sign in is shown
  // it while the refetch is still in flight. Two components were already
  // calling `queryClient.clear()` by hand for exactly this reason; doing it
  // here means every sign-out gets it rather than the two that remembered.
  try {
    activeCache?.clear();
  } catch {
    // A cache that will not clear must not prevent the sign-out itself.
  }

  if (typeof window !== "undefined") {
    // Wrapped, because storage throws rather than no-ops in private browsing
    // and when a browser is set to block site data. An unwrapped removeItem
    // here would reject the whole sign-out and strand the customer signed in.
    try {
      for (const key of PRIVATE_KEYS) window.localStorage.removeItem(key);
    } catch {
      /* nothing can be removed from storage that cannot be reached */
    }
  }
}

/** Dev-only: lets the bridge UI preview a role without hitting real auth. */
export function devSetRole(role: RoleKey) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("sv_active_role", role);
  }
}
