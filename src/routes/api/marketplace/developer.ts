import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";
import { AUTH_MODES, ENDPOINTS, openApi, scopes, toYaml } from "@/lib/marketplace/api-registry";
import { resolveAction } from "@/lib/marketplace/permission-guard";
import { loadMatrix, recordDenial, rolesOf } from "@/lib/marketplace/permission-store.server";

/**
 * Developer API - a section of the Marketplace Manager, not a module beside it.
 *
 * The registry is the endpoints this manager actually serves. What makes it
 * worth more than a document is that it is checked: every GET, and every
 * operator-guarded write, is called without credentials and the answer is
 * compared to what the registry claims. A row that says "operator" and answers
 * 200 to an anonymous caller shows up here as a mismatch, which is the one
 * thing an API document normally cannot tell you about itself.
 *
 * Public write endpoints are the exception and are not probed. Calling
 * /api/marketplace/lead or /track to see what happens would write a real lead
 * and a real event, and a security check that dirties production data is not a
 * check worth having.
 *
 * Four things this section does not pretend to have, each for a stated reason
 * rather than as a gap left quiet: no GraphQL, no OAuth, no issued API keys and
 * no webhooks. Sections 25 and 11 both say not to build a fake layer, and the
 * tables for keys, clients and deliveries cannot be created here - the
 * management token answers 401, so there is no DDL.
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

/**
 * Call every endpoint with no credential and see what it says.
 *
 * This is section 49 as a running check rather than a claim: unauthorised
 * blocked, and the registry honest about which ones are open on purpose.
 */
async function probe(origin: string) {
  const results = await Promise.all(
    ENDPOINTS.map(async (endpoint) => {
      const writesOnPublic = endpoint.auth === "public" && endpoint.method !== "GET";
      if (writesOnPublic) {
        return {
          id: endpoint.id, expected: null as number | null, status: null as number | null,
          agrees: null as boolean | null,
          note: "Not probed: it is public and it writes, so calling it to check would create a real record.",
        };
      }
      const expected = endpoint.auth === "operator" ? 401 : null;
      try {
        const response = await fetch(`${origin}${endpoint.path}`, {
          method: endpoint.method,
          headers: { "Content-Type": "application/json" },
          body: endpoint.method === "GET" ? undefined : "{}",
        });
        const agrees =
          endpoint.auth === "operator" ? response.status === 401 : response.status !== 401;
        return {
          id: endpoint.id, expected, status: response.status, agrees,
          note: agrees
            ? endpoint.auth === "operator"
              ? "Refused an anonymous caller, as declared."
              : "Answered an anonymous caller, as declared."
            : endpoint.auth === "operator"
              ? `Declared operator-only but answered ${response.status} without a credential.`
              : `Declared public but refused an anonymous caller with ${response.status}.`,
        };
      } catch (error) {
        return {
          id: endpoint.id, expected, status: null, agrees: null,
          note: `Could not be reached: ${error instanceof Error ? error.message : "unknown"}.`,
        };
      }
    }),
  );
  return results;
}

/**
 * Section 14 and 15, answered honestly.
 *
 * api_request_logs holds 400 rows and none of them are this API: they are the
 * platform's own outbound calls to Razorpay and the AI gateways, and they
 * belong to the AI API Manager. Presenting them as Marketplace API traffic
 * would be the single most misleading thing this screen could do.
 *
 * What does record every authenticated write through these endpoints is
 * marketplace_audit_logs, which names the actor, the action and the result. So
 * that is what is counted, and it is labelled for what it is.
 */
