import { fulfilOrder, logPaymentEvent } from "@/lib/commerce/fulfilment";
import { recordLedgerOnce } from "@/lib/finance/finance.server";
import { writeTolerant } from "@/lib/commerce/schema-tolerance";

/**
 * The one place a verified payment becomes money in the books.
 *
 * This platform already carried a complete payment domain that nothing was
 * writing to — finance_payment_intents, finance_payments,
 * finance_payment_events, finance_payment_webhooks,
 * finance_provider_transactions, finance_reconciliation_records and
 * finance_ledger_entries were all present and all empty. The only adapter that
 * existed (PayU) settled straight onto marketplace_orders and never touched
 * them, so a real sale left no intent, no ledger entry and nothing to
 * reconcile. Every rail now settles through this file instead, onto those
 * canonical tables: PayU, and each hosted card gateway.
 *
 * Three things it deliberately does not do.
 *
 * It never decides that a payment succeeded. The caller has already had that
 * confirmed by the provider's own verify call; this only acts on a decision
 * made against the provider.
 *
 * It never does its work twice. Every write is keyed — the intent on its client
 * reference, the webhook on the provider's event id, the payment on its intent,
 * the provider transaction on its own id, the ledger entry on the payment. Those
 * keys are unique indexes, so the protection is the database's rather than a
 * check that happens to run first.
 *
 * And it never settles two payments for one intent. Claiming an intent is a
 * conditional update from pending to processing: whichever request wins the
 * transition proceeds and every other one is told the intent is already taken.
 */

function supabaseUrl(): string {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function adminHeaders(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function rest(path: string, init?: RequestInit) {
  return fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    ...init,
    headers: { ...adminHeaders(), ...(init?.headers ?? {}) },
  });
}

async function rows<T>(path: string): Promise<T[]> {
  const response = await rest(path);
  if (!response.ok) return [];
  return (await response.json()) as T[];
}

/**
 * Call a database function.
 *
 * `missing` is the case that matters: a deployment whose code is ahead of its
 * schema has the caller but not the function, and a payment must not fail
 * because of that. Every caller here treats `missing` as "do it the older way"
 * rather than as an error.
 */
type RpcOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; missing: true }
  | { ok: false; missing: false; error: string; status: number };

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<RpcOutcome<T>> {
  if (!supabaseUrl()) return { ok: false, missing: true };
  try {
    const response = await rest(`rpc/${name}`, {
      method: "POST",
      body: JSON.stringify(args),
    });
    if (response.ok) return { ok: true, data: (await response.json()) as T };
    const body = await response.text();
    // PostgREST answers 404 for a function it does not know about.
    if (response.status === 404) return { ok: false, missing: true };
    return { ok: false, missing: false, error: body.slice(0, 500), status: response.status };
  } catch (error) {
    return {
      ok: false,
      missing: false,
      error: error instanceof Error ? error.message : String(error),
      status: 0,
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Rails                                                                       */
/* -------------------------------------------------------------------------- */

const railIds = new Map<string, string>();

/** The rail row's id for a gateway code. Every canonical table keys on it. */
export async function railId(code: string): Promise<string | null> {
  const cached = railIds.get(code);
  if (cached) return cached;
  const found = await rows<{ id: string }>(
    `finance_payment_rails?select=id&code=eq.${encodeURIComponent(code)}&limit=1`,
  );
  const id = found[0]?.id ?? null;
  if (id) railIds.set(code, id);
  return id;
}

/* -------------------------------------------------------------------------- */
/* The order behind a payment                                                  */
/* -------------------------------------------------------------------------- */

export type SettlementOrder = {
  id: string;
  status: string;
  buyerId: string;
  orderNumber: string;
  /** What the customer was actually charged, and in what. */
  amountCharged: number;
  currencyCharged: string;
  /** The same sale in the reporting currency, with the rate used at the time. */
  baseAmount: number;
  baseCurrency: string;
  fxRate: number;
  gateway: string;
  providerPaymentId: string | null;
  /** When the intent stopped being offerable. Never a reason to refuse money. */
  intentExpiresAt: string | null;
};

/**
 * The columns added for multi-provider payment. A deployment that has the code
 * but not yet the migration must keep taking payments rather than fail every
 * lookup, so the read falls back to the columns that have always existed.
 */
const EXTENDED_ORDER_COLUMNS =
  "amount_charged,provider_payment_id,intent_expires_at,provider_status";
const LEGACY_ORDER_COLUMNS =
  "id,status,buyer_id,user_id,order_number,order_no,total,currency,amount_usd," +
  "amount_inr,currency_charged,fx_rate,payment_gateway";

/** The order behind a payment reference, read from the database and nowhere else. */
export async function orderForReference(reference: string): Promise<SettlementOrder | null> {
  if (!supabaseUrl() || !reference) return null;
  const where = `&txnid=eq.${encodeURIComponent(reference)}&limit=1`;

  let found = await rows<Record<string, unknown>>(
    `marketplace_orders?select=${LEGACY_ORDER_COLUMNS},${EXTENDED_ORDER_COLUMNS}${where}`,
  );
  if (!found.length) {
    // Either there is no such order, or this database has not had the card
    // payment migration yet. Ask again for only the long-standing columns; if
    // that finds the order, the difference was the schema.
    found = await rows<Record<string, unknown>>(
      `marketplace_orders?select=${LEGACY_ORDER_COLUMNS}${where}`,
    );
  }
  const row = found[0];
  if (!row) return null;

  const currencyCharged = String(row.currency_charged ?? row.currency ?? "USD").toUpperCase();
  // amount_charged is the generic column. amount_inr predates it and is what
  // PayU orders were written with, so it is still honoured for those.
  const amountCharged = Number(row.amount_charged ?? row.amount_inr ?? row.total ?? 0);

  return {
    id: String(row.id),
    status: String(row.status ?? "").toLowerCase(),
    buyerId: String(row.user_id ?? row.buyer_id ?? ""),
    orderNumber: String(row.order_number ?? row.order_no ?? row.id),
    amountCharged,
    currencyCharged,
    baseAmount: Number(row.amount_usd ?? row.total ?? 0),
    baseCurrency: String(row.currency ?? "USD").toUpperCase(),
    fxRate: Number(row.fx_rate ?? 1) || 1,
    gateway: String(row.payment_gateway ?? "").toLowerCase(),
    providerPaymentId: row.provider_payment_id ? String(row.provider_payment_id) : null,
    intentExpiresAt: row.intent_expires_at ? String(row.intent_expires_at) : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Payment intents                                                             */
/* -------------------------------------------------------------------------- */

export type PaymentIntentRow = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  order_id: string | null;
  user_id: string | null;
  gateway_code: string | null;
  client_reference: string | null;
  provider_reference: string | null;
  expires_at: string | null;
};

const INTENT_COLUMNS =
  "id,status,amount,currency,order_id,user_id,gateway_code,client_reference," +
  "provider_reference,expires_at";
const INTENT_COLUMNS_LEGACY =
  "id,status,amount,currency,client_reference,provider_reference,expires_at";

export async function intentForReference(reference: string): Promise<PaymentIntentRow | null> {
  const where = `&client_reference=eq.${encodeURIComponent(reference)}&limit=1`;
  let found = await rows<PaymentIntentRow>(
    `finance_payment_intents?select=${INTENT_COLUMNS}${where}`,
  );
  if (!found.length) {
    found = await rows<PaymentIntentRow>(
      `finance_payment_intents?select=${INTENT_COLUMNS_LEGACY}${where}`,
    );
  }
  return found[0] ?? null;
}

/**
 * The intent for this payment, created once and reused after that.
 *
 * The unique index on client_reference is what makes this idempotent: a
 * customer who double-clicks Pay Now, or a retry that arrives twice, reaches
 * the intent that already exists rather than opening a second one against the
 * same order. The amount and the currency are fixed here, on the server, from
 * the order — and never re-read from a later request.
 */
export async function createOrReuseIntent(input: {
  reference: string;
  orderId: string;
  userId: string;
  gatewayCode: string;
  amount: number;
  currency: string;
  baseAmount: number;
  baseCurrency: string;
  fxRate: number;
  expiresAt: string;
}): Promise<PaymentIntentRow | null> {
  const existing = await intentForReference(input.reference);
  if (existing) {
    // An intent that has already produced a payment is finished. It is never
    // reopened, so a settled reference cannot be paid a second time.
    return existing;
  }

  const rail = await railId(input.gatewayCode);
  const core = {
    rail_id: rail,
    idempotency_key: input.reference,
    client_reference: input.reference,
    amount: input.amount,
    currency: input.currency,
    status: "pending",
    expires_at: input.expiresAt,
  };
  // The bindings the migration adds. Without them the intent is still created,
  // because an intent with no order binding is better than no payment at all —
  // and the settlement checks that depend on them simply fall back to the
  // order's own record.
  const bindings = {
    order_id: input.orderId,
    user_id: input.userId,
    gateway_code: input.gatewayCode,
    base_amount: input.baseAmount,
    base_currency: input.baseCurrency,
    fx_rate: input.fxRate,
  };

  const post = (body: Record<string, unknown>) =>
    rest("finance_payment_intents", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify(body),
    });

  let response = await post({ ...core, ...bindings });
  if (!response.ok && response.status === 400) response = await post(core);
  if (response.ok) {
    const created = (await response.json()) as PaymentIntentRow[];
    if (created[0]) return created[0];
  }
  // Lost the race to a concurrent request; the winner's intent is the one.
  return intentForReference(input.reference);
}

export type IntentClaim =
  | { claimed: true; intent: PaymentIntentRow }
  | { claimed: false; reason: string; intent: PaymentIntentRow | null };

/**
 * Take exclusive hold of an intent before settling it.
 *
 * This is a conditional update — pending to processing, matching on the current
 * status — so the database decides the winner. Two webhooks arriving at the same
 * instant cannot both pass, which is what stops one payment being settled twice
 * by two workers that each saw "pending".
 */
export async function claimIntent(reference: string): Promise<IntentClaim> {
  const response = await rest(
    `finance_payment_intents?client_reference=eq.${encodeURIComponent(reference)}` +
      // "processing" is deliberately not in this list. Including it would let a
      // second request claim an intent the first is already settling, which is
      // the exact thing the lock exists to prevent.
      `&status=in.(pending,requires_action)`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status: "processing", updated_at: new Date().toISOString() }),
    },
  );
  if (!response.ok) {
    return { claimed: false, reason: "The payment intent could not be read.", intent: null };
  }
  const claimed = (await response.json()) as PaymentIntentRow[];
  if (claimed[0]) return { claimed: true, intent: claimed[0] };

  const current = await intentForReference(reference);
  return {
    claimed: false,
    reason: current
      ? `That payment intent is ${current.status} and cannot be settled again.`
      : "No payment intent exists for that reference.",
    intent: current,
  };
}

