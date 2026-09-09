import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Json = Record<string, unknown>;

async function writeAudit(entry: {
  actor: string;
  action: string;
  entity: string;
  entity_ref: string;
  severity?: "info" | "warning" | "critical";
  details?: Json;
}) {
  await supabaseAdmin.from("finance_audit_logs").insert({
    actor: entry.actor,
    actor_role: "finance_manager",
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
  if (input.status === "paid") patch['processed_at'] = new Date().toISOString();

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

export async function updateRefundStatus(input: {
  id: string;
  status: "approved" | "rejected" | "processed";
  actor: string;
  note?: string | undefined;
}) {
  const patch: Json = { status: input.status, reviewer_note: input.note ?? null };
  if (input.status === "processed") patch['processed_at'] = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("finance_refunds")
    .update(patch as never)
    .eq("id", input.id)
    .select("*")
    .single();
  if (error) fail(error.message);

  await writeAudit({
    actor: input.actor,
    action: `refund.${input.status}`,
    entity: "finance_refunds",
    entity_ref: data.refund_code,
    severity: "warning",
    details: { amount: data.amount },
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

export async function updateInvoiceStatus(input: {
  id: string;
  status: "draft" | "unpaid" | "paid" | "overdue" | "cancelled";
  actor: string;
}) {
  const patch: Json = { status: input.status };
  if (input.status === "paid") patch['paid_at'] = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("finance_invoices")
    .update(patch as never)
    .eq("id", input.id)
    .select("*")
    .single();
  if (error) fail(error.message);

  await writeAudit({
    actor: input.actor,
    action: `invoice.${input.status}`,
    entity: "finance_invoices",
    entity_ref: data.invoice_no,
    details: { total: data.total },
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
  const { data, error } = await supabaseAdmin
    .rpc("finance_adjust_wallet_atomic", {
      p_wallet_id: input.walletId,
      p_amount: input.amount,
      p_entry_type: input.entryType,
      p_reason: input.reason,
      p_actor: input.actor,
      p_reference: `ADJ-${Date.now().toString(36).toUpperCase()}`,
    });
  if (error) fail(error.message);

  await writeAudit({
    actor: input.actor,
    action: `wallet.${input.entryType}`,
    entity: "finance_wallets",
    entity_ref: data.owner_code,
    severity: "warning",
    details: { amount: input.amount, reason: input.reason, balance_after: data.balance },
  });
  return ok(data);
}

export async function toggleWalletFreeze(input: { walletId: string; frozen: boolean; actor: string }) {
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

export async function setGatewayEnabled(input: { id: string; enabled: boolean; actor: string }) {
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
    const { data: plan, error: planError } = await supabaseAdmin.from("finance_plans").select("id, name, price").eq("id", input.planId).single();
    if (planError) fail(planError.message);
    patch['plan_id'] = plan.id;
    patch['amount'] = plan.price;
    patch['previous_plan'] = plan.name;
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
  const patch: Json = { provider: input.provider, service: input.service, updated_at: new Date().toISOString() };
  if (input.status !== undefined) patch['status'] = input.status;
  if (input.budget !== undefined) patch['budget'] = input.budget;
  if (input.spikeThreshold !== undefined) patch['spike_threshold'] = input.spikeThreshold;
  if (input.autoStopPercent !== undefined) patch['auto_stop_percent'] = input.autoStopPercent;
  const { data, error } = await supabaseAdmin.from("finance_ai_controls").upsert(patch as never, { onConflict: "provider,service" }).select("*").single();
  if (error) fail(error.message);
  await writeAudit({ actor: input.actor, action: "ai_billing.control_update", entity: "finance_ai_controls", entity_ref: `${input.provider}/${input.service}`, severity: "warning", details: patch });
  return ok(data);
}

export async function updateTaxRecordStatus(input: {
  id: string;
  status: "pending" | "filed" | "paid" | "overdue";
  actor: string;
}) {
  const patch: Json = { filing_status: input.status };
  if (input.status === "filed" || input.status === "paid") patch['filed_at'] = new Date().toISOString();

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
    patch['resolved_at'] = new Date().toISOString();
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

export async function updateAlertStatus(input: { id: string; status: "open" | "acknowledged" | "resolved" }) {
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
