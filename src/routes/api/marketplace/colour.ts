import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";
import {
  ACTION_TOKENS, DEFAULT_HEX, PALETTE_KEY, buildToken, contrast,
  defaultPalette, hexToRgb, normaliseHex,
  type Token, type TokenKey,
} from "@/lib/marketplace/color";
import { resolveAction } from "@/lib/marketplace/permission-guard";
import { loadMatrix, recordDenial, rolesOf } from "@/lib/marketplace/permission-store.server";

/**
 * The Marketplace palette: read, save, reset.
 *
 * Stored in system_settings under one key, the same way the Action Layer
 * registry is. marketplace_colour_* tables do not exist and this project has
 * no path to run DDL, and section 24 asks for presets to be configuration
 * rather than component logic - system_settings is the platform's own
 * configuration store, so that is where this goes.
 *
 * Only the hex is stored. RGB and HSL are derived on every read, which is what
 * section 22 means by one source of truth: two stored representations drift,
 * and then nobody knows which one is the colour.
 *
 * Section 28 asks every saved palette to be versioned with actor, timestamp,
 * previous and new values. mm_audit already records exactly that, called with
 * the operator's own token so the record names them, so the history is the
 * audit trail rather than a second table that would have to be kept in step.
 */

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function stored(): Promise<{ tokens: Token[]; configured: boolean }> {
  try {
    const response = await fetch(
      `${url()}/rest/v1/system_settings?select=value&key=eq.${PALETTE_KEY}&limit=1`,
      { headers: admin() },
    );
    if (!response.ok) return { tokens: defaultPalette(), configured: false };
    const rows = (await response.json()) as { value: string }[];
    if (!rows[0]?.value) return { tokens: defaultPalette(), configured: false };
    const parsed = JSON.parse(rows[0].value) as Record<string, string>;
    const tokens = (Object.keys(DEFAULT_HEX) as TokenKey[]).map((k) =>
      buildToken(k, parsed[k] ?? DEFAULT_HEX[k].hex, DEFAULT_HEX[k].label),
    );
    return { tokens, configured: true };
  } catch {
    return { tokens: defaultPalette(), configured: false };
  }
}

async function audit(request: Request, action: string, before: unknown, after: unknown, reason: string) {
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
        p_action: action, p_entity_type: "colour_palette", p_entity_id: null,
        p_before: before, p_after: after, p_reason: reason,
      }),
    });
  } catch (error) {
    console.error("[colour] audit failed", error);
  }
}

