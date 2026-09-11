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

/**
 * One entry in the ledger, written once.
 *
 * Every money movement in Finance Manager posts through here, keyed on a code
 * derived from the record that caused it — an invoice number, a refund code, a
 * payout code, or the row id for the tables that carry no code of their own.
 * Re-running the same action finds the entry that exists rather than posting a
 * second one, which is what makes an operator's double click, a retried
 * request and a replayed webhook all safe.
 */
export async function recordLedgerOnce(entry: {
  txnCode: string;
  direction: "credit" | "debit";
  amount: number;
  counterparty: string;
  counterpartyType: string;
  category: string;
  method: string;
  notes: string;
  gateway?: string;
}): Promise<void> {
  if (!entry.txnCode || !(entry.amount > 0)) return;
  const { data: existing } = await supabaseAdmin
    .from("finance_transactions")
    .select("id")
    .eq("txn_code", entry.txnCode)
    .limit(1);
  if ((existing ?? []).length) return;

  await supabaseAdmin.from("finance_transactions").insert({
    txn_code: entry.txnCode,
    direction: entry.direction,
    amount: entry.amount,
    counterparty: entry.counterparty,
    counterparty_type: entry.counterpartyType,
    category: entry.category,
    gateway: entry.gateway ?? "manual",
    method: entry.method,
    status: "completed",
    occurred_at: new Date().toISOString(),
    notes: entry.notes,
  } as never);
}

export async function updatePayoutStatus(input: {
  id: string;
  status: "approved" | "rejected" | "processing" | "paid" | "on_hold";
  actor: string;
  note?: string | undefined;
}) {
  const { data: payoutBefore } = await supabaseAdmin
    .from("finance_payouts")
    .select("payout_code, recipient_name, recipient_type, amount, method, status")
    .eq("id", input.id)
    .maybeSingle();
  const priorPayout = payoutBefore as unknown as {
    payout_code: string;
    recipient_name: string | null;
    recipient_type: string | null;
    amount: number | string;
    method: string | null;
    status: string;
  } | null;
  if (priorPayout?.status === "paid" && input.status === "paid") return ok(priorPayout);

  const patch: Json = { status: input.status, reviewer_note: input.note ?? null };
  if (input.status === "paid") patch["processed_at"] = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("finance_payouts")
    .update(patch as never)
    .eq("id", input.id)
    .select("*")
    .single();
  if (error) fail(error.message);

  // Money leaving for a partner is a ledger event.
  if (input.status === "paid" && priorPayout) {
    await recordLedgerOnce({
      txnCode: priorPayout.payout_code,
      direction: "debit",
      amount: Number(priorPayout.amount ?? 0),
      counterparty: priorPayout.recipient_name ?? "Partner",
      counterpartyType: priorPayout.recipient_type ?? "partner",
      category: "Payout",
      method: priorPayout.method ?? "Manual",
      notes: `Payout ${priorPayout.payout_code} to ${priorPayout.recipient_name ?? "partner"}`,
    });
  }

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

  // Money leaves through the provider that took it, before anything here says
  // it left. A card payment that is only marked REFUNDED in this database is a
  // customer who was told they were refunded and never was.
  let providerRefundId: string | null = null;
  let providerName: string | null = null;
  if (input.status === "processed") {
    const { refundThroughProvider } = await import("@/lib/commerce/settlement");
    const outcome = await refundThroughProvider({
      invoiceNo: refund.invoice_no,
      amount,
    });
    if ("ok" in outcome && !outcome.ok) {
      fail(`The refund was not issued: ${outcome.error}`);
    }
    if ("ok" in outcome && outcome.ok) {
      providerRefundId = outcome.providerRefundId;
      providerName = outcome.provider;
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
      provider: providerName,
      provider_refund_id: providerRefundId,
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
  const { resolvePayuConfig } = await import("@/lib/commerce/payu");
  const { CARD_ADAPTERS, CARD_GATEWAYS, resolveCardConfig } = await import(
    "@/lib/commerce/card-gateways"
  );
  const payuReady = Boolean(await resolvePayuConfig());

  const notImplemented = (name: string): GatewayReadiness => ({
    adapter: false,
    credentials: false,
    state: "NOT_IMPLEMENTED",
    detail: `No server-side ${name} adapter exists in this project yet.`,
  });

  // Each hosted card provider now has a real adapter — a checkout it hosts, a
  // verify call, signature checking and refunds — so its readiness is a
  // question of credentials rather than of code.
  const cards = await Promise.all(
    CARD_GATEWAYS.map(async (code) => {
      const ready = Boolean(await resolveCardConfig(code));
      const name = CARD_ADAPTERS[code].displayName;
      return [
        code,
        {
          adapter: true,
          credentials: ready,
          state: ready ? ("READY" as const) : ("NOT_CONFIGURED" as const),
          detail: ready
            ? `Hosted checkout, server verification, signed webhook and refunds are in place for ${name}.`
            : `Adapter and webhook exist. Add the secret key and webhook secret to the ${name} rail's configuration in Finance Manager, then enable the rail.`,
        },
      ] as const;
    }),
  );

  return {
    payu: {
      adapter: true,
      credentials: payuReady,
      state: payuReady ? "READY" : "NOT_CONFIGURED",
      detail: payuReady
        ? "Adapter, verification and webhook are in place."
        : "Adapter and webhook exist. Add the merchant key and salt to the PayU rail's configuration in Finance Manager, or set them in the server environment.",
    },
    ...Object.fromEntries(cards),
    upi: notImplemented("UPI"),
    bank: notImplemented("bank transfer"),
    paypal: notImplemented("PayPal"),
    crypto: notImplemented("crypto"),
  };
}

/** Read a rail row over REST, on the service key, without the typed client. */
async function railRest(path: string): Promise<unknown[]> {
  const url = process.env.SUPABASE_URL?.trim() ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!url || !key) return [];
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!response.ok) return [];
  return (await response.json()) as unknown[];
}

