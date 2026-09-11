import { createFileRoute } from "@tanstack/react-router";

import { PURCHASES_PAGE_SIZE } from "@/lib/portal/config";
import { selectTolerant } from "@/lib/commerce/schema-tolerance";

/**
 * What the signed-in customer has bought.
 *
 * Ownership is part of the query, not something checked afterwards, so one
 * customer can never be handed another's orders or licence keys. A licence key
 * is only ever returned for an order this customer owns.
 */

/**
 * How many orders one response carries.
 *
 * The cap exists so a customer with a long history cannot pull an unbounded
 * result into their browser, and it is reported alongside the rows so the page
 * can tell the customer which of the two situations they are in. The number
 * itself lives with the portal's other operating thresholds.
 */
const ORDER_LIMIT = PURCHASES_PAGE_SIZE;

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

/**
 * The figure the customer was charged, with the currency it was charged in.
 *
 * Never invented. A missing amount is `null`, not zero — a purchase shown as
 * costing nothing is worse than one showing an em dash — and a missing currency
 * is `null` rather than "USD", because guessing a currency for a catalogue that
 * sells in rupees, dollars, euros, pounds and naira is a lie roughly four times
 * out of five. The page's formatter already renders both of those honestly.
 */
export function chargedPair(order: Record<string, unknown>): {
  amount: number | null;
  currency: string | null;
} {
  const settled = order.amount_charged ?? order.amount_inr;
  if (settled != null && Number.isFinite(Number(settled))) {
    return {
      amount: Number(settled),
      // What was charged is denominated in the charged currency. Falling back to
      // the order's base currency here would re-create the mismatch.
      currency: (order.currency_charged as string | null) ?? null,
    };
  }
  // Nothing has been charged yet — an order still awaiting payment. The base
  // total is the honest thing to show, and it belongs with the base currency.
  if (order.total != null && Number.isFinite(Number(order.total))) {
    return {
      amount: Number(order.total),
      currency: (order.currency as string | null) ?? null,
    };
  }
  return { amount: null, currency: null };
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
          // amount_charged comes from a migration production does not have yet.
          // Naming it failed the whole read, so every signed-in buyer got 502
          // here; a column the database does not have is now simply not read.
          const orderResponse = await selectTolerant(
            "marketplace_orders",
            "id,order_no,order_number,status,total,currency,amount_inr,amount_charged," +
              "currency_charged,txnid,payment_gateway,created_at,metadata",
            (select) =>
              `${url()}/rest/v1/marketplace_orders?select=${select}` +
              `&or=(buyer_id.eq.${owner},user_id.eq.${owner})` +
              `&order=created_at.desc&limit=${ORDER_LIMIT}`,
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

            // Licences are issued in two places: settlement writes `licenses`
            // (read above), and the database trigger that fires when an order
            // becomes paid writes `marketplace_licenses`, keyed by order line.
            // Every licence that exists today was issued by the trigger, so a
            // buyer reading only `licenses` was shown no key at all. Orders the
            // first read did not answer for are looked up here, still scoped to
            // this buyer.
            const unanswered = ids.filter((id) => !licences.has(id));
            if (unanswered.length) {
              const itemResponse = await fetch(
                `${url()}/rest/v1/marketplace_order_items?select=id,order_id` +
                  `&order_id=in.(${unanswered.join(",")})`,
                { headers: admin() },
              );
              const items = itemResponse.ok
                ? ((await itemResponse.json()) as { id: string; order_id: string }[])
                : [];
              const orderOfItem = new Map(items.map((item) => [String(item.id), String(item.order_id)]));
              if (orderOfItem.size) {
                const marketplaceLicenceResponse = await fetch(
                  `${url()}/rest/v1/marketplace_licenses?select=order_item_id,license_key,status,created_at` +
                    `&order_item_id=in.(${Array.from(orderOfItem.keys()).join(",")})&buyer_id=eq.${owner}`,
                  { headers: admin() },
                );
                if (marketplaceLicenceResponse.ok) {
                  for (const row of (await marketplaceLicenceResponse.json()) as Record<string, unknown>[]) {
                    const orderId = orderOfItem.get(String(row.order_item_id));
                    if (!orderId || licences.has(orderId)) continue;
                    licences.set(orderId, {
                      key: String(row.license_key),
                      status: String(row.status),
                      issued: String(row.created_at),
                    });
                  }
                }
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
              // The amount and the currency are chosen as a pair, and only ever
              // as a pair. `amount_charged`/`amount_inr` are what the provider
              // actually took, and they belong with `currency_charged`; `total`
              // is the order's base figure and belongs with `currency`. Reading
              // one from each side is how a card order settled at $1,299.50 came
              // to be shown as its base total under the charged currency — the
              // right symbol against the wrong number, on the customer's own
              // receipt. The status endpoint already pairs them this way; this
              // now matches it rather than having its own idea.
              ...chargedPair(order),
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
              // Whether the cap was reached. Without this the page cannot tell
              // "you have bought a hundred things" from "you have bought more
              // than a hundred and we are only showing some", and a customer
              // looking for an older order would be told, in effect, that it
              // does not exist.
              truncated: orders.length >= ORDER_LIMIT,
              limit: ORDER_LIMIT,
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
