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

export async function getAuthenticatedRole(): Promise<RoleKey | null> {
  // TODO: replace with your existing auth call.
  if (typeof window === "undefined") return null;

  // Dev fallback ONLY: lets you preview each dashboard while wiring the bridge.
  // Remove this block once your real auth is connected.
  const stored = window.localStorage.getItem("sv_active_role");
  return isRoleKey(stored) ? stored : null;
}

export async function signOut(): Promise<void> {
  // TODO: call your existing auth logout endpoint.
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("sv_active_role");
  }
}

/** Dev-only: lets the bridge UI preview a role without hitting real auth. */
export function devSetRole(role: RoleKey) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("sv_active_role", role);
  }
}
