import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequestHeader } from "@tanstack/react-start/server";

export type FinanceOperator = { id: string; email: string | null; role: string };

/**
 * Who is allowed to move money.
 *
 * Every function in this file runs on the service-role client, which bypasses
 * row level security, and all seventeen of them are reachable from the browser
 * through finance.functions.ts. Before this guard none of them checked anything
 * at all: an unauthenticated request could credit any wallet by any amount,
 * freeze a wallet, flip a payment gateway or approve a payout, and the `actor`
 * recorded against it was a string the caller supplied — so the audit trail
 * named whoever the caller wanted it to name.
 *
 * The check is the same one the Control Panel data layer already uses, against
 * the same has_role function, so this introduces no second permission system.
 */
export async function requireFinanceOperator(): Promise<FinanceOperator> {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Finance authentication required");

  const { data: user, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user.user) throw new Error("Finance authentication required");

  const [{ data: isFinance }, { data: isAdmin }, { data: isBoss }] = await Promise.all([
    supabaseAdmin.rpc("has_role", { _user_id: user.user.id, _role: "finance" }),
    supabaseAdmin.rpc("has_role", { _user_id: user.user.id, _role: "admin" }),
    supabaseAdmin.rpc("has_role", { _user_id: user.user.id, _role: "boss" }),
  ]);
  if (!isFinance && !isAdmin && !isBoss) throw new Error("Finance permission required");

  return {
    id: user.user.id,
    email: user.user.email ?? null,
    role: isBoss ? "boss" : isAdmin ? "admin" : "finance",
  };
}

type Json = Record<string, unknown>;

async function writeAudit(entry: {
  actor: string;
  actor_role?: string;
  action: string;
  entity: string;
  entity_ref: string;
  severity?: "info" | "warning" | "critical";
  details?: Json;
}) {
  await supabaseAdmin.from("finance_audit_logs").insert({
    actor: entry.actor,
    actor_role: entry.actor_role ?? "finance_manager",
    action: entry.action,
    entity: entry.entity,
    entity_ref: entry.entity_ref,
    severity: entry.severity ?? "info",
    details: (entry.details ?? {}) as never,
    ip_address: "internal",
    user_agent: "software-vala-finance-console",
  } as never);
}

function ok<T>(data: T) {
  return { success: true as const, data };
}

function fail(message: string): never {
  throw new Error(message);
}

export async function updatePayoutStatus(input: {
  id: string;
  status: "approved" | "rejected" | "processing" | "paid" | "on_hold";
  actor: string;
  note?: string | undefined;
}) {
  const patch: Json = { status: input.status, reviewer_note: input.note ?? null };
  if (input.status === "paid") patch["processed_at"] = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("finance_payouts")
    .update(patch as never)
    .eq("id", input.id)
    .select("*")
    .single();
  if (error) fail(error.message);

  await writeAudit({
    actor: input.actor,
    action: `payout.${input.status}`,
    entity: "finance_payouts",
    entity_ref: data.payout_code,
    severity: input.status === "rejected" ? "warning" : "info",
    details: { amount: data.amount, recipient: data.recipient_name },
  });
  return ok(data);
}

/**
 * A refund's ledger entry. Idempotent on txn_code, which is the refund code,
 * so approving twice or a retried request cannot debit the business twice.
 */
async function recordRefundLedgerEntry(refund: {
  refund_code: string;
  amount: number;
  customer_name: string | null;
  invoice_no: string | null;
  mode: string | null;
}): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from("finance_transactions")
    .select("id")
    .eq("txn_code", refund.refund_code)
    .limit(1);
  if ((existing ?? []).length) return;

  await supabaseAdmin.from("finance_transactions").insert({
    txn_code: refund.refund_code,
    direction: "debit",
    amount: refund.amount,
    counterparty: refund.customer_name ?? "Customer",
    counterparty_type: "user",
    category: "Refund",
    gateway: "manual",
    method: refund.mode ?? "Original Source",
    status: "completed",
    occurred_at: new Date().toISOString(),
    notes: refund.invoice_no ? `Refund against invoice ${refund.invoice_no}` : "Refund",
  } as never);
}

