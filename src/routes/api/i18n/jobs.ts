import { createFileRoute } from "@tanstack/react-router";

import { sameOriginMutation } from "@/lib/i18n/session-contract";
import { messageText } from "@/lib/i18n/messages";

/**
 * Runs one batch of background translation jobs.
 *
 * The application already works the queue on a timer; this endpoint lets a
 * scheduler or an operator (x-internal-token, or a signed-in operator) drive
 * it explicitly.
 */
export const Route = createFileRoute("/api/i18n/jobs")({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          { error: "Method not allowed." },
          { status: 405, headers: { Allow: "POST" } },
        ),
      POST: async ({ request }) => {
        const { requireLanguageOperator } = await import("@/lib/i18n/admin.server");
        const caller = await requireLanguageOperator(request);
        if (caller instanceof Response) return caller;
        if (caller.subject !== "internal:token" && !sameOriginMutation(request))
          return Response.json(
            { error: messageText("common.language_origin_refused") },
            { status: 403 },
          );
        const { runJobBatch } = await import("@/lib/i18n/jobs.server");
        try {
          return Response.json(await runJobBatch());
        } catch (error) {
          console.error("[i18n] job batch failed", error);
          return Response.json({ error: "Job batch failed." }, { status: 500 });
        }
      },
    },
  },
});