/** Write to a rail row over REST, for the same reason. */
async function railWrite(path: string, body: Record<string, unknown>): Promise<boolean> {
  const url = process.env.SUPABASE_URL?.trim() ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!url || !key) return false;
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  return response.ok;
}

/**
 * What an operator may see about a card gateway's configuration.
 *
 * A secret that has been entered is reported as present and never returned.
 * The whole point of keeping credentials in configuration_state.secrets is that
 * they go in and do not come back out, so this says which fields are filled and
 * stops there.
 */
export type CardGatewaySettings = {
  code: string;
  displayName: string;
  enabled: boolean;
  hasSecretKey: boolean;
  hasPublicKey: boolean;
  hasWebhookSecret: boolean;
  apiBaseUrl: string;
  appBaseUrl: string;
  webhookUrl: string;
  supportedCurrencies: string[];
  supportedCountries: string[];
};

export async function cardGatewaySettings(): Promise<CardGatewaySettings[]> {
  const { CARD_ADAPTERS, CARD_GATEWAYS } = await import("@/lib/commerce/card-gateways");
  const codes = CARD_GATEWAYS as readonly string[];

  // finance_payment_rails predates the generated Supabase types, so it is read
  // over REST exactly as lib/commerce/payu.ts already reads it rather than by
  // loosening the typed client for the whole application.
  const data = await railRest(
    `finance_payment_rails?select=code,display_name,enabled,configuration_state,` +
      `supported_currencies,supported_countries&code=in.(${codes.join(",")})`,
  );

  const rows = (data ?? []) as unknown as {
    code: string;
    display_name: string | null;
    enabled: boolean | null;
    configuration_state: Record<string, unknown> | null;
    supported_currencies: string[] | null;
    supported_countries: string[] | null;
  }[];

  const appBase = process.env.APP_BASE_URL?.trim() || "https://softwarevala.net";

  return CARD_GATEWAYS.map((code) => {
    const row = rows.find((r) => r.code === code);
    const state = (row?.configuration_state ?? {}) as Record<string, unknown>;
    const secrets = (state["secrets"] ?? {}) as Record<string, unknown>;
    const adapter = CARD_ADAPTERS[code];
    return {
      code,
      displayName: String(row?.display_name ?? adapter.displayName),
      enabled: Boolean(row?.enabled),
      hasSecretKey: Boolean(String(secrets["secret_key"] ?? "").trim()),
      hasPublicKey: Boolean(String(secrets["public_key"] ?? "").trim()),
      hasWebhookSecret: Boolean(String(secrets["webhook_secret"] ?? "").trim()),
      apiBaseUrl: String(state["api_base_url"] ?? "").trim() || adapter.defaultApiBaseUrl,
      appBaseUrl: String(state["app_base_url"] ?? "").trim() || appBase,
      // The address to paste into the provider's dashboard. There is one
      // webhook endpoint for every provider; the query parameter is only a
      // fallback for a provider that sends no identifying header.
      webhookUrl: `${String(state["app_base_url"] ?? "").trim() || appBase}/api/payment/webhook?provider=${code}`,
      supportedCurrencies: (row?.supported_currencies ?? []).map((c) => String(c)),
      supportedCountries: (row?.supported_countries ?? []).map((c) => String(c)),
    };
  });
}

