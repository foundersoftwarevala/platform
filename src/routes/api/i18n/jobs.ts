import { createFileRoute } from "@tanstack/react-router";

import { requireInternalOperator } from "@/lib/auth/internal-guard";

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
      POST: async ({ request }) => {
        const guard = await requireInternalOperator(request);
        if (!guard.ok) return guard.response;
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
