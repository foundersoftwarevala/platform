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
 *   2. A signed-in Supabase user who holds an operator role in `user_roles`,
 *      for the Control Panel.
 *
 * If neither secret nor Supabase configuration is present the endpoint is
 * refused rather than left open: a misconfigured server must fail closed.
 */

// founder and boss_owner are owner-class roles: RequireRole lets them into the
// Marketplace Manager and mm_is_operator accepts them for every database
// function, but this list refused them, so every live table and every
// API-backed section answered them 401. They are recognised here as well.
const OPERATOR_ROLES = new Set([
  "boss",
  "admin",
  "super_admin",
  "owner",
  "developer",
  "founder",
  "boss_owner",
]);

/**
 * Roles that stay in the list above but do not, on their own, make someone an
 * operator of these endpoints.
 *
 * Developers on this marketplace are external product contributors - fourteen
 * accounts hold the role - and this guard protects the endpoints that rewrite
 * the server's database credentials (credential-setup), withdraw a buyer's
 * licences (DELETE /api/orders/<id>/fulfil), settle commissions, administer
 * sellers and apply migrations. None of the 38 route files that call this
 * guard is a developer's own endpoint: /api/marketplace/developer is the
 * Marketplace Manager's "Developer API" section, an operator screen, not
 * something a developer uses.
 *
 * No role is taken from anyone. An account that holds admin (or boss, or any
 * other operator role) as well as developer still passes through that role -
 * one of the fourteen does, and keeps its access; only developer by itself is
 * no longer enough. An endpoint that genuinely
 * belongs to developers can say so explicitly with `{ allowDeveloper: true }`
 * rather than the whole list being widened again.
 */
const NON_OPERATOR_BY_DEFAULT = new Set(["developer"]);

export type InternalGuardOptions = {
  /** Admit a caller whose only qualifying role is developer. Off by default. */
  allowDeveloper?: boolean;
};

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

export async function requireInternalOperator(
  input: RequestLike,
  options: InternalGuardOptions = {},
): Promise<GuardResult> {
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

    // Roles live in `user_roles`, one row per role, and a person may hold
    // several. This guard first asked `profiles` for a `role` column that has
    // never existed there: PostgREST answered 400, the list came back empty and
    // every signed-in operator was refused. Only the shared token worked, which
    // is why the refusal went unnoticed. `user_roles` is the authoritative
    // table and is asked first; the profile column is still consulted after it,
    // so a deployment that does carry one keeps working.
    const service = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
    const held: string[] = [];

    const rolesResponse = await fetch(
      `${url}/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(user.id)}`,
      { headers: service },
    );
    if (rolesResponse.ok) {
      const rows = (await rolesResponse.json()) as { role?: string }[];
      for (const row of rows) {
        const value = String(row?.role ?? "").toLowerCase().trim();
        if (value) held.push(value);
      }
    }

    if (held.length === 0) {
      const profileResponse = await fetch(
        `${url}/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(user.id)}&limit=1`,
        { headers: service },
      );
      if (profileResponse.ok) {
        const profiles = (await profileResponse.json()) as { role?: string }[];
        const value = String(profiles[0]?.role ?? "").toLowerCase().trim();
        if (value) held.push(value);
      }
    }

    // A real operator role is preferred, so admin+developer is reported as
    // admin; developer alone counts only where the endpoint opted in.
    const role =
      held.find((value) => OPERATOR_ROLES.has(value) && !NON_OPERATOR_BY_DEFAULT.has(value)) ??
      (options.allowDeveloper ? held.find((value) => value === "developer") : undefined);
    if (!role) {
      return deny("This endpoint is restricted to operators.", 403);
    }
    return { ok: true, via: `operator:${role}` };
  } catch (error) {
    console.error("[internal guard] check failed", error);
    return deny("Could not verify your access.", 503);
  }
}
