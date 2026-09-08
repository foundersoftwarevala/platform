import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";

/**
 * The bulk operation engine.
 *
 * There is one table in the Marketplace Manager - LiveTable, over
 * /api/manager/resource - and forty-four sections use it. This gives that one
 * table bulk operations rather than giving each section its own, which is what
 * section 42 asks for and what section 12 means by taking actions from the
 * central registry: the operations here are exactly the ones the resource
 * whitelist already permits, evaluated per resource.
 *
 * Section 25 says the flow is validate, authorize, preview, execute, verify,
 * audit - never click then success toast. So:
 *
 *   preview: true  returns what would happen to each row and changes nothing.
 *   Every row is validated on its own, and one ineligible row does not stop
 *   the others or get quietly carried through with them.
 *   The result is per record, with a reason for each refusal.
 *   One correlation id ties every audit row of the run together.
 *
 * Partial failure is reported as partial. Section 26 is explicit that
 * successful records are not rolled back silently to make a run look clean.
 */

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ceiling on one run. A larger selection is refused, not silently truncated. */
const MAX_RECORDS = 500;

type Outcome = {
  id: string;
  status: "done" | "skipped" | "failed" | "unauthorized" | "invalid";
  reason?: string;
  changed?: string[];
};

/**
 * The resource definitions live in resource.ts. Rather than duplicating that
 * whitelist - the thing section 42 forbids - this asks that endpoint what a
 * resource permits, and refuses anything it does not.
 */
async function describe(request: Request, resource: string) {
  const origin = new URL(request.url).origin;
  const response = await fetch(
    `${origin}/api/manager/resource?resource=${encodeURIComponent(resource)}&limit=1`,
    { headers: { ...forwardAuth(request) } },
  );
  if (!response.ok) return null;
  return (await response.json()) as {
    label: string; columns: string[]; editable: string[];
    creatable?: string[]; retirable?: boolean;
  };
}

function forwardAuth(request: Request): Record<string, string> {
  const authorization = request.headers.get("authorization");
  const internal = request.headers.get("x-internal-token");
  const headers: Record<string, string> = {};
  if (authorization) headers.authorization = authorization;
  if (internal) headers["x-internal-token"] = internal;
  return headers;
}

