import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";
import { catalogueChanged } from "@/lib/marketplace/catalogue-invalidation";
import { withVpsPublicDatabase } from "@/lib/marketplace-manager/vps-rpc.server";
import {
  DEFAULT_ACTIONS,
  REGISTRY_KEY,
  type ActionConfig,
  type Visibility,
} from "@/lib/marketplace/action-layer";

type SettingsRow = {
  value: string;
  label: string;
  value_type: string;
  category: string;
  description: string;
  updated_at: string;
};

const VISIBILITIES: Visibility[] = ["VISIBLE", "DISABLED", "HIDDEN", "CONDITIONAL"];
const PERMISSIONS: ActionConfig["permission"][] = [
  "public",
  "authenticated",
  "purchaser",
  "operator",
];
const VARIANTS: ActionConfig["variant"][] = ["primary", "ghost", "outline"];
const ACTION_KEYS = new Set(DEFAULT_ACTIONS.map((action) => action.key));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The existing operator guard has already validated this bearer with local Auth. */
function verifiedSubject(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const decoded: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!decoded || typeof decoded !== "object") return null;
    const sub = (decoded as { sub?: unknown }).sub;
    return typeof sub === "string" && UUID.test(sub) ? sub : null;
  } catch {
    return null;
  }
}

async function currentSettings(): Promise<SettingsRow | null> {
  return withVpsPublicDatabase(async (tx) => {
    const [row] = await tx<SettingsRow[]>`
      select value, label, value_type, category, description, updated_at::text as updated_at
        from public.system_settings
       where key = ${REGISTRY_KEY}
       limit 1
    `;
    return row ?? null;
  });
}

function parseStored(row: SettingsRow | null): {
  actions: ActionConfig[];
  configured: boolean;
} {
  if (!row) return { actions: DEFAULT_ACTIONS, configured: false };
  try {
    const parsed: unknown = JSON.parse(row.value);
    const actions = normaliseActions(parsed);
    if (actions) return { actions, configured: true };
  } catch {
    // A malformed persisted value is not a configured registry.
  }
  return { actions: DEFAULT_ACTIONS, configured: false };
}

function normaliseActions(value: unknown): ActionConfig[] | null {
  if (!Array.isArray(value) || value.length !== DEFAULT_ACTIONS.length) return null;
  const seen = new Set<string>();
  const output: ActionConfig[] = [];

  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const item = raw as Record<string, unknown>;
    if (
      typeof item.key !== "string" ||
      !ACTION_KEYS.has(item.key as ActionConfig["key"]) ||
      seen.has(item.key) ||
      typeof item.enabled !== "boolean" ||
      typeof item.label !== "string" ||
      !Number.isInteger(item.sort_order) ||
      !VISIBILITIES.includes(item.visibility as Visibility) ||
      !PERMISSIONS.includes(item.permission as ActionConfig["permission"]) ||
      !VARIANTS.includes(item.variant as ActionConfig["variant"])
    ) {
      return null;
    }
    seen.add(item.key);
    output.push({
      key: item.key as ActionConfig["key"],
      label: item.label.slice(0, 60) || item.key,
      enabled: item.enabled,
      visibility: item.visibility as Visibility,
      sort_order: item.sort_order as number,
      permission: item.permission as ActionConfig["permission"],
      variant: item.variant as ActionConfig["variant"],
    });
  }

  return seen.size === ACTION_KEYS.size ? output : null;
}

async function productCounts() {
  return withVpsPublicDatabase(async (tx) => {
    const [counts] = await tx<
      {
        visible: number;
        with_demo: number;
        purchasable: number;
        hidden: number;
      }[]
    >`
      select
        count(*) filter (where visible is true)::int as visible,
        count(*) filter (where visible is true and demo_url is not null)::int as with_demo,
        count(*) filter (
          where visible is true and price_label is not null and content_status is distinct from 'archived'
        )::int as purchasable,
        count(*) filter (where visible is false)::int as hidden
      from public.marketplace_products
    `;
    if (!counts) throw new Error("The product counts could not be read.");
    return counts;
  });
}

