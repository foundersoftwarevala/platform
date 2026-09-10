import { fulfilOrder, logPaymentEvent } from "@/lib/commerce/fulfilment";
import {
  claimPaymentEvents,
  finishPaymentEvent,
  retireDeadPaymentEvents,
} from "@/lib/commerce/settlement";
import { log } from "@/lib/commerce/observability";

/**
 * The work that finishes a payment after the money is already recorded.
 *
 * A settlement commits the payment, the ledger and one outbox event together.
 * Everything downstream of that — issuing the licence, granting the
 * entitlement, telling the customer — happens here, driven off that event.
 *
 * The rules this obeys, because they are the difference between a queue and a
 * source of double charges:
 *
 *   - a consumer is idempotent. `fulfilOrder` returns the licence that already
 *     exists rather than issuing a second one, so running an event twice is
 *     harmless;
 *   - an event is claimed by exactly one worker, in the database, with
 *     FOR UPDATE SKIP LOCKED;
 *   - retries are bounded and back off, and what runs out of attempts is
 *     retired to `dead` for a person to look at rather than retried forever;
 *   - an event is never treated as proof that a payment succeeded. The payment
 *     row and the ledger entry are the authority; this only reacts to them.
 *
 * There is no broker here on purpose. The platform runs one Node process on one
 * VPS and its queue depth is measured in single figures; a database table with
 * a skip-locked claim does the job that Redis would, without adding a service
 * that also has to be run, watched and recovered.
 */

export type EventRunResult = {
  claimed: number;
  processed: number;
  failed: number;
  retired: number;
  details: { event: string; order: string | null; ok: boolean; error?: string }[];
};

/**
 * Process one batch of due payment events.
 *
 * Called by the operator endpoint and safe to call as often as an operator
 * likes: an empty queue is a no-op and a partly processed batch simply leaves
 * the rest due.
 */
export async function runPaymentEvents(limit = 20): Promise<EventRunResult> {
  const result: EventRunResult = {
    claimed: 0,
    processed: 0,
    failed: 0,
    retired: 0,
    details: [],
  };

  const events = await claimPaymentEvents(limit);
  result.claimed = events.length;

  for (const event of events) {
    const correlation = event.correlation_id ?? `event:${event.id}`;
    const orderId =
      event.order_id ?? (event.payload?.["order_id"] ? String(event.payload["order_id"]) : null);
    const started = Date.now();

    try {
      if (event.event_type !== "payment.settled") {
        // An event type nothing consumes is finished rather than left to be
        // claimed again on every sweep.
        await finishPaymentEvent(event.id, { ok: true });
        result.processed += 1;
        result.details.push({ event: event.event_type, order: orderId, ok: true });
        continue;
      }

      if (!orderId) {
        await finishPaymentEvent(event.id, { ok: false, error: "event carries no order" });
        result.failed += 1;
        result.details.push({
          event: event.event_type,
          order: null,
          ok: false,
          error: "event carries no order",
        });
        continue;
      }

      const fulfilment = await fulfilOrder(orderId);
      if (fulfilment.ok) {
        await finishPaymentEvent(event.id, { ok: true });
        result.processed += 1;
        result.details.push({ event: event.event_type, order: orderId, ok: true });
        log({
          correlationId: correlation,
          component: "payment-jobs",
          action: "entitlement_activated",
          status: "ok",
          orderId,
          durationMs: Date.now() - started,
          attempt: event.attempts,
        });
      } else {
        await finishPaymentEvent(event.id, { ok: false, error: fulfilment.error });
        result.failed += 1;
        result.details.push({
          event: event.event_type,
          order: orderId,
          ok: false,
          error: fulfilment.error,
        });
        // The customer has paid and does not have their licence yet. That is
        // worth a payment log line of its own, because it is the one failure
        // mode where the money is right and the customer is still waiting.
        await logPaymentEvent(
          orderId,
          "entitlement_retry_failed",
          { attempt: event.attempts, detail: fulfilment.error, correlation_id: correlation },
          {},
        );
        log({
          correlationId: correlation,
          component: "payment-jobs",
          action: "entitlement_failed",
          status: "error",
          errorCode: "entitlement_activation_failed",
          orderId,
          attempt: event.attempts,
          detail: fulfilment.error,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await finishPaymentEvent(event.id, { ok: false, error: message });
      result.failed += 1;
      result.details.push({ event: event.event_type, order: orderId, ok: false, error: message });
    }
  }

  result.retired = await retireDeadPaymentEvents();
  return result;
}
