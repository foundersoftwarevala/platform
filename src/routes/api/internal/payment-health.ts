import { createFileRoute } from "@tanstack/react-router";

import { requireInternalOperator } from "@/lib/auth/internal-guard";
import { paymentHealth } from "@/lib/commerce/payment-jobs.server";

/**
 * What is measurably true about payments right now.
 *
 * 503 rather than 200 when something is stuck, because the caller treats 503
 * as a reading and not as a failure to take one — "the answer is unhealthy" is
 * a successful measurement, and the script says so in its own comment.
 *
 * Every number is counted by the database and none is worked out from a fetched
 * list, so this stays correct at any size.
 *
 *   POST {}
 */
export const Route = createFileRoute("/api/internal/payment-health")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        try {
          const health = await paymentHealth();
          return Response.json(health, { status: health.ok ? 200 : 503 });
        } catch (error) {
          console.error("[payment-health] failed", error);
          return Response.json(
            { ok: false, error: error instanceof Error ? error.message : "Could not measure." },
            { status: 502 },
          );
        }
      },
    },
  },
});
