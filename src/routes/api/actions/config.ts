import { createFileRoute } from "@tanstack/react-router";
import { onCatalogueChange } from "@/lib/marketplace/catalogue-invalidation";
import { withVpsPublicDatabase } from "@/lib/marketplace-manager/vps-rpc.server";
import { DEFAULT_ACTIONS, REGISTRY_KEY, type ActionConfig } from "@/lib/marketplace/action-layer";

type Config = { actions: ActionConfig[]; paymentConfigured: boolean; configured: boolean };
type SettingsRow = { value: string };

const CACHE_MS = 60_000;
let cached: { at: number; payload: Config } | null = null;
const ACTION_KEYS = new Set(DEFAULT_ACTIONS.map((action) => action.key));
onCatalogueChange(() => {
  cached = null;
});

function actionsFromValue(value: string | null): ActionConfig[] | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length !== DEFAULT_ACTIONS.length) return null;
    const seen = new Set<string>();
    for (const raw of parsed) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
      const item = raw as Record<string, unknown>;
      if (
        typeof item.key !== "string" ||
        !ACTION_KEYS.has(item.key as ActionConfig["key"]) ||
        seen.has(item.key) ||
        typeof item.enabled !== "boolean" ||
        typeof item.label !== "string" ||
        !Number.isInteger(item.sort_order) ||
        !["VISIBLE", "DISABLED", "HIDDEN", "CONDITIONAL"].includes(String(item.visibility)) ||
        !["public", "authenticated", "purchaser", "operator"].includes(String(item.permission)) ||
        !["primary", "ghost", "outline"].includes(String(item.variant))
      ) {
        return null;
      }
      seen.add(item.key);
    }
    return seen.size === ACTION_KEYS.size ? (parsed as ActionConfig[]) : null;
  } catch {
    return null;
  }
  return null;
}

export const Route = createFileRoute("/api/actions/config")({
  server: {
    handlers: {
      GET: async () => {
        if (cached && Date.now() - cached.at < CACHE_MS) {
          return Response.json(
            { ok: true, ...cached.payload },
            {
              headers: { "cache-control": "public, max-age=60" },
            },
          );
        }

        try {
          const [row] = await withVpsPublicDatabase(async (tx) => {
            const rows = await tx<SettingsRow[]>`
              select value from public.system_settings where key = ${REGISTRY_KEY} limit 1
            `;
            return rows;
          });
          const paymentConfigured = Boolean(
            process.env.PAYU_MERCHANT_KEY?.trim() && process.env.PAYU_MERCHANT_SALT?.trim(),
          );
          const actions = actionsFromValue(row?.value) ?? DEFAULT_ACTIONS;
          const payload = {
            configured: actions !== DEFAULT_ACTIONS,
            actions,
            paymentConfigured,
          };
          cached = { at: Date.now(), payload };
          return Response.json(
            { ok: true, ...payload },
            {
              headers: { "cache-control": "public, max-age=60" },
            },
          );
        } catch {
          return Response.json(
            { ok: false, error: "Could not read the VPS action registry." },
            { status: 502 },
          );
        }
      },
    },
  },
});
