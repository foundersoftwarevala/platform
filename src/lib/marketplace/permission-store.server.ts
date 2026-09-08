import {
  ALL_PERMISSIONS, PERMISSION_KEY, ROLE_PERMISSIONS,
  type Permission,
} from "./permission-guard";

/**
 * Where the permission matrix actually comes from, on the server.
 *
 * permission-guard.ts holds the defaults and the decision. This holds the
 * override, and it exists so the editor in section 19 writes the same thing the
 * guard in section 10 reads. A permission screen that saves to a store nothing
 * consults is worse than no screen at all: it reports a revocation that never
 * happened.
 *
 * The override lives in system_settings under one key, the way the Action Layer
 * registry and the colour palette do. marketplace_role_permissions does not
 * exist as a table and this project has no path to run DDL.
 *
 * Nothing is cached. Section 45 asks that a revoked permission stop working
 * immediately regardless of what any UI believes, and a cache is precisely the
 * thing that would make that untrue for as long as it lived. One small read per
 * guarded call is the cost of that promise being real.
 *
 * .server.ts because it reads with the service role. This must never be
 * reachable from a browser bundle.
 */

function url(): string {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

export type MatrixSource = "defaults" | "system_settings";

export type LoadedMatrix = {
  matrix: Record<string, Permission[]>;
  source: MatrixSource;
  /** Roles whose set differs from the shipped default. */
  overridden: string[];
};

const KNOWN = new Set<string>(ALL_PERMISSIONS);

/** Keep only permissions that exist. A stored typo must not become a grant. */
function clean(list: unknown): Permission[] {
  if (!Array.isArray(list)) return [];
  const out: Permission[] = [];
  for (const item of list) {
    const value = String(item);
    if (KNOWN.has(value) && !out.includes(value as Permission)) out.push(value as Permission);
  }
  return out;
}

function sameSet(a: Permission[], b: Permission[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((p) => set.has(p));
}

/**
 * The matrix in force right now.
 *
 * The stored override replaces a role's set outright rather than merging into
 * it, because a merge could never express a revocation - the shipped default
 * would keep granting back whatever an administrator had just taken away.
 * Roles absent from the override keep their defaults.
 */
export async function loadMatrix(): Promise<LoadedMatrix> {
  const defaults = ROLE_PERMISSIONS as Record<string, Permission[]>;
  if (!url()) return { matrix: defaults, source: "defaults", overridden: [] };

  try {
    const response = await fetch(
      `${url()}/rest/v1/system_settings?select=value&key=eq.${PERMISSION_KEY}&limit=1`,
      { headers: admin() },
    );
    if (!response.ok) return { matrix: defaults, source: "defaults", overridden: [] };
    const rows = (await response.json()) as { value?: string }[];
    if (!rows[0]?.value) return { matrix: defaults, source: "defaults", overridden: [] };

    const parsed = JSON.parse(rows[0].value) as Record<string, unknown>;
    const matrix: Record<string, Permission[]> = { ...defaults };
    const overridden: string[] = [];
    for (const [role, list] of Object.entries(parsed)) {
      const permissions = clean(list);
      matrix[role] = permissions;
      if (!sameSet(permissions, defaults[role] ?? [])) overridden.push(role);
    }
    return { matrix, source: "system_settings", overridden };
  } catch (error) {
    // A malformed override falls back to the defaults rather than to nothing.
    // Failing open on an empty matrix would lock every operator out; failing
    // back to the shipped set keeps the console usable, and the response says
    // which of the two it is rather than hiding it.
    console.error("[permissions] override unreadable, using defaults", error);
    return { matrix: defaults, source: "defaults", overridden: [] };
  }
}

/** Persist a full matrix. The caller has already been authorised. */
export async function saveMatrix(next: Record<string, Permission[]>): Promise<boolean> {
  const body: Record<string, Permission[]> = {};
  for (const [role, list] of Object.entries(next)) body[role] = clean(list);
  try {
    const response = await fetch(`${url()}/rest/v1/system_settings?on_conflict=key`, {
      method: "POST",
      headers: { ...admin(), Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        key: PERMISSION_KEY,
        label: "Marketplace role permissions",
        value: JSON.stringify(body),
        value_type: "json",
        category: "marketplace",
        description:
          "Per-role Marketplace permission override. A role listed here replaces its shipped default outright, so a revocation stays revoked.",
        updated_at: new Date().toISOString(),
      }),
    });
    if (!response.ok) {
      console.error("[permissions] save failed", response.status, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("[permissions] save failed", error);
    return false;
  }
}

/** Drop the override, so every role returns to its shipped default. */
export async function resetMatrix(): Promise<boolean> {
  try {
    const response = await fetch(`${url()}/rest/v1/system_settings?key=eq.${PERMISSION_KEY}`, {
      method: "DELETE",
      headers: admin(),
    });
    return response.ok;
  } catch (error) {
    console.error("[permissions] reset failed", error);
    return false;
  }
}

/**
 * The caller's roles, from the database rather than from the request.
 *
 * Read against user_roles for the user the token actually belongs to, so what
 * comes back is what the database says that account is. A header could claim
 * anything - section 15 lists exactly this among the things never to trust.
 *
 * A call carrying only the internal token has no user behind it. It is treated
 * as the owner tier because it is a script an operator ran deliberately, and
 * every audit row says so rather than naming a person who was not there.
 */
export async function rolesOf(request: Request): Promise<{ roles: string[]; via: string }> {
  const authorization = request.headers.get("authorization");
  const publishable =
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? process.env.SUPABASE_ANON_KEY?.trim();
  if (!authorization || !publishable) return { roles: ["boss"], via: "internal token" };
  try {
    const who = await fetch(`${url()}/auth/v1/user`, {
      headers: { apikey: publishable, Authorization: authorization },
    });
    if (!who.ok) return { roles: [], via: "unknown" };
    const user = (await who.json()) as { id?: string };
    if (!user?.id) return { roles: [], via: "unknown" };
    const rows = await fetch(
      `${url()}/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(user.id)}`,
      { headers: admin() },
    )
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);
    return {
      roles: (rows as { role: string }[]).map((r) => String(r.role)),
      via: `user:${user.id}`,
    };
  } catch {
    return { roles: [], via: "unknown" };
  }
}

/**
 * Record a refusal - section 25.
 *
 * Logging what succeeded says what happened. Logging what was refused says what
 * somebody tried, which is the half most systems drop. Written through mm_audit
 * with the caller's own token where there is one, so the row names them.
 */
export async function recordDenial(
  request: Request,
  detail: {
    action: string;
    permission: string | null;
    roles: string[];
    entityType?: string;
    recordId: string | null;
    why: string;
  },
): Promise<void> {
  try {
    const authorization = request.headers.get("authorization");
    const anon =
      process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? process.env.SUPABASE_ANON_KEY?.trim() ?? "";
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
    const asOperator = Boolean(authorization && anon);
    await fetch(`${url()}/rest/v1/rpc/mm_audit`, {
      method: "POST",
      headers: asOperator
        ? { apikey: anon, Authorization: authorization!, "Content-Type": "application/json" }
        : { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_action: `Action denied: ${detail.action}`,
        p_entity_type: detail.entityType ?? "products",
        p_entity_id: detail.recordId,
        p_before: null,
        p_after: { result: "DENIED", roles: detail.roles, permission_required: detail.permission },
        p_reason: detail.why,
      }),
    });
  } catch (error) {
    console.error("[permissions] denial not recorded", error);
  }
}