/**
 * Store a card gateway's credentials on its rail.
 *
 * Secrets are merged, not replaced, so rotating one key does not silently wipe
 * the others. They are written into configuration_state.secrets — the same
 * place PayU's merchant key and salt live — which the data layer strips before
 * any row reaches a browser. The values themselves are never echoed back and
 * never written to the audit trail; the audit records which fields changed.
 */
export async function saveCardGatewayCredentials(input: {
  code: string;
  secretKey?: string | undefined;
  publicKey?: string | undefined;
  webhookSecret?: string | undefined;
  apiBaseUrl?: string | undefined;
  appBaseUrl?: string | undefined;
  enabled?: boolean | undefined;
  actor: string;
}) {
  const { CARD_ADAPTERS, isCardGateway } = await import("@/lib/commerce/card-gateways");
  if (!isCardGateway(input.code)) fail("That is not a card gateway.");
  const adapter = CARD_ADAPTERS[input.code];

  const existing = await railRest(
    `finance_payment_rails?select=id,configuration_state,enabled` +
      `&code=eq.${encodeURIComponent(input.code)}&limit=1`,
  );
  const row = (existing[0] ?? null) as {
    id: string;
    configuration_state: Record<string, unknown> | null;
    enabled: boolean | null;
  } | null;
  if (!row) {
    fail(
      `The ${adapter.displayName} rail does not exist yet. Run the card payment rails migration.`,
    );
  }

  const state = { ...((row.configuration_state ?? {}) as Record<string, unknown>) };
  const secrets = { ...((state["secrets"] ?? {}) as Record<string, unknown>) };
  const changed: string[] = [];

  const put = (key: string, value: string | undefined) => {
    if (value === undefined) return;
    const clean = value.trim();
    if (clean) secrets[key] = clean;
    else delete secrets[key];
    changed.push(key);
  };
  put("secret_key", input.secretKey);
  put("public_key", input.publicKey);
  put("webhook_secret", input.webhookSecret);

  if (input.apiBaseUrl !== undefined) {
    state["api_base_url"] = input.apiBaseUrl.trim();
    changed.push("api_base_url");
  }
  if (input.appBaseUrl !== undefined) {
    state["app_base_url"] = input.appBaseUrl.trim();
    changed.push("app_base_url");
  }
  state["secrets"] = secrets;

  // A rail cannot be switched on without the two things a payment needs: a key
  // to charge with and a secret to check the callback against. Enabling one
  // without them puts a payment route in front of a customer that cannot
  // complete and whose webhook could not be trusted if it did.
  const nextEnabled = input.enabled ?? Boolean(row.enabled);
  if (nextEnabled) {
    if (!String(secrets["secret_key"] ?? "").trim()) {
      fail(`${adapter.displayName} needs a secret key before it can be enabled.`);
    }
    if (!String(secrets["webhook_secret"] ?? "").trim()) {
      fail(`${adapter.displayName} needs a webhook secret before it can be enabled.`);
    }
  }

  const written = await railWrite(
    `finance_payment_rails?id=eq.${encodeURIComponent(row.id)}`,
    {
      configuration_state: state,
      enabled: nextEnabled,
      health_status: nextEnabled ? "healthy" : "unconfigured",
      updated_at: new Date().toISOString(),
    },
  );
  if (!written) fail("The credentials could not be saved.");

  await writeAudit({
    actor: input.actor,
    action: "gateway.credentials",
    entity: "finance_payment_rails",
    entity_ref: input.code,
    severity: "critical",
    // Which fields were touched, never what they were set to.
    details: { fields: changed, enabled: nextEnabled },
  });

  return ok({ code: input.code, enabled: nextEnabled });
}

