import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";
import { DEFAULT_ACTIONS, REGISTRY_KEY, type ActionConfig } from "@/lib/marketplace/action-layer";
import {
  DEFINITIONS, FREQUENCIES, MICRO_KEY, SURFACES,
  defaultConfig, validateConfig,
  type MicroConfig, type MicroKey,
} from "@/lib/marketplace/micro-interactions";
import { resolveAction } from "@/lib/marketplace/permission-guard";
import { loadMatrix, recordDenial, rolesOf } from "@/lib/marketplace/permission-store.server";

/**
 * Micro-interaction configuration: read it, save it, reset it.
 *
 * Two things this does beyond storing eight switches.
 *
 * It resolves each feature against what is actually behind it. Section 20 says
 * a micro-interaction cannot outlive the Action Layer setting it depends on -
 * if Add to Cart is off globally then Add To Cart Burst cannot fire, and saying
 * so here is better than letting an operator switch on a burst that will never
 * happen. The same resolution reports the features whose backing does not exist
 * at all, with the exact reason, which is what section 8 and section 26 ask for
 * instead of a hopeful toggle.
 *
 * And it versions every save. Section 24 wants a version with the previous and
 * new configuration and who changed it; mm_audit already records exactly that
 * shape with the operator's own token, so the history is the audit trail rather
 * than a second table that could disagree with it.
 */

