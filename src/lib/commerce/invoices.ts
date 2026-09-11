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

// "draft" is the invoice a payment intent is bound to before any money has
// moved: it is not owed and Finance Manager does not count it as receivable.
const TO_DB: Record<string, string> = {
  paid: "paid",
  pending: "unpaid",
  failed: "overdue",
  draft: "draft",
};

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
  status?: "paid" | "pending" | "failed" | "draft";
  /**
   * The order's number. Settlement used to issue its own `INV-<order number>`
   * invoice with no meta, which this lookup could not see, so one paid order
   * ended up with two invoices. Passing the number lets that older invoice be
   * found and reused instead of duplicated.
   */
  orderNumber?: string | null;
};

/** The invoice already issued for an order, under either numbering. */
async function existingInvoiceForOrder(
  orderId: string,
  orderNumber?: string | null,
): Promise<Record<string, unknown> | null> {
  const byMeta = await fetch(
    `${url()}/rest/v1/finance_invoices?select=*` +
      `&line_items->meta->>order_id=eq.${encodeURIComponent(orderId)}&limit=1`,
    { headers: admin() },
  );
  const found = byMeta.ok ? ((await byMeta.json()) as Record<string, unknown>[]) : [];
  if (found[0]) return found[0];
  if (!orderNumber) return null;
  const byNumber = await fetch(
    `${url()}/rest/v1/finance_invoices?select=*` +
      `&invoice_no=eq.${encodeURIComponent(`INV-${orderNumber}`)}&limit=1`,
    { headers: admin() },
  );
  const older = byNumber.ok ? ((await byNumber.json()) as Record<string, unknown>[]) : [];
  return older[0] ?? null;
}

/**
 * Mark an order's invoice paid.
 *
 * The invoice a payment intent is bound to is issued as a draft before the
 * customer pays. When the money is confirmed that same document becomes the
 * paid invoice, rather than a second one being issued beside it.
 */
export async function markInvoicePaid(invoiceId: string, amount: number): Promise<boolean> {
  if (!url() || !invoiceId) return false;
  const now = new Date().toISOString();
  try {
    const response = await fetch(
      `${url()}/rest/v1/finance_invoices?id=eq.${encodeURIComponent(invoiceId)}&status=neq.paid`,
      {
        method: "PATCH",
        headers: { ...admin(), Prefer: "return=minimal" },
        body: JSON.stringify({
          status: "paid",
          paid_at: now,
          due_date: now.slice(0, 10),
          ...(amount > 0 ? { subtotal: amount, total: amount } : {}),
        }),
      },
    );
    return response.ok;
  } catch (error) {
    console.error("[invoice] could not mark paid", error);
    return false;
  }
}

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
    const existing = await existingInvoiceForOrder(input.orderId, input.orderNumber);
    if (existing) {
      // A draft issued when the payment started becomes the paid invoice.
      if (input.status === "paid" && String(existing.status ?? "") !== "paid") {
        await markInvoicePaid(String(existing.id), input.amount);
        return { invoice: { ...existing, status: "paid" }, created: false };
      }
      return { invoice: existing, created: false };
    }

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
      // NOT NULL on this table. Every insert was being rejected without it, so
      // no settled order ever produced an invoice. A paid invoice is not owed
      // later; anything else gets the customary fourteen days.
      due_date:
        status === "paid"
          ? now.slice(0, 10)
          : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
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

/**
 * The ledger entry for an invoice that has been issued.
 *
 * createInvoiceForOrder writes finance_invoices and stops there, so a paid
 * order produced a document with nothing behind it: finance_transactions had
 * no matching row, which is why the Finance Manager's ledger and its
 * reconciliation had nothing real to work with. The entry is written here,
 * against the same canonical table the rest of Finance uses — no second
 * ledger.
 *
 * Idempotent on txn_code, which is the invoice number, so a retried webhook
 * finds the entry that already exists instead of crediting the business twice.
 */
export async function recordLedgerEntryForInvoice(input: {
  invoiceNo: string;
  amount: number;
  currency: string;
  counterparty: string;
  orderNo: string;
  gateway: string;
  providerTxnId?: string | null | undefined;
  /**
   * The order's payment reference. Settlement — the database function and the
   * fallback alike — posts the sale to finance_transactions under this
   * reference before fulfilment runs. Posting it again here under the invoice
   * number credited every settled order twice, so Finance Manager's revenue was
   * double the money that actually arrived.
   */
  paymentReference?: string | null;
}): Promise<{ created: boolean; error?: string }> {
  if (!url() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { created: false, error: "Ledger is not configured" };
  }
  if (!input.invoiceNo) return { created: false, error: "No invoice number" };

  try {
    const codes = [input.invoiceNo, input.paymentReference]
      .filter((code): code is string => Boolean(code))
      .map((code) => `"${code.replace(/"/g, "")}"`)
      .join(",");
    const existingResponse = await fetch(
      `${url()}/rest/v1/finance_transactions?select=id` +
        `&txn_code=in.(${encodeURIComponent(codes)})&limit=1`,
      { headers: admin() },
    );
    if (existingResponse.ok) {
      const rows = (await existingResponse.json()) as { id: string }[];
      if (rows.length) return { created: false };
    }

    const response = await fetch(`${url()}/rest/v1/finance_transactions`, {
      method: "POST",
      headers: { ...admin(), Prefer: "return=minimal" },
      body: JSON.stringify({
        txn_code: input.invoiceNo,
        direction: "credit",
        amount: input.amount,
        counterparty: input.counterparty,
        counterparty_type: "user",
        category: "Marketplace Sale",
        gateway: input.gateway,
        method: input.gateway === "payu" ? "PayU" : "Bank Transfer",
        status: "completed",
        occurred_at: new Date().toISOString(),
        notes:
          `Order ${input.orderNo}` +
          (input.providerTxnId ? ` · provider txn ${input.providerTxnId}` : ""),
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        created: false,
        error: `Ledger insert failed (${response.status}) ${detail.slice(0, 200)}`,
      };
    }
    return { created: true };
  } catch (error) {
    return {
      created: false,
      error: error instanceof Error ? error.message : "Ledger insert failed",
    };
  }
}