/* -------------------------------------------------------------------------- */
/* Manual rails: Wise, bank transfer, UPI, Binance                              */
/* -------------------------------------------------------------------------- */

/**
 * The rails a person settles. Checkout offers one only when it is enabled here
 * (payment-routing.ts), and hands the customer its pay link and instructions
 * (initiate.ts) - but nothing in Finance Manager could switch one on or give it
 * a link. The Payment Methods screen said "not enabled in Finance Manager" with
 * no control to change that, so checkout had no method to offer at all.
 */
export const MANUAL_RAIL_CODES = ["wise", "upi", "bank_transfer", "binance"] as const;
export type ManualRailCode = (typeof MANUAL_RAIL_CODES)[number];

export type ManualRailSettings = {
  code: ManualRailCode;
  displayName: string;
  enabled: boolean;
  payLink: string;
  instructions: string;
  /** Bank transfer only. Shown to operators; never the account number. */
  accountName: string;
  bankName: string;
  accountLast4: string;
};

function isManualRail(code: string): code is ManualRailCode {
  return (MANUAL_RAIL_CODES as readonly string[]).includes(code);
}

export async function manualRailSettings(): Promise<ManualRailSettings[]> {
  const data = (await railRest(
    `finance_payment_rails?select=code,display_name,enabled,configuration_state` +
      `&code=in.(${MANUAL_RAIL_CODES.join(",")})`,
  )) as {
    code: string;
    display_name: string | null;
    enabled: boolean | null;
    configuration_state: Record<string, unknown> | null;
  }[];
  return data
    .filter((row) => isManualRail(row.code))
    .map((row) => {
      const state = (row.configuration_state ?? {}) as Record<string, unknown>;
      const text = (key: string) => String(state[key] ?? "").trim();
      return {
        code: row.code as ManualRailCode,
        displayName: String(row.display_name ?? row.code),
        enabled: Boolean(row.enabled),
        payLink: text("pay_link"),
        instructions: text("instructions"),
        accountName: text("account_name"),
        bankName: text("bank_name"),
        accountLast4: text("account_last4"),
      };
    })
    .sort((a, b) => MANUAL_RAIL_CODES.indexOf(a.code) - MANUAL_RAIL_CODES.indexOf(b.code));
}

/**
 * Save a manual rail's settings. The configuration is merged, never replaced,
 * so anything else stored on the rail - including a `secrets` block - is kept.
 * Only the last four characters of a bank account are ever stored here: the
 * masked view is all Finance Manager shows, and support gives the rest.
 */
