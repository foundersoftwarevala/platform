import { createFileRoute } from "@tanstack/react-router";
import {
  INFLUENCER_REWARDS,
  FRANCHISE_PLANS,
  quoteFor,
  resolvePlan,
} from "@/lib/commerce/partner-plans";
import { languageOf, serverTranslator } from "@/lib/i18n/server-translate.server";

/**
 * What the signed-in partner pays for a product.
 *
 *   GET ?product=<slug or id>
 *
 * Everything that decides the number is read on the server. The request
 * carries only which product is being asked about — no tier, no discount, no
 * price. Sending those has no effect, which is the point.
 *
 * Resellers: the database decides, through marketplace_quote_product, run with
 * the caller's own session. The discount is the profit_percent of the plan of an
 * active, unexpired membership held by an active, approved reseller — the same
 * rule marketplace_create_checkout applies, so the quote and the charge agree.
 * A reseller without such a membership is quoted list price.
 *
 * Franchises: the franchise row's territory and status, as before.
 */

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function publishableKey() {
  return (
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? process.env.SUPABASE_ANON_KEY?.trim() ?? ""
  );
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}` };
}

async function currentUser(request: Request) {
  const publishable = publishableKey();
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

/** A database function run as the caller, so auth.uid() is theirs. */
async function rpcAsUser<T>(
  request: Request,
  name: string,
  body: Record<string, unknown>,
): Promise<T | null> {
  const response = await fetch(`${url()}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: publishableKey(),
      Authorization: request.headers.get("authorization") ?? "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

type ProductQuote = {
  ok?: boolean;
  product?: { id: string; slug: string; name: string };
  currency?: string;
  list_price?: number | string;
  discount_percent?: number | string;
  discount?: number | string;
  final_price?: number | string;
  pricing?: ResellerPricing;
};

type ResellerPricing = {
  eligible?: boolean;
  percent?: number;
  plan_code?: string;
  plan_name?: string;
  reason?: string;
};

/** The franchise row this user owns, if any. Their territory comes from here alone. */
async function franchiseFor(userId: string) {
  const owner = encodeURIComponent(userId);
  const franchiseResponse = await fetch(
    `${url()}/rest/v1/franchises?select=territory,status,joined_date&owner_user_id=eq.${owner}&limit=1`,
    { headers: admin() },
  );
  const franchises = franchiseResponse.ok
    ? ((await franchiseResponse.json()) as Record<string, unknown>[])
    : [];
  if (!franchises[0]) return null;
  const row = franchises[0];
  return {
    kind: "franchise" as const,
    tier: row.territory,
    eligible: String(row.status ?? "").toLowerCase() === "active",
    state: `status=${row.status ?? "unknown"}`,
  };
}

/** The reseller plans as the database defines them. */
async function resellerPlans() {
  const response = await fetch(
    `${url()}/rest/v1/reseller_membership_plans?select=code,name,price_usd,profit_percent&enabled=eq.true&order=sort_order`,
    { headers: admin() },
  );
  const rows = response.ok ? ((await response.json()) as Record<string, unknown>[]) : [];
  return rows.map((p) => ({
    id: String(p.code),
    label: String(p.name),
    joiningFeeUsd: Number(p.price_usd),
    discount: Number(p.profit_percent) / 100,
  }));
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
          const cart = await rpcAsUser<{ pricing?: ResellerPricing }>(
            request,
            "marketplace_cart_quote",
            {},
          );
          const pricing = (cart?.pricing ?? {}) as ResellerPricing;
          const franchise =
            pricing.reason === "not_a_reseller" ? await franchiseFor(user.id) : null;
          return Response.json({
            partner: franchise
              ? {
                  kind: "franchise",
                  plan: resolvePlan("franchise", franchise.tier)?.id ?? null,
                  eligible: franchise.eligible,
                  state: franchise.state,
                }
              : pricing.reason && pricing.reason !== "not_a_reseller"
                ? {
                    kind: "reseller",
                    plan: pricing.plan_code ?? null,
                    eligible: Boolean(pricing.eligible),
                    state: pricing.reason,
                  }
                : null,
            reseller_plans: await resellerPlans(),
            franchise_plans: FRANCHISE_PLANS.map(
              ({ id, label, joiningFeeUsd, discount, leadAllowance, territory }) => ({
                id,
                label,
                joiningFeeUsd,
                discount,
                leadAllowance,
                territory,
              }),
            ),
            influencer: INFLUENCER_REWARDS,
          });
        }

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

        // The list price and the reseller rule, both from the database.
        const quote = await rpcAsUser<ProductQuote>(request, "marketplace_quote_product", {
          p_product: products[0].id,
        });
        if (!quote) {
          const t = await serverTranslator(languageOf(request), ["reseller"], { waitMs: 1500 });
          return Response.json({ error: t("reseller.pricing.quote_failed") }, { status: 502 });
        }
        if (!quote.ok) {
          return Response.json(
            { error: "That product has no published price yet." },
            { status: 409 },
          );
        }
        const pricing = (quote.pricing ?? {}) as ResellerPricing;
        const listPrice = Number(quote.list_price);
        const headers = { "Cache-Control": "no-store" };

        if (pricing.reason !== "not_a_reseller") {
          const percent = Number(quote.discount_percent ?? 0);
          return Response.json(
            {
              product: quote.product,
              partner: { kind: "reseller", state: pricing.reason ?? "unknown" },
              listPriceUsd: listPrice,
              discount: percent / 100,
              discountLabel: `${percent}%`,
              savingUsd: Number(quote.discount),
              finalPriceUsd: Number(quote.final_price),
              plan: pricing.plan_code ?? null,
              // A code, not a sentence: the screen that shows it translates it.
              // active_membership | no_active_membership | reseller_not_active
              reason: pricing.reason ?? "unknown",
              planName: pricing.plan_name ?? null,
              currency: String(quote.currency ?? "USD"),
            },
            { headers },
          );
        }

        const partner = await franchiseFor(user.id);
        const plan = partner ? resolvePlan("franchise", partner.tier) : null;
        return Response.json(
          {
            product: quote.product,
            partner: partner ? { kind: partner.kind, state: partner.state } : null,
            ...quoteFor(listPrice, plan, partner?.eligible ?? false),
            currency: String(quote.currency ?? "USD"),
          },
          { headers },
        );
      },
    },
  },
});
