import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";
import {
  ALL_PERMISSIONS, ROLE_PERMISSIONS, resolveAction,
  type Permission,
} from "@/lib/marketplace/permission-guard";
import {
  loadMatrix, recordDenial, resetMatrix, rolesOf, saveMatrix,
} from "@/lib/marketplace/permission-store.server";

/**
 * The role and permission matrix - sections 16 to 19.
 *
 * Read it, search it, and if you are allowed to, change it. What makes this
 * worth having rather than a printed table is that the same matrix is the one
 * the guard consults on every row action, so a revocation made here is in force
 * on the next request. Nothing is cached between the two.
 *
 * Two things this deliberately does not pretend to have.
 *
 * Temporary grants with an expiry (section 22) and break-glass access (section
 * 23) both need rows with their own lifecycle - granted_at, expires_at, an
 * actor, a revocation. A single JSON blob in system_settings cannot expire
 * anything, and a fake expiry that never fires is worse than none, so they are
 * absent rather than mocked.
 *
 * The role counts are real: they are read from user_roles, so a role showing
 * zero people is a role nobody actually holds.
 */

function url(): string {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

/** How many people actually hold each role. Section 16 wants scope, not theory. */
async function roleCounts(): Promise<Record<string, number>> {
  try {
    const response = await fetch(`${url()}/rest/v1/user_roles?select=role`, { headers: admin() });
    if (!response.ok) return {};
    const rows = (await response.json()) as { role: string }[];
    const counts: Record<string, number> = {};
    for (const row of rows) {
      const role = String(row.role);
      counts[role] = (counts[role] ?? 0) + 1;
    }
    return counts;
  } catch {
    return {};
  }
}

/** The module each permission belongs to, for section 18's module filter. */
function moduleOf(permission: string): string {
  const rest = permission.replace(/^marketplace\./, "");
  const parts = rest.split(".");
  return parts.length > 1 ? parts[0] : "records";
}

async function auditChange(
  request: Request,
  action: string,
  before: unknown,
  after: unknown,
  reason: string,
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
        p_action: action,
        p_entity_type: "role_permissions",
        p_entity_id: null,
        p_before: before,
        p_after: after,
        p_reason: reason,
      }),
    });
  } catch (error) {
    console.error("[permissions] audit failed", error);
  }
}