export async function saveManualRailSettings(input: {
  code: string;
  enabled?: boolean | undefined;
  payLink?: string | undefined;
  instructions?: string | undefined;
  accountName?: string | undefined;
  bankName?: string | undefined;
  accountLast4?: string | undefined;
  actor: string;
}) {
  if (!isManualRail(input.code)) fail("That is not a manual payment rail.");

  const existing = (await railRest(
    `finance_payment_rails?select=id,enabled,configuration_state` +
      `&code=eq.${encodeURIComponent(input.code)}&limit=1`,
  )) as { id: string; enabled: boolean | null; configuration_state: Record<string, unknown> | null }[];
  const row = existing[0];
  if (!row) fail("That rail does not exist.");

  const state = { ...((row.configuration_state ?? {}) as Record<string, unknown>) };
  const changed: string[] = [];
  const put = (key: string, value: string | undefined, max: number) => {
    if (value === undefined) return;
    const clean = value.trim().slice(0, max);
    if (clean) state[key] = clean;
    else delete state[key];
    changed.push(key);
  };

  if (input.payLink !== undefined) {
    const link = input.payLink.trim();
    if (link && !/^https:\/\/[^\s]+$/i.test(link)) fail("The pay link must be a full https:// address.");
  }
  if (input.accountLast4 !== undefined) {
    const last4 = input.accountLast4.replace(/\s/g, "");
    if (last4 && !/^[0-9A-Za-z]{2,4}$/.test(last4)) {
      fail("Store only the last four characters of the account, never the full number.");
    }
  }
  put("pay_link", input.payLink, 500);
  put("instructions", input.instructions, 1000);
  put("account_name", input.accountName, 120);
  put("bank_name", input.bankName, 120);
  put("account_last4", input.accountLast4?.replace(/\s/g, ""), 4);

  // A rail is offered to customers only when they can actually pay on it:
  // Wise needs its link; the others need a link or written instructions.
  const nextEnabled = input.enabled ?? Boolean(row.enabled);
  if (nextEnabled) {
    const link = String(state["pay_link"] ?? "").trim();
    const how = String(state["instructions"] ?? "").trim();
    if (input.code === "wise" && !link) fail("Add the Wise pay link before enabling Wise.");
    if (input.code !== "wise" && !link && !how) {
      fail("Add a pay link or payment instructions before enabling this method.");
    }
  }

  const written = await railWrite(`finance_payment_rails?id=eq.${encodeURIComponent(row.id)}`, {
    configuration_state: state,
    enabled: nextEnabled,
    updated_at: new Date().toISOString(),
  });
  if (!written) fail("The payment method could not be saved.");

  await writeAudit({
    actor: input.actor,
    action: "rail.manual_settings",
    entity: "finance_payment_rails",
    entity_ref: input.code,
    severity: "critical",
    details: { fields: changed, enabled: nextEnabled },
  });
  return ok({ code: input.code, enabled: nextEnabled });
}

/**
 * Finance confirms that a manual payment arrived.
 *
 * The customer paid on Wise, a bank transfer, UPI or Binance using the order's
 * reference; nothing on the site can see that money arrive, so the order sat
 * at pending_payment for ever - there was no path by which a manual-rail order
 * could become paid. An operator who has checked the receiving account now
 * records the provider's own transaction id against the reference, and the
 * order is settled through exactly the path a verified gateway payment takes:
 * the amount is checked against the order, the payment row, licence, ledger and
 * invoice are written once, and a second confirmation is a replay, not a
 * second sale.
 */