export async function updateRefundStatus(input: {
  id: string;
  status: "approved" | "rejected" | "processed";
  actor: string;
  note?: string | undefined;
}) {
  // Read what is being changed before changing it. Marking a refund processed
  // used to flip a column and write an audit line: no check that the refund had
  // not already been paid out, no check that it was within what the customer
  // actually paid, and no entry in the ledger, so refunded money never left the
  // books.
  const { data: current, error: readError } = await supabaseAdmin
    .from("finance_refunds")
    .select("*")
    .eq("id", input.id)
    .maybeSingle();
  if (readError) fail(readError.message);
  if (!current) fail("Refund not found");

  const refund = current as unknown as {
    refund_code: string;
    invoice_no: string | null;
    customer_name: string | null;
    amount: number | string;
    mode: string | null;
    status: string;
  };
  const amount = Number(refund.amount ?? 0);

  if (refund.status === "processed" && input.status === "processed") {
    // Already paid out. Saying so is better than paying it again.
    return ok(current);
  }
  if (refund.status === "processed" && input.status !== "processed") {
    fail("A processed refund cannot be changed.");
  }

  // A refund can never exceed what was invoiced, counting refunds already
  // processed against the same invoice.
  if (input.status === "approved" || input.status === "processed") {
    if (refund.invoice_no) {
      const { data: invoice } = await supabaseAdmin
        .from("finance_invoices")
        .select("total")
        .eq("invoice_no", refund.invoice_no)
        .maybeSingle();
      const invoiceTotal = Number((invoice as { total?: number } | null)?.total ?? 0);
      if (invoiceTotal > 0) {
        const { data: siblings } = await supabaseAdmin
          .from("finance_refunds")
          .select("id, amount, status")
          .eq("invoice_no", refund.invoice_no);
        const alreadyRefunded = (siblings ?? [])
          .filter((r) => {
            const row = r as unknown as { id: string; status: string };
            return row.id !== input.id && row.status === "processed";
          })
          .reduce((sum, r) => sum + Number((r as unknown as { amount: number }).amount ?? 0), 0);
        if (alreadyRefunded + amount > invoiceTotal + 0.005) {
          fail(
            `Refund would exceed invoice ${refund.invoice_no}: ` +
              `${alreadyRefunded + amount} against a total of ${invoiceTotal}.`,
          );
        }
      }
    }
  }

  const patch: Json = { status: input.status, reviewer_note: input.note ?? null };
  if (input.status === "processed") patch["processed_at"] = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("finance_refunds")
    .update(patch as never)
    .eq("id", input.id)
    .select("*")
    .single();
  if (error) fail(error.message);

  // Money actually leaving is a ledger event.
  if (input.status === "processed") {
    await recordRefundLedgerEntry({
      refund_code: refund.refund_code,
      amount,
      customer_name: refund.customer_name,
      invoice_no: refund.invoice_no,
      mode: refund.mode,
    });
  }

  await writeAudit({
    actor: input.actor,
    action: `refund.${input.status}`,
    entity: "finance_refunds",
    entity_ref: data.refund_code,
    severity: "warning",
    details: {
      amount,
      invoice_no: refund.invoice_no,
      previous_status: refund.status,
      note: input.note ?? null,
    },
  });
  return ok(data);
}

export async function decideApproval(input: {
  id: string;
  decision: "approved" | "rejected";
  actor: string;
  note?: string | undefined;
}) {
  const { data, error } = await supabaseAdmin
    .from("finance_approvals")
    .update({
      status: input.decision,
      decided_at: new Date().toISOString(),
      notes: input.note ?? null,
    } as never)
    .eq("id", input.id)
    .select("*")
    .single();
  if (error) fail(error.message);

  await writeAudit({
    actor: input.actor,
    action: `approval.${input.decision}`,
    entity: "finance_approvals",
    entity_ref: data.reference,
    severity: input.decision === "rejected" ? "warning" : "info",
    details: { amount: data.amount, request_type: data.request_type },
  });
  return ok(data);
}

/**
 * An invoice's ledger entry. Idempotent on txn_code, which is the invoice
 * number, so the marketplace settlement path and an operator marking the same
 * invoice paid cannot both post it.
 */
