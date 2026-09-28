/**
 * Who is behind a bearer token, asked the one way that works here.
 *
 * Supabase's `auth.getUser(token)` sends whatever key its client was built
 * with as `apikey`. Every server guard in this codebase builds that client
 * with the **service-role** key, because it also needs to read `user_roles`
 * — and the auth service answers a service-role `apikey` with
 *
 *     401 {"message":"Invalid API key",
 *          "hint":"Double check your Supabase `anon` or `service_role` API key."}
 *
 * so the guard refuses everyone, including a perfectly valid operator. It is a
 * silent failure: the token is fine, the roles are fine, and the only symptom
 * is that a screen is empty or a feature answers 401 forever.
 *
 * Measured on the live server: the same request with the publishable key as
 * `apikey` gets past the key check and is judged on the token itself. That is
 * the whole fix, and it needs no new credential — the publishable key is
 * already in the environment as SUPABASE_PUBLISHABLE_KEY.
 *
 * This had already been found twice and solved inline, in
 * `lib/auth/internal-guard.ts` and in `lib/ai-ceo/ceo.functions.ts`, each with
 * its own copy of the fetch. This is that same check in one place, so the next
 * guard does not have to rediscover it. Those two keep their working copies;
 * anything new, and anything being repaired, asks here.
 *
 * The role check is a separate question and is deliberately not done here:
 * callers keep their own, with the service key, which the REST side accepts.
 */

export type BearerUser = { id: string; email: string | null };

/** The token from an Authorization header value, or null. */
export function bearerToken(header: string | null | undefined): string | null {
  if (!header) return null;
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

/**
 * The user a token belongs to, or null when it belongs to nobody.
 *
 * Returns null rather than throwing so each caller can refuse in its own
 * words; the wording of these refusals is what operators read.
 */
export async function userFromBearerToken(token: string): Promise<BearerUser | null> {
  const url = process.env.SUPABASE_URL?.trim() ?? process.env.VITE_SUPABASE_URL?.trim() ?? "";
  const publishable =
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ??
    process.env.SUPABASE_ANON_KEY?.trim() ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishable || !token) return null;

  try {
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: publishable, Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const user = (await response.json()) as { id?: string; email?: string };
    if (!user?.id) return null;
    return { id: user.id, email: user.email ?? null };
  } catch (error) {
    console.error("[bearer-user] could not verify the token", error);
    return null;
  }
}
