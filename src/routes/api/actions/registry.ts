import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";
import {
  DEFAULT_ACTIONS, REGISTRY_KEY, resolveProductActions,
  type ActionConfig,
} from "@/lib/marketplace/action-layer";

/**
 * The Action Layer registry, and what it resolves to today.
 *
 * GET returns the stored configuration - or the defaults, saying so, when
 * nothing has been stored yet - plus a health line per action computed against
 * the real catalogue and the real payment configuration, which is what section
 * 29 asks for: an action that is enabled but cannot execute should say why
 * rather than sit there looking active.
 *
 * PATCH writes the configuration and records the change through mm_audit, so
 * section 30's requirement that every configuration change is audited holds
 * without a new table.
 */

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

type Row = Record<string, unknown>;

async function read(path: string): Promise<Row[]> {
  try {
    const response = await fetch(`${url()}/rest/v1/${path}`, { headers: admin() });
    if (!response.ok) return [];
    return (await response.json()) as Row[];
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

async function stored(): Promise<{ actions: ActionConfig[]; configured: boolean; row: Row | null }> {
  const rows = await read(`system_settings?select=*&key=eq.${REGISTRY_KEY}&limit=1`);
  const row = rows[0] ?? null;
  if (!row) return { actions: DEFAULT_ACTIONS, configured: false, row: null };
  try {
    const parsed = JSON.parse(String(row.value ?? "[]")) as ActionConfig[];
    return Array.isArray(parsed) && parsed.length
      ? { actions: parsed, configured: true, row }
      : { actions: DEFAULT_ACTIONS, configured: false, row };
  } catch {
    return { actions: DEFAULT_ACTIONS, configured: false, row };
  }
}

export const Route = createFileRoute("/api/actions/registry")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        if (!url()) return Response.json({ error: "Not configured" }, { status: 503 });

        const { actions, configured } = await stored();

        // The environment the resolver reasons about, read rather than assumed.
        const paymentConfigured = Boolean(
          process.env.PAYU_MERCHANT_KEY?.trim() && process.env.PAYU_MERCHANT_SALT?.trim(),
        );

        const [withDemo, purchasable, total, hidden] = await Promise.all([
          count("marketplace_products?select=id&visible=eq.true&demo_url=not.is.null"),
          count("marketplace_products?select=id&visible=eq.true&price_label=not.is.null"),
          count("marketplace_products?select=id&visible=eq.true"),
          count("marketplace_products?select=id&visible=eq.false"),
        ]);

        // Health per action, against the catalogue as it actually is.
        const health = actions.map((a) => {
          const sample = resolveProductActions([a], { demo_url: "x", slug: "s", visible: true, price_label: "$249" },
            { paymentConfigured, signedIn: true })[0];
          let applies: number | null = null;
          let note: string | null = null;
          if (a.key === "LIVE_DEMO") {
            applies = withDemo;
            note = `${withDemo} of ${total} visible products carry a demo URL; the rest hide this action.`;
          } else if (a.key === "BUY_NOW" || a.key === "ADD_TO_CART") {
            applies = paymentConfigured ? purchasable : 0;
            note = paymentConfigured
              ? `${purchasable} of ${total} visible products have a price.`
              : "BLOCKED — no payment provider is configured, so this cannot complete for any product.";
          } else if (a.key === "NOTIFY_ME") {
            applies = hidden;
            note = `${hidden} product(s) are not visible, which is the only case this action appears in.`;
          } else {
            applies = total;
          }
          return {
            key: a.key,
            enabled: a.enabled,
            visibility: a.visibility,
            state: !a.enabled ? "OFF" : sample.available ? "OK" : "BLOCKED",
            blocked_reason: sample.available ? null : sample.reason,
            applies_to_products: applies,
            note,
          };
        });

        return Response.json({
          ok: true,
          configured,
          source: configured ? "system_settings" : "defaults (nothing stored yet)",
          actions,
          environment: { paymentConfigured, products_visible: total, products_with_demo: withDemo },
          health,
        });
      },

      PATCH: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        if (!url()) return Response.json({ error: "Not configured" }, { status: 503 });

        let body: { actions?: ActionConfig[]; reason?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }
        if (!Array.isArray(body.actions) || body.actions.length === 0) {
          return Response.json({ error: "Nothing to save" }, { status: 400 });
        }

        // Only the known keys survive, and only the fields this layer owns, so
        // a crafted body cannot introduce an action or a permission.
        const known = new Set(DEFAULT_ACTIONS.map((a) => a.key));
        const clean: ActionConfig[] = body.actions
          .filter((a) => known.has(a.key))
          .map((a, i) => ({
            key: a.key,
            label: String(a.label ?? "").slice(0, 60) || a.key,
            enabled: Boolean(a.enabled),
            visibility: (["VISIBLE", "DISABLED", "HIDDEN", "CONDITIONAL"] as const).includes(a.visibility)
              ? a.visibility : "VISIBLE",
            sort_order: Number.isFinite(a.sort_order) ? Number(a.sort_order) : i + 1,
            permission: (["public", "authenticated", "purchaser", "operator"] as const).includes(a.permission)
              ? a.permission : "public",
            variant: (["primary", "ghost", "outline"] as const).includes(a.variant) ? a.variant : "ghost",
          }));
        if (clean.length === 0) {
          return Response.json({ error: "No known action in that request" }, { status: 400 });
        }

        const before = await stored();
        const payload = {
          key: REGISTRY_KEY,
          label: "Marketplace action layer",
          value: JSON.stringify(clean),
          value_type: "json",
          category: "marketplace",
          description: "Which product actions exist, in what order, and who may use them.",
          updated_at: new Date().toISOString(),
        };

        const response = await fetch(
          `${url()}/rest/v1/system_settings?on_conflict=key&select=*`,
          {
            method: "POST",
            headers: { ...admin(), Prefer: "resolution=merge-duplicates,return=representation" },
            body: JSON.stringify(payload),
          },
        );
        if (!response.ok) {
          console.error("[actions] save failed", response.status, await response.text());
          return Response.json({ error: "That configuration was not saved" }, { status: 502 });
        }

        // Section 30: the change itself is evidence.
        await fetch(`${url()}/rest/v1/rpc/mm_audit`, {
          method: "POST",
          headers: admin(),
          body: JSON.stringify({
            p_action: "action_layer_configured",
            p_entity_type: "action_layer",
            p_entity_id: null,
            p_before: { actions: before.actions },
            p_after: { actions: clean },
            p_reason: String(body.reason ?? "").slice(0, 300) || "Action Layer updated from the Marketplace Manager.",
          }),
        }).catch((error) => console.error("[actions] audit failed", error));

        return Response.json({ ok: true, actions: clean });
      },
    },
  },
});
