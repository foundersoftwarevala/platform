import { createFileRoute } from "@tanstack/react-router";

import { currentUser } from "@/lib/affiliate/core";
import { bearer } from "@/lib/applications/gateway.server";
import { submitApplication } from "@/lib/applications/submit.server";

/**
 * An application from /apply/<role>.
 *
 *   POST /api/applications/submit {role, values, agreementAccepted}
 *
 * The applicant must be signed in; the application is theirs. Documents are
 * not part of this request - they are uploaded to the application once it
 * exists (POST /api/applications/documents), so a file is only ever stored
 * against an application its owner really holds.
 */
export const Route = createFileRoute("/api/applications/submit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = bearer(request);
        const user = token ? await currentUser(request) : null;
        if (!token || !user)
          return Response.json({ error: "Please sign in to apply" }, { status: 401 });

        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return Response.json({ error: "Expected a JSON body" }, { status: 400 });
        }
        const values =
          body.values && typeof body.values === "object" && !Array.isArray(body.values)
            ? (body.values as Record<string, unknown>)
            : {};

        const result = await submitApplication(
          String(body.role ?? ""),
          values,
          body.agreementAccepted === true,
          token,
          user.id,
        );
        if ("error" in result) {
          return Response.json(
            { error: result.error, fields: result.fields ?? [] },
            { status: result.status },
          );
        }
        return Response.json(result);
      },
    },
  },
});
