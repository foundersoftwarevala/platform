import { createFileRoute } from "@tanstack/react-router";

/**
 * What the signed-in customer has bought.
 *
 * Ownership is part of the query, not something checked afterwards, so one
 * customer can never be handed another's orders or licence keys. A licence key
 * is only ever returned for an order this customer owns.
 */

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}` };
}

async function currentUser(request: Request) {
  const publishable =
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? process.env.SUPABASE_ANON_KEY?.trim();
  const authorization = request.headers.get("authorization");
  if (!url() || !publishable || !authorization) return null;
  try {
    const response = await fetch(`${url()}/auth/v1/user`, {
      headers: { apikey: publishable, Authorization: authorization },
    });
    if (!response.ok) return null;
    const user = (await response.json()) as { id?: string; email?: string };
    return user?.id ? { id: user.id, email: user.email ?? "" } : null;
  } catch {
    return null;
  }
}

const PORTAL_STATUS: Record<string, string> = {
  paid: "paid",
  pending_payment: "awaiting payment",
  pending: "awaiting payment",
  payment_failed: "failed",
  failed: "failed",
  cancelled: "cancelled",
};

export const Route = createFileRoute("/api/account/purchases")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!url() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
          return Response.json({ error: "Not configured" }, { status: 503 });
        }
        const user = await currentUser(request);
        if (!user) {
          return Response.json({ error: "Sign in to see your purchases" }, { status: 401 });
        }

        try {
          // Orders belonging to this customer, under either owner column.
          const owner = encodeURIComponent(user.id);
          const orderResponse = await fetch(
            `${url()}/rest/v1/marketplace_orders` +
              `?select=id,order_no,order_number,status,total,currency,amount_inr,currency_charged,` +
              `txnid,payment_gateway,created_at,metadata` +
              `&or=(buyer_id.eq.${owner},user_id.eq.${owner})` +
              `&order=created_at.desc&limit=100`,
            { headers: admin() },
          );
          if (!orderResponse.ok) {
            return Response.json({ error: "Could not load your purchases" }, { status: 502 });
          }
          const orders = (await orderResponse.json()) as Record<string, unknown>[];

          // Licences for exactly those orders.
          const ids = orders.map((o) => String(o.id));
          const licences = new Map<string, { key: string; status: string; issued: string }>();
          if (ids.length) {
            const licenceResponse = await fetch(
              `${url()}/rest/v1/licenses?select=order_id,license_key,status,issued_at` +
                `&order_id=in.(${ids.join(",")})&user_id=eq.${owner}`,
              { headers: admin() },
            );
            if (licenceResponse.ok) {
              for (const row of (await licenceResponse.json()) as Record<string, unknown>[]) {
                licences.set(String(row.order_id), {
                  key: String(row.license_key),
                  status: String(row.status),
                  issued: String(row.issued_at),
                });
              }
            }
          }

          // Invoices for the same orders, matched on the meta they carry.
          const invoices = new Map<string, { id: string; no: string }>();
          if (ids.length) {
            const invoiceResponse = await fetch(
              `${url()}/rest/v1/finance_invoices?select=id,invoice_no,line_items` +
                `&line_items->meta->>user_id=eq.${owner}&limit=200`,
              { headers: admin() },
            );
            if (invoiceResponse.ok) {
              for (const row of (await invoiceResponse.json()) as Record<string, unknown>[]) {
                const meta = (row.line_items as { meta?: { order_id?: string } })?.meta;
                if (meta?.order_id) {
                  invoices.set(meta.order_id, { id: String(row.id), no: String(row.invoice_no) });
                }
              }
            }
          }

          const purchases = orders.map((order) => {
            const metadata = (order.metadata ?? {}) as Record<string, unknown>;
            const licence = licences.get(String(order.id));
            return {
              id: String(order.id),
              order_no: order.order_no ?? order.order_number ?? null,
              product: metadata.product_name ?? "Software Vala licence",
              status: PORTAL_STATUS[String(order.status).toLowerCase()] ?? String(order.status),
              amount: Number(order.amount_inr ?? order.total ?? 0),
              currency: order.currency_charged ?? order.currency ?? "USD",
              gateway: order.payment_gateway ?? null,
              placed: order.created_at,
              licence_key: licence?.key ?? null,
              licence_status: licence?.status ?? null,
              invoice_id: invoices.get(String(order.id))?.id ?? null,
              invoice_no: invoices.get(String(order.id))?.no ?? null,
            };
          });

          return Response.json(
            {
              purchases,
              total: purchases.length,
              paid: purchases.filter((p) => p.status === "paid").length,
            },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch (error) {
          console.error("[purchases] failed", error);
          return Response.json({ error: "Could not load your purchases" }, { status: 502 });
        }
      },
    },
  },
});