async function setIntentStatus(
  reference: string,
  status: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  await rest(`finance_payment_intents?client_reference=eq.${encodeURIComponent(reference)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status, updated_at: new Date().toISOString(), ...extra }),
  });
}

/* -------------------------------------------------------------------------- */
/* Webhook replay defence                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Claim a provider event before acting on it.
 *
 * Returns false when this exact event has been seen before, which is the whole
 * of the replay defence: a provider that retries its webhook — and all of them
 * do — reaches a closed door rather than a second settlement. The unique index
 * on (rail_id, event_key) makes the claim atomic, so two callbacks arriving at
 * the same instant cannot both win.
 *
 * The payload is stored as the provider sent it, minus nothing, because a
 * provider webhook never contains card data — but it is only ever readable by a
 * finance operator.
 */
export async function claimWebhookEvent(input: {
  provider: string;
  eventId: string;
  signatureValid: boolean;
  payload: unknown;
}): Promise<{ claimed: boolean }> {
  if (!supabaseUrl()) return { claimed: false };
  const rail = await railId(input.provider);
  try {
    const response = await rest("finance_payment_webhooks", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        rail_id: rail,
        event_key: input.eventId,
        signature_valid: input.signatureValid,
        payload: input.payload ?? {},
      }),
    });
    if (response.ok) return { claimed: true };
    // 409 is the unique index doing its job: this event is already recorded.
    if (response.status === 409) return { claimed: false };
    // Any other failure must not let an unrecorded event through as if it were
    // new, because that is exactly how a replay becomes a double settlement.
    console.error("[settlement] could not claim webhook event", response.status);
    return { claimed: false };
  } catch (error) {
    console.error("[settlement] webhook event claim failed", error);
    return { claimed: false };
  }
}

async function markWebhookProcessed(provider: string, eventId: string): Promise<void> {
  const rail = await railId(provider);
  if (!rail) return;
  await rest(
    `finance_payment_webhooks?rail_id=eq.${encodeURIComponent(rail)}` +
      `&event_key=eq.${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ processed_at: new Date().toISOString() }),
    },
  );
}

/** One durable record of a payment event, keyed so it is written exactly once. */
async function recordPaymentEvent(input: {
  eventKey: string;
  eventType: string;
  intentId: string | null;
  paymentId: string | null;
  payload: Record<string, unknown>;
}): Promise<void> {
  await rest("finance_payment_events", {
    method: "POST",
    headers: { Prefer: "return=minimal,resolution=ignore-duplicates" },
    body: JSON.stringify({
      event_key: input.eventKey,
      event_type: input.eventType,
      intent_id: input.intentId,
      payment_id: input.paymentId,
      payload: input.payload,
    }),
  });
}

/* -------------------------------------------------------------------------- */
/* Reconciliation                                                              */
/* -------------------------------------------------------------------------- */

export type ReconciliationOutcome =
  | "matched"
  | "amount_mismatch"
  | "currency_mismatch"
  | "gateway_mismatch"
  | "unmatched_provider_payment"
  | "missing_transaction"
  | "duplicate_event"
  | "missing_webhook"
  | "refund_mismatch";

/**
 * Record what the provider reported, as its own transaction.
 *
 * This is the provider's side of the books, kept separately from ours so the
 * two can be compared rather than merged. Keyed on the provider's transaction
 * id, so recording it again finds the row that exists.
 */
async function recordProviderTransaction(input: {
  provider: string;
  providerPaymentId: string;
  reference: string;
  amount: number | null;
  currency: string | null;
  status: string;
}): Promise<string | null> {
  const rail = await railId(input.provider);
  const response = await rest("finance_provider_transactions", {
    method: "POST",
    headers: { Prefer: "return=representation,resolution=merge-duplicates" },
    body: JSON.stringify({
      rail_id: rail,
      provider_transaction_id: input.providerPaymentId,
      reference: input.reference,
      amount: input.amount,
      currency: input.currency,
      network: input.provider,
      status: input.status,
      observed_at: new Date().toISOString(),
    }),
  });
  if (response.ok) {
    const created = (await response.json()) as { id: string }[];
    if (created[0]) return created[0].id;
  }
  const found = await rows<{ id: string }>(
    `finance_provider_transactions?select=id` +
      `&provider_transaction_id=eq.${encodeURIComponent(input.providerPaymentId)}` +
      (rail ? `&rail_id=eq.${encodeURIComponent(rail)}` : "") +
      `&limit=1`,
  );
  return found[0]?.id ?? null;
}

/**
 * Record how a provider event lined up against our own books.
 *
 * A matched payment gets a reconciliation row so the sale can be traced from
 * the provider's transaction through to the ledger entry. Anything that did not
 * line up gets one too, marked with what was expected against what arrived,
 * because a mismatch that is silently dropped is a mismatch nobody ever
 * investigates. Nothing here ever adjusts a financial figure to make the two
 * sides agree.
 */
