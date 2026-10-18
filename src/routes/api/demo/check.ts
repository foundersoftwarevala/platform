import { createFileRoute } from "@tanstack/react-router";

import { requireInternalOperator } from "@/lib/auth/internal-guard";
import { checkUrl } from "@/lib/demo/url-check.server";

/**
 * Check one demo address now, on the server, and record the result.
 *
 * The "check" and "re-check" buttons used to run in the browser with a no-cors
 * fetch that stored every reachable address as HTTP 200 / working, or called a
 * `health-check` edge function that does not exist on this server (404). This
 * does the same real check the scheduled monitor does, writes it to the same
 * columns, appends it to demo_health and to the demo audit log, and returns it.
 *
 *   POST /api/demo/check  { "id": "<product_demo_urls.id>" }
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/demo/check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        const base = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
        if (!base || !key) {
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json(
            {
              error: "The database is not configured on this server." /* i18n-ignore: API error */,
            },
            { status: 503 },
          );
        }
        let id = "";
        try {
          id = String(((await request.json()) as { id?: unknown }).id ?? "");
        } catch {
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json({ error: "Expected a JSON body" }, { status: 400 });
        }
        if (!UUID.test(id)) {
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json({ error: "A demo address id is required" }, { status: 400 });
        }

        const headers = {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        };
        const found = await fetch(
          `${base}/rest/v1/product_demo_urls?select=id,demo_name,url&id=eq.${id}`,
          { headers },
        );
        if (!found.ok) {
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json({ error: "The demo address could not be read" }, { status: 502 });
        }
        const [row] = (await found.json()) as {
          id: string;
          demo_name: string | null;
          url: string | null;
        }[];
        if (!row) {
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json({ error: "That demo address was not found" }, { status: 404 });
        }
        if (!row.url?.trim()) {
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json({ error: "This demo has no address to check" }, { status: 422 });
        }

        const outcome = await checkUrl(row.url);
        const checkedAt = new Date().toISOString();
        const patch = {
          last_checked_at: checkedAt,
          last_response_ms: outcome.ms,
          last_http_status: outcome.status,
          last_result: outcome.result,
          ssl_valid: outcome.ssl_valid,
        };

        const writes = await Promise.all([
          fetch(`${base}/rest/v1/product_demo_urls?id=eq.${id}`, {
            method: "PATCH",
            headers: { ...headers, Prefer: "return=minimal" },
            body: JSON.stringify(patch),
          }),
          // History, so uptime is counted rather than declared.
          fetch(`${base}/rest/v1/demo_health`, {
            method: "POST",
            headers: { ...headers, Prefer: "return=minimal" },
            body: JSON.stringify({
              demo_url_id: id,
              status: outcome.result === "offline" ? "down" : "active",
              response_time: outcome.ms,
              http_status: outcome.status,
              error_message: outcome.error,
            }),
          }),
          fetch(`${base}/rest/v1/demo_url_audit_log`, {
            method: "POST",
            headers: { ...headers, Prefer: "return=minimal" },
            body: JSON.stringify({
              demo_url_id: id,
              action: "demo_url.test",
              actor_email: gate.via,
              metadata: {
                http_status: outcome.status,
                response_ms: outcome.ms,
                result: outcome.result,
                ssl_valid: outcome.ssl_valid,
                ssl_days_left: outcome.ssl_days,
                error: outcome.error,
              },
            }),
          }),
        ]);
        const failed = writes.find((w) => !w.ok);
        if (failed) {
          const detail = await failed.text().catch(() => "");
          console.error(
            "[demo check] could not record the result",
            failed.status,
            detail.slice(0, 200),
          );
          return Response.json(
            // i18n-ignore: an API error message; this API answers in English.
            { error: "The check ran but its result could not be saved", check: { id, ...patch } },
            { status: 502 },
          );
        }
        return Response.json({ id, ...patch, error: outcome.error, ssl_days: outcome.ssl_days });
      },
    },
  },
});
