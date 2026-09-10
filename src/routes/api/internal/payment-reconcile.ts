import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";
import { runConsistencySweep } from "@/lib/commerce/consistency";
import { correlationId, withCorrelation } from "@/lib/commerce/observability";

/**
 * The consistency engine.
 *
 *   GET   what is currently unresolved
 *   POST  run a sweep
 *
 * A sweep asks the provider about payments that are still pending and settles
 * the ones the provider confirms, re-issues a licence for an order that is paid
 * and has none, and writes an exception for everything else it finds — an
 * amount that does not agree, a payment with no ledger entry, two payments for
 * one reference, money a provider says it took for a reference we do not hold.
 *
 * It never repairs a mismatch. The two repairs it does make — settle what the
 * provider confirms, issue a licence for an order already paid — are
 * deterministic, idempotent and cannot move money that was not already moved.
 * Everything else lands in Finance Manager's Reconciliation screen for a person
 * to decide, which is the only correct answer to a financial disagreement.
 */

function url(): string {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}` };
}

async function openExceptions(): Promise<number | null> {
  if (!url()) return null;
  try {
    const response = await fetch(
      `${url()}/rest/v1/finance_reconciliation_records?select=id` +
        `&matching_status=neq.matched&resolved_at=is.null`,
      { headers: { ...admin(), Prefer: "count=exact", Range: "0-0" } },
    );
    if (!response.ok) return null;
    const total = Number((response.headers.get("content-range") ?? "").split("/")[1]);
    return Number.isFinite(total) ? total : null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/internal/payment-reconcile")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        const id = correlationId(request);
        return withCorrelation(
          Response.json({ open_exceptions: await openExceptions() }),
          id,
        );
      },

      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        const id = correlationId(request);

        const report = await runConsistencySweep();
        return withCorrelation(
          Response.json({
            correlation_id: id,
            ...report,
            open_exceptions: await openExceptions(),
          }),
          id,
        );
      },
    },
  },
});
