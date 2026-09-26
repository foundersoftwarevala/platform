import { createFileRoute } from "@tanstack/react-router";

import { requireInternalOperator } from "@/lib/auth/internal-guard";
import { approveChange, publishChange, rollbackChange } from "@/lib/seo/change-control.server";

/**
 * Move one SEO change request along: approve it, publish it, or undo it.
 *
 * Only an internal operator may act. Publishing writes to a live SEO table and
 * a rollback writes over it again; both are exactly the kind of thing that
 * must not be reachable by anyone who happens to find the URL.
 *
 * Each step refuses a request in the wrong state rather than forcing it. That
 * refusal is the mechanism - without it the state column would be a label
 * rather than a gate.
 */
export const Route = createFileRoute("/api/seo/change")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        let body: { id?: unknown; action?: unknown; approvedBy?: unknown };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          // i18n-ignore: a diagnostic in a JSON body, not copy anyone reads.
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        const id = typeof body.id === "string" ? body.id.trim() : "";
        const action = typeof body.action === "string" ? body.action.trim() : "";
        if (!id || !action) {
          // i18n-ignore: names the request fields, not something a person reads.
          return Response.json({ error: "id and action are required" }, { status: 400 });
        }

        try {
          const approvedBy = typeof body.approvedBy === "string" ? body.approvedBy : null;
          const change =
            action === "approve"
              ? await approveChange(id, approvedBy)
              : action === "publish"
                ? await publishChange(id)
                : action === "rollback"
                  ? await rollbackChange(id)
                  : null;

          if (!change) {
            // i18n-ignore: names the accepted values, not copy.
            return Response.json(
              { error: "action must be approve, publish or rollback" },
              { status: 400 },
            );
          }
          return Response.json({ change });
        } catch (error) {
          // A refusal is an answer, not a fault: the state machine said no.
          return Response.json(
            { error: error instanceof Error ? error.message : String(error) },
            { status: 409 },
          );
        }
      },
    },
  },
});