export async function recordReconciliation(input: {
  provider: string;
  reference: string;
  providerPaymentId: string | null;
  orderId: string | null;
  paymentId?: string | null;
  outcome: ReconciliationOutcome;
  expectedAmount: number | null;
  observedAmount: number | null;
  expectedCurrency: string | null;
  observedCurrency: string | null;
  detail: string;
}): Promise<void> {
  if (!supabaseUrl()) return;
  try {
    let providerTransactionId: string | null = null;
    if (input.providerPaymentId) {
      providerTransactionId = await recordProviderTransaction({
        provider: input.provider,
        providerPaymentId: input.providerPaymentId,
        reference: input.reference,
        amount: input.observedAmount,
        currency: input.observedCurrency,
        status: input.outcome === "matched" ? "settled" : "exception",
      });
    }

    await rest("finance_reconciliation_records", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        provider_transaction_id: providerTransactionId,
        payment_id: input.paymentId ?? null,
        order_id: input.orderId,
        rail_code: input.provider,
        reference: input.reference,
        matching_status: input.outcome,
        expected_amount: input.expectedAmount,
        observed_amount: input.observedAmount,
        expected_currency: input.expectedCurrency,
        observed_currency: input.observedCurrency,
        detail: input.detail,
      }),
    });
  } catch (error) {
    console.error("[settlement] could not write reconciliation record", error);
  }
}

/* -------------------------------------------------------------------------- */
/* Invoice and buyer                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The invoice for a settled sale, written once.
 *
 * Keyed on the order number rather than on a fresh random number, so the second
 * call for one payment finds the invoice that exists instead of issuing a
 * second one against the same money.
 */
async function issueSettlementInvoice(
  order: SettlementOrder,
  name: string,
): Promise<string | null> {
  const invoiceNo = `INV-${order.orderNumber}`;
  try {
    const existing = await rows<{ id: string }>(
      `finance_invoices?select=id&invoice_no=eq.${encodeURIComponent(invoiceNo)}&limit=1`,
    );
    if (existing[0]) return existing[0].id;

    const today = new Date().toISOString().slice(0, 10);
    const response = await rest("finance_invoices", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        invoice_no: invoiceNo,
        doc_type: "invoice",
        client_name: name || "Marketplace customer",
        client_type: "customer",
        issue_date: today,
        due_date: today,
        subtotal: order.amountCharged,
        tax_amount: 0,
        total: order.amountCharged,
        status: "paid",
        paid_at: new Date().toISOString(),
        auto_generated: true,
        line_items: [
          { description: `Order ${order.orderNumber}`, qty: 1, rate: order.amountCharged },
        ],
      }),
    });
    if (!response.ok) return null;
    const created = (await response.json()) as { id: string }[];
    return created[0]?.id ?? null;
  } catch (error) {
    // An invoice that could not be written is reported, never allowed to undo a
    // payment the customer has already made.
    console.error("[settlement] could not issue invoice", error);
    return null;
  }
}

async function buyerName(userId: string): Promise<string> {
  if (!userId) return "";
  const found = await rows<{
    full_name: string | null;
    username: string | null;
    email: string | null;
  }>(`profiles?select=full_name,username,email&id=eq.${encodeURIComponent(userId)}&limit=1`);
  const row = found[0];
  return String(row?.full_name ?? row?.username ?? row?.email ?? "").trim();
}

/* -------------------------------------------------------------------------- */
/* Settlement                                                                  */
/* -------------------------------------------------------------------------- */

export type SettlementResult =
  | { ok: true; replay: boolean; orderId: string; fulfilled: boolean; paymentId: string | null }
  | { ok: false; reason: string; status: number };

/* -------------------------------------------------------------------------- */
/* The outbox                                                                  */
/* -------------------------------------------------------------------------- */

export type PaymentOutboxEvent = {
  id: string;
  event_key: string;
  event_type: string;
  order_id: string | null;
  payment_id: string | null;
  intent_id: string | null;
  payload: Record<string, unknown>;
  attempts: number;
  correlation_id: string | null;
};

/**
 * Take up to `limit` events that are due.
 *
 * The claim is `FOR UPDATE SKIP LOCKED` inside the database, so two workers
 * running at once take different events rather than the same one twice. The
 * attempt count and the next-attempt time move in the same statement, which is
 * what stops an event that kills its worker from being retried in a tight loop.
 */
export async function claimPaymentEvents(limit = 20): Promise<PaymentOutboxEvent[]> {
  const claimed = await rpc<PaymentOutboxEvent[]>("finance_claim_payment_events", {
    p_limit: limit,
  });
  if (!claimed.ok) return [];
  return Array.isArray(claimed.data) ? claimed.data : [];
}

/** Record how an event turned out. A failure goes back in the queue; a success never does. */
export async function finishPaymentEvent(
  eventId: string,
  outcome: { ok: true } | { ok: false; error: string },
): Promise<void> {
  if (!supabaseUrl() || !eventId) return;
  const body = outcome.ok
    ? { status: "processed", processed_at: new Date().toISOString(), last_error: null }
    : { status: "pending", last_error: String(outcome.error).slice(0, 1_000) };
  await rest(`finance_payment_events?id=eq.${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
}

/** Stop retrying anything that has used up its attempts, so it can be looked at instead. */
export async function retireDeadPaymentEvents(): Promise<number> {
  const result = await rpc<number>("finance_retire_dead_payment_events", {});
  return result.ok ? Number(result.data) || 0 : 0;
}

/**
 * Mark the settlement event for one reference processed, without going through
 * the queue. Used straight after an inline settlement that already did the
 * work, so the consumer does not repeat it a moment later.
 */
async function closeSettlementEvent(eventKey: string): Promise<void> {
  if (!supabaseUrl() || !eventKey) return;
  await rest(`finance_payment_events?event_key=eq.${encodeURIComponent(eventKey)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: "processed", processed_at: new Date().toISOString() }),
  });
}