function url(): string {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function rows<T = Record<string, unknown>>(path: string): Promise<T[]> {
  try {
    const response = await fetch(`${url()}/rest/v1/${path}`, { headers: admin() });
    if (!response.ok) return [];
    return (await response.json()) as T[];
  } catch {
    return [];
  }
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

async function setting(key: string): Promise<unknown> {
  const found = await rows<{ value?: string }>(
    `system_settings?select=value&key=eq.${key}&limit=1`,
  );
  if (!found[0]?.value) return null;
  try {
    return JSON.parse(found[0].value);
  } catch {
    return null;
  }
}

async function storedConfig(): Promise<{ config: Record<MicroKey, MicroConfig>; configured: boolean }> {
  const raw = await setting(MICRO_KEY);
  if (!raw) return { config: defaultConfig(), configured: false };
  const result = validateConfig(raw);
  if (!result.ok) {
    // A stored configuration that no longer validates falls back to the
    // defaults rather than to something half applied, and the caller is told.
    console.error("[micro] stored configuration is invalid", result.issues);
    return { config: defaultConfig(), configured: false };
  }
  return { config: result.config, configured: true };
}

async function actionLayer(): Promise<ActionConfig[]> {
  const raw = await setting(REGISTRY_KEY);
  if (!Array.isArray(raw)) return DEFAULT_ACTIONS;
  return raw as ActionConfig[];
}

/**
 * What stands between a feature and actually working.
 *
 * Every answer here is a reading, not an opinion: an Action Layer row, an
 * environment variable, or a table that does or does not exist.
 */
async function readiness(actions: ActionConfig[]) {
  const paymentConfigured = Boolean(
    process.env.PAYU_MERCHANT_KEY?.trim() && process.env.PAYU_MERCHANT_SALT?.trim(),
  );
  const [carts, cartItems, demoProducts, viewEvents] = await Promise.all([
    count("marketplace_carts?select=id"),
    count("marketplace_cart_items?select=id"),
    count("marketplace_products?select=id&demo_url=not.is.null"),
    count("marketplace_events?select=id&event_type=eq.product_view"),
  ]);

  const actionFor = (key: string | null) =>
    key ? actions.find((a) => a.key === key) ?? null : null;

  return DEFINITIONS.map((definition) => {
    const action = actionFor(definition.requiresAction);
    const blockers: string[] = [];

    // Section 20, first: a micro-interaction cannot outlive its action.
    if (action && (!action.enabled || action.visibility === "HIDDEN")) {
      blockers.push(
        `${action.label} is ${action.enabled ? "hidden" : "turned off"} in the Action Layer, so this cannot run.`,
      );
    }

    switch (definition.key) {
      case "quick_buy":
        if (!paymentConfigured) {
          blockers.push(
            "No payment provider authenticates in this environment (PAYU_MERCHANT_KEY and PAYU_MERCHANT_SALT are unset), so a Quick Buy cannot reach an order. It stops at the cart.",
          );
        }
        break;
      case "add_to_cart_burst":
        if (cartItems === 0 && carts === 0) {
          blockers.push("The cart tables are empty, so nothing has been added to a cart yet.");
        }
        break;
      case "quick_demo":
        if (demoProducts === 0) {
          blockers.push("No product has a demo URL, so there is nothing to launch.");
        }
        break;
      case "save_for_later":
        blockers.push(
          "There is no saved-products table on this database, so saving is the visitor's own browser only. A signed-in visitor's saves do not follow them to another device, and cannot.",
        );
        break;
      case "recently_viewed":
        if (viewEvents === 0) {
          blockers.push("No product_view events have been recorded yet, so there is nothing to show.");
        }
        break;
      default:
        break;
    }

    return {
      key: definition.key,
      action: action ? { key: action.key, label: action.label, enabled: action.enabled, visibility: action.visibility } : null,
      ready: blockers.length === 0,
      blockers,
      evidence: {
        carts, cart_items: cartItems,
        products_with_demo: demoProducts,
        product_view_events: viewEvents,
        payment_configured: paymentConfigured,
      },
    };
  });
}

/**
 * Section 33: real usage, or the words "no data".
 *
 * marketplace_events is where the storefront already records interactions. Its
 * CHECK constraint permits four stored types, so the specific interaction is
 * kept in metadata.action - both are counted here, because counting only the
 * stored type would under-report every interaction this module adds.
 */
async function analytics() {
  const events = await rows<{
    event_type: string; metadata: Record<string, unknown> | null;
    session_id: string | null; user_id: string | null; surface: string | null;
    created_at: string;
  }>("marketplace_events?select=event_type,metadata,session_id,user_id,surface,created_at&order=created_at.desc&limit=2000");

  const byAction: Record<string, number> = {};
  const bySurface: Record<string, number> = {};
  const sessions = new Set<string>();
  const users = new Set<string>();
  for (const e of events) {
    const action = String(e.metadata?.action ?? e.event_type);
    byAction[action] = (byAction[action] ?? 0) + 1;
    if (e.surface) bySurface[e.surface] = (bySurface[e.surface] ?? 0) + 1;
    if (e.session_id) sessions.add(e.session_id);
    if (e.user_id) users.add(e.user_id);
  }

  const [shares, cartItems] = await Promise.all([
    count("product_share_events?select=id"),
    count("marketplace_cart_items?select=id"),
  ]);

  return {
    total_events: events.length,
    unique_sessions: sessions.size,
    unique_users: users.size,
    by_action: byAction,
    by_surface: bySurface,
    shares_recorded: shares,
    cart_items: cartItems,
    // Said plainly rather than shown as a zero that looks like a measurement.
    empty: events.length === 0,
    note:
      events.length === 0
        ? "No interaction events have been recorded yet."
        : `Counted from ${events.length} marketplace_events rows.`,
  };
}

async function audit(
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
        p_action: action, p_entity_type: "micro_interactions", p_entity_id: null,
        p_before: before, p_after: after, p_reason: reason,
      }),
    });
  } catch (error) {
    console.error("[micro] audit failed", error);
  }
}