async function recordInvoiceLedgerEntry(invoice: {
  invoice_no: string;
  total: number;
  client_name: string | null;
  client_type: string | null;
}): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from("finance_transactions")
    .select("id")
    .eq("txn_code", invoice.invoice_no)
    .limit(1);
  if ((existing ?? []).length) return;

  await supabaseAdmin.from("finance_transactions").insert({
    txn_code: invoice.invoice_no,
    direction: "credit",
    amount: invoice.total,
    counterparty: invoice.client_name ?? "Customer",
    counterparty_type: invoice.client_type ?? "user",
    category: "Invoice Settlement",
    gateway: "manual",
    method: "Manual",
    status: "completed",
    occurred_at: new Date().toISOString(),
    notes: `Invoice ${invoice.invoice_no} marked paid in Finance Manager`,
  } as never);
}

export async function updateInvoiceStatus(input: {
  id: string;
  status: "draft" | "unpaid" | "paid" | "overdue" | "cancelled";
  actor: string;
}) {
  // Marking an invoice paid used to change a column and nothing else. The
  // document said settled while finance_transactions had no record of the
  // money, which is the same break that left the ledger empty behind a hundred
  // and twenty-three invoices.
  const { data: current, error: readError } = await supabaseAdmin
    .from("finance_invoices")
    .select("*")
    .eq("id", input.id)
    .maybeSingle();
  if (readError) fail(readError.message);
  if (!current) fail("Invoice not found");

  const before = current as unknown as {
    invoice_no: string;
    status: string;
    total: number | string;
    client_name: string | null;
    client_type: string | null;
  };

  if (before.status === "paid" && input.status === "paid") return ok(current);
  if (before.status === "cancelled" && input.status !== "cancelled") {
    fail("A cancelled invoice cannot be reopened. Raise a new document instead.");
  }

  const patch: Json = { status: input.status };
  if (input.status === "paid") patch["paid_at"] = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("finance_invoices")
    .update(patch as never)
    .eq("id", input.id)
    .select("*")
    .single();
  if (error) fail(error.message);

  if (input.status === "paid") {
    await recordInvoiceLedgerEntry({
      invoice_no: before.invoice_no,
      total: Number(before.total ?? 0),
      client_name: before.client_name,
      client_type: before.client_type,
    });
  }

  await writeAudit({
    actor: input.actor,
    action: `invoice.${input.status}`,
    entity: "finance_invoices",
    entity_ref: data.invoice_no,
    details: { total: data.total, previous_status: before.status },
  });
  return ok(data);
}

export async function adjustWallet(input: {
  walletId: string;
  amount: number;
  entryType: "credit" | "debit";
  reason: string;
  actor: string;
}) {
  const reference = `ADJ-${Date.now().toString(36).toUpperCase()}`;

  // The module was written against finance_adjust_wallet_atomic, which locks
  // the wallet row and writes the ledger entry in one transaction. That
  // function does not exist in this project's database — PostgREST answers
  // PGRST202 — so every top-up and every deduction failed the moment it was
  // used. The migration that creates it ships alongside this change; until it
  // is applied the same work is done here with a compare-and-set, which is
  // safe against a concurrent adjustment because the update only lands if the
  // balance is still the one that was read.
  const viaRpc = await supabaseAdmin.rpc("finance_adjust_wallet_atomic", {
    p_wallet_id: input.walletId,
    p_amount: input.amount,
    p_entry_type: input.entryType,
    p_reason: input.reason,
    p_actor: input.actor,
    p_reference: reference,
  });

  let wallet: Record<string, unknown>;

  if (!viaRpc.error) {
    wallet = viaRpc.data as unknown as Record<string, unknown>;
  } else if (!/PGRST202|could not find|does not exist/i.test(viaRpc.error.message)) {
    fail(viaRpc.error.message);
  } else {
    wallet = await adjustWalletWithoutRpc({ ...input, reference });
  }

  await writeAudit({
    actor: input.actor,
    action: `wallet.${input.entryType}`,
    entity: "finance_wallets",
    entity_ref: String(wallet["owner_code"] ?? wallet["id"] ?? input.walletId),
    severity: "warning",
    details: {
      amount: input.amount,
      reason: input.reason,
      reference,
      balance_after: wallet["balance"],
    },
  });
  return ok(wallet);
}