/* -------------------------------------------------------------------------- */
/* Settlement in one transaction                                               */
/* -------------------------------------------------------------------------- */

type AtomicOutcome = {
  ok?: boolean;
  replay?: boolean;
  reason?: string;
  status?: number;
  order_id?: string;
  payment_id?: string | null;
  intent_id?: string | null;
};

/**
 * Settle through the canonical database function.
 *
 * Returns null — and only null — when the database does not have the function,
 * which is the one case the caller should handle by doing the work the older
 * way. Every other outcome, including a refusal, is an answer.
 *
 * After the transaction commits, the customer's licence and entitlement are
 * issued. That deliberately happens out here: it sends email, and a transaction
 * is never held open across a network call. If it fails the payment stays
 * settled and the outbox event stays pending, so a later run finishes the job
 * without the customer ever being charged again.
 */
async function atomicSettlement(input: {
  order: SettlementOrder;
  provider: string;
  reference: string;
  providerPaymentId: string | null;
  providerStatus: string;
  observedAmount: number | null;
  observedCurrency: string | null;
  last4?: string | null;
  brand?: string | null;
  eventKey?: string | null;
  correlationId?: string | null;
}): Promise<SettlementResult | null> {
  const { order, provider, reference } = input;
  const name = await buyerName(order.buyerId);

  const outcome = await rpc<AtomicOutcome>("finance_settle_payment", {
    p_reference: reference,
    p_provider: provider,
    p_provider_payment_id: input.providerPaymentId,
    p_provider_status: input.providerStatus,
    p_observed_amount: input.observedAmount,
    p_observed_currency: input.observedCurrency,
    p_last4: input.last4 ?? null,
    p_brand: input.brand ?? null,
    p_event_key: input.eventKey ?? null,
    p_correlation_id: input.correlationId ?? null,
    p_buyer_name: name || null,
  });

  if (!outcome.ok && outcome.missing) return null;

  if (!outcome.ok) {
    // The transaction refused or failed. Nothing was written, which is the
    // point of it being a transaction — so this is reported rather than
    // retried a different way.
    console.error("[settlement] atomic settlement failed", outcome.error);
    await logPaymentEvent(
      order.id,
      "settlement_transaction_failed",
      { reference, detail: outcome.error, correlation_id: input.correlationId ?? null },
      { provider },
    );
    return { ok: false, reason: "The payment could not be recorded", status: 500 };
  }

  const result = outcome.data ?? {};
  if (result.ok === false) {
    await logPaymentEvent(
      order.id,
      "settlement_refused",
      { reference, reason: result.reason ?? "refused", correlation_id: input.correlationId ?? null },
      { provider },
    );
    return { ok: false, reason: result.reason ?? "Refused", status: Number(result.status) || 409 };
  }

  const orderId = String(result.order_id ?? order.id);
  const paymentId = result.payment_id ? String(result.payment_id) : null;

  if (result.replay) {
    await logPaymentEvent(
      orderId,
      "settlement_replay",
      { reference, correlation_id: input.correlationId ?? null },
      { provider },
    );
    return { ok: true, replay: true, orderId, fulfilled: true, paymentId };
  }

  // ---- outside the transaction: the customer's licence and entitlement ----
  const fulfilment = await fulfilOrder(orderId);
  if (fulfilment.ok) {
    await closeSettlementEvent(input.eventKey || `settle:${reference}`);
  }

  await logPaymentEvent(
    orderId,
    fulfilment.ok ? "payment_settled" : "fulfilment_error",
    {
      reference,
      amount: order.amountCharged,
      currency: order.currencyCharged,
      base_amount: order.baseAmount,
      base_currency: order.baseCurrency,
      fx_rate: order.fxRate,
      payment_id: paymentId,
      fulfilled: fulfilment.ok,
      atomic: true,
      correlation_id: input.correlationId ?? null,
      detail: fulfilment.ok ? undefined : fulfilment.error,
    },
    { provider, signatureValid: true },
  );

  return { ok: true, replay: false, orderId, fulfilled: fulfilment.ok, paymentId };
}

/**
 * Turn a payment the provider has already confirmed into a settled sale.
 *
 * The order of the writes matters. The intent is claimed first, so nothing else
 * can settle it. The payment row is written next and is unique on that intent,
 * so even a claim that somehow passed twice cannot produce two payments. Only
 * then do the ledger, the invoice and the customer's licence follow, each keyed
 * so it can be reached again without repeating.
 */
