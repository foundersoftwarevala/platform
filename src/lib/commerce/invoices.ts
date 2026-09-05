/**
 * Invoices for marketplace purchases.
 *
 * `finance_invoices` has no user or order column, so the customer and the order
 * are carried inside `line_items.meta`. That is what makes an invoice belong to
 * somebody, and every read filters on it rather than checking ownership after
 * the fact.
 *
 * Its status column only accepts paid / unpaid / draft / overdue, while the
 * rest of the system talks about paid / pending / failed, so the translation
 * between the two lives here and nowhere else.
 */

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

const TO_DB: Record<string, string> = { paid: "paid", pending: "unpaid", failed: "overdue" };

export function toDbStatus(status: string): string {
  return TO_DB[String(status).toLowerCase()] ?? "unpaid";
}

export function toPortalStatus(status: string): string {
  const value = String(status ?? "").toLowerCase();
  if (value === "paid") return "paid";
  if (value === "overdue") return "failed";
  return "pending";
}

export type InvoiceMeta = {
  user_id?: string;
  order_id?: string;
  product_name?: string;
  currency?: string;
};

export function readMeta(lineItems: unknown): InvoiceMeta {
  if (!lineItems || typeof lineItems !== "object") return {};
  const meta = (lineItems as { meta?: InvoiceMeta }).meta;
  return meta && typeof meta === "object" ? meta : {};
}

/** A readable, sortable invoice number: SV-INV-20260905-4F2A. */
function invoiceNumber(): string {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const tail = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SV-INV-${day}-${tail}`;
}

export type InvoiceInput = {
  userId: string;
  orderId: string;
  amount: number;
  currency: string;
  productName?: string;
  clientName?: string;
  status?: "paid" | "pending" | "failed";
};

/**
 * Create the invoice for an order, once.
 *
 * Calling this again for the same order returns the invoice that already
 * exists, because a payment webhook is retried and a customer must never end up
 * with two invoices for one purchase.
 */
export async function createInvoiceForOrder(
  input: InvoiceInput,
): Promise<{ invoice: Record<string, unknown> | null; created: boolean; error?: string }> {
  if (!url() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { invoice: null, created: false, error: "Invoicing is not configured" };
  }

  try {
    const existingResponse = await fetch(
      `${url()}/rest/v1/finance_invoices?select=*` +
        `&line_items->meta->>order_id=eq.${encodeURIComponent(input.orderId)}&limit=1`,
      { headers: admin() },
    );
    const existing = existingResponse.ok
      ? ((await existingResponse.json()) as Record<string, unknown>[])
      : [];
    if (existing[0]) return { invoice: existing[0], created: false };

    const now = new Date().toISOString();
    const status = input.status ?? "paid";
    const row = {
      invoice_no: invoiceNumber(),
      doc_type: "invoice",
      client_name: input.clientName || "Marketplace customer",
      client_type: "customer",
      subtotal: input.amount,
      tax_amount: 0,
      total: input.amount,
      status: toDbStatus(status),
      auto_generated: true,
      issue_date: now.slice(0, 10),
      paid_at: status === "paid" ? now : null,
      line_items: {
        items: [
          {
            description: input.productName || "Software Vala lifetime licence",
            qty: 1,
            rate: input.amount,
          },
        ],
        meta: {
          user_id: input.userId,
          order_id: input.orderId,
          product_name: input.productName ?? null,
          currency: input.currency,
        },
      },
    };

    const response = await fetch(`${url()}/rest/v1/finance_invoices`, {
      method: "POST",
      headers: { ...admin(), Prefer: "return=representation" },
      body: JSON.stringify(row),
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error("[invoice] insert failed", response.status, detail);
      return { invoice: null, created: false, error: "Could not create the invoice" };
    }
    const rows = (await response.json()) as Record<string, unknown>[];
    return { invoice: rows[0] ?? null, created: true };
  } catch (error) {
    console.error("[invoice] threw", error);
    return { invoice: null, created: false, error: "Could not create the invoice" };
  }
}

/** The shape the customer portal shows. */
export function toCustomerInvoice(row: Record<string, unknown>) {
  const meta = readMeta(row.line_items);
  return {
    id: String(row.id),
    invoice_number: String(row.invoice_no ?? ""),
    product_name: meta.product_name ?? "Software Vala licence",
    amount: Number(row.total ?? 0),
    currency: meta.currency ?? "USD",
    status: toPortalStatus(String(row.status ?? "")),
    issued_date: row.issue_date ?? null,
    order_id: meta.order_id ?? null,
  };
}
