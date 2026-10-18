import { createFileRoute } from "@tanstack/react-router";

import { currentUser } from "@/lib/affiliate/core";
import { documentRow, openDocument, storeDocument } from "@/lib/applications/documents.server";
import { bearer, isApplicationStaff } from "@/lib/applications/gateway.server";
import { isApplicationKind, OPEN_STATUSES, ownerOf } from "@/lib/applications/registry.server";

/**
 * Documents attached to an application.
 *
 *   POST /api/applications/documents   multipart: kind, applicationId, field, file
 *   GET  /api/applications/documents?id=<document id>
 *
 * Only the applicant can attach a document, only to their own application, and
 * only while it is still waiting for a decision. A document can be opened by
 * its applicant and by application staff - by nobody else, and never through a
 * lasting link.
 */
export const Route = createFileRoute("/api/applications/documents")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = bearer(request);
        const user = token ? await currentUser(request) : null;
        // i18n-ignore: an API error message; this API answers in English.
        if (!user) return Response.json({ error: "Please sign in" }, { status: 401 });

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json({ error: "Send the document as a form upload" }, { status: 400 });
        }
        const kind = form.get("kind");
        const applicationId = String(form.get("applicationId") ?? "");
        const field = String(form.get("field") ?? "");
        const file = form.get("file");
        if (!isApplicationKind(kind))
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json({ error: "Unknown kind of application" }, { status: 400 });
        if (!/^[0-9a-f-]{36}$/i.test(applicationId))
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json({ error: "An application id is required" }, { status: 400 });
        if (!(file instanceof File))
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json({ error: "No file was sent" }, { status: 400 });

        const application = await ownerOf(kind, applicationId);
        if (!application || application.owner !== user.id) {
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json({ error: "That application is not yours" }, { status: 403 });
        }
        if (!OPEN_STATUSES.includes(application.status)) {
          return Response.json(
            // i18n-ignore: an API error message; this API answers in English.
            { error: "Documents can only be added while the application is waiting for review." },
            { status: 409 },
          );
        }

        const stored = await storeDocument({
          kind,
          applicationId,
          ownerUserId: user.id,
          field,
          file,
        });
        if ("error" in stored)
          return Response.json({ error: stored.error }, { status: stored.status });
        return Response.json({ document: stored }, { status: 201 });
      },

      GET: async ({ request }) => {
        const token = bearer(request);
        const user = token ? await currentUser(request) : null;
        // i18n-ignore: an API error message; this API answers in English.
        if (!token || !user) return Response.json({ error: "Please sign in" }, { status: 401 });

        const id = new URL(request.url).searchParams.get("id") ?? "";
        if (!/^[0-9a-f-]{36}$/i.test(id))
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json({ error: "A document id is required" }, { status: 400 });
        const row = await documentRow(id);
        // i18n-ignore: an API error message; this API answers in English.
        if (!row) return Response.json({ error: "Document not found" }, { status: 404 });

        const mine = row.owner_user_id === user.id;
        if (!mine && !(await isApplicationStaff(token))) {
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json({ error: "You may not open this document" }, { status: 403 });
        }
        return openDocument(row);
      },
    },
  },
});
