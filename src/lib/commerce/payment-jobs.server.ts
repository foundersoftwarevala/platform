/**
 * The scheduled side of payments.
 *
 * sv-payment-jobs.sh has called three endpoints every five minutes since it was
 * installed. None of them existed: the log holds 168 calls, every one http=404
 * and not one 200, so the settlement queue has never been drained by the
 * scheduler. What stands between a paid customer and their licence was a route
 * that was never written.
 *
 * The logic was not missing. Both of the jobs the cron asks for already exist
 * in the database, with signatures that match what it already sends:
 *
 *   process_payment_success_events(p_limit int default 25) -> jsonb
 *   reconcile_payment_intents() -> jsonb
 *
 * So nothing here decides anything about money. These are calls to functions
 * that already own the rules, and the amounts, the eligibility and the
 * idempotency stay where they were written. Inventing a second settlement path
 * in TypeScript would be the worst possible place to put a disagreement.
 *
 * Health is the one that had nothing behind it - no view, no function, no
 * thresholds table; payment_controls holds only enable/disable flags and
 * country lists. Rather than invent a threshold for a domain that is not mine
 * to set policy in, it reports measured facts and calls the system unhealthy
 * only where something is objectively stuck: an event that failed, or one that
 * became due and is still sitting there.
 */

function config() {
  const url = process.env.SUPABASE_URL?.trim() ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!url || !key) throw new Error("The database is not configured on this server.");
  return { url: url.replace(/\/$/, ""), key };
}

function headers() {
  const { key } = config();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function rpc<T>(fn: string, body: Record<string, unknown> = {}): Promise<T> {
  const { url } = config();
  const response = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${fn} answered ${response.status}: ${text.slice(0, 300)}`);
  }
  return (text.trim() ? JSON.parse(text) : null) as T;
}

/** Rows, with the exact count, without fetching them. */
async function countOf(path: string): Promise<number> {
  const { url } = config();
  const response = await fetch(`${url}/rest/v1/${path}&select=id&limit=1`, {
    headers: { ...headers(), Prefer: "count=exact" },
  });
  if (!response.ok) {
    throw new Error(
      `Could not measure ${path.split("?")[0]} payment health (HTTP ${response.status}).`,
    );
  }
  // "0-0/12" or "*/0" — the total is what matters, and it is counted by the
  // database rather than worked out from a fetched list.
  const range = response.headers.get("content-range") ?? "";
  const match = range.match(/\/(\d+|\*)$/);
  if (!match || match[1] === "*") {
    throw new Error(`Could not read the exact count for ${path.split("?")[0]} payment health.`);
  }
  const total = Number(match[1]);
  if (!Number.isSafeInteger(total)) {
    throw new Error(`Could not read the exact count for ${path.split("?")[0]} payment health.`);
  }
  return total;
}

/**
 * Drain the settlement outbox.
 *
 * The limit is the cron's, and the default is the function's own. A paid
 * customer waiting on a licence is the thing this moves.
 */
export async function drainPaymentOutbox(limit?: number) {
  const p_limit = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(500, Number(limit))) : 25;
  const result = await rpc<Record<string, unknown>>("process_payment_success_events", { p_limit });
  return { ok: true, limit: p_limit, ...(result ?? {}) };
}

/** Ask the providers about intents that never came back. */
export async function reconcilePaymentIntents() {
  const result = await rpc<Record<string, unknown>>("reconcile_payment_intents", {});
  return { ok: true, ...(result ?? {}) };
}

/**
 * What is measurably true about payments right now.
 *
 * No invented thresholds. Unhealthy means one of two things that are wrong by
 * definition rather than by opinion: an event the queue gave up on, or an event
 * that became due and is still pending. The second is given an hour of grace,
 * which is twelve cron passes - long enough that a slow run cannot trip it and
 * short enough that a stopped queue is noticed the same morning.
 */
export async function paymentHealth() {
  const overdue = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const [pending, processing, failed, completed, stuck, openIntents] = await Promise.all([
    countOf("payment_event_outbox?status=eq.pending"),
    countOf("payment_event_outbox?status=eq.processing"),
    countOf("payment_event_outbox?status=eq.failed"),
    countOf("payment_event_outbox?status=eq.completed"),
    countOf(`payment_event_outbox?status=eq.pending&available_at=lt.${overdue}`),
    countOf("payment_intents?status=eq.pending"),
  ]);

  const reasons: string[] = [];
  if (failed > 0) reasons.push(`${failed} settlement event(s) failed`);
  if (stuck > 0)
    reasons.push(`${stuck} settlement event(s) became due over an hour ago and are still pending`);

  return {
    ok: reasons.length === 0,
    outbox: { pending, processing, failed, completed, overdue: stuck },
    intents: { pending: openIntents },
    reasons,
    measured_at: new Date().toISOString(),
  };
}
