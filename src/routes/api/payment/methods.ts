import { createFileRoute } from "@tanstack/react-router";
import { paymentOptions } from "@/lib/commerce/payment-routing";

/**
 * Which payment methods this buyer can actually use for this order.
 *
 * The checkout asks before it draws the choice, so a customer is never offered
 * a method that would refuse them — a rail with no credentials, a provider that
 * does not settle their currency, or one that does not operate in their
 * country. Everything here is derived from the rails Finance Manager holds.
 *
 * The response carries no credentials of any kind: a code, a name, the
 * currencies and countries the rail covers, and whether it is usable. The
 * public key a client-side widget would need is deliberately absent, because
 * every provider here is entered by redirect and no card field is ever rendered
 * on a Software Vala page.
 *
 * The order is read from the database to get its currency. A caller who does
 * not own it learns only which methods exist, never anything about the order.
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

function requestCountry(request: Request): string | null {
  const country =
    request.headers.get("cf-ipcountry") ??
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("x-country-code");
  const code = String(country ?? "").trim().toUpperCase();
  return code && code !== "XX" && code.length === 2 ? code : null;
}

export const Route = createFileRoute("/api/payment/methods")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!url()) return Response.json({ options: [] }, { status: 503 });

        const params = new URL(request.url).searchParams;
        const orderId = (params.get("orderId") ?? "").trim().slice(0, 80);
        const country = requestCountry(request) ?? (params.get("country") ?? "").trim().slice(0, 2);

        let currency = (params.get("currency") ?? "USD").trim().toUpperCase().slice(0, 3);

        if (orderId) {
          const viewer = await currentUserId(request);
          const response = await fetch(
            `${url()}/rest/v1/marketplace_orders?select=buyer_id,user_id,currency,currency_charged` +
              `&id=eq.${encodeURIComponent(orderId)}&limit=1`,
            { headers: admin() },
          );
          const rows = response.ok ? ((await response.json()) as Record<string, unknown>[]) : [];
          const order = rows[0];
          const owner = String(order?.user_id ?? order?.buyer_id ?? "");
          if (order && viewer && viewer === owner) {
            currency = String(order.currency_charged ?? order.currency ?? currency).toUpperCase();
          }
        }

        const options = await paymentOptions({ currency, country: country || null });

        return Response.json(
          {
            currency,
            country: country || null,
            options: options.map((option) => ({
              code: option.code,
              displayName: option.displayName,
              trustLabel: option.trustLabel,
              kind: option.kind,
              ready: option.ready,
              reason: option.reason,
            })),
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
