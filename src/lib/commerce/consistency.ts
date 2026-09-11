import { fulfilOrder, logPaymentEvent } from "@/lib/commerce/fulfilment";
import {
  orderForReference,
  recordReconciliation,
  settleVerifiedPayment,
  type ReconciliationOutcome,
} from "@/lib/commerce/settlement";
import { cardAdapter, isCardGateway, resolveCardConfig } from "@/lib/commerce/card-gateways";
import { resolvePayuConfig, verifyWithPayu } from "@/lib/commerce/payu";
import { log } from "@/lib/commerce/observability";
import { selectTolerant } from "@/lib/commerce/schema-tolerance";

/**
 * The consistency engine.
 *
 * Payments break in ways that nobody is present to see: a provider drops a
 * callback, a worker dies between the money and the licence, an order sits
 * pending because the customer closed the tab. Each of those leaves the books
 * and the world disagreeing, and none of them raises an error anywhere.
 *
 * This sweeps for those disagreements and, for each one, does one of exactly
 * two things.
 *
 * **Repair**, but only where the repair is deterministic, idempotent and
 * financially safe. There are two: asking the provider what became of a pending
 * payment and settling it if the provider says it succeeded, and re-issuing an
 * entitlement for an order that is already paid. Both produce the same result
 * however many times they run, and neither can move money that was not already
 * moved.
 *
 * **Record an exception** for everything else, into the reconciliation records
 * Finance Manager already renders. An amount that does not match, a payment
 * with no ledger entry, two payments against one reference — none of those is
 * repaired automatically, ever. A mismatch that a machine quietly "corrects" is
 * how a real loss becomes invisible.
 *
 * Nothing here decides that a payment succeeded. That is only ever the
 * provider's answer to a direct question, verified by the same adapter the
 * webhook uses, settled through the same function.
 */