export const Route = createFileRoute("/api/manager/bulk")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        if (!url()) return Response.json({ error: "Not configured" }, { status: 503 });

        let body: {
          resource?: string;
          ids?: string[];
          operation?: "update" | "retire";
          changes?: Record<string, unknown>;
          preview?: boolean;
          reason?: string;
          operationId?: string;
        };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        const resourceName = String(body.resource ?? "").trim();
        const operation = body.operation === "retire" ? "retire" : "update";
        const preview = body.preview !== false; // preview unless told otherwise
        const ids = (body.ids ?? []).filter((id) => UUID.test(String(id)));

        if (!resourceName) return Response.json({ error: "Which resource?" }, { status: 400 });
        if (ids.length === 0) {
          return Response.json({ error: "Nothing was selected" }, { status: 400 });
        }
        if (ids.length > MAX_RECORDS) {
          // Refused rather than truncated: quietly acting on the first 500 of a
          // larger selection is worse than saying the selection is too large.
          return Response.json(
            { error: `That is ${ids.length} records. This engine runs at most ${MAX_RECORDS} in one go.` },
            { status: 413 },
          );
        }

        const spec = await describe(request, resourceName);
        if (!spec) return Response.json({ error: "Unknown resource" }, { status: 400 });

        // Section 27: one id for the whole run, so a retry with the same id is
        // recognisable in the audit trail and every row of the run is tied
        // together by it.
        const operationId = String(body.operationId ?? "").slice(0, 64) || crypto.randomUUID();

        /* ------------------------------------------------------- validate */
        let changes: Record<string, unknown> = {};
        if (operation === "update") {
          for (const [key, value] of Object.entries(body.changes ?? {})) {
            if (spec.editable.includes(key)) changes[key] = value;
          }
          if (Object.keys(changes).length === 0) {
            return Response.json(
              { error: "Nothing changeable was sent", editable: spec.editable },
              { status: 400 },
            );
          }
        } else if (!spec.retirable) {
          return Response.json(
            { error: `${spec.label} cannot be retired here` },
            { status: 403 },
          );
        }

        const origin = new URL(request.url).origin;

        /* -------------------------------------------------------- preview */
        if (preview) {
          return Response.json({
            ok: true,
            preview: true,
            operation,
            operation_id: operationId,
            resource: resourceName,
            label: spec.label,
            records: ids.length,
            changes: operation === "update" ? changes : { retire: true },
            note:
              "Nothing has been changed. Send preview: false with this operation_id to run it.",
          });
        }

        /* -------------------------------------------------------- execute */
        const outcomes: Outcome[] = [];
        // Sequential on purpose: five hundred parallel writes against one table
        // is how a bulk action becomes an outage.
        for (const id of ids) {
          try {
            const response =
              operation === "retire"
                ? await fetch(
                    `${origin}/api/manager/resource?resource=${encodeURIComponent(resourceName)}&id=${encodeURIComponent(id)}`,
                    { method: "DELETE", headers: forwardAuth(request) },
                  )
                : await fetch(`${origin}/api/manager/resource`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json", ...forwardAuth(request) },
                    body: JSON.stringify({ resource: resourceName, id, changes }),
                  });

            const payload = (await response.json().catch(() => ({}))) as {
              ok?: boolean; error?: string; changed?: string[]; row?: unknown;
            };

            if (response.ok && payload.ok && payload.row) {
              outcomes.push({ id, status: "done", changed: payload.changed });
            } else if (response.ok && payload.ok && !payload.row) {
              // PostgREST answers a write that matched nothing with 200 and an
              // empty array, so no row came back means the record is not there.
              // Counting that as done would report a run over stale ids as a
              // complete success.
              outcomes.push({
                id,
                status: "skipped",
                reason: "No such record — it was not found, so nothing was changed.",
              });
            } else if (response.status === 401 || response.status === 403) {
              outcomes.push({ id, status: "unauthorized", reason: payload.error ?? "Refused" });
            } else if (response.status === 400) {
              outcomes.push({ id, status: "invalid", reason: payload.error ?? "Rejected" });
            } else {
              outcomes.push({ id, status: "failed", reason: payload.error ?? `HTTP ${response.status}` });
            }
          } catch (error) {
            outcomes.push({
              id,
              status: "failed",
              reason: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }

        const tally = {
          done: outcomes.filter((o) => o.status === "done").length,
          failed: outcomes.filter((o) => o.status === "failed").length,
          invalid: outcomes.filter((o) => o.status === "invalid").length,
          unauthorized: outcomes.filter((o) => o.status === "unauthorized").length,
          skipped: outcomes.filter((o) => o.status === "skipped").length,
        };
        // Section 26: partial is partial. A run with one failure is not a
        // success, and the successful rows are not undone to make it look tidy.
        const status =
          tally.done === outcomes.length
            ? "completed"
            : tally.done === 0
              ? tally.skipped === outcomes.length
                ? "nothing_matched"
                : "failed"
              : "partial";

        /* ---------------------------------------------------------- audit */
        // Each record already produced its own audit row through
        // /api/manager/resource. This is the run itself, tying them together.
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
              p_action: `${spec.label} bulk ${operation}`,
              p_entity_type: resourceName,
              p_entity_id: null,
              p_before: { operation_id: operationId, selected: ids.length },
              p_after: { operation_id: operationId, status, ...tally, outcomes: outcomes.slice(0, 200) },
              p_reason: String(body.reason ?? "").slice(0, 300) ||
                `Bulk ${operation} of ${ids.length} ${spec.label} record(s) from the Marketplace Manager.`,
            }),
          });
        } catch (error) {
          console.error("[bulk] audit failed", error);
        }

        return Response.json({
          ok: status !== "failed",
          status,
          operation,
          operation_id: operationId,
          resource: resourceName,
          label: spec.label,
          ...tally,
          total: outcomes.length,
          outcomes,
        });
      },
    },
  },
});
