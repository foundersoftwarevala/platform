import { getRequestHeader } from "@tanstack/react-start/server";
import { bearerToken, userFromBearerToken } from "@/lib/auth/bearer-user.server";
import { withVpsPublicDatabase } from "@/lib/marketplace-manager/vps-rpc.server";

const EXECUTIVE_ROLES = new Set([
  "super_admin",
  "boss_owner",
  "boss",
  "admin",
  "founder",
  "developer",
  "finance",
  "support",
  "marketing",
  "seo",
  "legal",
]);

export type FounderInsightCaller = { id: string; roles: string[] };

async function signedInCaller(): Promise<FounderInsightCaller> {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = bearerToken(header);
  if (!token) throw new Error("Unauthorized: sign in required.");
  const user = await userFromBearerToken(token);
  if (!user) throw new Error("Unauthorized: sign in required.");
  const rows = await withVpsPublicDatabase((tx) => tx<{ role: string }[]>`
    select role::text as role from public.user_roles where user_id = ${user.id}::uuid
  `);
  return { id: user.id, roles: rows.map((row) => row.role.toLowerCase().trim()).filter(Boolean) };
}

export async function requireFounderInsightReader(): Promise<FounderInsightCaller> {
  const caller = await signedInCaller();
  if (!caller.roles.some((role) => EXECUTIVE_ROLES.has(role))) {
    throw new Error("Executive permission required.");
  }
  return caller;
}

export async function requireSignedInFounderInsightCaller(): Promise<FounderInsightCaller> {
  return signedInCaller();
}
