import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";
import { withVpsPublicDatabase } from "@/lib/marketplace-manager/vps-rpc.server";
import { bearerToken, userFromBearerToken } from "@/lib/auth/bearer-user.server";
import type { TransactionSql } from "postgres";
import { requireJsonObject } from "@/lib/json";

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
const BOOLEAN_SETTINGS = new Set<string>([
  "block_on_malware",
  "auto_quarantine_flagged",
  "notify_author_on_rejection",
  "attach_hash_to_assets",
  "send_copyright_to_dmca",
]);

export const Route = createFileRoute("/api/security/settings")({
  server: {
    handlers: {
      PATCH: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        const patch: Record<string, unknown> = {};
        for (const key of SETTABLE) {
          if (!(key in body)) continue;
          const value = body[key];
          if (BOOLEAN_SETTINGS.has(key)) {
            if (typeof value !== "boolean") {
              return Response.json({ error: `${key} must be a boolean` }, { status: 400 });
            }
          } else if (
            typeof value !== "number" ||
            !Number.isInteger(value) ||
            (key === "result_freshness_days" && (value < 0 || value > 365)) ||
            (key === "max_upload_mb" && (value < 1 || value > 10_240))
          ) {
            return Response.json({ error: `${key} is outside its allowed range` }, { status: 400 });
          }
          patch[key] = value;
        }
        if (Object.keys(patch).length === 0) {
          return Response.json({ error: "Nothing to change" }, { status: 400 });
        }

        try {
          const result = await withVpsPublicDatabase((tx) => updateScannerSettings(tx, patch));
          if (!result) {
            return Response.json({ error: "The scanner has no settings row" }, { status: 404 });
          }
          return Response.json({ ok: true, settings: result.after });
        } catch (error) {
          console.error("[security] settings transaction failed", error);
          return Response.json({ error: "That setting was not saved" }, { status: 502 });
        }
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

        const token = bearerToken(request.headers.get("authorization"));
        const caller = token ? await userFromBearerToken(token) : null;
        const internalToken = gate.via === "internal token";
        if (!caller && !internalToken) {
          return Response.json(
            { ok: false, error: "A verified operator session is required to start scans." },
            { status: 401 },
          );
        }

        const withAuthorizedOperator = <T>(run: (tx: TransactionSql) => Promise<T>) =>
          withVpsPublicDatabase(async (tx) => {
            const claims = internalToken
              ? JSON.stringify({ role: "service_role" })
              : JSON.stringify({ sub: caller!.id, role: "authenticated" });
            if (caller) {
              await tx`select set_config('request.jwt.claim.sub', ${caller.id}, true)`;
            }
            await tx`select set_config('request.jwt.claims', ${claims}, true)`;
            return run(tx);
          });

        const start = async (assetId: string) =>
          withAuthorizedOperator(async (tx) => {
            const [row] = await tx<{ result: unknown }[]>`
              select public.mm_security_scan_start(${assetId}::uuid, true) as result
            `;
            if (!row) throw new Error("The scan function returned no result.");
            return requireJsonObject(row.result, "The scanner result") as Record<string, unknown>;
          });

        const failure = (result: Record<string, unknown>) =>
          Response.json(
            {
              ok: false,
              error: `The scan could not be started (${String(result.reason ?? "unknown")}).`,
              result,
            },
            { status: 409 },
          );

        const auditFullRun = (report: {
          total: number;
          started: number;
          reused: number;
          failed: number;
        }) =>
          withAuthorizedOperator(async (tx) => {
            await tx`
              insert into public.security_events
                (event, actor_id, actor_role, new_state, reason, detail)
              values (
                'scan.full_run',
                ${caller?.id ?? null}::uuid,
                ${gate.role ?? (internalToken ? "internal_token" : null)},
                'queued',
                'Full scan requested from the Marketplace Manager console.',
                ${JSON.stringify(report)}::jsonb
              )
            `;
          });

        if (body.assetId) {
          try {
            const result = await start(body.assetId);
            if (result.ok !== true) return failure(result);
            return Response.json({ ok: true, result });
          } catch (error) {
            console.error("[security] scan start failed", error);
            return Response.json(
              { ok: false, error: "The scan could not be started." },
              { status: 502 },
            );
          }
        }

        if (!body.full) {
          return Response.json({ error: "Name an asset, or ask for a full scan" }, { status: 400 });
        }

        // Section 30. Eligible means an asset that is not already being
        // scanned; the reuse rule inside the function decides whether an
        // identical file needs looking at again.
        const limit = Math.min(Math.max(Number(body.limit ?? 200) || 200, 1), 1000);
        let assets: { id: string }[];
        try {
          assets = await withAuthorizedOperator(
            (tx) =>
              tx<{ id: string }[]>`
              select id
                from public.security_assets
               where status <> 'scanning'
               order by created_at desc
               limit ${limit}
            `,
          );
        } catch (error) {
          console.error("[security] scanner asset list failed", error);
          return Response.json(
            { ok: false, error: "Could not list assets for scanning." },
            { status: 502 },
          );
        }

        const report = { total: assets.length, started: 0, reused: 0, failed: 0 };
        // Sequential on purpose: a full scan must not open hundreds of jobs at
        // once against the provider or the database.
        for (const asset of assets) {
          try {
            const result = await start(asset.id);
            if (result.ok !== true) report.failed++;
            else if (result.reused) report.reused++;
            else report.started++;
          } catch (error) {
            console.error("[security] scan start failed", error);
            report.failed++;
          }
        }

        try {
          await auditFullRun(report);
        } catch (error) {
          console.error("[security] full scan audit failed", error);
          return Response.json(
            {
              ok: false,
              error: "The scan run completed, but its audit event could not be recorded.",
              report,
            },
            { status: 502 },
          );
        }

        if (report.failed > 0) {
          return Response.json(
            {
              ok: false,
              error: `${report.failed} scan${report.failed === 1 ? "" : "s"} failed to start.`,
              report,
            },
            { status: 502 },
          );
        }
        return Response.json({ ok: true, report });
      },
    },
  },
});

async function updateScannerSettings(
  tx: TransactionSql,
  patch: Record<string, unknown>,
): Promise<{ before: Record<string, unknown>; after: Record<string, unknown> } | null> {
  const [beforeRow] = await tx<{ settings: Record<string, unknown> }[]>`
    select to_jsonb(settings) as settings
      from public.security_scanner_settings settings
     where id = true
     for update
  `;
  if (!beforeRow?.settings) return null;

  const entries = Object.entries(patch).filter(([key]) =>
    (SETTABLE as readonly string[]).includes(key),
  );
  if (entries.length === 0) throw new Error("No recognized scanner settings were supplied.");
  const assignments = entries.map(([key], index) => `"${key}" = $${index + 1}`);
  assignments.push("updated_at = now()");
  const updatedRows = (await tx.unsafe(
    `update public.security_scanner_settings
        set ${assignments.join(", ")}
      where id = true
      returning to_jsonb(security_scanner_settings) as settings`,
    entries.map(([, value]) => value) as never[],
  )) as { settings: Record<string, unknown> }[];
  const after = updatedRows[0]?.settings;
  if (!after) throw new Error("The scanner settings row could not be updated.");

  const changed = entries.map(([key]) => key);
  await tx`
    insert into public.security_events
      (event, previous_state, new_state, reason, detail)
    values (
      'config.changed',
      'settings',
      'settings',
      'Scanner configuration changed from the Marketplace Manager console.',
      ${JSON.stringify({ changed, before: beforeRow.settings, after })}::jsonb
    )
  `;

  return { before: beforeRow.settings, after };
}
