import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";

/**
 * The scanner's own settings, and starting a scan.
 *
 * Section 15 asks that these five controls not live in React state. They live
 * in security_scanner_settings, only the named columns can be written, and
 * every change writes a row to security_events.
 *
 * One honest limit on that log. security_events carries no update and no
 * delete policy, so no signed-in user of any role can rewrite it - verified by
 * probing it. The service role bypasses RLS entirely, as it does on every
 * table, so append-only holds against users and not against a caller holding
 * the service key. Making it hold against everything needs a trigger, which
 * needs DDL this project currently has no way to run; it is reported rather
 * than claimed.
 *
 * POST starts scanning. One asset, or every asset eligible under the policy.
 * It calls mm_security_scan_start, which is what decides whether an identical
 * SHA-256 already has a fresh verdict worth reusing; this route never decides
 * a file is clean.
 */

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

/** Only these may be changed from the console. */
const SETTABLE = [
  "block_on_malware",
  "auto_quarantine_flagged",
  "notify_author_on_rejection",
  "attach_hash_to_assets",
  "send_copyright_to_dmca",
  "result_freshness_days",
  "max_upload_mb",
] as const;

export const Route = createFileRoute("/api/security/settings")({
  server: {
    handlers: {
      PATCH: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        if (!url()) return Response.json({ error: "Not configured" }, { status: 503 });

        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        const patch: Record<string, unknown> = {};
        for (const key of SETTABLE) {
          if (key in body) patch[key] = body[key];
        }
        if (Object.keys(patch).length === 0) {
          return Response.json({ error: "Nothing to change" }, { status: 400 });
        }

        const beforeResponse = await fetch(
          `${url()}/rest/v1/security_scanner_settings?select=*&limit=1`,
          { headers: admin() },
        );
        const before = beforeResponse.ok
          ? ((await beforeResponse.json()) as Record<string, unknown>[])[0] ?? null
          : null;
        if (!before) {
          return Response.json({ error: "The scanner has no settings row" }, { status: 404 });
        }

        patch.updated_at = new Date().toISOString();
        const response = await fetch(
          `${url()}/rest/v1/security_scanner_settings?id=eq.${encodeURIComponent(String(before.id))}&select=*`,
          {
            method: "PATCH",
            headers: { ...admin(), Prefer: "return=representation" },
            body: JSON.stringify(patch),
          },
        );
        if (!response.ok) {
          console.error("[security] settings write failed", response.status, await response.text());
          return Response.json({ error: "That setting was not saved" }, { status: 502 });
        }
        const after = ((await response.json()) as Record<string, unknown>[])[0] ?? null;

        // Section 17: a configuration change is a security event, permanently.
        await fetch(`${url()}/rest/v1/security_events`, {
          method: "POST",
          headers: { ...admin(), Prefer: "return=minimal" },
          body: JSON.stringify({
            event: "config.changed",
            previous_state: "settings",
            new_state: "settings",
            reason: "Scanner configuration changed from the Marketplace Manager console.",
            detail: { changed: Object.keys(patch).filter((k) => k !== "updated_at"), before, after },
          }),
        }).catch((error) => console.error("[security] event write failed", error));

        return Response.json({ ok: true, settings: after });
      },

      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        if (!url()) return Response.json({ error: "Not configured" }, { status: 503 });

        let body: { assetId?: string; full?: boolean; limit?: number };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          body = {};
        }

        const start = async (assetId: string) => {
          const response = await fetch(`${url()}/rest/v1/rpc/mm_security_scan_start`, {
            method: "POST",
            headers: admin(),
            body: JSON.stringify({ p_asset: assetId, p_reuse: true }),
          });
          if (!response.ok) {
            return { ok: false, reason: "rpc_failed", detail: (await response.text()).slice(0, 200) };
          }
          return (await response.json()) as Record<string, unknown>;
        };

        if (body.assetId) {
          return Response.json({ ok: true, result: await start(body.assetId) });
        }

        if (!body.full) {
          return Response.json({ error: "Name an asset, or ask for a full scan" }, { status: 400 });
        }

        // Section 30. Eligible means an asset that is not already being
        // scanned; the reuse rule inside the function decides whether an
        // identical file needs looking at again.
        const limit = Math.min(Math.max(Number(body.limit ?? 200) || 200, 1), 1000);
        const listResponse = await fetch(
          `${url()}/rest/v1/security_assets?select=id,status&status=not.in.(scanning)&order=created_at.desc&limit=${limit}`,
          { headers: admin() },
        );
        if (!listResponse.ok) {
          return Response.json({ error: "Could not list the assets" }, { status: 502 });
        }
        const assets = (await listResponse.json()) as { id: string }[];

        const report = { total: assets.length, started: 0, reused: 0, failed: 0 };
        // Sequential on purpose: a full scan must not open hundreds of jobs at
        // once against the provider or the database.
        for (const asset of assets) {
          const result = await start(asset.id);
          if (result.ok === false) report.failed++;
          else if (result.reused) report.reused++;
          else report.started++;
        }

        await fetch(`${url()}/rest/v1/security_events`, {
          method: "POST",
          headers: { ...admin(), Prefer: "return=minimal" },
          body: JSON.stringify({
            event: "scan.full_run",
            new_state: "queued",
            reason: "Full scan requested from the Marketplace Manager console.",
            detail: report,
          }),
        }).catch(() => undefined);

        return Response.json({ ok: true, report });
      },
    },
  },
});
