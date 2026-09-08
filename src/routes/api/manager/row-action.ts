import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";
import {
  ACTION_TARGET, resolveRowActions, transitionAllowed,
  type RowActionId,
} from "@/lib/marketplace/row-actions";
import { ACTION_PERMISSION, resolveAction } from "@/lib/marketplace/permission-guard";
import { loadMatrix } from "@/lib/marketplace/permission-store.server";

/**
 * Row actions, executed on the server.
 *
 * The resolver decides what a row may offer; this decides what actually
 * happens, and it re-decides it rather than trusting what the browser sent.
 * Section 18 and section 44 both say the same thing in different words: a
 * button being visible is not authorisation.
 *
 * Three things it will not do.
 *
 * It will not make an illegal transition. The state machine in row-actions.ts
 * says what each status may become, and anything else is refused by name.
 *
 * It will not delete a product that anything depends on. Section 9 asks for a
 * block with the exact dependency, so orders, licences and entitlements are
 * counted first and the refusal says which of them stands in the way.
 *
 * It will not invent an audit trail. Every write goes through
 * /api/manager/resource, which already records before and after with a content
 * hash and names the operator, so a row action is auditable for the same
 * reason every other manager write is.
 */

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The caller's roles, from the database rather than from the request.
 *
 * Read with their own token, so what comes back is what user_roles says that
 * account is - a claim in a header could say anything. An internal-token call
 * has no user, and is treated as the owner tier because it is a script an
 * operator ran deliberately; that is recorded as such in any denial.
 */
async function rolesOf(request: Request): Promise<{ roles: string[]; via: string }> {
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
 * Record a refusal.
 *
 * Section 25: a denied attempt is a security event. Written through mm_audit
 * with the caller's own token where there is one, so the record names them.
 */
async function recordDenial(
  request: Request,
  detail: { action: string; permission: string | null; roles: string[]; recordId: string; why: string },
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
        p_entity_type: "products",
        p_entity_id: detail.recordId,
        p_before: null,
        p_after: { result: "DENIED", roles: detail.roles, permission_required: detail.permission },
        p_reason: detail.why,
      }),
    });
  } catch (error) {
    console.error("[row-action] denial not recorded", error);
  }
}

function forwardAuth(request: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  const authorization = request.headers.get("authorization");
  const internal = request.headers.get("x-internal-token");
  if (authorization) headers.authorization = authorization;
  if (internal) headers["x-internal-token"] = internal;
  return headers;
}

async function count(path: string): Promise<number> {
  try {
    const response = await fetch(`${url()}/rest/v1/${path}`, {
      headers: { ...admin(), Prefer: "count=exact", Range: "0-0" },
    });
    if (!response.ok) return 0;
    return Number((response.headers.get("content-range") ?? "").split("/")[1]) || 0;
  } catch {
    return 0;
  }
}

/** What would be orphaned. Counted before anything is removed — section 9. */
async function dependenciesOf(productId: string) {
  const [orders, licences, entitlements, demos] = await Promise.all([
    count(`marketplace_order_items?select=id&product_id=eq.${productId}`),
    count(`marketplace_licenses?select=id&product_id=eq.${productId}`),
    count(`marketplace_entitlements?select=id&product_id=eq.${productId}`),
    count(`product_demo_urls?select=id&product_id=eq.${productId}`),
  ]);
  const blocking: string[] = [];
  if (orders) blocking.push(`${orders} order line(s)`);
  if (licences) blocking.push(`${licences} licence(s)`);
  if (entitlements) blocking.push(`${entitlements} entitlement(s)`);
  return { orders, licences, entitlements, demos, blocking };
}