/**
 * The same adjustment without the stored procedure.
 *
 * Validation matches the function's exactly — a positive amount, a known entry
 * type, a reason, no adjustment on a frozen wallet and no balance below zero —
 * and the ledger row carries the same columns. The write is conditional on the
 * balance that was read, so two adjustments arriving together cannot both
 * succeed against the same starting balance; the loser retries against the new
 * one.
 */
async function adjustWalletWithoutRpc(input: {
  walletId: string;
  amount: number;
  entryType: "credit" | "debit";
  reason: string;
  actor: string;
  reference: string;
}): Promise<Record<string, unknown>> {
  if (!(input.amount > 0)) fail("Amount must be greater than zero");
  if (input.entryType !== "credit" && input.entryType !== "debit") fail("Invalid entry type");
  if (!input.reason.trim()) fail("A reason is required");

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: current, error: readError } = await supabaseAdmin
      .from("finance_wallets")
      .select("*")
      .eq("id", input.walletId)
      .maybeSingle();
    if (readError) fail(readError.message);
    if (!current) fail("Wallet not found");

    const row = current as unknown as Record<string, unknown>;
    if (row["status"] === "frozen") fail("Frozen wallets cannot be adjusted");

    const balance = Number(row["balance"] ?? 0);
    const next = input.entryType === "credit" ? balance + input.amount : balance - input.amount;
    if (next < 0) fail("Adjustment would push the wallet balance below zero");

    const { data: updated, error: writeError } = await supabaseAdmin
      .from("finance_wallets")
      .update({ balance: next, last_activity_at: new Date().toISOString() } as never)
      .eq("id", input.walletId)
      .eq("balance", balance)
      .select("*")
      .maybeSingle();
    if (writeError) fail(writeError.message);
    if (!updated) continue; // somebody else moved the balance; read it again

    const { error: ledgerError } = await supabaseAdmin.from("finance_wallet_transactions").insert({
      wallet_id: input.walletId,
      entry_type: input.entryType,
      amount: input.amount,
      balance_after: next,
      reference: input.reference,
      note: input.reason,
      status: "completed",
      performed_by: input.actor,
    } as never);
    if (ledgerError) fail(ledgerError.message);

    return updated as unknown as Record<string, unknown>;
  }

  fail("The wallet was being changed by someone else. Try again.");
}

