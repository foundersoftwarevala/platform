import { DEMO_OPERATOR_ROLES } from "./demo-roles";
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

/**
 * Who may publish a demo. The list itself lives in demo-roles.ts, which holds no
 * logic, so the route gate in the browser can read it without pulling this
 * guard - and its env access and service key - into the client bundle.
 */
export const OPERATOR_ROLES = new Set<string>(DEMO_OPERATOR_ROLES);
export { DEMO_ROUTE_ROLES } from "./demo-roles";

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

    // Roles live in `user_roles`, one row per role, and a person may hold
    // several. This guard first asked `profiles` for a `role` column that has
    // never existed there: PostgREST answered 400, the list came back empty and
    // every signed-in operator was refused. Only the shared token worked, which
    // is why the refusal went unnoticed. `user_roles` is the authoritative
    // table and the only one asked: profiles has no role column, and a role
    // that cannot be read is a refusal, never a guess.
    const service = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
    const held: string[] = [];

    const rolesResponse = await fetch(
      `${url}/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(user.id)}`,
      { headers: service },
    );
    if (!rolesResponse.ok) {
      console.error("[internal guard] user_roles lookup failed", rolesResponse.status);
      return deny("Could not verify your access.", 503);
    }
    const rows = (await rolesResponse.json()) as { role?: string }[];
    for (const row of rows) {
      const value = String(row?.role ?? "").toLowerCase().trim();
      if (value) held.push(value);
    }

    const role = held.find((value) => OPERATOR_ROLES.has(value));
    if (!role) {
      // Names who can, because the screens in front of this are opened by
      // support as well as developers - RouteAccessGate admits both - and a
      // refusal that does not say who to ask reads as a fault in the product.
      return deny(
        "Publishing a demo is restricted to operators (" + [...OPERATOR_ROLES].join(", ") + "). Ask one of them to run it.",
        403,
      );
    }
    return { ok: true, via: `operator:${role}` };
  } catch (error) {
    console.error("[internal guard] check failed", error);
    return deny("Could not verify your access.", 503);
  }
}