export async function confirmManualPayment(input: {
  reference: string;
  transactionId: string;
  amount?: number | undefined;
  actor: string;
  actorRole: string;
}) {
  const reference = input.reference.trim();
  const transactionId = input.transactionId.trim();
  if (!reference) fail("Enter the order's payment reference.");
  if (transactionId.length < 4) {
    fail("Enter the transaction id shown in Wise, the bank statement, UPI or Binance.");
  }

  const { orderForReference, settleVerifiedPayment } = await import("@/lib/commerce/settlement");
  const order = await orderForReference(reference);
  if (!order) fail("No order carries that payment reference.");
  if (!isManualRail(order.gateway)) {
    fail("That order was not placed on a manual payment method; its provider confirms it.");
  }
  if (order.status === "paid") return ok({ orderId: order.id, orderNumber: order.orderNumber, replay: true });
  if (!["pending_payment", "pending", "payment_failed"].includes(order.status)) {
    fail(`That order is ${order.status}; only an order awaiting payment can be confirmed.`);
  }

  // The amount that actually arrived, as the operator read it off the
  // statement. Defaulting it to the order's own amount compared the order with
  // itself, so a buyer who sent $200 of $249 — or a transfer Wise shaved its
  // fee off — was settled in full while the panel said the amount was checked.
  if (!(typeof input.amount === "number" && Number.isFinite(input.amount) && input.amount > 0)) {
    fail("Enter the amount that arrived, exactly as the statement shows it.");
  }
  const observed = Number(input.amount);

  // One transfer pays one order. A transaction id already confirmed against a
  // different reference is refused here, so the same Wise or bank transfer id
  // cannot be entered again to activate a second order.
  const { data: earlier } = await supabaseAdmin
    .from("finance_audit_logs")
    .select("entity_ref, details")
    .eq("action", "payment.manual_confirmed")
    .eq("details->>transaction_id", transactionId)
    .eq("details->>settled", "true")
    .limit(5);
  const usedElsewhere = ((earlier ?? []) as { entity_ref: string; details: { reference?: string } | null }[])
    .find((row) => String(row.details?.reference ?? "") !== reference);
  if (usedElsewhere) {
    fail(
      `That transaction id already confirmed order ${usedElsewhere.entity_ref}. ` +
        "One transfer can only pay one order.",
    );
  }

  const result = await settleVerifiedPayment({
    order,
    provider: order.gateway,
    reference,
    providerPaymentId: transactionId,
    providerStatus: "manually_verified",
    observedAmount: Number.isFinite(observed) ? Number(observed) : null,
    observedCurrency: order.currencyCharged,
    eventKey: `manual:${reference}`,
    correlationId: null,
  });

  await writeAudit({
    actor: input.actor,
    actor_role: input.actorRole,
    action: "payment.manual_confirmed",
    entity: "marketplace_orders",
    entity_ref: order.orderNumber,
    severity: "critical",
    details: {
      reference,
      gateway: order.gateway,
      transaction_id: transactionId,
      observed_amount: observed,
      settled: result.ok,
      reason: result.ok ? null : result.reason,
    },
  });

  if (!result.ok) fail(result.reason);
  return ok({ orderId: order.id, orderNumber: order.orderNumber, replay: result.replay });
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
  const { data: expenseBefore } = await supabaseAdmin
    .from("finance_expenses")
    .select("id, vendor, category, amount, status")
    .eq("id", input.id)
    .maybeSingle();
  const priorExpense = expenseBefore as unknown as {
    id: string;
    vendor: string | null;
    category: string | null;
    amount: number | string;
    status: string;
  } | null;
  if (priorExpense?.status === "reimbursed" && input.status === "reimbursed") {
    return ok(priorExpense);
  }

  const { data, error } = await supabaseAdmin
    .from("finance_expenses")
    .update({ status: input.status } as never)
    .eq("id", input.id)
    .select("*")
    .single();
  if (error) fail(error.message);

  // A reimbursed expense is money that has actually left.
  if (input.status === "reimbursed" && priorExpense) {
    await recordLedgerOnce({
      txnCode: `EXP-${priorExpense.id.replace(/-/g, "").slice(0, 12).toUpperCase()}`,
      direction: "debit",
      amount: Number(priorExpense.amount ?? 0),
      counterparty: priorExpense.vendor ?? "Vendor",
      counterpartyType: "vendor",
      category: `Expense · ${priorExpense.category ?? "general"}`,
      method: "Manual",
      notes: `Expense reimbursed to ${priorExpense.vendor ?? "vendor"}`,
    });
  }

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
  const { data: commissionBefore } = await supabaseAdmin
    .from("finance_commissions")
    .select("id, partner_name, partner_type, commission_amount, period, status")
    .eq("id", input.id)
    .maybeSingle();
  const priorCommission = commissionBefore as unknown as {
    id: string;
    partner_name: string | null;
    partner_type: string | null;
    commission_amount: number | string;
    period: string | null;
    status: string;
  } | null;
  if (priorCommission?.status === "paid" && input.status === "paid") return ok(priorCommission);

  const { data, error } = await supabaseAdmin
    .from("finance_commissions")
    .update({ status: input.status } as never)
    .eq("id", input.id)
    .select("*")
    .single();
  if (error) fail(error.message);

  // Commission paid out is money leaving, against the partner it went to.
  if (input.status === "paid" && priorCommission) {
    await recordLedgerOnce({
      txnCode: `CMS-${priorCommission.id.replace(/-/g, "").slice(0, 12).toUpperCase()}`,
      direction: "debit",
      amount: Number(priorCommission.commission_amount ?? 0),
      counterparty: priorCommission.partner_name ?? "Partner",
      counterpartyType: priorCommission.partner_type ?? "partner",
      category: "Commission",
      method: "Manual",
      notes:
        `Commission paid to ${priorCommission.partner_name ?? "partner"}` +
        (priorCommission.period ? ` for ${priorCommission.period}` : ""),
    });
  }

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
