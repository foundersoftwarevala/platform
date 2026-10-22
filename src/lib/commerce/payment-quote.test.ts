import { beforeEach, describe, expect, it, vi } from "vitest";

const pricingState = vi.hoisted(() => ({
  pricing: {
    eligible: true,
    percent: 30,
    reseller_id: "reseller-1",
    plan_name: "Professional",
    reason: "active_membership",
  } as {
    eligible: boolean;
    percent: number;
    reseller_id: string | null;
    plan_name?: string;
    reason: string;
  },
}));

vi.mock("@/lib/commerce/reseller-payment-pricing.server", () => ({
  referralAttributionForRequest: vi.fn(async () => ({ resellerId: "reseller-1" })),
  resellerPricingForReferral: vi.fn(async () => pricingState.pricing),
}));

const { Route } = await import("@/routes/api/payment/quote");
const handler = (
  Route.options as unknown as {
    server: { handlers: { GET: (context: { request: Request }) => Promise<Response> } };
  }
).server.handlers.GET;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  Object.assign(process.env, {
    SUPABASE_URL: "http://db.test",
    SUPABASE_PUBLISHABLE_KEY: "public",
  });
  pricingState.pricing = {
    eligible: true,
    percent: 30,
    reseller_id: "reseller-1",
    plan_name: "Professional",
    reason: "active_membership",
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      if (url.pathname === "/auth/v1/user") return json({ id: "buyer-1" });
      if (url.pathname === "/rest/v1/rpc/marketplace_cart_quote") {
        return json({
          subtotal: 249,
          discount_total: 0,
          discount_percent: 0,
          total: 249,
          currency: "USD",
          lines: [{ cart_item_id: "cart-item-1", line_total: 249 }],
        });
      }
      return json({ error: "unexpected request" }, 500);
    }),
  );
});

function quote() {
  return handler({
    request: new Request("http://app.test/api/payment/quote", {
      headers: { Authorization: "Bearer buyer-token" },
    }),
  });
}

describe("payment-screen reseller pricing", () => {
  it("shows the active referring reseller's discount in the cart quote", async () => {
    const response = await quote();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      subtotal: 249,
      discount_percent: 30,
      discount_total: 74.7,
      total: 174.3,
      pricing: { plan_name: "Professional", eligible: true },
    });
  });

  it("shows full price after the plan expires", async () => {
    pricingState.pricing = {
      eligible: false,
      percent: 0,
      reseller_id: "reseller-1",
      reason: "no_active_membership",
    };
    const response = await quote();
    expect(await response.json()).toMatchObject({
      subtotal: 249,
      discount_percent: 0,
      discount_total: 0,
      total: 249,
    });
  });
});
