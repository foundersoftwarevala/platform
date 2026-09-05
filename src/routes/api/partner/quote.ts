import { createFileRoute } from "@tanstack/react-router";
import {
  INFLUENCER_REWARDS, RESELLER_PLANS, FRANCHISE_PLANS,
  quoteFor, resolvePlan, type PartnerKind,
} from "@/lib/commerce/partner-plans";

/**
 * What the signed-in partner pays for a product.
 *
 *   GET ?product=<slug or id>
 *
 * Everything that decides the number is read on the server: the list price from
 * the catalogue, and the partner's tier and approval state from their own row.
 * The request carries only which product is being asked about — no tier, no
 * discount, no price. Sending those has no effect, which is the point.
 *
 * A partner whose row is not active and approved is quoted list price. The
 * approval itself belongs to the Control Panel; nothing here grants it.
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

/** The partner row this user owns, if any. Their tier comes from here alone. */
async function partnerFor(userId: string): Promise<{
  kind: PartnerKind; tier: unknown; eligible: boolean; state: string;
} | null> {
  const owner = encodeURIComponent(userId);

  const resellerResponse = await fetch(
    `${url()}/rest/v1/resellers?select=tier,status,kyc_status,approved_at&user_id=eq.${owner}&limit=1`,
    { headers: admin() },
  );
  const resellers = resellerResponse.ok
    ? ((await resellerResponse.json()) as Record<string, unknown>[])
    : [];
  if (resellers[0]) {
    const row = resellers[0];
    const active = String(row.status ?? "").toLowerCase() === "active";
    const approved = Boolean(row.approved_at);
    return {
      kind: "reseller",
      tier: row.tier,
      eligible: active && approved,
      state: `status=${row.status ?? "unknown"} approved=${approved}`,
    };
  }

  const franchiseResponse = await fetch(
    `${url()}/rest/v1/franchises?select=territory,status,joined_date&owner_user_id=eq.${owner}&limit=1`,
    { headers: admin() },
  );
  const franchises = franchiseResponse.ok
    ? ((await franchiseResponse.json()) as Record<string, unknown>[])
    : [];
  if (franchises[0]) {
    const row = franchises[0];
    const active = String(row.status ?? "").toLowerCase() === "active";
    return {
      kind: "franchise",
      tier: row.territory,
      eligible: active,
      state: `status=${row.status ?? "unknown"}`,
    };
  }

  return null;
}

export const Route = createFileRoute("/api/partner/quote")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!url() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
          return Response.json({ error: "Not configured" }, { status: 503 });
        }
        const user = await currentUser(request);
        if (!user) return Response.json({ error: "Sign in first" }, { status: 401 });

        const product = (new URL(request.url).searchParams.get("product") ?? "").trim();
        if (!product) {
          // No product asked about: report the plans and this partner's standing.
          const partner = await partnerFor(user.id);
          return Response.json({
            partner: partner
              ? { kind: partner.kind, plan: resolvePlan(partner.kind, partner.tier)?.id ?? null,
                  eligible: partner.eligible, state: partner.state }
              : null,
            reseller_plans: RESELLER_PLANS.map(({ id, label, joiningFeeUsd, discount }) => ({
              id, label, joiningFeeUsd, discount })),
            franchise_plans: FRANCHISE_PLANS.map(({ id, label, joiningFeeUsd, discount, leadAllowance, territory }) => ({
              id, label, joiningFeeUsd, discount, leadAllowance, territory })),
            influencer: INFLUENCER_REWARDS,
          });
        }

        // The list price comes from the catalogue, never from the caller.
        const isUuid = /^[0-9a-f-]{36}$/i.test(product);
        const filter = isUuid
          ? `id=eq.${encodeURIComponent(product)}`
          : `slug=eq.${encodeURIComponent(product)}`;
        const productResponse = await fetch(
          `${url()}/rest/v1/marketplace_products?select=id,slug,name&${filter}&limit=1`,
          { headers: admin() },
        );
        const products = productResponse.ok
          ? ((await productResponse.json()) as Record<string, unknown>[])
          : [];
        if (!products[0]) return Response.json({ error: "Product not found" }, { status: 404 });

        const priceResponse = await fetch(
          `${url()}/rest/v1/marketplace_product_pricing` +
            `?select=amount,currency&active=eq.true&product_id=eq.${String(products[0].id)}&limit=1`,
          { headers: admin() },
        );
        const prices = priceResponse.ok
          ? ((await priceResponse.json()) as Record<string, unknown>[])
          : [];
        const listPrice = Number(prices[0]?.amount ?? 0);
        if (!(listPrice > 0)) {
          return Response.json(
            { error: "That product has no published price yet." },
            { status: 409 },
          );
        }

        const partner = await partnerFor(user.id);
        const plan = partner ? resolvePlan(partner.kind, partner.tier) : null;
        const quote = quoteFor(listPrice, plan, partner?.eligible ?? false);

        return Response.json(
          {
            product: { id: products[0].id, slug: products[0].slug, name: products[0].name },
            partner: partner ? { kind: partner.kind, state: partner.state } : null,
            ...quote,
            currency: String(prices[0]?.currency ?? "USD"),
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