export async function toggleWalletFreeze(input: {
  walletId: string;
  frozen: boolean;
  actor: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("finance_wallets")
    .update({ status: input.frozen ? "frozen" : "active" } as never)
    .eq("id", input.walletId)
    .select("*")
    .single();
  if (error) fail(error.message);

  await writeAudit({
    actor: input.actor,
    action: input.frozen ? "wallet.freeze" : "wallet.unfreeze",
    entity: "finance_wallets",
    entity_ref: data.owner_code,
    severity: "critical",
  });
  return ok(data);
}

export type GatewayReadiness = {
  adapter: boolean;
  credentials: boolean;
  state: "READY" | "NOT_CONFIGURED" | "NOT_IMPLEMENTED";
  detail: string;
};

/**
 * What each gateway can actually do, as opposed to what its row says.
 *
 * finance_gateways.status is seeded 'active' for UPI, bank transfer, PayU and
 * Stripe, and the console read that column alone — so four gateways presented
 * themselves as live while nothing in this codebase could take a payment
 * through any of them. Only PayU has a real adapter here
 * (lib/commerce/payu.ts, with hash generation, the verify call and the webhook
 * that checks it four ways), and even that has no credentials on this server.
 *
 * This answers from the code and the environment, never from the row, so the
 * console can show the truth without its layout changing.
 */
export async function gatewayReadiness(): Promise<Record<string, GatewayReadiness>> {
  const { payuConfig } = await import("@/lib/commerce/payu");
  const payuReady = Boolean(payuConfig());

  const notImplemented = (name: string): GatewayReadiness => ({
    adapter: false,
    credentials: false,
    state: "NOT_IMPLEMENTED",
    detail: `No server-side ${name} adapter exists in this project yet.`,
  });

  return {
    payu: {
      adapter: true,
      credentials: payuReady,
      state: payuReady ? "READY" : "NOT_CONFIGURED",
      detail: payuReady
        ? "Adapter, verification and webhook are in place."
        : "Adapter and webhook exist; PAYU_MERCHANT_KEY and PAYU_MERCHANT_SALT are not set on this server.",
    },
    upi: notImplemented("UPI"),
    bank: notImplemented("bank transfer"),
    stripe: notImplemented("Stripe"),
    paypal: notImplemented("PayPal"),
    crypto: notImplemented("crypto"),
  };
}

export async function setGatewayEnabled(input: { id: string; enabled: boolean; actor: string }) {
  if (input.enabled) {
    // Enabling a gateway that has no adapter or no credentials would put a
    // live-looking payment route in front of an operator that cannot complete
    // a single payment.
    const { data: row } = await supabaseAdmin
      .from("finance_gateways")
      .select("code")
      .eq("id", input.id)
      .maybeSingle();
    const code = String((row as { code?: string } | null)?.code ?? "");
    const readiness = (await gatewayReadiness())[code];
    if (readiness && readiness.state !== "READY") {
      fail(`${code.toUpperCase()} cannot be enabled: ${readiness.detail}`);
    }
  }

  const { data, error } = await supabaseAdmin
    .from("finance_gateways")
    .update({ status: input.enabled ? "active" : "disabled" } as never)
    .eq("id", input.id)
    .select("*")
    .single();
  if (error) fail(error.message);

  await writeAudit({
    actor: input.actor,
    action: input.enabled ? "gateway.enable" : "gateway.disable",
    entity: "finance_gateways",
    entity_ref: data.code,
    severity: "critical",
  });
  return ok(data);
}

export async function createExpense(input: {
  category: string;
  vendor: string;
  description: string;
  amount: number;
  expenseDate: string;
  recurring: boolean;
  actor: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("finance_expenses")
    .insert({
      category: input.category,
      vendor: input.vendor,
      description: input.description,
      amount: input.amount,
      expense_date: input.expenseDate,
      recurring: input.recurring,
      status: "pending",
    } as never)
    .select("*")
    .single();
  if (error) fail(error.message);

  await writeAudit({
    actor: input.actor,
    action: "expense.create",
    entity: "finance_expenses",
    entity_ref: data.id,
    details: { amount: data.amount, vendor: data.vendor },
  });
  return ok(data);
}

export async function updateExpenseStatus(input: {
  id: string;
  status: "pending" | "approved" | "rejected" | "reimbursed";
  actor: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("finance_expenses")
    .update({ status: input.status } as never)
    .eq("id", input.id)
    .select("*")
    .single();
  if (error) fail(error.message);

  await writeAudit({
    actor: input.actor,
    action: `expense.${input.status}`,
    entity: "finance_expenses",
    entity_ref: data.id,
    details: { vendor: data.vendor, amount: data.amount },
  });
  return ok(data);
}

export async function updateSubscriptionStatus(input: {
  id: string;
  status: "active" | "cancelled" | "paused" | "expired";
  planId?: string | undefined;
  actor: string;
}) {
  const patch: Json = { status: input.status };
  if (input.planId) {
    const { data: plan, error: planError } = await supabaseAdmin
      .from("finance_plans")
      .select("id, name, price")
      .eq("id", input.planId)
      .single();
    if (planError) fail(planError.message);
    patch["plan_id"] = plan.id;
    patch["amount"] = plan.price;
    patch["previous_plan"] = plan.name;
  }
  const { data, error } = await supabaseAdmin
    .from("finance_subscriptions")
    .update(patch as never)
    .eq("id", input.id)
    .select("*")
    .single();
  if (error) fail(error.message);

  await writeAudit({
    actor: input.actor,
    action: `subscription.${input.status}`,
    entity: "finance_subscriptions",
    entity_ref: data.customer_name,
    details: { amount: data.amount },
  });
  return ok(data);
}

export async function updateAiControl(input: {
  provider: string;
  service: string;
  status?: "active" | "stopped" | undefined;
  budget?: number | undefined;
  spikeThreshold?: number | undefined;
  autoStopPercent?: number | undefined;
  actor: string;
}) {
  const patch: Json = {
    provider: input.provider,
    service: input.service,
    updated_at: new Date().toISOString(),
  };
  if (input.status !== undefined) patch["status"] = input.status;
  if (input.budget !== undefined) patch["budget"] = input.budget;
  if (input.spikeThreshold !== undefined) patch["spike_threshold"] = input.spikeThreshold;
  if (input.autoStopPercent !== undefined) patch["auto_stop_percent"] = input.autoStopPercent;
  const { data, error } = await supabaseAdmin
    .from("finance_ai_controls")
    .upsert(patch as never, { onConflict: "provider,service" })
    .select("*")
    .single();
  if (error) fail(error.message);
  await writeAudit({
    actor: input.actor,
    action: "ai_billing.control_update",
    entity: "finance_ai_controls",
    entity_ref: `${input.provider}/${input.service}`,
    severity: "warning",
    details: patch,
  });
  return ok(data);
}

export async function updateTaxRecordStatus(input: {
  id: string;
  status: "pending" | "filed" | "paid" | "overdue";
  actor: string;
}) {
  const patch: Json = { filing_status: input.status };
  if (input.status === "filed" || input.status === "paid")
    patch["filed_at"] = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("finance_tax_records")
    .update(patch as never)
    .eq("id", input.id)
    .select("*")
    .single();
  if (error) fail(error.message);

  await writeAudit({
    actor: input.actor,
    action: `tax.${input.status}`,
    entity: "finance_tax_records",
    entity_ref: data.reference_no ?? data.period,
    details: { period: data.period, amount: data.tax_amount },
  });
  return ok(data);
}

export async function updateFraudAlertStatus(input: {
  id: string;
  status: "open" | "investigating" | "resolved" | "false_positive";
  actor: string;
}) {
  const patch: Json = { status: input.status };
  if (input.status === "resolved" || input.status === "false_positive") {
    patch["resolved_at"] = new Date().toISOString();
  }

  const { data, error } = await supabaseAdmin
    .from("finance_fraud_alerts")
    .update(patch as never)
    .eq("id", input.id)
    .select("*")
    .single();
  if (error) fail(error.message);

  await writeAudit({
    actor: input.actor,
    action: `fraud.${input.status}`,
    entity: "finance_fraud_alerts",
    entity_ref: data.alert_code,
    severity: "critical",
    details: { risk_score: data.risk_score, amount: data.amount },
  });
  return ok(data);
}

export async function updateAlertStatus(input: {
  id: string;
  status: "open" | "acknowledged" | "resolved";
}) {
  const { data, error } = await supabaseAdmin
    .from("finance_alerts")
    .update({ status: input.status } as never)
    .eq("id", input.id)
    .select("*")
    .single();
  if (error) fail(error.message);
  return ok(data);
}

export async function updateCommissionStatus(input: {
  id: string;
  status: "pending" | "approved" | "paid" | "reversed";
  actor: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("finance_commissions")
    .update({ status: input.status } as never)
    .eq("id", input.id)
    .select("*")
    .single();
  if (error) fail(error.message);

  await writeAudit({
    actor: input.actor,
    action: `commission.${input.status}`,
    entity: "finance_commissions",
    entity_ref: data.partner_name,
    details: { amount: data.commission_amount, period: data.period },
  });
  return ok(data);
}

export async function createInvoice(input: {
  clientName: string;
  clientType: string;
  docType: "invoice" | "credit_note" | "debit_note" | "tax_invoice";
  gstNumber?: string | undefined;
  dueDate: string;
  taxPercent: number;
  lineItems: { description: string; qty: number; rate: number }[];
  actor: string;
}) {
  if (!input.lineItems.length) fail("Add at least one line item.");
  const subtotal = input.lineItems.reduce((sum, li) => sum + li.qty * li.rate, 0);
  const taxAmount = (subtotal * input.taxPercent) / 100;
  const prefix =
    input.docType === "credit_note" ? "CN" : input.docType === "debit_note" ? "DN" : "INV";
  const invoiceNo = `${prefix}-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-6)}`;

  const { data, error } = await supabaseAdmin
    .from("finance_invoices")
    .insert({
      invoice_no: invoiceNo,
      doc_type: input.docType,
      client_name: input.clientName,
      client_type: input.clientType,
      gst_number: input.gstNumber ?? null,
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: input.dueDate,
      subtotal,
      tax_amount: taxAmount,
      total: subtotal + taxAmount,
      status: "draft",
      auto_generated: false,
      line_items: input.lineItems as never,
    } as never)
    .select("*")
    .single();
  if (error) fail(error.message);

  await writeAudit({
    actor: input.actor,
    action: "invoice.create",
    entity: "finance_invoices",
    entity_ref: data.invoice_no,
    details: { total: data.total, client: data.client_name },
  });
  return ok(data);
}

/* ------------------------------------------------------------------ *
 * Business dates
 *
 * "Today's Income" was decided by the browser: the section filtered a list of
 * the newest three hundred transactions with getFullYear/getMonth/getDate
 * against the viewer's own clock. Two things were wrong with that. The
 * timestamps in finance_transactions are UTC, so an operator in Asia/Kolkata
 * saw every transaction after 18:30 UTC counted as tomorrow's, and an operator
 * in America/New_York saw a different figure for the same day. And three
 * hundred rows is not a day — it is whatever happened to be newest.
 *
 * The business day is now decided on the server, in the timezone the platform
 * is configured with, and the total is summed over every transaction inside
 * that day rather than over a window of rows. The timezone is read from
 * system_settings, the table the Settings screen already edits, so it is not
 * hardcoded to IST or to UTC and can differ per deployment.
 * ------------------------------------------------------------------ */

const BUSINESS_TIMEZONE_KEY = "finance.business_timezone";

/** Milliseconds between UTC and the named zone at that instant. */
function zoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asIfUtc - at.getTime();
}

/** The UTC instants that bound one business day in the given zone. */
export function businessDayRange(
  dateIso: string,
  timeZone: string,
): { start: string; end: string } {
  const [y, m, d] = dateIso.split("-").map(Number);
  const startGuess = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  const endGuess = startGuess + 24 * 60 * 60 * 1000;
  const start = startGuess - zoneOffsetMs(new Date(startGuess), timeZone);
  const end = endGuess - zoneOffsetMs(new Date(endGuess), timeZone);
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
}

/** The date, in the configured zone, that "today" means for the business. */
function todayInZone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts;
}

async function businessTimezone(): Promise<string> {
  const { data } = await supabaseAdmin
    .from("system_settings")
    .select("value")
    .eq("key", BUSINESS_TIMEZONE_KEY)
    .maybeSingle();
  const configured = (data as { value?: unknown } | null)?.value;
  const zone = typeof configured === "string" && configured.trim() ? configured.trim() : "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return zone;
  } catch {
    return "UTC";
  }
}

export type DayTotals = {
  date: string;
  timezone: string;
  windowStart: string;
  windowEnd: string;
  income: number;
  expense: number;
  net: number;
  transactions: number;
  truncated: boolean;
};

/**
 * Income and expense for one business day, summed over every transaction in
 * that day. Rows are read here in pages and never sent to the browser; only
 * the totals are.
 */
export async function financeDayTotals(input?: {
  date?: string | undefined;
  timezone?: string | undefined;
}): Promise<DayTotals> {
  const timezone = input?.timezone?.trim() || (await businessTimezone());
  const date = input?.date?.trim() || todayInZone(timezone);
  const { start, end } = businessDayRange(date, timezone);

  const pageSize = 1000;
  const maxPages = 50; // 50,000 transactions in one day before we say so
  let income = 0;
  let expense = 0;
  let count = 0;
  let truncated = false;

  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;
    const { data, error } = await supabaseAdmin
      .from("finance_transactions")
      .select("direction, amount, status")
      .gte("occurred_at", start)
      .lt("occurred_at", end)
      .range(from, from + pageSize - 1);
    if (error) fail(error.message);
    const rows = (data ?? []) as unknown as {
      direction: string;
      amount: number | string;
      status: string;
    }[];
    for (const row of rows) {
      // Only money that actually moved counts towards the day.
      if (row.status !== "completed" && row.status !== "success") continue;
      const value = Number(row.amount ?? 0);
      if (row.direction === "credit") income += value;
      else if (row.direction === "debit") expense += value;
      count += 1;
    }
    if (rows.length < pageSize) break;
    if (page === maxPages - 1) truncated = true;
  }

  return {
    date,
    timezone,
    windowStart: start,
    windowEnd: end,
    income: Number(income.toFixed(2)),
    expense: Number(expense.toFixed(2)),
    net: Number((income - expense).toFixed(2)),
    transactions: count,
    truncated,
  };
}