export const Route = createFileRoute("/api/manager/row-action")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        if (!url()) return Response.json({ error: "Not configured" }, { status: 503 });

        let body: { id?: string; action?: RowActionId; confirm?: boolean; reason?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        const id = String(body.id ?? "");
        const action = body.action as RowActionId;
        if (!UUID.test(id)) return Response.json({ error: "A product id is required" }, { status: 400 });

        // The record as it is now, not as the browser last saw it — section 35.
        const rows = await fetch(
          `${url()}/rest/v1/marketplace_products` +
            `?select=id,name,slug,content_status,moderation_status,visible,demo_url` +
            `&id=eq.${encodeURIComponent(id)}&limit=1`,
          { headers: admin() },
        )
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []);
        const record = (rows as Record<string, unknown>[])[0];
        if (!record) return Response.json({ error: "No such product" }, { status: 404 });

        // Permission first, from the database. Sections 15 and 33: the button
        // is not the boundary.
        const { roles, via } = await rolesOf(request);
        // The matrix as it stands now, not as it shipped. A permission revoked
        // in the Role Matrix screen is in force on this request - section 45
        // asks the backend to enforce immediately whatever any UI believes.
        const { matrix } = await loadMatrix();
        const decision = resolveAction({ roles, action, permissions: matrix });
        if (!decision.visible || !decision.enabled) {
          await recordDenial(request, {
            action, permission: ACTION_PERMISSION[action] ?? null, roles, recordId: id,
            why: `${decision.reason ?? "Refused."} Caller ${via} holds [${roles.join(", ") || "no role"}].`,
          });
          return Response.json(
            {
              ok: false,
              reason: "permission_denied",
              message: decision.reason,
              // Section 11: an action the role may not know about is hidden,
              // one it may take but cannot right now is disabled.
              visibility: decision.visible ? "disabled" : "hidden",
            },
            { status: 403 },
          );
        }

        // Re-resolved here. What the browser believed is not consulted.
        const resolved = resolveRowActions(record as never).find((a) => a.id === action);
        if (!resolved) return Response.json({ error: "Unknown action" }, { status: 400 });
        if (!resolved.available) {
          return Response.json(
            { ok: false, reason: "not_available", message: resolved.reason },
            { status: 409 },
          );
        }
        if (resolved.confirmationRequired && !body.confirm) {
          return Response.json({
            ok: false,
            reason: "confirmation_required",
            message: `${resolved.label} needs confirmation.`,
            record: { id, name: record.name, status: record.content_status },
            danger: resolved.dangerLevel,
          }, { status: 428 });
        }

        /* ------------------------------------------------------------ delete */
        if (action === "delete") {
          const deps = await dependenciesOf(id);
          if (deps.blocking.length) {
            // Blocked with the exact dependency, as section 9 asks, rather than
            // a generic refusal or a delete that orphans a paid order.
            return Response.json({
              ok: false,
              reason: "dependencies_exist",
              message: `This product cannot be deleted: ${deps.blocking.join(", ")} depend on it. Archive it instead — that keeps the history and takes it off the storefront.`,
              dependencies: deps,
            }, { status: 409 });
          }
          return Response.json({
            ok: false,
            reason: "policy",
            message: "Nothing in this catalogue is deleted. Archive takes a product off the storefront and keeps its history.",
            dependencies: deps,
          }, { status: 409 });
        }

        /* -------------------------------------------------- state transitions */
        const target = ACTION_TARGET[action];
        if (target) {
          const from = String(record.content_status ?? "draft");
          if (!transitionAllowed(from, target)) {
            return Response.json({
              ok: false,
              reason: "invalid_transition",
              message: `A ${from} product cannot become ${target}.`,
            }, { status: 409 });
          }

          const changes: Record<string, unknown> =
            target === "published"
              ? { content_status: "published", visible: true }
              : target === "archived"
                ? { content_status: "archived", visible: false }
                : { content_status: "draft", visible: false };

          // Through the resource endpoint, so the write is audited with before,
          // after and a content hash exactly like every other manager write.
          const origin = new URL(request.url).origin;
          const response = await fetch(`${origin}/api/manager/resource`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...forwardAuth(request) },
            body: JSON.stringify({ resource: "products", id, changes }),
          });
          const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; row?: unknown; error?: string };
          if (!response.ok || !payload.ok || !payload.row) {
            return Response.json(
              { ok: false, reason: "write_failed", message: payload.error ?? "That change was not saved" },
              { status: 502 },
            );
          }
          return Response.json({
            ok: true, action, from, to: target,
            audit_event: resolved.auditEvent, row: payload.row,
          });
        }

        /* --------------------------------------------------------- duplicate */
        if (action === "duplicate") {
          const origin = new URL(request.url).origin;
          const base = record as Record<string, unknown>;
          const stamp = Date.now().toString(36);
          // A new identity, never the old one. Nothing about ownership, orders
          // or licences travels — section 7.
          const values = {
            name: `${String(base.name ?? "Untitled")} (copy)`,
            slug: `${String(base.slug ?? "product")}-copy-${stamp}`.slice(0, 200),
            visible: false,
            content_status: "draft",
          };
          const response = await fetch(`${origin}/api/manager/resource`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...forwardAuth(request) },
            body: JSON.stringify({ resource: "products", values }),
          });
          const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; row?: Record<string, unknown>; error?: string };
          if (!response.ok || !payload.ok || !payload.row) {
            return Response.json(
              { ok: false, reason: "duplicate_failed", message: payload.error ?? "The copy was not created" },
              { status: 502 },
            );
          }
          return Response.json({
            ok: true, action, audit_event: resolved.auditEvent,
            created: { id: payload.row.id, name: payload.row.name, slug: payload.row.slug },
            note: "The copy is a draft and not visible. Nothing about ownership, orders or licences was carried over.",
          });
        }

        // view, preview, edit, live_demo and audit are navigations; the caller
        // already has the destination from the resolver.
        return Response.json({
          ok: true, action, navigate: resolved.href ?? null,
          audit_event: resolved.auditEvent,
        });
      },
    },
  },
});
