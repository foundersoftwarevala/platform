import { createFileRoute } from "@tanstack/react-router";

/**
 * Language Manager API (admin and boss only).
 *
 * GET  ?view=overview | review | glossary | revisions&id=
 * POST { action: enqueue_catalogue | enqueue_texts | run_jobs | review |
 *        set_language_enabled | glossary_save, ... }
 */

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed.";
  const invalid = typeof error === "object" && error !== null && "issues" in error;
  return Response.json(
    { error: invalid ? "Invalid request." : message },
    { status: invalid ? 400 : 500 },
  );
}

export const Route = createFileRoute("/api/i18n/admin")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const admin = await import("@/lib/i18n/admin.server");
        const caller = await admin.requireLanguageOperator(request);
        if (caller instanceof Response) return caller;
        const params = new URL(request.url).searchParams;
        try {
          switch (params.get("view") ?? "overview") {
            case "overview":
              return Response.json(await admin.overview());
            case "review":
              return Response.json(await admin.reviewQueue(params));
            case "glossary":
              return Response.json(await admin.glossaryList());
            case "revisions":
              return Response.json(await admin.revisions(params.get("id") ?? ""));
            default:
              return Response.json({ error: "Unknown view." }, { status: 400 });
          }
        } catch (error) {
          return failure(error);
        }
      },
      POST: async ({ request }) => {
        const admin = await import("@/lib/i18n/admin.server");
        const caller = await admin.requireLanguageOperator(request);
        if (caller instanceof Response) return caller;
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid request." }, { status: 400 });
        }
        try {
          return Response.json(await admin.performAction(body, caller));
        } catch (error) {
          return failure(error);
        }
      },
    },
  },
});