function url(): string {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function rows<T>(path: string): Promise<T[]> {
  if (!url()) return [];
  try {
    const response = await fetch(`${url()}/rest/v1/${path}`, { headers: admin() });
    if (!response.ok) return [];
    return (await response.json()) as T[];
  } catch {
    return [];
  }
}

/** How many rows a single sweep will look at, so one run is always bounded. */
const BATCH = 100;
/** A pending order younger than this is simply still in progress. */
const PENDING_GRACE_MS = 20 * 60 * 1000;
/** How far back a paid order is checked for the things that follow a payment. */
const SETTLED_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

export type FindingKind =
  | "stale_pending"
  | "recovered_settlement"
  | "expired_intent"
  | "missing_ledger_entry"
  | "missing_entitlement"
  | "entitlement_repaired"
  | "duplicate_settlement"
  | "payment_amount_mismatch"
  | "orphan_provider_payment";

export type Finding = {
  kind: FindingKind;
  /** repaired: the engine fixed it. exception: a person has to decide. */
  disposition: "repaired" | "exception" | "info";
  reference: string | null;
  orderId: string | null;
  detail: string;
};

export type SweepReport = {
  ranAt: string;
  checked: { pending: number; settled: number; providerTransactions: number };
  repaired: number;
  exceptions: number;
  findings: Finding[];
};

/* -------------------------------------------------------------------------- */
/* Writing an exception down                                                   */
/* -------------------------------------------------------------------------- */

/**
 * An exception goes to the reconciliation records Finance Manager already
 * shows, and — once, per kind, per day — to the alerts board, so a backlog is
 * something an operator is told about rather than something they have to think
 * to look for.
 */
async function raiseException(input: {
  kind: FindingKind;
  outcome: ReconciliationOutcome;
  reference: string | null;
  orderId: string | null;
  providerPaymentId?: string | null;
  provider: string;
  expectedAmount: number | null;
  observedAmount: number | null;
  currency: string | null;
  detail: string;
}): Promise<void> {
  await recordReconciliation({
    provider: input.provider,
    reference: input.reference ?? "",
    providerPaymentId: input.providerPaymentId ?? null,
    orderId: input.orderId,
    outcome: input.outcome,
    expectedAmount: input.expectedAmount,
    observedAmount: input.observedAmount,
    expectedCurrency: input.currency,
    observedCurrency: input.currency,
    detail: input.detail,
  });
}

const ALERT_CATEGORY = "reconciliation";

/**
 * One alert per kind per day, so a sweep that finds forty of the same thing
 * does not produce forty notifications and train everyone to ignore them.
 */
async function alertOnce(kind: FindingKind, count: number, message: string): Promise<void> {
  if (!url() || count === 0) return;
  const title = `Reconciliation: ${kind.replace(/_/g, " ")}`;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  try {
    const existing = await rows<{ id: string }>(
      `finance_alerts?select=id&category=eq.${encodeURIComponent(ALERT_CATEGORY)}` +
        `&title=eq.${encodeURIComponent(title)}&created_at=gte.${encodeURIComponent(since)}&limit=1`,
    );
    if (existing.length) return;
    await fetch(`${url()}/rest/v1/finance_alerts`, {
      method: "POST",
      headers: { ...admin(), Prefer: "return=minimal" },
      body: JSON.stringify({
        title,
        message,
        severity: kind === "duplicate_settlement" ? "critical" : "warning",
        category: ALERT_CATEGORY,
        status: "unread",
      }),
    });
  } catch (error) {
    console.error("[consistency] could not raise alert", error);
  }
}

/* -------------------------------------------------------------------------- */
/* 1. Payments that are still pending                                          */
/* -------------------------------------------------------------------------- */

type PendingOrder = {
  id: string;
  txnid: string | null;
  payment_gateway: string | null;
  updated_at: string | null;
  intent_expires_at?: string | null;
};

/**
 * Ask the provider what became of a payment nobody told us about.
 *
 * This is the repair that matters most to a customer: they paid, the callback
 * was lost, and without this they are left with a pending order and a debited
 * card. Settling goes through the same function the webhook uses, so it is
 * idempotent and a late callback finds the work already done.
 */
async function sweepPending(findings: Finding[]): Promise<number> {
  const cutoff = new Date(Date.now() - PENDING_GRACE_MS).toISOString();
  const pending = await rows<PendingOrder>(
    `marketplace_orders?select=id,txnid,payment_gateway,updated_at` +
      `&status=in.(pending_payment,pending)&txnid=not.is.null` +
      `&updated_at=lt.${encodeURIComponent(cutoff)}` +
      `&order=updated_at.asc&limit=${BATCH}`,
  );

  for (const row of pending) {
    const reference = row.txnid ?? "";
    const gateway = String(row.payment_gateway ?? "").toLowerCase();
    if (!reference || !gateway) continue;

    const order = await orderForReference(reference);
    if (!order || order.status === "paid") continue;

    let verified = false;
    let providerPaymentId: string | null = null;
    let amount: number | null = null;
    let currency: string | null = null;
    let providerStatus = "unknown";
    let last4: string | null = null;
    let brand: string | null = null;

    if (isCardGateway(gateway)) {
      const adapter = cardAdapter(gateway);
      const config = await resolveCardConfig(gateway);
      if (!adapter || !config) continue;
      const answer = await adapter.verify(config, {
        reference,
        providerPaymentId: order.providerPaymentId,
      });
      verified = answer.verified;
      providerStatus = answer.status;
      providerPaymentId = answer.providerPaymentId ?? order.providerPaymentId;
      amount = answer.amount;
      currency = answer.currency;
      last4 = answer.last4 ?? null;
      brand = answer.brand ?? null;
    } else if (gateway === "payu") {
      const config = await resolvePayuConfig();
      if (!config) continue;
      const answer = await verifyWithPayu(config, reference);
      verified = answer.verified;
      providerStatus = answer.status ?? "unknown";
      providerPaymentId = answer.payuId ?? null;
      amount = answer.amount ? Number(answer.amount) : null;
      currency = order.currencyCharged;
    } else {
      // A manual rail — Wise, bank transfer, UPI, Binance — is settled by a
      // person against a submitted proof. There is no provider to ask.
      continue;
    }

    if (verified) {
      const settled = await settleVerifiedPayment({
        order,
        provider: gateway,
        reference,
        providerPaymentId,
        providerStatus,
        observedAmount: amount,
        observedCurrency: currency,
        last4,
        brand,
        eventKey: `sweep:${reference}`,
        correlationId: `sweep:${reference}`,
      });
      findings.push({
        kind: "recovered_settlement",
        disposition: settled.ok ? "repaired" : "exception",
        reference,
        orderId: order.id,
        detail: settled.ok
          ? "The provider confirmed this payment; it has been settled and posted."
          : `The provider confirmed this payment but it could not be settled: ${settled.reason}`,
      });
      await logPaymentEvent(
        order.id,
        "sweep_recovered",
        { reference, settled: settled.ok },
        { provider: gateway },
      );
      continue;
    }

    // The provider was reached and says this did not succeed. Only then, and
    // only after the intent's window has run out, is the order allowed to stop
    // waiting — an unreachable provider never expires anybody's payment.
    const expiresAt = order.intentExpiresAt ? Date.parse(order.intentExpiresAt) : NaN;
    const expired = Number.isFinite(expiresAt) && Date.now() > expiresAt;
    if (providerStatus !== "unknown" && expired) {
      findings.push({
        kind: "expired_intent",
        disposition: "info",
        reference,
        orderId: order.id,
        detail: `${gateway} reports "${providerStatus}" and the payment window has closed.`,
      });
      continue;
    }

    findings.push({
      kind: "stale_pending",
      disposition: "exception",
      reference,
      orderId: order.id,
      detail: `Still pending since ${row.updated_at ?? "unknown"}; ${gateway} reports "${providerStatus}".`,
    });
    await raiseException({
      kind: "stale_pending",
      outcome: "missing_transaction",
      reference,
      orderId: order.id,
      providerPaymentId,
      provider: gateway,
      expectedAmount: order.amountCharged,
      observedAmount: amount,
      currency: order.currencyCharged,
      detail: `Payment has been pending since ${row.updated_at ?? "unknown"} and ${gateway} does not confirm it.`,
    });
  }

  return pending.length;
}

/* -------------------------------------------------------------------------- */
/* 2. Payments that settled                                                    */
/* -------------------------------------------------------------------------- */

type SettledOrder = {
  id: string;
  txnid: string | null;
  order_number: string | null;
  payment_gateway: string | null;
  amount_charged: number | null;
  amount_inr: number | null;
  total: number | null;
  currency_charged: string | null;
  currency: string | null;
};

/**
 * Everything that is supposed to follow a settled payment: a ledger entry, a
 * licence, exactly one payment row, and an amount that agrees.
 */
async function sweepSettled(findings: Finding[]): Promise<number> {
  const since = new Date(Date.now() - SETTLED_LOOKBACK_MS).toISOString();
  // amount_charged may not exist yet in production; drop it rather than let
  // the sweep read nothing at all.
  let settled: SettledOrder[] = [];
  if (url()) {
    try {
      const response = await selectTolerant(
        "marketplace_orders",
        "id,txnid,order_number,payment_gateway,amount_charged,amount_inr,total,currency_charged,currency",
        (select) =>
          `${url()}/rest/v1/marketplace_orders?select=${select}&status=eq.paid&txnid=not.is.null` +
          `&updated_at=gte.${encodeURIComponent(since)}&order=updated_at.desc&limit=${BATCH}`,
        { headers: admin() },
      );
      settled = response.ok ? ((await response.json()) as SettledOrder[]) : [];
    } catch {
      settled = [];
    }
  }

  for (const order of settled) {
    const reference = order.txnid ?? "";
    if (!reference) continue;
    const provider = String(order.payment_gateway ?? "unknown").toLowerCase();
    const charged = Number(order.amount_charged ?? order.amount_inr ?? order.total ?? 0);
    const currency = String(order.currency_charged ?? order.currency ?? "USD").toUpperCase();

    // ---- the operating ledger ---------------------------------------------
    const ledger = await rows<{ id: string }>(
      `finance_transactions?select=id&txn_code=eq.${encodeURIComponent(reference)}&limit=1`,
    );
    if (!ledger.length) {
      findings.push({
        kind: "missing_ledger_entry",
        disposition: "exception",
        reference,
        orderId: order.id,
        detail: "This order is paid but no transaction was posted to the ledger for it.",
      });
      await raiseException({
        kind: "missing_ledger_entry",
        outcome: "missing_transaction",
        reference,
        orderId: order.id,
        provider,
        expectedAmount: charged,
        observedAmount: null,
        currency,
        detail:
          "Order is marked paid but there is no finance_transactions entry for its reference. " +
          "Finance must decide whether to post it; nothing has been posted automatically.",
      });
    }

    // ---- exactly one payment ----------------------------------------------
    const payments = await rows<{ id: string; amount: number; currency: string }>(
      `finance_payments?select=id,amount,currency` +
        `&provider_reference=eq.${encodeURIComponent(reference)}&limit=5`,
    );
    if (payments.length > 1) {
      findings.push({
        kind: "duplicate_settlement",
        disposition: "exception",
        reference,
        orderId: order.id,
        detail: `${payments.length} payment rows exist for one reference.`,
      });
      await raiseException({
        kind: "duplicate_settlement",
        outcome: "duplicate_event",
        reference,
        orderId: order.id,
        provider,
        expectedAmount: charged,
        observedAmount: payments.reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
        currency,
        detail:
          `${payments.length} payments are recorded against reference ${reference}. ` +
          "This is never repaired automatically — a refund may be owed.",
      });
    } else if (payments.length === 1 && charged > 0) {
      const paid = Number(payments[0]?.amount ?? 0);
      if (Math.abs(paid - charged) > 0.01) {
        findings.push({
          kind: "payment_amount_mismatch",
          disposition: "exception",
          reference,
          orderId: order.id,
          detail: `Order says ${charged} ${currency}; the payment says ${paid}.`,
        });
        await raiseException({
          kind: "payment_amount_mismatch",
          outcome: "amount_mismatch",
          reference,
          orderId: order.id,
          provider,
          expectedAmount: charged,
          observedAmount: paid,
          currency,
          detail: "The order total and the recorded payment do not agree.",
        });
      }
    }

    // ---- the customer actually has what they bought ------------------------
    //
    // The one repair that is always safe: fulfilment is idempotent, grants only
    // what the order's own lines say, and cannot move money.
    const licence = await rows<{ id: string }>(
      `licenses?select=id&order_id=eq.${encodeURIComponent(order.id)}&limit=1`,
    );
    if (!licence.length) {
      const repaired = await fulfilOrder(order.id);
      findings.push({
        kind: repaired.ok ? "entitlement_repaired" : "missing_entitlement",
        disposition: repaired.ok ? "repaired" : "exception",
        reference,
        orderId: order.id,
        detail: repaired.ok
          ? "Paid order had no licence; one has been issued."
          : `Paid order has no licence and it could not be issued: ${repaired.error}`,
      });
      await logPaymentEvent(
        order.id,
        repaired.ok ? "sweep_entitlement_repaired" : "sweep_entitlement_failed",
        { reference, detail: repaired.ok ? undefined : repaired.error },
        { provider },
      );
      if (!repaired.ok) {
        await raiseException({
          kind: "missing_entitlement",
          outcome: "missing_transaction",
          reference,
          orderId: order.id,
          provider,
          expectedAmount: charged,
          observedAmount: charged,
          currency,
          detail:
            "The customer has paid and has no licence, and re-issuing it failed: " + repaired.error,
        });
      }
    }
  }

  return settled.length;
}

/* -------------------------------------------------------------------------- */
/* 3. Money the provider says it took                                          */
/* -------------------------------------------------------------------------- */

/**
 * A provider transaction that never matched anything on our side. This is the
 * shape of a payment taken from a customer whose order we cannot find, which is
 * the most serious thing a sweep can turn up and the least suitable for
 * automatic anything.
 */
async function sweepProviderTransactions(findings: Finding[]): Promise<number> {
  const orphans = await rows<{
    id: string;
    provider_transaction_id: string;
    reference: string | null;
    amount: number | null;
    currency: string | null;
    network: string | null;
  }>(
    `finance_provider_transactions?select=id,provider_transaction_id,reference,amount,currency,network` +
      `&status=neq.matched&order=observed_at.desc&limit=${BATCH}`,
  );

  for (const txn of orphans) {
    const reference = txn.reference ?? "";
    if (!reference) continue;
    const matched = await rows<{ id: string }>(
      `finance_reconciliation_records?select=id` +
        `&provider_transaction_id=eq.${encodeURIComponent(txn.id)}` +
        `&matching_status=eq.matched&limit=1`,
    );
    if (matched.length) continue;

    const order = await orderForReference(reference);
    if (order && order.status === "paid") continue;

    findings.push({
      kind: "orphan_provider_payment",
      disposition: "exception",
      reference,
      orderId: order?.id ?? null,
      detail: order
        ? `The provider recorded ${txn.amount ?? "?"} ${txn.currency ?? ""} but the order is ${order.status}.`
        : "The provider recorded a payment for a reference this platform does not hold.",
    });
  }

  return orphans.length;
}

/* -------------------------------------------------------------------------- */
/* The sweep                                                                   */
/* -------------------------------------------------------------------------- */

export async function runConsistencySweep(): Promise<SweepReport> {
  const started = Date.now();
  const findings: Finding[] = [];

  const pending = await sweepPending(findings);
  const settled = await sweepSettled(findings);
  const providerTransactions = await sweepProviderTransactions(findings);

  const exceptions = findings.filter((f) => f.disposition === "exception");
  const repaired = findings.filter((f) => f.disposition === "repaired");

  // One alert per kind, deduplicated over a day.
  const byKind = new Map<FindingKind, number>();
  for (const finding of exceptions) {
    byKind.set(finding.kind, (byKind.get(finding.kind) ?? 0) + 1);
  }
  for (const [kind, count] of byKind) {
    await alertOnce(
      kind,
      count,
      `The payment consistency sweep found ${count} ${kind.replace(/_/g, " ")} ` +
        "exception(s). They are listed under Reconciliation in Finance Manager and " +
        "have not been altered automatically.",
    );
  }

  log({
    correlationId: `sweep:${started}`,
    component: "consistency",
    action: "sweep",
    status: exceptions.length ? "error" : "ok",
    durationMs: Date.now() - started,
    pending,
    settled,
    providerTransactions,
    repaired: repaired.length,
    exceptions: exceptions.length,
  });

  return {
    ranAt: new Date(started).toISOString(),
    checked: { pending, settled, providerTransactions },
    repaired: repaired.length,
    exceptions: exceptions.length,
    findings,
  };
}
