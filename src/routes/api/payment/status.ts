import { createFileRoute } from "@tanstack/react-router";
import { orderForTxnid } from "@/lib/commerce/payu-settle";
import { bearerToken, userFromBearerToken } from "@/lib/auth/bearer-user.server";
import { SlidingWindowLimiter } from "@/lib/i18n/limits";

/**
 * What actually happened to a payment.
 *
 * The status page asks this rather than reading the query string it was sent,
 * because the query string is whatever the browser was handed. The answer comes
 * from the order row, which only the verified webhook is allowed to move to
 * "paid".
 *
 * Payment details are returned only to the signed-in customer who owns the
 * order. The transaction id is not an authorization credential.
 */

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}` };
}

const PORTAL_STATUS: Record<string, "paid" | "pending" | "failed"> = {
  paid: "paid",
  pending_payment: "pending",
  pending: "pending",
  payment_failed: "failed",
  failed: "failed",
  cancelled: "failed",
};

/** PayU's answers that end an attempt without the money. */
const FAILED_ATTEMPT = new Set([
  "failure",
  "failed",
  "usercancelled",
  "cancelled",
  "dropped",
  "bounced",
]);
const statusLimiter = new SlidingWindowLimiter(60_000);
const STATUS_REQUESTS_PER_MINUTE = 60;

export const Route = createFileRoute("/api/payment/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!url() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
          return Response.json({ status: "unknown" }, { status: 503 });
        }

        const token = bearerToken(request.headers.get("authorization"));
        const viewer = token ? await userFromBearerToken(token) : null;
        if (!viewer) {
          return Response.json(
            { status: "unknown", error: "Sign in to check your payment" },
            { status: 401, headers: { "Cache-Control": "no-store" } },
          );
        }
        if (statusLimiter.hit(viewer.id, STATUS_REQUESTS_PER_MINUTE)) {
          return Response.json(
            { status: "unknown", error: "Too many payment status requests" },
            {
              status: 429,
              headers: { "Retry-After": "30", "Cache-Control": "no-store" },
            },
          );
        }

        const txnid = (new URL(request.url).searchParams.get("txnid") ?? "").trim().slice(0, 80);
        if (!txnid) return Response.json({ status: "unknown" });

        try {
          // The transaction may be the order's current attempt or an earlier one.
          const order = await orderForTxnid(
            txnid,
            "id,order_no,order_number,status,buyer_id,amount_inr,total,currency_charged,txnid,payu_status",
          );
          if (!order) return Response.json({ status: "unknown" });
          if (String(order.buyer_id ?? "") !== viewer.id) {
            return Response.json(
              { status: "unknown" },
              { status: 404, headers: { "Cache-Control": "no-store" } },
            );
          }

          // An unpaid order stays pending_payment after a failed attempt (the
          // table has no failed status); PayU's answer for that attempt is kept
          // in payu_status, and a failure is shown as one.
          const orderStatus = String(order.status ?? "").toLowerCase();
          const attemptFailed =
            orderStatus === "pending_payment" &&
            (order.txnid !== txnid ||
              FAILED_ATTEMPT.has(String(order.payu_status ?? "").toLowerCase()));
          const status = attemptFailed ? "failed" : (PORTAL_STATUS[orderStatus] ?? "pending");
          const payload: Record<string, unknown> = {
            status,
            order_no: order.order_no ?? order.order_number ?? null,
            amount: Number(order.amount_inr ?? order.total ?? 0) || null,
            currency: order.currency_charged ?? null,
          };

          // The key is only ever shown to the person who bought it.
          if (status === "paid") {
            const licenceResponse = await fetch(
              `${url()}/rest/v1/licenses?select=license_key&order_id=eq.${encodeURIComponent(String(order.id))}&limit=1`,
              { headers: admin() },
            );
            if (!licenceResponse.ok) {
              console.error("[payment status] licence read failed", licenceResponse.status);
              return Response.json(
                { status: "unknown", error: "Could not verify payment access" },
                { status: 502, headers: { "Cache-Control": "no-store" } },
              );
            }
            const licences: unknown = await licenceResponse.json();
            if (!Array.isArray(licences)) {
              console.error("[payment status] licence read returned invalid data");
              return Response.json(
                { status: "unknown", error: "Could not verify payment access" },
                { status: 502, headers: { "Cache-Control": "no-store" } },
              );
            }
            const licence = licences[0] as { license_key?: unknown } | undefined;
            if (typeof licence?.license_key === "string") {
              payload.licence_key = licence.license_key;
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