/**
 * Rows for an export, taken from the database for the range that was asked
 * for.
 *
 * The export panel filtered whatever the browser already held — the newest
 * five hundred transactions, two hundred expenses, two hundred invoices — so
 * choosing a range older than that window produced a file that was missing
 * rows and said nothing about it. An export that quietly drops records is
 * worse than one that refuses.
 *
 * The range is applied in the query, the rows are paged here, and the caller
 * is told whether the cap was reached instead of being handed a short file.
 */
export type ExportDataset = "transactions" | "expenses" | "invoices" | "daily-metrics";

const EXPORT_SOURCES: Record<ExportDataset, { table: string; dateColumn: string }> = {
  transactions: { table: "finance_transactions", dateColumn: "occurred_at" },
  expenses: { table: "finance_expenses", dateColumn: "expense_date" },
  invoices: { table: "finance_invoices", dateColumn: "issue_date" },
  "daily-metrics": { table: "finance_daily_metrics", dateColumn: "metric_date" },
};

export async function financeExportRows(input: {
  dataset: ExportDataset;
  from?: string | undefined;
  to?: string | undefined;
}): Promise<{ rows: Record<string, unknown>[]; truncated: boolean; total: number }> {
  const source = EXPORT_SOURCES[input.dataset];
  if (!source) fail("Unknown export dataset");

  const pageSize = 1000;
  const maxRows = 50_000;
  const rows: Record<string, unknown>[] = [];
  let truncated = false;

  for (let page = 0; page * pageSize < maxRows; page += 1) {
    let query = supabaseAdmin
      .from(source.table)
      .select("*")
      .order(source.dateColumn, { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (input.from) query = query.gte(source.dateColumn, input.from);
    if (input.to) {
      // The picker gives a day; include everything that happened inside it.
      const end = new Date(new Date(input.to).getTime() + 86_400_000).toISOString();
      query = query.lt(source.dateColumn, end);
    }
    const { data, error } = await query;
    if (error) fail(error.message);
    const batch = (data ?? []) as unknown as Record<string, unknown>[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    if (rows.length >= maxRows) {
      truncated = true;
      break;
    }
  }

  return { rows, truncated, total: rows.length };
}

export type PaymentTotals = {
  incoming: number;
  outgoing: number;
  failed: number;
  pending: number;
  partial: number;
  transactions: number;
  truncated: boolean;
};

/**
 * The five payment figures, summed over the whole table.
 *
 * Payment Management computed these from the newest five hundred rows the
 * browser had fetched. With four hundred transactions that is the whole table
 * and the numbers are right; past that they under-report without saying so,
 * which is the worst way for a financial figure to be wrong. The sums are done
 * here, in pages, and only the totals travel.
 */
export async function financePaymentTotals(): Promise<PaymentTotals> {
  const pageSize = 1000;
  const maxPages = 200;
  const totals: PaymentTotals = {
    incoming: 0,
    outgoing: 0,
    failed: 0,
    pending: 0,
    partial: 0,
    transactions: 0,
    truncated: false,
  };

  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;
    const { data, error } = await supabaseAdmin
      .from("finance_transactions")
      .select("direction, amount, status")
      .range(from, from + pageSize - 1);
    if (error) fail(error.message);
    const rows = (data ?? []) as unknown as {
      direction: string;
      amount: number | string;
      status: string;
    }[];
    for (const row of rows) {
      const value = Number(row.amount ?? 0);
      totals.transactions += 1;
      if (row.direction === "credit") totals.incoming += value;
      else if (row.direction === "debit") totals.outgoing += value;
      if (row.status === "failed") totals.failed += value;
      else if (row.status === "pending") totals.pending += value;
      else if (row.status === "partial") totals.partial += value;
    }
    if (rows.length < pageSize) break;
    if (page === maxPages - 1) totals.truncated = true;
  }

  for (const key of ["incoming", "outgoing", "failed", "pending", "partial"] as const) {
    totals[key] = Number(totals[key].toFixed(2));
  }
  return totals;
}
