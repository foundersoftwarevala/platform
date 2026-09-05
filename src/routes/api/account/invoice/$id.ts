import { createFileRoute } from "@tanstack/react-router";
import { readMeta, toPortalStatus } from "@/lib/commerce/invoices";

/**
 * A printable invoice.
 *
 * There is no PDF library and no file store, and adding either to hand over a
 * document would be a lot of machinery for no gain — so this returns a clean
 * printable page instead. Any browser saves it as a PDF.
 *
 * It is only ever served to the customer the invoice belongs to.
 */

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}` };
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export const Route = createFileRoute("/api/account/invoice/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const publishable =
          process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? process.env.SUPABASE_ANON_KEY?.trim();
        const authorization = request.headers.get("authorization");
        if (!url() || !publishable) return new Response("Not configured", { status: 503 });
        if (!authorization) return new Response("Sign in to open this invoice", { status: 401 });

        const userResponse = await fetch(`${url()}/auth/v1/user`, {
          headers: { apikey: publishable, Authorization: authorization },
        });
        if (!userResponse.ok) return new Response("Sign in to open this invoice", { status: 401 });
        const user = (await userResponse.json()) as { id?: string; email?: string };
        if (!user?.id) return new Response("Sign in to open this invoice", { status: 401 });

        const response = await fetch(
          `${url()}/rest/v1/finance_invoices?select=*&id=eq.${encodeURIComponent(params.id)}&limit=1`,
          { headers: admin() },
        );
        const rows = response.ok ? ((await response.json()) as Record<string, unknown>[]) : [];
        const invoice = rows[0];
        if (!invoice) return new Response("Invoice not found", { status: 404 });

        const meta = readMeta(invoice.line_items);
        if (meta.user_id && meta.user_id !== user.id) {
          return new Response("That invoice is not yours", { status: 403 });
        }

        const items =
          (invoice.line_items as { items?: { description?: string; qty?: number; rate?: number }[] })
            ?.items ?? [];
        const currency = meta.currency ?? "USD";
        const total = Number(invoice.total ?? 0);
        const status = toPortalStatus(String(invoice.status ?? ""));

        const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Invoice ${escapeHtml(invoice.invoice_no)} — Software Vala</title>
<style>
 *{box-sizing:border-box}
 body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111827;margin:0;padding:40px;background:#fff}
 .sheet{max-width:760px;margin:0 auto}
 .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111827;padding-bottom:18px}
 h1{margin:0;font-size:22px}
 .muted{color:#6b7280;font-size:13px}
 .status{display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;text-transform:uppercase}
 .paid{background:#dcfce7;color:#166534}.pending{background:#fef3c7;color:#92400e}.failed{background:#fee2e2;color:#991b1b}
 table{width:100%;border-collapse:collapse;margin-top:28px}
 th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;border-bottom:1px solid #e5e7eb;padding:8px 0}
 td{padding:12px 0;border-bottom:1px solid #f3f4f6;font-size:14px}
 .right{text-align:right}
 .total{margin-top:18px;display:flex;justify-content:flex-end;gap:40px;font-size:18px;font-weight:700}
 .foot{margin-top:40px;color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb;padding-top:14px}
 @media print{body{padding:0}.noprint{display:none}}
</style></head><body><div class="sheet">
 <div class="top">
  <div><h1>Software Vala&trade;</h1><p class="muted">Invoice ${escapeHtml(invoice.invoice_no)}</p></div>
  <div class="right">
   <span class="status ${status}">${escapeHtml(status)}</span>
   <p class="muted">Issued ${escapeHtml(invoice.issue_date ?? "")}</p>
  </div>
 </div>
 <p class="muted" style="margin-top:22px">Billed to</p>
 <p style="margin:2px 0;font-weight:600">${escapeHtml(invoice.client_name ?? user.email)}</p>
 ${meta.order_id ? `<p class="muted">Order ${escapeHtml(meta.order_id)}</p>` : ""}
 <table>
  <thead><tr><th>Description</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Amount</th></tr></thead>
  <tbody>${
    items.length
      ? items.map((item) => {
          const qty = Number(item.qty ?? 1);
          const rate = Number(item.rate ?? total);
          return `<tr><td>${escapeHtml(item.description ?? meta.product_name ?? "Software licence")}</td>
            <td class="right">${qty}</td><td class="right">${money(rate, currency)}</td>
            <td class="right">${money(rate * qty, currency)}</td></tr>`;
        }).join("")
      : `<tr><td>${escapeHtml(meta.product_name ?? "Software licence")}</td><td class="right">1</td>
         <td class="right">${money(total, currency)}</td><td class="right">${money(total, currency)}</td></tr>`
  }</tbody>
 </table>
 <div class="total"><span>Total</span><span>${money(total, currency)}</span></div>
 <p class="foot">Lifetime licence with one year of support. Generated by Software Vala on ${new Date()
   .toISOString().slice(0, 10)}.</p>
 <p class="noprint muted">Use your browser's print dialog to save this as a PDF.</p>
</div></body></html>`;

        return new Response(html, {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
