import { createFileRoute } from "@tanstack/react-router";

/**
 * What actually happened to a payment.
 *
 * The status page asks this rather than reading the query string it was sent,
 * because the query string is whatever the browser was handed. The answer comes
 * from the order row, which only the verified webhook is allowed to move to
 * "paid".
 *
 * The licence key is returned only to the customer who owns the order, and only
 * when they are signed in. Everyone else gets the status and nothing more.
 */

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}` };
}

async function currentUserId(request: Request): Promise<string | null> {
  const publishable =
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? process.env.SUPABASE_ANON_KEY?.trim();
  const authorization = request.headers.get("authorization");
  if (!url() || !publishable || !authorization) return null;
  try {
    const response = await fetch(`${url()}/auth/v1/user`, {
      headers: { apikey: publishable, Authorization: authorization },
    });
    if (!response.ok) return null;
    const user = (await response.json()) as { id?: string };
    return user?.id ?? null;
  } catch {
    return null;
  }
}

const PORTAL_STATUS: Record<string, "paid" | "pending" | "failed"> = {
  paid: "paid",
  pending_payment: "pending",
  pending: "pending",
  payment_failed: "failed",
  failed: "failed",
  cancelled: "failed",
};

export const Route = createFileRoute("/api/payment/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!url() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
          return Response.json({ status: "unknown" }, { status: 503 });
        }

        const txnid = (new URL(request.url).searchParams.get("txnid") ?? "").trim().slice(0, 80);
        if (!txnid) return Response.json({ status: "unknown" });

        try {
          const response = await fetch(
            `${url()}/rest/v1/marketplace_orders` +
              `?select=id,order_no,order_number,status,buyer_id,user_id,amount_inr,total,currency_charged` +
              `&txnid=eq.${encodeURIComponent(txnid)}&limit=1`,
            { headers: admin() },
          );
          const orders = response.ok ? ((await response.json()) as Record<string, unknown>[]) : [];
          const order = orders[0];
          if (!order) return Response.json({ status: "unknown" });

          const status = PORTAL_STATUS[String(order.status ?? "").toLowerCase()] ?? "pending";
          const payload: Record<string, unknown> = {
            status,
            order_no: order.order_no ?? order.order_number ?? null,
            amount: Number(order.amount_inr ?? order.total ?? 0) || null,
            currency: order.currency_charged ?? null,
          };

          // The key is only ever shown to the person who bought it.
          if (status === "paid") {
            const viewer = await currentUserId(request);
            const owner = String(order.user_id ?? order.buyer_id ?? "");
            if (viewer && viewer === owner) {
              const licenceResponse = await fetch(
                `${url()}/rest/v1/licenses?select=license_key&order_id=eq.${encodeURIComponent(String(order.id))}&limit=1`,
                { headers: admin() },
              );
              const licences = licenceResponse.ok
                ? ((await licenceResponse.json()) as { license_key: string }[])
                : [];
              if (licences[0]) payload.licence_key = licences[0].license_key;
            }
          }

          return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
        } catch (error) {
          console.error("[payment status] failed", error);
          return Response.json({ status: "unknown" }, { status: 502 });
        }
      },
    },
  },
});
