import { createFileRoute } from "@tanstack/react-router";
import { DEFAULT_ACTIONS, REGISTRY_KEY, type ActionConfig } from "@/lib/marketplace/action-layer";

/**
 * The action layer, as the storefront reads it.
 *
 * The configuration endpoint next door requires an operator, because it also
 * writes. This one is read-only and public, because what it returns is
 * presentation configuration - which buttons exist, in what order, how they
 * are styled - and a visitor is about to see all of that anyway.
 *
 * It answers one question the browser cannot answer for itself: whether a
 * payment provider is configured. Only the boolean crosses; no key, no
 * merchant id, nothing about the provider.
 *
 * Held for a minute in the process and given a short public cache, so a page
 * of product cards costs one request rather than one per card - section 38.
 */

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

const CACHE_MS = 60_000;
let cached: { at: number; payload: unknown } | null = null;

export const Route = createFileRoute("/api/actions/config")({
  server: {
    handlers: {
      GET: async () => {
        if (cached && Date.now() - cached.at < CACHE_MS) {
          return Response.json(cached.payload, {
            headers: { "cache-control": "public, max-age=60" },
          });
        }

        const paymentConfigured = Boolean(
          process.env.PAYU_MERCHANT_KEY?.trim() && process.env.PAYU_MERCHANT_SALT?.trim(),
        );

        let actions: ActionConfig[] = DEFAULT_ACTIONS;
        let configured = false;

        if (url()) {
          try {
            const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
            const response = await fetch(
              `${url()}/rest/v1/system_settings?select=value&key=eq.${REGISTRY_KEY}&limit=1`,
              { headers: { apikey: key, Authorization: `Bearer ${key}` } },
            );
            if (response.ok) {
              const rows = (await response.json()) as { value: string }[];
              if (rows[0]?.value) {
                const parsed = JSON.parse(rows[0].value) as ActionConfig[];
                if (Array.isArray(parsed) && parsed.length) {
                  actions = parsed;
                  configured = true;
                }
              }
            }
          } catch {
            // The storefront falls back to the defaults rather than losing its
            // buttons because a settings read failed.
          }
        }

        const payload = { ok: true, configured, actions, paymentConfigured };
        cached = { at: Date.now(), payload };
        return Response.json(payload, {
          headers: { "cache-control": "public, max-age=60" },
        });
      },
    },
  },
});