export const Route = createFileRoute("/api/marketplace/permissions")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        if (!url()) return Response.json({ error: "Not configured" }, { status: 503 });

        const [{ matrix, source, overridden }, counts, caller] = await Promise.all([
          loadMatrix(),
          roleCounts(),
          rolesOf(request),
        ]);

        // Every role the platform knows about, whether or not the Marketplace
        // grants it anything. A role that holds people but no permissions is a
        // real answer and it is shown as one, not left out of the table.
        const roles = Array.from(
          new Set([...Object.keys(matrix), ...Object.keys(ROLE_PERMISSIONS), ...Object.keys(counts)]),
        ).sort();

        const editor = resolveAction({
          roles: caller.roles,
          action: "configure_permissions",
          permissions: matrix,
        });

        return Response.json({
          ok: true,
          source,
          overridden,
          permissions: ALL_PERMISSIONS.map((p) => ({ id: p, module: moduleOf(p) })),
          roles: roles.map((role) => {
            const granted = matrix[role] ?? [];
            const shipped = (ROLE_PERMISSIONS as Record<string, Permission[]>)[role] ?? [];
            return {
              role,
              users: counts[role] ?? 0,
              granted,
              denied: ALL_PERMISSIONS.filter((p) => !granted.includes(p)),
              // Section 18 asks to filter by inherited versus override. There
              // is no inheritance chain here - explicit definitions are
              // authoritative, which section 20 also asks for - so the honest
              // two states are "as shipped" and "changed here".
              origin: overridden.includes(role) ? "override" : "default",
              shipped,
            };
          }),
          caller: {
            roles: caller.roles,
            via: caller.via,
            can_edit: editor.visible && editor.enabled,
            edit_reason: editor.reason,
          },
          unsupported: {
            temporary_grants:
              "Section 22 needs per-grant rows with an expiry that something actually enforces. There is no table for that and no way to create one here, so it is absent rather than faked.",
            break_glass:
              "Section 23 needs a time-limited emergency grant that expires on its own. Same reason.",
          },
        });
      },

      PATCH: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        if (!url()) return Response.json({ error: "Not configured" }, { status: 503 });

        let body: {
          role?: string;
          permission?: string;
          granted?: boolean;
          reset?: boolean;
          reason?: string;
        };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        const { matrix, source } = await loadMatrix();
        const caller = await rolesOf(request);

        // Authorised here, on the server, before anything is looked at. The
        // screen not showing an Edit control is not what stops this.
        const decision = resolveAction({
          roles: caller.roles,
          action: "configure_permissions",
          permissions: matrix,
        });
        if (!decision.visible || !decision.enabled) {
          await recordDenial(request, {
            action: "configure_permissions",
            permission: "marketplace.permissions.configure",
            roles: caller.roles,
            entityType: "role_permissions",
            recordId: null,
            why: `${decision.reason ?? "Refused."} Caller ${caller.via} holds [${caller.roles.join(", ") || "no role"}].`,
          });
          return Response.json(
            {
              ok: false,
              reason: "permission_denied",
              message: decision.reason,
              visibility: decision.visible ? "disabled" : "hidden",
            },
            { status: 403 },
          );
        }

        if (body.reset) {
          const done = await resetMatrix();
          if (!done) return Response.json({ error: "The matrix was not reset" }, { status: 502 });
          await auditChange(
            request,
            "Role permissions reset",
            { source, matrix },
            { source: "defaults", matrix: ROLE_PERMISSIONS },
            String(body.reason ?? "").slice(0, 300) ||
              "Every role returned to its shipped Marketplace permissions.",
          );
          const now = await loadMatrix();
          return Response.json({ ok: true, reset: true, source: now.source });
        }

        const role = String(body.role ?? "").trim();
        const permission = String(body.permission ?? "").trim() as Permission;
        if (!role) return Response.json({ error: "A role is required" }, { status: 400 });
        if (!ALL_PERMISSIONS.includes(permission)) {
          return Response.json(
            { error: `"${permission}" is not a Marketplace permission.` },
            { status: 400 },
          );
        }

        const current = matrix[role] ?? [];
        const wanted = Boolean(body.granted);
        const has = current.includes(permission);
        if (has === wanted) {
          // Section 43: doing the same thing twice must not become two events.
          return Response.json({
            ok: true,
            unchanged: true,
            message: `${role} already ${wanted ? "has" : "does not have"} ${permission}.`,
          });
        }

        const next: Record<string, Permission[]> = {};
        for (const [key, list] of Object.entries(matrix)) next[key] = [...list];
        next[role] = wanted
          ? [...current, permission]
          : current.filter((p) => p !== permission);

        const saved = await saveMatrix(next);
        if (!saved) {
          return Response.json({ error: "That change was not saved" }, { status: 502 });
        }

        // Read back, because a write that was accepted and a write that took
        // effect are not the same claim.
        const after = await loadMatrix();
        const effective = (after.matrix[role] ?? []).includes(permission);
        if (effective !== wanted) {
          return Response.json(
            {
              ok: false,
              reason: "not_effective",
              message: `The save was accepted but ${role} still ${effective ? "has" : "does not have"} ${permission}.`,
            },
            { status: 502 },
          );
        }

        await auditChange(
          request,
          wanted ? "Permission granted" : "Permission revoked",
          { role, permission, granted: has },
          { role, permission, granted: wanted, actor_roles: caller.roles },
          String(body.reason ?? "").slice(0, 300) ||
            `${permission} ${wanted ? "granted to" : "revoked from"} ${role} in the Marketplace Manager.`,
        );

        return Response.json({
          ok: true,
          role,
          permission,
          granted: wanted,
          source: after.source,
          // Section 45: this is already true for the backend. The next request
          // any holder of this role makes is evaluated against what was just
          // saved, because the guard re-reads it rather than caching.
          effective_immediately: true,
        });
      },
    },
  },
});
