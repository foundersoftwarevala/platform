/**
 * Turn a settled order into an invoice and a ledger entry.
 *
 * A paid marketplace order issued a licence and credited the author, and then
 * the money vanished from the business's point of view: `finance_invoices` had
 * no row for it and `finance_transactions` had no entry, so the Finance
 * Manager could not see a single real sale. The 121 invoices it did show were
 * all seeded in one second on 2026-08-20.
 *
 * This runs in the settlement path, after PayU has been verified and after the
 * customer has their licence. It writes into the Finance Manager's own tables
 * rather than inventing a parallel set.
 *
 * Idempotent by invoice number: the number is derived from the order, so a
 * duplicate webhook, a PayU retry and a manual replay all find the invoice
 * that already exists instead of issuing a second one. Issuing a customer two
 * invoices for one payment is worse than issuing none.
 *
 * `finance_invoices` has no order_id column, so the order is recorded inside
 * `line_items` and in the transaction's reference. A proper foreign key would
 * be better and needs a migration; this keeps the link real and queryable in
 * the meantime.
 */

type OrderRow = {
  id: string;
  order_no: string | null;
  buyer_id: string | null;
  user_id: string | null;
  total: number | string | null;
  subtotal: number | string | null;
  tax_total: number | string | null;
  discount_total: number | string | null;
  currency: string | null;
  payu_txn_id: string | null;
  payment_gateway: string | null;
};

type ItemRow = {
  id: string;
  product_name: string | null;
  quantity: number | null;
  unit_amount: number | string | null;
  line_total: number | string | null;
};

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const money = (n: number): number => Math.round(n * 100) / 100;

function supabaseUrl(): string {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

/** Derived from the order, so it is the same number every time it is asked for. */
export function invoiceNumberFor(order: { id: string; order_no: string | null }): string {
  const base = (order.order_no ?? "").trim();
  if (base) return `SV-${base}`;
  return `SV-${order.id.replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

export type InvoiceOutcome = {
  ok: boolean;
  created: boolean;
  invoiceNo?: string;
  invoiceId?: string;
  error?: string;
};

export async function recordInvoiceForOrder(orderId: string): Promise<InvoiceOutcome> {
  if (!supabaseUrl() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, created: false, error: "Supabase is not configured" };
  }

  const orderResponse = await rest(
    `marketplace_orders?select=id,order_no,buyer_id,user_id,total,subtotal,tax_total,` +
      `discount_total,currency,payu_txn_id,payment_gateway&id=eq.${encodeURIComponent(orderId)}&limit=1`,
  );
  if (!orderResponse.ok) return { ok: false, created: false, error: "Could not read the order" };
  const order = ((await orderResponse.json()) as OrderRow[])[0];
  if (!order) return { ok: false, created: false, error: "No such order" };

  const invoiceNo = invoiceNumberFor(order);

  // Already invoiced? Then this is a replay.
  const existing = await rest(
    `finance_invoices?select=id&invoice_no=eq.${encodeURIComponent(invoiceNo)}&limit=1`,
  );
  if (existing.ok) {
    const rows = (await existing.json()) as { id: string }[];
    if (rows.length) return { ok: true, created: false, invoiceNo, invoiceId: rows[0].id };
  }

  const itemsResponse = await rest(
    `marketplace_order_items?select=id,product_name,quantity,unit_amount,line_total` +
      `&order_id=eq.${encodeURIComponent(orderId)}`,
  );
  const items = itemsResponse.ok ? ((await itemsResponse.json()) as ItemRow[]) : [];

  // Who bought it. The name is only what the account already carries.
  let clientName = "Marketplace customer";
  const buyerId = order.buyer_id ?? order.user_id;
  if (buyerId) {
    const profile = await rest(
      `profiles?select=full_name,email,username&id=eq.${encodeURIComponent(buyerId)}&limit=1`,
    );
    if (profile.ok) {
      const rows = (await profile.json()) as
        { full_name: string | null; email: string | null; username: string | null }[];
      clientName = rows[0]?.full_name || rows[0]?.email || rows[0]?.username || clientName;
    }
  }

  const lineTotal = items.reduce((sum, i) => sum + num(i.line_total ?? num(i.unit_amount) * num(i.quantity ?? 1)), 0);
  const subtotal = money(num(order.subtotal) || lineTotal || num(order.total));
  const tax = money(num(order.tax_total));
  const total = money(num(order.total) || subtotal + tax);
  const today = new Date().toISOString().slice(0, 10);

  const invoiceResponse = await rest("finance_invoices", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      invoice_no: invoiceNo,
      doc_type: "invoice",
      client_name: clientName,
      client_type: "user",
      subtotal,
      tax_amount: tax,
      total,
      status: "paid",
      auto_generated: true,
      issue_date: today,
      // The column is NOT NULL and a paid invoice is not owed later.
      due_date: today,
      paid_at: new Date().toISOString(),
      line_items: [
        // The order this invoice is for. There is no order_id column yet, so
        // the link lives here and in the ledger reference.
        { order_id: order.id, order_no: order.order_no, currency: order.currency ?? "USD",
          gateway: order.payment_gateway ?? "payu", provider_txn: order.payu_txn_id },
        ...items.map((i) => ({
          description: i.product_name ?? "Marketplace product",
          qty: num(i.quantity ?? 1),
          rate: money(num(i.unit_amount)),
          amount: money(num(i.line_total)),
        })),
      ],
    }),
  });

  if (!invoiceResponse.ok) {
    const detail = await invoiceResponse.text();
    // A unique violation means another attempt won the race; that invoice stands.
    if (invoiceResponse.status === 409) {
      return { ok: true, created: false, invoiceNo, error: "already issued" };
    }
    console.error("[invoicing] invoice insert failed", invoiceResponse.status, detail.slice(0, 300));
    return { ok: false, created: false, error: `Invoice insert failed (${invoiceResponse.status})` };
  }

  const invoice = ((await invoiceResponse.json()) as { id: string }[])[0];

  // The itemised child rows, so the invoice can be read line by line.
  if (items.length && invoice?.id) {
    await rest("finance_invoice_items", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(
        items.map((i) => ({
          invoice_id: invoice.id,
          description: i.product_name ?? "Marketplace product",
          quantity: num(i.quantity ?? 1),
          unit_amount: money(num(i.unit_amount)),
          tax_amount: 0,
          discount_amount: 0,
        })),
      ),
    }).catch(() => undefined);
  }

  // The ledger entry. Money in, against the order it came from.
  await rest("finance_transactions", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      txn_code: invoiceNo,
      direction: "credit",
      amount: total,
      counterparty: clientName,
      counterparty_type: "user",
      category: "Marketplace Sale",
      gateway: order.payment_gateway ?? "payu",
      method: (order.payment_gateway ?? "payu") === "payu" ? "PayU" : "Bank Transfer",
      status: "completed",
      occurred_at: new Date().toISOString(),
      notes: `Order ${order.order_no ?? order.id}` +
        (order.payu_txn_id ? ` · provider txn ${order.payu_txn_id}` : ""),
    }),
  }).catch(() => undefined);

  return { ok: true, created: true, invoiceNo, invoiceId: invoice?.id };
}