function makeHealth(actions: ActionConfig[], counts: Awaited<ReturnType<typeof productCounts>>) {
  return actions.map((action) => {
    const enabled =
      action.enabled && action.visibility !== "HIDDEN" && action.visibility !== "DISABLED";
    let applies: number | null = counts.visible;
    let reason: string | null = null;
    let note: string | null = null;

    if (action.key === "LIVE_DEMO") {
      applies = counts.with_demo;
      if (enabled && counts.with_demo === 0)
        reason = "No visible products currently have a demo URL.";
      note = `${counts.with_demo} of ${counts.visible} visible products carry a demo URL.`;
    } else if (action.key === "BUY_NOW" || action.key === "ADD_TO_CART") {
      applies = counts.purchasable;
      if (enabled && counts.purchasable === 0)
        reason = "No visible, priced products are available.";
      note = `${counts.purchasable} of ${counts.visible} visible products are purchasable.`;
    } else if (action.key === "NOTIFY_ME") {
      applies = counts.hidden;
      note = `${counts.hidden} hidden products are in the catalogue.`;
    }

    return {
      key: action.key,
      enabled: action.enabled,
      visibility: action.visibility,
      state:
        !action.enabled || action.visibility === "HIDDEN" || action.visibility === "DISABLED"
          ? "OFF"
          : reason
            ? "BLOCKED"
            : "OK",
      blocked_reason: reason,
      applies_to_products: applies,
      note,
    };
  });
}

export const Route = createFileRoute("/api/actions/registry")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        try {
          const [row, counts] = await Promise.all([currentSettings(), productCounts()]);
          const { actions, configured } = parseStored(row);
          return Response.json({
            ok: true,
            configured,
            source: configured ? "system_settings (VPS Postgres)" : "defaults (nothing stored yet)",
            actions,
            environment: {
              paymentConfigured: Boolean(
                process.env.PAYU_MERCHANT_KEY?.trim() && process.env.PAYU_MERCHANT_SALT?.trim(),
              ),
              products_visible: counts.visible,
              products_with_demo: counts.with_demo,
            },
            health: makeHealth(actions, counts),
          });
        } catch {
          return Response.json(
            { error: "Could not read the VPS action registry." },
            { status: 502 },
          );
        }
      },

      PATCH: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        let body: { actions?: unknown; reason?: unknown };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Invalid request body." }, { status: 400 });
        }
        const actions = normaliseActions(body.actions);
        if (!actions) {
          return Response.json(
            { error: "The complete action registry is required; no changes were saved." },
            { status: 400 },
          );
        }
        const reason =
          typeof body.reason === "string" && body.reason.trim()
            ? body.reason.trim().slice(0, 500)
            : "Configured from the Product Action Manager.";
        const token =
          gate.via === "internal token"
            ? null
            : (request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1] ?? null);
        const userId = token ? verifiedSubject(token) : null;
        if (gate.via !== "internal token" && !userId) {
          return Response.json(
            { error: "Could not verify the operator for audit." },
            { status: 503 },
          );
        }

        try {
          const saved = await withVpsPublicDatabase(async (tx) => {
            if (userId) {
              const claims = JSON.stringify({ sub: userId, role: "authenticated" });
              await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
              await tx`select set_config('request.jwt.claims', ${claims}, true)`;
            }
            const [before] = await tx<{ value: string }[]>`
              select value from public.system_settings where key = ${REGISTRY_KEY} for update
            `;
            await tx`
              insert into public.system_settings
                (key, label, value, value_type, category, description, updated_at)
              values
                (
                  ${REGISTRY_KEY},
                  'Marketplace action layer',
                  ${JSON.stringify(actions)},
                  'json',
                  'marketplace',
                  'Which product actions exist, in what order, and who may use them.',
                  now()
                )
              on conflict (key) do update set
                label = excluded.label,
                value = excluded.value,
                value_type = excluded.value_type,
                category = excluded.category,
                description = excluded.description,
                updated_at = excluded.updated_at
            `;
            await tx`
              select public.mm_audit(
                'configure_action_layer',
                'action_layer',
                ${REGISTRY_KEY},
                ${before?.value ?? null}::jsonb,
                ${JSON.stringify(actions)}::jsonb,
                ${reason}
              )
            `;
            return { actions, configured: true };
          });
          catalogueChanged();
          return Response.json({ ok: true, ...saved });
        } catch {
          return Response.json(
            {
              error:
                "The VPS action settings or audit could not be saved; no success was recorded.",
            },
            { status: 502 },
          );
        }
      },
    },
  },
});
