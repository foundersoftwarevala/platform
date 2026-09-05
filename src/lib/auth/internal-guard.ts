/**
 * Gate for the /api/internal/* endpoints.
 *
 * These routes rewrite credentials, apply migrations and change schema. They
 * shipped with no authentication at all, so anyone who knew the path could
 * repoint the server's database credentials or run a migration. Nothing about
 * them is removed here — they simply now refuse a caller who cannot prove they
 * are an operator.
 *
 * Two ways to prove it, so an operator is never locked out:
 *
 *   1. `x-internal-token` matching INTERNAL_API_TOKEN, for scripts and the
 *      command line.
 *   2. A signed-in Supabase user whose profile carries an operator role, for
 *      the Control Panel.
 *
 * If neither secret nor Supabase configuration is present the endpoint is
 * refused rather than left open: a misconfigured server must fail closed.
 */

const OPERATOR_ROLES = new Set(["boss", "admin", "super_admin", "owner", "developer"]);

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type GuardResult = { ok: true; via: string } | { ok: false; response: Response };

function deny(message: string, status = 401): GuardResult {
  return { ok: false, response: Response.json({ error: message }, { status }) };
}

/**
 * Handlers in this codebase are written both ways — some receive the Request
 * itself, others the handler context that carries it — so the guard accepts
 * either rather than depending on one shape.
 */
type RequestLike = Request | { request?: Request } | undefined | null;

function asRequest(input: RequestLike): Request | null {
  if (!input) return null;
  if (typeof (input as Request).headers?.get === "function") return input as Request;
  const nested = (input as { request?: Request }).request;
  if (nested && typeof nested.headers?.get === "function") return nested;
  return null;
}

export async function requireInternalOperator(input: RequestLike): Promise<GuardResult> {
  const request = asRequest(input);
  if (!request) {
    return deny("This endpoint could not read the request.", 400);
  }
  // 1. Shared secret, for scripts run by an operator.
  const expected = process.env.INTERNAL_API_TOKEN?.trim();
  const presented = request.headers.get("x-internal-token")?.trim();
  if (expected && presented && timingSafeEqual(expected, presented)) {
    return { ok: true, via: "internal token" };
  }

  // 2. A signed-in operator, for the Control Panel.
  const url = process.env.SUPABASE_URL?.trim();
  const publishable =
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? process.env.SUPABASE_ANON_KEY?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const authorization = request.headers.get("authorization");

  if (!url || !publishable || !serviceKey) {
    return deny("This endpoint is not available on an unconfigured server.", 503);
  }
  if (!authorization) return deny("Operator sign-in required.");

  try {
    const userResponse = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: publishable, Authorization: authorization },
    });
    if (!userResponse.ok) return deny("Operator sign-in required.");
    const user = (await userResponse.json()) as { id?: string };
    if (!user?.id) return deny("Operator sign-in required.");

    const profileResponse = await fetch(
      `${url}/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(user.id)}&limit=1`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    );
    const profiles = profileResponse.ok
      ? ((await profileResponse.json()) as { role?: string }[])
      : [];
    const role = String(profiles[0]?.role ?? "").toLowerCase();
    if (!OPERATOR_ROLES.has(role)) {
      return deny("This endpoint is restricted to operators.", 403);
    }
    return { ok: true, via: `operator:${role}` };
  } catch (error) {
    console.error("[internal guard] check failed", error);
    return deny("Could not verify your access.", 503);
  }
}
