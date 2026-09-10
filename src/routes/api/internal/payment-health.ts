import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";
import { alertOnHealth, measurePaymentHealth } from "@/lib/commerce/payment-health";
import { correlationId, withCorrelation } from "@/lib/commerce/observability";

/**
 * Payment health, measured rather than asserted.
 *
 *   GET   the current signals
 *   POST  the current signals, and raise an alert for anything breaching
 *
 * Every number is counted from rows this platform wrote while doing its work.
 * A signal that could not be measured comes back as `unknown` and is never
 * rendered as healthy, because a monitor that reports green when it cannot see
 * is worse than no monitor at all.
 *
 * The status code follows the worst signal: 200 while everything is fine or
 * merely warning, 503 when something is critical, so an uptime check pointed at
 * this endpoint reflects whether payments actually work rather than whether the
 * process is running.
 */

export const Route = createFileRoute("/api/internal/payment-health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        const id = correlationId(request);

        const report = await measurePaymentHealth();
        return withCorrelation(
          Response.json(report, { status: report.overall === "critical" ? 503 : 200 }),
          id,
        );
      },

      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        const id = correlationId(request);

        const report = await measurePaymentHealth();
        const alerts = await alertOnHealth(report);
        return withCorrelation(
          Response.json(
            { correlation_id: id, ...report, alerts_raised: alerts.raised },
            { status: report.overall === "critical" ? 503 : 200 },
          ),
          id,
        );
      },
    },
  },
});