async function telemetry() {
  const [audit, outbound] = await Promise.all([
    rows<Record<string, unknown>>(
      "marketplace_audit_logs?select=action,actor,actor_role,entity_type,created_at&order=created_at.desc&limit=500",
    ),
    rows<Record<string, unknown>>(
      "api_request_logs?select=status_code,latency_ms,method,occurred_at&order=occurred_at.desc&limit=1",
    ),
  ]);

  const byAction: Record<string, number> = {};
  const byActor: Record<string, number> = {};
  const byEntity: Record<string, number> = {};
  let denied = 0;
  for (const row of audit) {
    const action = String(row.action);
    byAction[action] = (byAction[action] ?? 0) + 1;
    byActor[String(row.actor_role ?? "unknown")] = (byActor[String(row.actor_role ?? "unknown")] ?? 0) + 1;
    byEntity[String(row.entity_type ?? "unknown")] = (byEntity[String(row.entity_type ?? "unknown")] ?? 0) + 1;
    if (action.startsWith("Action denied")) denied += 1;
  }

  const top = (source: Record<string, number>, n = 8) =>
    Object.entries(source).sort((a, b) => b[1] - a[1]).slice(0, n);

  return {
    source: "marketplace_audit_logs",
    what:
      "Every authenticated write through these endpoints is audited with its actor and result. That is the record of this API's traffic; there is no separate request log for it.",
    total_recorded: audit.length,
    denied_attempts: denied,
    top_actions: top(byAction),
    by_actor_role: top(byActor),
    by_entity: top(byEntity),
    latest: audit[0]?.created_at ?? null,
    outbound_note:
      outbound.length > 0
        ? "api_request_logs also exists on this database. It records the platform's outbound calls to external providers and belongs to the AI API Manager, so it is not counted here."
        : null,
  };
}

async function audit(request: Request, action: string, after: unknown, reason: string) {
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
        p_action: action, p_entity_type: "developer_api", p_entity_id: null,
        p_before: null, p_after: after, p_reason: reason,
      }),
    });
  } catch (error) {
    console.error("[developer-api] audit failed", error);
  }
}

