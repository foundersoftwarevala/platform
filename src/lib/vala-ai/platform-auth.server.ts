import { roleFromPlatform, type Operator } from "./auth.server.ts";
import { ValaError } from "./util.server.ts";

/**
 * Resolves the Vala AI caller from the Control Panel session.
 *
 * The browser sends the Control Panel's bearer token (`authHeaders()` from
 * `@/lib/auth/operator-fetch`); the platform's own `requireOperator` verifies
 * it and reads the account's roles — the same check every other operator
 * surface uses, unchanged. Developers are admitted on top of the platform's
 * operator roles, as the /vala-ai route gate already does. There is no other
 * way in: no Vala AI password, no development bypass.
 */
export async function resolveCaller(req: Request): Promise<Operator | null> {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;

  const { requireOperator } = await import("@/lib/auth/require-operator.server");
  let account: { userId: string; email: string; roles: string[] };
  try {
    account = await requireOperator("Vala AI", { alsoAllow: ["developer"] });
  } catch (e) {
    if (/operator rights/.test((e as Error).message))
      throw new ValaError(403, "Your Control Panel account has no Vala AI role.");
    return null;
  }
  const role = roleFromPlatform(account.roles);
  if (!role) throw new ValaError(403, "Your Control Panel account has no Vala AI role.");
  return { id: account.userId, email: account.email, name: account.email || account.userId, role };
}