export async function settleVerifiedPayment(input: {
  order: SettlementOrder;
  provider: string;
  reference: string;
  providerPaymentId: string | null;
  providerStatus: string;
  observedAmount: number | null;
  observedCurrency: string | null;
  last4?: string | null;
  brand?: string | null;
  eventKey?: string | null;
  correlationId?: string | null;
}): Promise<SettlementResult> {
  const { order, provider, reference } = input;

  // ---- the atomic path ----------------------------------------------------
  //
  // Preferred, and used wherever the database has the function: every
  // database-local write of a settlement happens inside one transaction with
  // the order and intent rows locked, so a process that dies part-way leaves
  // nothing half-done. The fallback below is the same work as a sequence of
  // individually idempotent writes, kept for a deployment whose code has
  // reached it before the migration has.
  const atomic = await atomicSettlement(input);
  if (atomic) return atomic;

  // Already settled. Say so rather than doing any of it twice.
  if (order.status === "paid") {
    await logPaymentEvent(order.id, "settlement_replay", { reference }, { provider });
    return { ok: true, replay: true, orderId: order.id, fulfilled: true, paymentId: null };
  }

  // ---- the amount and the currency, against the order ---------------------
  //
  // Checked against what the server recorded, never against what the provider
  // chose to send, and a mismatch stops the settlement rather than being
  // rounded away or quietly corrected.
  if (input.observedCurrency && input.observedCurrency !== order.currencyCharged) {
    await recordReconciliation({
      provider,
      reference,
      providerPaymentId: input.providerPaymentId,
      orderId: order.id,
      outcome: "currency_mismatch",
      expectedAmount: order.amountCharged,
      observedAmount: input.observedAmount,
      expectedCurrency: order.currencyCharged,
      observedCurrency: input.observedCurrency,
      detail: "The provider settled in a different currency than the order was priced in.",
    });
    await logPaymentEvent(
      order.id,
      "payment_currency_mismatch",
      { reference, expected: order.currencyCharged, observed: input.observedCurrency },
      { provider },
    );
    await setIntentStatus(reference, "requires_review");
    return { ok: false, reason: "Currency mismatch", status: 409 };
  }

  if (
    input.observedAmount != null &&
    order.amountCharged > 0 &&
    Math.abs(input.observedAmount - order.amountCharged) > 0.01
  ) {
    await recordReconciliation({
      provider,
      reference,
      providerPaymentId: input.providerPaymentId,
      orderId: order.id,
      outcome: "amount_mismatch",
      expectedAmount: order.amountCharged,
      observedAmount: input.observedAmount,
      expectedCurrency: order.currencyCharged,
      observedCurrency: input.observedCurrency,
      detail: "The provider settled a different amount than the order was for.",
    });
    await logPaymentEvent(
      order.id,
      "payment_amount_mismatch",
      { reference, expected: order.amountCharged, observed: input.observedAmount },
      { provider },
    );
    await setIntentStatus(reference, "requires_review");
    return { ok: false, reason: "Amount mismatch", status: 409 };
  }

  // ---- claim the intent ---------------------------------------------------
  //
  // An order started before this file existed has no intent, and so does one
  // whose intent write lost a race. Settlement creates the missing one from the
  // order rather than refusing money the provider has already taken; it is the
  // same idempotent call the checkout makes, so it cannot produce a second.
  if (!(await intentForReference(reference))) {
    await createOrReuseIntent({
      reference,
      orderId: order.id,
      userId: order.buyerId,
      gatewayCode: provider,
      amount: order.amountCharged,
      currency: order.currencyCharged,
      baseAmount: order.baseAmount,
      baseCurrency: order.baseCurrency,
      fxRate: order.fxRate,
      expiresAt: order.intentExpiresAt ?? new Date().toISOString(),
    });
  }

  const claim = await claimIntent(reference);
  if (!claim.claimed) {
    // Either another request is settling it, or it is already settled. Both are
    // reasons to stop, and neither is an error the provider should retry into.
    await logPaymentEvent(
      order.id,
      "settlement_intent_locked",
      { reference, reason: claim.reason },
      { provider },
    );
    if (claim.intent?.status === "succeeded") {
      return { ok: true, replay: true, orderId: order.id, fulfilled: true, paymentId: null };
    }
    return { ok: false, reason: claim.reason, status: 409 };
  }
  const intent = claim.intent;

  // The intent's own amount is checked too, because the order could in
  // principle have been re-priced after the customer was quoted.
  if (Math.abs(Number(intent.amount) - order.amountCharged) > 0.01) {
    await recordReconciliation({
      provider,
      reference,
      providerPaymentId: input.providerPaymentId,
      orderId: order.id,
      outcome: "amount_mismatch",
      expectedAmount: Number(intent.amount),
      observedAmount: order.amountCharged,
      expectedCurrency: intent.currency,
      observedCurrency: order.currencyCharged,
      detail: "The order's amount no longer matches the intent the customer was quoted.",
    });
    await setIntentStatus(reference, "requires_review");
    return { ok: false, reason: "Intent amount mismatch", status: 409 };
  }

  const now = new Date().toISOString();
  const rail = await railId(provider);
  const name = await buyerName(order.buyerId);
  const invoiceId = await issueSettlementInvoice(order, name);

  // ---- the payment row ----------------------------------------------------
  //
  // Unique on intent_id, so one intent can only ever produce one payment.
  let paymentId: string | null = null;
  const paymentResponse = await rest("finance_payments", {
    method: "POST",
    headers: { Prefer: "return=representation,resolution=merge-duplicates" },
    body: JSON.stringify({
      intent_id: intent.id,
      invoice_id: invoiceId,
      rail_id: rail,
      amount: order.amountCharged,
      currency: order.currencyCharged,
      status: "succeeded",
      provider_transaction_id: input.providerPaymentId,
      provider_reference: reference,
      confirmed_at: now,
    }),
  });
  if (paymentResponse.ok) {
    const created = (await paymentResponse.json()) as { id: string }[];
    paymentId = created[0]?.id ?? null;
  }
  if (!paymentId) {
    const found = await rows<{ id: string }>(
      `finance_payments?select=id&intent_id=eq.${encodeURIComponent(intent.id)}&limit=1`,
    );
    paymentId = found[0]?.id ?? null;
  }

  // ---- the order ----------------------------------------------------------
  const patch: Record<string, unknown> = {
    status: "paid",
    payment_gateway: provider,
    provider_payment_id: input.providerPaymentId,
    provider_status: input.providerStatus,
    payment_verified_at: now,
    updated_at: now,
  };
  // Only what the provider volunteered, and only what is safe to keep.
  if (input.last4) patch.card_last4 = String(input.last4).slice(-4);
  if (input.brand) patch.card_brand = String(input.brand).slice(0, 40);

  // provider_status, payment_verified_at and the card columns come from a
  // migration production does not have yet; without them the whole update was
  // refused and a verified payment ended as settlement_write_failed. Only the
  // absent columns are dropped - status and gateway are always written.
  const updated = await writeTolerant("marketplace_orders", patch, (body) =>
    rest(`marketplace_orders?id=eq.${encodeURIComponent(order.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(body),
    }),
  );
  if (!updated.ok) {
    await setIntentStatus(reference, "requires_review");
    await logPaymentEvent(
      order.id,
      "settlement_write_failed",
      { reference, status: updated.status },
      { provider },
    );
    return { ok: false, reason: "Could not record the payment", status: 500 };
  }

  // ---- the customer's licence and entitlement -----------------------------
  const fulfilment = await fulfilOrder(order.id);

  // ---- the ledger ---------------------------------------------------------
  //
  // Two records, because this platform keeps two and they answer different
  // questions. finance_transactions is the operating ledger every Finance
  // Manager screen reads, written through the single canonical writer that
  // already exists. finance_ledger_entries is the immutable per-payment record
  // that reconciliation points at. Both are keyed so neither can post twice.
  await recordLedgerOnce({
    txnCode: reference,
    direction: "credit",
    amount: order.amountCharged,
    counterparty: name || order.orderNumber,
    counterpartyType: "customer",
    category: "sale",
    method: "card",
    gateway: provider,
    notes:
      `Order ${order.orderNumber} settled through ${provider}` +
      ` (${order.currencyCharged} ${order.amountCharged.toFixed(2)}` +
      `, base ${order.baseCurrency} ${order.baseAmount.toFixed(2)} at ${order.fxRate}).`,
  });

  if (paymentId) {
    await rest("finance_ledger_entries", {
      method: "POST",
      headers: { Prefer: "return=minimal,resolution=ignore-duplicates" },
      body: JSON.stringify({
        payment_id: paymentId,
        invoice_id: invoiceId,
        entry_type: "payment_received",
        amount: order.amountCharged,
        currency: order.currencyCharged,
        account_code: "revenue.marketplace",
        // The exchange-rate snapshot lives here and is never recalculated.
        immutable_payload: {
          reference,
          provider,
          provider_payment_id: input.providerPaymentId,
          order_id: order.id,
          order_number: order.orderNumber,
          base_amount: order.baseAmount,
          base_currency: order.baseCurrency,
          fx_rate: order.fxRate,
          settled_at: now,
        },
      }),
    });
  }

  // ---- close the intent and reconcile -------------------------------------
  await setIntentStatus(reference, "succeeded", {
    provider_reference: input.providerPaymentId,
    settled_at: now,
  });

  await recordReconciliation({
    provider,
    reference,
    providerPaymentId: input.providerPaymentId,
    orderId: order.id,
    paymentId,
    outcome: "matched",
    expectedAmount: order.amountCharged,
    observedAmount: input.observedAmount,
    expectedCurrency: order.currencyCharged,
    observedCurrency: input.observedCurrency,
    detail: `Settled and posted to the ledger as ${reference}.`,
  });

  if (input.eventKey) {
    await recordPaymentEvent({
      eventKey: input.eventKey,
      eventType: "payment.settled",
      intentId: intent.id,
      paymentId,
      payload: {
        reference,
        provider,
        amount: order.amountCharged,
        currency: order.currencyCharged,
      },
    });
    await markWebhookProcessed(provider, input.eventKey);
  }

  // Where the outbox exists, an event this path has already acted on is closed
  // here rather than left for a consumer to repeat.
  if (fulfilment.ok) await closeSettlementEvent(input.eventKey || `settle:${reference}`);

  await logPaymentEvent(
    order.id,
    fulfilment.ok ? "payment_settled" : "fulfilment_error",
    {
      reference,
      amount: order.amountCharged,
      currency: order.currencyCharged,
      base_amount: order.baseAmount,
      base_currency: order.baseCurrency,
      fx_rate: order.fxRate,
      payment_id: paymentId,
      fulfilled: fulfilment.ok,
      detail: fulfilment.ok ? undefined : fulfilment.error,
    },
    { provider, signatureValid: true },
  );

  return { ok: true, replay: false, orderId: order.id, fulfilled: fulfilment.ok, paymentId };
}

/**
 * Record a payment the provider says did not succeed.
 *
 * A failure is written down as truthfully as a success, because the customer
 * needs to be told and because an order stuck in pending forever is the thing
 * that makes people pay twice. The intent goes back to pending rather than
 * being closed, so a retry can reuse it instead of opening a second one.
 */
export async function recordFailedPayment(input: {
  order: SettlementOrder;
  provider: string;
  reference: string;
  providerStatus: string;
  reason: string;
  providerPaymentId?: string | null;
  expired?: boolean;
}): Promise<void> {
  if (input.order.status === "paid") return;
  const now = new Date().toISOString();
  await rest(`marketplace_orders?id=eq.${encodeURIComponent(input.order.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      status: input.expired ? "payment_expired" : "payment_failed",
      payment_gateway: input.provider,
      provider_status: input.providerStatus,
      provider_payment_id: input.providerPaymentId ?? null,
      updated_at: now,
    }),
  });
  await setIntentStatus(input.reference, input.expired ? "expired" : "pending");
  await logPaymentEvent(
    input.order.id,
    input.expired ? "payment_expired" : "payment_failed",
    { reference: input.reference, status: input.providerStatus, reason: input.reason },
    { provider: input.provider },
  );
}

