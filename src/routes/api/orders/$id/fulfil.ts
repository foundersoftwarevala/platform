import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";
import { fulfilOrder, revokeOrderAccess, logPaymentEvent } from "@/lib/commerce/fulfilment";

/**
 * Issue or withdraw the access that belongs to an order.
 *
 *   POST   /api/orders/<id>/fulfil   issue the licence and entitlement
 *   DELETE /api/orders/<id>/fulfil   withdraw them, for a refund or chargeback
 *
 * Restricted to operators. It deliberately cannot decide that a payment
 * succeeded — it refuses any order the database does not already show as paid,
 * so a caller can never talk their way into a licence.
 */
export const Route = createFileRoute("/api/orders/$id/fulfil")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        const result = await fulfilOrder(params.id);
        if (!result.ok) {
          return Response.json({ error: result.error }, { status: result.status });
        }
        return Response.json(
          {
            ok: true,
            created: result.created,
            licence_key: result.licenceKey,
            licence_id: result.licenceId,
            entitlement_id: result.entitlementId,
          },
          { status: result.created ? 201 : 200 },
        );
      },

      DELETE: async ({ params, request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        let reason = "operator revocation";
        try {
          const body = (await request.json()) as { reason?: string };
          if (body?.reason) reason = String(body.reason).slice(0, 200);
        } catch {
          /* a reason is optional */
        }

        const done = await revokeOrderAccess(params.id, reason);
        if (!done) {
          await logPaymentEvent(params.id, "revoke_failed", { reason });
          return Response.json({ error: "Could not withdraw access" }, { status: 502 });
        }
        return Response.json({ ok: true, revoked: true, reason });
      },
    },
  },
});
