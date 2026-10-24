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

const ORDER_PAGE_SIZE = 100;
const INVOICE_PAGE_SIZE = 200;

async function readRows<T>(
  table: string,
  params: URLSearchParams,
  operation: string,
): Promise<T[]> {
  const response = await fetch(`${url()}/rest/v1/${table}?${params}`, { headers: admin() });
  if (!response.ok) {
    console.error(`[purchases] ${operation} failed`, response.status);
    throw new Error(`Could not read ${operation}`);
  }
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) throw new Error(`Invalid ${operation} response`);
  return rows as T[];
}

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
          const orders: Record<string, unknown>[] = [];
          let orderCursor: { createdAt: string; id: string } | null = null;
          while (true) {
            const params = new URLSearchParams({
              select:
                "id,order_no,order_number,status,total,currency,amount_inr,currency_charged,txnid,payment_gateway,created_at,metadata",
              buyer_id: `eq.${user.id}`,
              order: "created_at.desc,id.desc",
              limit: String(ORDER_PAGE_SIZE),
            });
            if (orderCursor) {
              params.set(
                "or",
                `(created_at.lt.${orderCursor.createdAt},and(created_at.eq.${orderCursor.createdAt},id.lt.${orderCursor.id}))`,
              );
            }
            const page = await readRows<Record<string, unknown>>(
              "marketplace_orders",
              params,
              "orders",
            );
            for (const order of page) {
              if (typeof order.id !== "string" || typeof order.created_at !== "string") {
                throw new Error("Invalid order pagination fields");
              }
            }
            orders.push(...page);
            if (page.length < ORDER_PAGE_SIZE) break;
            const last = page[page.length - 1];
            const nextCursor = { createdAt: String(last.created_at), id: String(last.id) };
            if (
              orderCursor &&
              orderCursor.createdAt === nextCursor.createdAt &&
              orderCursor.id === nextCursor.id
            ) {
              throw new Error("Order pagination cursor did not advance");
            }
            orderCursor = nextCursor;
          }

          const licences = new Map<string, { key: string; status: string; issued: string }>();
          const names = new Map<string, string[]>();
          for (let offset = 0; offset < orders.length; offset += ORDER_PAGE_SIZE) {
            const batch = orders.slice(offset, offset + ORDER_PAGE_SIZE);
            const ids = batch.map((order) => String(order.id));
            const idFilter = `in.(${ids.join(",")})`;

            // Licences for exactly these orders.
            const licenceParams = new URLSearchParams({
              select: "order_id,license_key,status,issued_at",
              order_id: idFilter,
              user_id: `eq.${user.id}`,
            });
            const licenceRows = await readRows<Record<string, unknown>>(
              "licenses",
              licenceParams,
              "licences",
            );
            for (const row of licenceRows) {
              licences.set(String(row.order_id), {
                key: String(row.license_key),
                status: String(row.status),
                issued: String(row.issued_at),
              });
            }

            // What each order was for. Checkout records it on the order lines,
            // not in order.metadata.
            const lineParams = new URLSearchParams({
              select: "order_id,product_name",
              order_id: idFilter,
              order: "created_at.asc,id.asc",
            });
            const lineRows = await readRows<{ order_id: string; product_name: string | null }>(
              "marketplace_order_items",
              lineParams,
              "order lines",
            );
            for (const row of lineRows) {
              if (!row.product_name) continue;
              const list = names.get(row.order_id) ?? [];
              if (!list.includes(row.product_name)) list.push(row.product_name);
              names.set(row.order_id, list);
            }
          }

          // Invoices for this buyer. Page by the unique primary key so an
          // account with many purchases is not silently capped at 200 invoices.
          const invoices = new Map<string, { id: string; no: string }>();
          let invoiceCursor: string | null = null;
          while (orders.length > 0) {
            const invoiceParams = new URLSearchParams({
              select: "id,invoice_no,line_items",
              order: "id.asc",
              limit: String(INVOICE_PAGE_SIZE),
            });
            invoiceParams.set("line_items->meta->>user_id", `eq.${user.id}`);
            if (invoiceCursor) invoiceParams.set("id", `gt.${invoiceCursor}`);
            const invoiceRows = await readRows<Record<string, unknown>>(
              "finance_invoices",
              invoiceParams,
              "invoices",
            );
            for (const row of invoiceRows) {
              const meta = (row.line_items as { meta?: { order_id?: string } })?.meta;
              if (meta?.order_id) {
                invoices.set(meta.order_id, { id: String(row.id), no: String(row.invoice_no) });
              }
            }
            if (invoiceRows.length < INVOICE_PAGE_SIZE) break;
            const lastId = invoiceRows[invoiceRows.length - 1]?.id;
            if (typeof lastId !== "string" || lastId === invoiceCursor) {
              throw new Error("Invalid invoice pagination cursor");
            }
            invoiceCursor = lastId;
          }

          const purchases = orders.map((order) => {
            const metadata = (order.metadata ?? {}) as Record<string, unknown>;
            const licence = licences.get(String(order.id));
            return {
              id: String(order.id),
              order_no: order.order_no ?? order.order_number ?? null,
              product:
                metadata.product_name ??
                (names.get(String(order.id))?.join(", ") || "Software Vala licence"),
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
          return Response.json({ error: "Could not load your purchases" }, { status: 500 });
        }
      },
    },
  },
});