/* -------------------------------------------------------------------------- */
/* Refunds                                                                     */
/* -------------------------------------------------------------------------- */

export type ProviderRefund =
  | { ok: true; providerRefundId: string; status: string; provider: string }
  | { ok: false; error: string }
  | { skipped: true; reason: string };

/**
 * Send a refund to the provider that took the payment.
 *
 * Finance Manager owns the refund decision, the approval and the ledger; this
 * is only the leg that makes the money actually move. It runs before the refund
 * is written down as processed, so a provider that refuses leaves the refund
 * unprocessed and the operator looking at the real reason, rather than a
 * REFUNDED status over money that never went anywhere.
 *
 * A refund against a manual rail — Wise, bank transfer, UPI, Binance — is
 * skipped rather than failed, because those are settled by a person and the
 * ledger entry is the whole of the record.
 */
export async function refundThroughProvider(input: {
  /** The settlement invoice, which carries the order number it was issued for. */
  invoiceNo: string | null;
  amount: number;
}): Promise<ProviderRefund> {
  if (!input.invoiceNo || !supabaseUrl()) {
    return { skipped: true, reason: "No invoice to trace the payment back to." };
  }
  // Settlement invoices are numbered INV-<order number>, which is what makes a
  // refund traceable to the payment without a second linking table.
  const orderNumber = input.invoiceNo.replace(/^INV-/, "");

  const found = await rows<Record<string, unknown>>(
    `marketplace_orders?select=id,status,txnid,payment_gateway,provider_payment_id,` +
      `currency_charged,currency&order_number=eq.${encodeURIComponent(orderNumber)}&limit=1`,
  );
  const order = found[0];
  if (!order) return { skipped: true, reason: "No marketplace order matches that invoice." };

  const gateway = String(order.payment_gateway ?? "").toLowerCase();
  const reference = String(order.txnid ?? "");
  const providerPaymentId = String(order.provider_payment_id ?? "");
  const currency = String(order.currency_charged ?? order.currency ?? "USD").toUpperCase();
  const orderId = String(order.id);

  const { cardAdapter, isCardGateway, resolveCardConfig } = await import(
    "@/lib/commerce/card-gateways"
  );
  if (!isCardGateway(gateway)) {
    return { skipped: true, reason: `${gateway || "That rail"} is settled by hand, not by API.` };
  }
  if (String(order.status).toLowerCase() !== "paid") {
    return { ok: false, error: "That order was never settled, so there is nothing to refund." };
  }
  if (!providerPaymentId) {
    return { ok: false, error: "No provider payment reference was recorded for that order." };
  }

  const adapter = cardAdapter(gateway);
  const config = await resolveCardConfig(gateway);
  if (!adapter || !config) {
    return { ok: false, error: `${gateway} has no credentials configured.` };
  }

  const outcome = await adapter.refund(config, {
    providerPaymentId,
    reference,
    amount: input.amount,
    currency,
  });

  await logPaymentEvent(
    orderId,
    outcome.ok ? "provider_refund_issued" : "provider_refund_failed",
    {
      reference,
      amount: input.amount,
      currency,
      detail: outcome.ok ? outcome.providerRefundId : outcome.error,
    },
    { provider: gateway },
  );

  if (!outcome.ok) return { ok: false, error: outcome.error };

  // The money going back out is its own immutable ledger entry, against the
  // same payment, so the sale and its refund are one traceable pair.
  const payment = await rows<{ id: string; invoice_id: string | null }>(
    `finance_payments?select=id,invoice_id&provider_reference=eq.${encodeURIComponent(reference)}&limit=1`,
  );
  if (payment[0]) {
    await rest("finance_ledger_entries", {
      method: "POST",
      headers: { Prefer: "return=minimal,resolution=ignore-duplicates" },
      body: JSON.stringify({
        payment_id: payment[0].id,
        invoice_id: payment[0].invoice_id,
        entry_type: "refund_issued",
        amount: input.amount,
        currency,
        account_code: "revenue.marketplace.refund",
        immutable_payload: {
          reference,
          provider: gateway,
          provider_refund_id: outcome.providerRefundId,
          order_id: orderId,
          issued_at: new Date().toISOString(),
        },
      }),
    });
  }

  await recordReconciliation({
    provider: gateway,
    reference: `${reference}:refund`,
    providerPaymentId: outcome.providerRefundId,
    orderId,
    paymentId: payment[0]?.id ?? null,
    outcome: "matched",
    expectedAmount: input.amount,
    observedAmount: input.amount,
    expectedCurrency: currency,
    observedCurrency: currency,
    detail: `Refund ${outcome.providerRefundId} issued through ${gateway}.`,
  });

  return {
    ok: true,
    providerRefundId: outcome.providerRefundId,
    status: outcome.status,
    provider: gateway,
  };
}
