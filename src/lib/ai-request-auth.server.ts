import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

const AI_CALLER_ROLES = ["admin", "boss", "developer", "seo", "marketing"] as const;

function tokenFromRequest(): string {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Authentication required for AI requests.");
  return token;
}

/**
 * Every browser-reachable AI function resolves its actor on the server.
 * Callers supply prompts, never roles, product identities, or credentials.
 */
export async function requireAuthorizedAiCaller(): Promise<{
  id: string;
  email: string | null;
  role: (typeof AI_CALLER_ROLES)[number];
}> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) throw new Error("Supabase service configuration is missing.");

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.auth.getUser(tokenFromRequest());
  if (error || !data.user) throw new Error("Authentication required for AI requests.");

  const checks = await Promise.all(
    AI_CALLER_ROLES.map(async (role) => ({
      role,
      allowed: (await db.rpc("has_role", { _user_id: data.user.id, _role: role })).data === true,
    })),
  );
  const matched = checks.find((check) => check.allowed);
  if (!matched) throw new Error("AI routing permission required.");
  return { id: data.user.id, email: data.user.email ?? null, role: matched.role };
}