async function save(config: Record<MicroKey, MicroConfig>): Promise<boolean> {
  try {
    const response = await fetch(`${url()}/rest/v1/system_settings?on_conflict=key`, {
      method: "POST",
      headers: { ...admin(), Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        key: MICRO_KEY,
        label: "Storefront micro-interactions",
        value: JSON.stringify(config),
        value_type: "json",
        category: "marketplace",
        description: "Per-interaction enablement, surfaces, frequency, device and audience.",
        updated_at: new Date().toISOString(),
      }),
    });
    if (!response.ok) {
      console.error("[micro] save failed", response.status, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("[micro] save failed", error);
    return false;
  }
}

export const Route = createFileRoute("/api/marketplace/micro-interactions")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        if (!url()) return Response.json({ error: "Not configured" }, { status: 503 });

        const { matrix } = await loadMatrix();
        const caller = await rolesOf(request);
        const may = (action: string) => {
          const d = resolveAction({ roles: caller.roles, action, permissions: matrix });
          return d.visible && d.enabled;
        };
        if (!may("micro_view")) {
          await recordDenial(request, {
            action: "micro_view", permission: "marketplace.micro.view",
            roles: caller.roles, entityType: "micro_interactions", recordId: null,
            why: `Caller ${caller.via} holds [${caller.roles.join(", ") || "no role"}].`,
          });
          return Response.json(
            { ok: false, reason: "permission_denied", message: "Permission marketplace.micro.view is required." },
            { status: 403 },
          );
        }

        const actions = await actionLayer();
        const [{ config, configured }, ready, stats, history] = await Promise.all([
          storedConfig(),
          readiness(actions),
          analytics(),
          // Section 24: the versions are the audit rows for this entity.
          rows("marketplace_audit_logs?select=action,reason,actor,actor_role,created_at,before_state,after_state&entity_type=eq.micro_interactions&order=created_at.desc&limit=20"),
        ]);

        return Response.json({
          ok: true,
          configured,
          source: configured ? "system_settings" : "Software Vala defaults",
          definitions: DEFINITIONS,
          surfaces: SURFACES,
          frequencies: FREQUENCIES,
          config,
          readiness: ready,
          analytics: stats,
          versions: history,
          permissions: { view: true, edit: may("micro_edit"), manage: may("micro_manage") },
          // Single marketplace, single tenant. Saying so is the honest answer
          // to section 22 rather than inventing an organization column.
          tenancy: {
            model: "single",
            note: "This platform runs one marketplace. There is no organization_id on the marketplace tables, so there is no cross-tenant configuration to isolate. The configuration is guarded by operator permission instead.",
          },
        });
      },

      PATCH: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        if (!url()) return Response.json({ error: "Not configured" }, { status: 503 });

        let body: { config?: unknown; reset?: boolean; reason?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        const { matrix } = await loadMatrix();
        const caller = await rolesOf(request);
        const decision = resolveAction({
          roles: caller.roles, action: "micro_manage", permissions: matrix,
        });
        if (!decision.visible || !decision.enabled) {
          await recordDenial(request, {
            action: "micro_manage", permission: "marketplace.micro.manage",
            roles: caller.roles, entityType: "micro_interactions", recordId: null,
            why: `${decision.reason ?? "Refused."} Caller ${caller.via} holds [${caller.roles.join(", ") || "no role"}].`,
          });
          return Response.json(
            {
              ok: false, reason: "permission_denied", message: decision.reason,
              visibility: decision.visible ? "disabled" : "hidden",
            },
            { status: 403 },
          );
        }

        const before = await storedConfig();

        if (body.reset) {
          // Section 32: reset removes the override so the defaults are the
          // configuration again, rather than writing the defaults back as
          // though somebody had chosen each one.
          const response = await fetch(`${url()}/rest/v1/system_settings?key=eq.${MICRO_KEY}`, {
            method: "DELETE", headers: admin(),
          });
          if (!response.ok) {
            return Response.json({ error: "The configuration was not reset" }, { status: 502 });
          }
          await audit(request, "Micro-interactions reset", before.config, defaultConfig(),
            String(body.reason ?? "").slice(0, 300) ||
              "Every micro-interaction returned to the Software Vala defaults.");
          return Response.json({ ok: true, reset: true, config: defaultConfig() });
        }

        // Section 2: validated first, and a rejected value is named rather
        // than quietly replaced with something that would have been allowed.
        const result = validateConfig(body.config);
        if (!result.ok) {
          return Response.json(
            { ok: false, reason: "invalid_configuration", issues: result.issues },
            { status: 400 },
          );
        }

        const saved = await save(result.config);
        if (!saved) {
          return Response.json({ error: "That configuration was not saved" }, { status: 502 });
        }

        // Read back. A write that was accepted and a write that took effect
        // are different claims, and section 2 is explicit that success is not
        // shown for the first one.
        const after = await storedConfig();
        if (!after.configured) {
          return Response.json(
            {
              ok: false, reason: "not_effective",
              message: "The save was accepted but reading it back did not return a valid configuration.",
            },
            { status: 502 },
          );
        }

        const changed = DEFINITIONS.filter(
          (d) => JSON.stringify(before.config[d.key]) !== JSON.stringify(after.config[d.key]),
        ).map((d) => d.key);

        await audit(request, "Micro-interactions configured", before.config, after.config,
          String(body.reason ?? "").slice(0, 300) ||
            `Changed ${changed.join(", ") || "nothing"} from the Marketplace Manager.`);

        return Response.json({ ok: true, config: after.config, changed });
      },
    },
  },
});
