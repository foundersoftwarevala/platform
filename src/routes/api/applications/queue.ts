import { createFileRoute } from "@tanstack/react-router";

import {
  APPLICATION_KINDS,
  definitionOf,
  getApplication,
  isApplicationKind,
  listApplications,
  type ApplicationKind,
} from "@/lib/applications/registry.server";
import { bearer, isApplicationStaff, rpcAs } from "@/lib/applications/gateway.server";
import { applySellerCommissionRule } from "@/lib/commerce/seller-commission.server";

/**
 * Every application, managed from one place: the Control Panel's Application
 * Manager, and each role Manager's own applications queue.
 *
 *   GET  /api/applications/queue?kind=all|<kind>&filter=open|all   the queue
 *   GET  /api/applications/queue?kind=<kind>&id=<id>               one, in full
 *   POST /api/applications/queue {action:"decide", kind, id, status, reason?}
 *
 * Only application staff - the database's own application_staff() - may read
 * or decide. A decision is made with the reviewer's own token by the role's
 * own review function, so its rules apply unchanged: never your own
 * application, a reason for every refusal, a refusal is final.
 */

async function gate(
  request: Request,
): Promise<{ ok: true; token: string } | { ok: false; response: Response }> {
  const token = bearer(request);
  if (!token)
    // i18n-ignore: an API error message; this API answers in English.
    return { ok: false, response: Response.json({ error: "Please sign in" }, { status: 401 }) };
  if (!(await isApplicationStaff(token))) {
    return {
      ok: false,
      response: Response.json(
        // i18n-ignore: an API error message; this API answers in English.
        { error: "Application review is limited to application staff." },
        { status: 403 },
      ),
    };
  }
  return { ok: true, token };
}

export const Route = createFileRoute("/api/applications/queue")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const allowed = await gate(request);
        if (!allowed.ok) return allowed.response;

        const url = new URL(request.url);
        const kindParam = url.searchParams.get("kind") ?? "all";
        const id = url.searchParams.get("id");

        if (id) {
          if (!isApplicationKind(kindParam))
            // i18n-ignore: an API error message; this API answers in English.
            return Response.json({ error: "Name the kind of application" }, { status: 400 });
          const detail = await getApplication(kindParam, id);
          // i18n-ignore: an API error message; this API answers in English.
          if (!detail) return Response.json({ error: "Application not found" }, { status: 404 });
          return Response.json({ application: detail });
        }

        const kinds: ApplicationKind[] =
          kindParam === "all"
            ? [...APPLICATION_KINDS]
            : isApplicationKind(kindParam)
              ? [kindParam]
              : [];
        if (!kinds.length)
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json({ error: "Unknown kind of application" }, { status: 400 });
        try {
          const rows = await listApplications(kinds, url.searchParams.get("filter") !== "all");
          return Response.json({ rows });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "The queue could not be read" },
            { status: 502 },
          );
        }
      },

      POST: async ({ request }) => {
        const allowed = await gate(request);
        if (!allowed.ok) return allowed.response;

        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json({ error: "Expected a JSON body" }, { status: 400 });
        }
        const kind = body.kind;
        const id = String(body.id ?? "").trim();
        if (!isApplicationKind(kind))
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json({ error: "Unknown kind of application" }, { status: 400 });
        if (!/^[0-9a-f-]{36}$/i.test(id))
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json({ error: "An application id is required" }, { status: 400 });
        const definition = definitionOf(kind);

        if (body.action !== "decide")
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json({ error: "Unknown action" }, { status: 400 });
        const status = String(body.status ?? "").trim();
        const reason =
          typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : null;
        const current = await getApplication(kind, id);
        // i18n-ignore: an API error message; this API answers in English.
        if (!current) return Response.json({ error: "Application not found" }, { status: 404 });
        if (!current.actions.includes(status)) {
          return Response.json(
            { error: `An application that is ${current.status} cannot become ${status}.` },
            { status: 409 },
          );
        }
        if ((status === "rejected" || status === "suspended") && !reason) {
          return Response.json(
            { error: `Record why the application is ${status}.` },
            { status: 400 },
          );
        }

        const { fn, args } = definition.review(id, status, reason);
        const outcome = await rpcAs(allowed.token, fn, args);
        if (!outcome.ok)
          return Response.json({ error: outcome.message }, { status: outcome.status });

        // An approved vendor or author carries the commission their agreement
        // promised, exactly as an approval in the Vendor Manager does.
        let commissionRate: number | null = null;
        if ((kind === "vendor" || kind === "author") && status === definition.approvedStatus) {
          commissionRate = await applySellerCommissionRule(id, kind);
        }

        const after = await getApplication(kind, id);
        return Response.json({ ok: true, application: after, commissionRate });
      },
    },
  },
});
