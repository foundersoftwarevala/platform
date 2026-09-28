import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

import { userFromBearerToken } from "@/lib/auth/bearer-user.server";

const AI_CALLER_ROLES = ["admin", "boss", "developer", "seo", "marketing"] as const;

function tokenFromRequest(): string {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Authentication required for AI requests.");
  return token;
}

/**
 * The signed-in user behind this request, or nothing.
 *
 * The token is checked against the auth service with the **publishable** key,
 * not the service-role one. This module used the service-role client's
 * `auth.getUser()`, which sends the service key as `apikey`, and the auth
 * service answers 401 "Invalid API key" to that — so this guard refused every
 * caller, and with it every browser-reachable AI feature on the platform:
 * chat, the marketplace assistants, the FAQ and SEO writers, the legal and
 * promise-tracker summaries. It is why AI API Manager's OpenAI and Anthropic
 * credentials both still read "never used" while both services sat active and
 * approved, and why only the three cron-driven workers - which never pass
 * through here - ever appear in ai_agent_runs.
 *
 * `requireInternalOperator` and the AI CEO console had already met this and
 * both ask the same way; this is that same check, not a new one.
 *
 * The role check below is unchanged and still runs with the service key, which
 * the REST side does accept. Nothing is loosened.
 */
async function userFromToken(token: string): Promise<{ id: string; email: string | null }> {
  const user = await userFromBearerToken(token);
  if (!user) throw new Error("Authentication required for AI requests.");
  return user;
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
  const user = await userFromToken(tokenFromRequest());

  const checks = await Promise.all(
    AI_CALLER_ROLES.map(async (role) => ({
      role,
      allowed: (await db.rpc("has_role", { _user_id: user.id, _role: role })).data === true,
    })),
  );
  const matched = checks.find((check) => check.allowed);
  if (!matched) throw new Error("AI routing permission required.");
  return { id: user.id, email: user.email, role: matched.role };
}