export const Route = createFileRoute("/api/marketplace/developer")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        if (!url()) return Response.json({ error: "Not configured" }, { status: 503 });

        const origin = new URL(request.url).origin;
        const params = new URL(request.url).searchParams;
        const format = params.get("format");

        const { matrix } = await loadMatrix();
        const caller = await rolesOf(request);
        const may = (action: string) => {
          const d = resolveAction({ roles: caller.roles, action, permissions: matrix });
          return d.visible && d.enabled;
        };
        if (!may("view")) {
          await recordDenial(request, {
            action: "developer_api_view", permission: "marketplace.view",
            roles: caller.roles, entityType: "developer_api", recordId: null,
            why: `Caller ${caller.via} holds [${caller.roles.join(", ") || "no role"}].`,
          });
          return Response.json(
            { ok: false, reason: "permission_denied", message: "Permission marketplace.view is required." },
            { status: 403 },
          );
        }

        // Section 24 and 42: the spec is generated from the registry, so it
        // cannot describe an endpoint that does not exist.
        if (format === "openapi" || format === "yaml") {
          const spec = openApi(origin);
          await audit(request, "OpenAPI exported", { endpoints: ENDPOINTS.length, format },
            `The Marketplace API specification was exported as ${format === "yaml" ? "YAML" : "JSON"}.`);
          if (format === "yaml") {
            return new Response(toYaml(spec).replace(/^\n/, ""), {
              headers: {
                "Content-Type": "application/yaml; charset=utf-8",
                "Content-Disposition": 'attachment; filename="marketplace-api.yaml"',
              },
            });
          }
          return new Response(JSON.stringify(spec, null, 2), {
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Content-Disposition": 'attachment; filename="marketplace-api.json"',
            },
          });
        }

        const [checks, stats] = await Promise.all([probe(origin), telemetry()]);
        const mismatches = checks.filter((c) => c.agrees === false);

        return Response.json({
          ok: true,
          endpoints: ENDPOINTS,
          auth_modes: AUTH_MODES,
          scopes: scopes(),
          verification: {
            checked: checks.filter((c) => c.agrees !== null).length,
            agree: checks.filter((c) => c.agrees === true).length,
            mismatches: mismatches.length,
            results: checks,
            what:
              "Each endpoint was called from this server with no credential. An operator endpoint must answer 401; a public one must not.",
          },
          telemetry: stats,
          version: {
            current: "v1",
            deprecated: [],
            note: "One version is in service. Paths are unversioned in the URL today; a v2 would be introduced beside v1 rather than by changing these.",
          },
          capabilities: {
            graphql: {
              available: false,
              reason: "There is no GraphQL server in this application. Section 25 says not to build a fake one, so there is not one.",
            },
            api_keys: {
              available: false,
              reason: "Issuing keys needs a table to hold the hash, the scopes and the revocation, and it cannot be created here — the Supabase management token answers 401, so there is no DDL. api_keys exists but belongs to the AI API Manager and holds the platform's own provider credentials.",
            },
            oauth: {
              available: false,
              reason: "No client registry, no authorisation endpoint and no token store. All three need tables.",
            },
            jwt: {
              available: true,
              reason: "Operator bearer tokens are Supabase JWTs, verified against Supabase on every guarded request. This application does not mint or sign its own.",
            },
            webhooks: {
              available: false,
              reason: "The Marketplace Manager emits no outbound events today, and section 11 says to register only events that are actually emitted. finance_payment_webhooks exists, is empty, and belongs to Finance.",
            },
            rate_limiting: {
              available: false,
              reason: "No limiter runs in front of these endpoints. The rate_limits table on this database configures the platform's outbound provider calls, not this API. Saying a limit is enforced when nothing enforces it would be worse than saying there is none.",
            },
            test_console: { available: true, reason: null },
            openapi: { available: true, reason: null },
          },
          permissions: { view: true, test: may("edit"), export: may("export") },
        });
      },

      /**
       * Section 23: the test console runs the real endpoint.
       *
       * It runs server-side with the caller's own credential forwarded, so what
       * comes back is exactly what that caller would get. Nothing is simulated,
       * and a failing call is reported as a failing call.
       */
      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        let body: { endpoint_id?: string; query?: string; payload?: unknown };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        const { matrix } = await loadMatrix();
        const caller = await rolesOf(request);
        const decision = resolveAction({ roles: caller.roles, action: "edit", permissions: matrix });
        if (!decision.visible || !decision.enabled) {
          await recordDenial(request, {
            action: "developer_api_test", permission: "marketplace.edit",
            roles: caller.roles, entityType: "developer_api", recordId: body.endpoint_id ?? null,
            why: `${decision.reason ?? "Refused."} Caller ${caller.via} holds [${caller.roles.join(", ") || "no role"}].`,
          });
          return Response.json(
            { ok: false, reason: "permission_denied", message: decision.reason },
            { status: 403 },
          );
        }

        const endpoint = ENDPOINTS.find((e) => e.id === String(body.endpoint_id ?? ""));
        if (!endpoint) {
          return Response.json(
            { ok: false, reason: "unknown_endpoint", message: "That endpoint is not in the registry." },
            { status: 400 },
          );
        }
        // Only reads from the console. A console that can fire a bulk retire is
        // a console that will, one afternoon, fire a bulk retire.
        if (endpoint.method !== "GET") {
          return Response.json(
            {
              ok: false, reason: "read_only_console",
              message: `${endpoint.name} is a ${endpoint.method}. The console runs reads only — a write belongs in the screen that owns it, where its confirmation and its audit reason are asked for.`,
            },
            { status: 400 },
          );
        }

        const origin = new URL(request.url).origin;
        const query = String(body.query ?? "").replace(/^\?/, "").slice(0, 500);
        const target = `${origin}${endpoint.path}${query ? `?${query}` : ""}`;

        const forwarded: Record<string, string> = { "Content-Type": "application/json" };
        const authorization = request.headers.get("authorization");
        const internal = request.headers.get("x-internal-token");
        if (authorization) forwarded.authorization = authorization;
        if (internal) forwarded["x-internal-token"] = internal;

        const requestId = crypto.randomUUID();
        const started = Date.now();
        let status = 0;
        let text = "";
        let headers: Record<string, string> = {};
        try {
          const response = await fetch(target, { method: "GET", headers: forwarded });
          status = response.status;
          headers = Object.fromEntries(response.headers.entries());
          text = (await response.text()).slice(0, 20000);
        } catch (error) {
          return Response.json(
            {
              ok: false, reason: "unreachable", request_id: requestId,
              message: error instanceof Error ? error.message : "The endpoint could not be reached.",
            },
            { status: 502 },
          );
        }
        const latency = Date.now() - started;

        await audit(request, "API test console call",
          { endpoint: endpoint.id, path: endpoint.path, status, latency_ms: latency, request_id: requestId },
          `${endpoint.name} was called from the API test console and answered ${status}.`);

        let parsed: unknown = null;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text;
        }

        return Response.json({
          ok: true,
          request_id: requestId,
          endpoint: endpoint.id,
          url: `${endpoint.path}${query ? `?${query}` : ""}`,
          status,
          latency_ms: latency,
          // Nothing sensitive: response headers only, and the request's own
          // credential is never echoed back.
          headers: {
            "content-type": headers["content-type"] ?? null,
            "content-length": headers["content-length"] ?? null,
          },
          body: parsed,
        });
      },
    },
  },
});
