import { createFileRoute } from "@tanstack/react-router";
import { translateApiMessage } from "@/lib/i18n/server-translate.server";

import {
  APPLICATION_KINDS,
  definitionOf,
  getApplication,
  isApplicationKind,
  listApplications,
  countApplications,
  type ApplicationKind,
} from "@/lib/applications/registry.server";
import {
  bearer,
  isApplicationBoss,
  isApplicationStaff,
  isResellerApplicationReader,
  rpcAs,
} from "@/lib/applications/gateway.server";
import { applySellerCommissionRule } from "@/lib/commerce/seller-commission.server";
import { providerConfigured, sendQueued } from "@/lib/commerce/mailer";

/**
 * Every application, managed from one place: the Control Panel's Application
 * Manager, and each role Manager's own applications queue.
 *
 *   GET  /api/applications/queue?kind=all|<kind>&filter=open|all   the queue
 *   GET  /api/applications/queue?kind=reseller&filter=reseller-manager
 *                                                               the manager's read-only list
 *   GET  /api/applications/queue?kind=<kind>&id=<id>               one, in full
 *   POST /api/applications/queue {action:"decide", kind, id, status, reason?}
 *
 * Application staff read the normal queues. Reseller Managers may read only
 * reseller application summaries; only platform operators may decide those
 * applications. Other decisions retain the existing application_staff gate.
 */

function signedIn(
  request: Request,
): { ok: true; token: string } | { ok: false; response: Response } {
  const token = bearer(request);
  if (!token)
    // i18n-ignore: an API error message; this API answers in English.
    return { ok: false, response: Response.json({ error: "Please sign in" }, { status: 401 }) };
  return { ok: true, token };
}

function forbidden(message = "Application review is limited to application staff.") {
  return Response.json(
    // i18n-ignore: an API error message; this API answers in English.
    { error: message },
    { status: 403 },
  );
}

export const Route = createFileRoute("/api/applications/queue")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const translateText = translateApiMessage.bind(null, request);
        const auth = signedIn(request);
        if (!auth.ok) return auth.response;

        const url = new URL(request.url);
        const kindParam = url.searchParams.get("kind") ?? "all";
        const id = url.searchParams.get("id");
        const resellerManagerView = url.searchParams.get("filter") === "reseller-manager";
        if (url.searchParams.get("counts") === "true") {
          if (!(await isApplicationStaff(auth.token))) return forbidden();
          try {
            return Response.json(
              {
                ...(await countApplications()),
                emailProviderConfigured: Boolean(providerConfigured()),
              },
              { headers: { "Cache-Control": "no-store" } },
            );
          } catch (error) {
            console.error("[applications] counts unavailable", error);
            return Response.json(
              { error: await translateText("apply.api_application_counts_could_not_be_read_527dfa1") },
              { status: 502 },
            );
          }
        }

        if (id) {
          if (!isApplicationKind(kindParam))
            // i18n-ignore: an API error message; this API answers in English.
            return Response.json({ error: "Name the kind of application" }, { status: 400 });
          // Manager access is limited to the summary list; applicant details,
          // uploaded ID documents and selfies remain available to application staff.
          if (!(await isApplicationStaff(auth.token))) return forbidden();
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
        if (resellerManagerView) {
          if (kindParam !== "reseller")
            return Response.json(
              { error: await translateText("apply.api_the_reseller_manager_view_only_supports_re_f28dd08") },
              { status: 400 },
            );
          if (!(await isResellerApplicationReader(auth.token))) return forbidden();
        } else if (!(await isApplicationStaff(auth.token))) {
          return forbidden();
        }
        try {
          const rows = await listApplications(
            kinds,
            url.searchParams.get("filter") !== "all",
            resellerManagerView,
          );
          return Response.json({ rows }, { headers: { "Cache-Control": "no-store" } });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "The queue could not be read" },
            { status: 502 },
          );
        }
      },

      POST: async ({ request }) => {
        const auth = signedIn(request);
        if (!auth.ok) return auth.response;

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
        if (kind === "reseller") {
          if (!(await isApplicationBoss(auth.token)))
            return forbidden(
              "Only a platform operator can approve or reject reseller applications.",
            );
        } else if (!(await isApplicationStaff(auth.token))) {
          return forbidden();
        }
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
        const outcome = await rpcAs<{ ok?: boolean; reason?: string; message?: string }>(
          auth.token,
          fn,
          args,
        );
        if (!outcome.ok)
          return Response.json({ error: outcome.message }, { status: outcome.status });
        if (outcome.data?.ok === false) {
          return Response.json(
            {
              error: outcome.data.message ?? outcome.data.reason ?? "The decision was refused.",
            },
            { status: 409 },
          );
        }

        // An approved vendor or author carries the commission their agreement
        // promised, exactly as an approval in the Vendor Manager does.
        let commissionRate: number | null = null;
        if ((kind === "vendor" || kind === "author") && status === definition.approvedStatus) {
          commissionRate = await applySellerCommissionRule(id, kind);
        }

        let email;
        if (
          ["pending", "in_review"].includes(current.status) &&
          (status === definition.approvedStatus || status === "rejected")
        ) {
          try {
            email = await sendQueued(1, { id, kind });
          } catch (error) {
            console.error("[applications] decision saved, email delivery unconfirmed", error);
            email = { sent: 0, reason: "Decision saved; email delivery could not be confirmed." };
          }
        }
        const after = await getApplication(kind, id);
        return Response.json({ ok: true, application: after, commissionRate, email });
      },
    },
  },
});