export const Route = createFileRoute("/api/marketplace/colour")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        if (!url()) return Response.json({ error: "Not configured" }, { status: 503 });

        const { tokens, configured } = await stored();
        // Section 27: reported, not enforced. A token that fails contrast is
        // flagged with the ratio it reached so the choice is visible.
        const onDark = hexToRgb("#0A1526");
        const onLight = hexToRgb("#FFFFFF");
        return Response.json({
          ok: true,
          configured,
          source: configured ? "system_settings" : "Software Vala defaults",
          tokens: tokens.map((t) => ({
            ...t,
            contrast_on_dark: contrast(t.rgb, onDark),
            contrast_on_light: contrast(t.rgb, onLight),
            // 4.5 is the AA threshold for normal text.
            readable_on_dark: contrast(t.rgb, onDark) >= 4.5,
            readable_on_light: contrast(t.rgb, onLight) >= 4.5,
          })),
          action_tokens: ACTION_TOKENS,
          defaults: DEFAULT_HEX,
        });
      },

      PATCH: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        if (!url()) return Response.json({ error: "Not configured" }, { status: 503 });

        // Section 26: the palette is configuration, so changing it takes
        // marketplace.colors.configure and not merely being an operator.
        // Reading it stays open to any operator - the colours are on every
        // screen they can already see, so guarding the read would protect
        // nothing.
        const { matrix } = await loadMatrix();
        const caller = await rolesOf(request);
        const allowed = resolveAction({
          roles: caller.roles, action: "configure_colors", permissions: matrix,
        });
        if (!allowed.visible || !allowed.enabled) {
          await recordDenial(request, {
            action: "configure_colors",
            permission: "marketplace.colors.configure",
            roles: caller.roles,
            entityType: "colour_palette",
            recordId: null,
            why: `${allowed.reason ?? "Refused."} Caller ${caller.via} holds [${caller.roles.join(", ") || "no role"}].`,
          });
          return Response.json(
            {
              ok: false,
              reason: "permission_denied",
              message: allowed.reason,
              visibility: allowed.visible ? "disabled" : "hidden",
            },
            { status: 403 },
          );
        }

        let body: { tokens?: Record<string, string>; reset?: boolean; reason?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        const before = await stored();

        if (body.reset) {
          // Section 26: reset restores exactly the configured default, by
          // removing the override rather than writing the defaults back as if
          // somebody had chosen them.
          const response = await fetch(
            `${url()}/rest/v1/system_settings?key=eq.${PALETTE_KEY}`,
            { method: "DELETE", headers: admin() },
          );
          if (!response.ok) {
            return Response.json({ error: "The palette was not reset" }, { status: 502 });
          }
          await audit(request, "Colour palette reset", { tokens: before.tokens }, { tokens: defaultPalette() },
            "Palette reset to the Software Vala defaults.");
          return Response.json({ ok: true, reset: true, tokens: defaultPalette() });
        }

        // Only known tokens, and only valid colours. An invalid value is
        // refused by name rather than silently replaced with a default.
        const accepted: Record<string, string> = {};
        const rejected: { key: string; value: string; reason: string }[] = [];
        for (const [key, value] of Object.entries(body.tokens ?? {})) {
          if (!(key in DEFAULT_HEX)) {
            rejected.push({ key, value: String(value), reason: "Not a Marketplace colour token." });
            continue;
          }
          const hex = normaliseHex(String(value));
          if (!hex) {
            rejected.push({ key, value: String(value), reason: "Not a valid hex colour." });
            continue;
          }
          accepted[key] = hex;
        }
        if (rejected.length) {
          return Response.json(
            { error: "Some values were not colours", rejected },
            { status: 400 },
          );
        }
        if (Object.keys(accepted).length === 0) {
          return Response.json({ error: "Nothing to save" }, { status: 400 });
        }

        // Anything not sent keeps what it had, so a partial save is a partial
        // save rather than a silent reset of everything else.
        const merged: Record<string, string> = {};
        for (const t of before.tokens) merged[t.key] = t.hex;
        Object.assign(merged, accepted);

        const response = await fetch(
          `${url()}/rest/v1/system_settings?on_conflict=key&select=*`,
          {
            method: "POST",
            headers: { ...admin(), Prefer: "resolution=merge-duplicates,return=representation" },
            body: JSON.stringify({
              key: PALETTE_KEY,
              label: "Marketplace colour palette",
              value: JSON.stringify(merged),
              value_type: "json",
              category: "marketplace",
              description: "Semantic action colours. Only the hex is stored; RGB and HSL are derived.",
              updated_at: new Date().toISOString(),
            }),
          },
        );
        if (!response.ok) {
          console.error("[colour] save failed", response.status, await response.text());
          return Response.json({ error: "That palette was not saved" }, { status: 502 });
        }

        const after = (Object.keys(DEFAULT_HEX) as TokenKey[]).map((k) =>
          buildToken(k, merged[k], DEFAULT_HEX[k].label),
        );
        await audit(
          request, "Colour palette changed",
          { tokens: before.tokens.map((t) => ({ key: t.key, hex: t.hex })) },
          { tokens: after.map((t) => ({ key: t.key, hex: t.hex })), changed: Object.keys(accepted) },
          String(body.reason ?? "").slice(0, 300) ||
            `Changed ${Object.keys(accepted).join(", ")} from the Marketplace Manager.`,
        );

        return Response.json({ ok: true, tokens: after, changed: Object.keys(accepted) });
      },
    },
  },
});
