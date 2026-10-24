import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orderForTxnid: vi.fn(),
  userFromBearerToken: vi.fn(),
}));

vi.mock("@/lib/commerce/payu-settle", () => ({
  orderForTxnid: mocks.orderForTxnid,
}));
vi.mock("@/lib/auth/bearer-user.server", () => ({
  bearerToken: (header: string | null) => (header?.startsWith("Bearer ") ? header.slice(7) : null),
  userFromBearerToken: mocks.userFromBearerToken,
}));

const { Route } = await import("@/routes/api/payment/status");
const handler = (
  Route.options as unknown as {
    server: { handlers: { GET: (context: { request: Request }) => Promise<Response> } };
  }
).server.handlers.GET;

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    order_no: "SV-1001",
    order_number: null,
    status: "pending_payment",
    buyer_id: "buyer-1",
    amount_inr: 20750,
    total: 249,
    currency_charged: "INR",
    txnid: "txn-1",
    payu_status: null,
    ...overrides,
  };
}

function request(token?: string) {
  return new Request("https://softwarevala.test/api/payment/status?txnid=txn-1", {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

beforeEach(() => {
  process.env.SUPABASE_URL = "https://database.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  mocks.orderForTxnid.mockReset();
  mocks.userFromBearerToken.mockReset();
  mocks.userFromBearerToken.mockResolvedValue({ id: "buyer-1", email: "buyer@example.test" });
  mocks.orderForTxnid.mockResolvedValue(order());
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json([{ license_key: "LICENSE-1" }], { status: 200 })),
  );
});

describe("payment status authorization", () => {
  it("requires a verified bearer session before looking up a transaction", async () => {
    const response = await handler({ request: request() });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ status: "unknown" });
    expect(mocks.orderForTxnid).not.toHaveBeenCalled();
  });

  it("does not disclose payment details to a different signed-in buyer", async () => {
    mocks.userFromBearerToken.mockResolvedValue({ id: "other-buyer", email: null });

    const response = await handler({ request: request("valid-token") });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ status: "unknown" });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("returns the payment status and licence only to the order owner", async () => {
    mocks.orderForTxnid.mockResolvedValue(order({ status: "paid" }));

    const response = await handler({ request: request("valid-token") });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "paid",
      order_no: "SV-1001",
      amount: 20750,
      currency: "INR",
      licence_key: "LICENSE-1",
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/rest/v1/licenses?"),
      expect.objectContaining({ headers: expect.objectContaining({ apikey: "service-role-key" }) }),
    );
  });

  it("rate limits repeated status polling by authenticated account", async () => {
    mocks.userFromBearerToken.mockResolvedValue({ id: "payment-status-rate-limit", email: null });

    let response: Response | undefined;
    for (let i = 0; i < 61; i += 1) {
      response = await handler({ request: request("valid-token") });
    }

    expect(response?.status).toBe(429);
    expect(response?.headers.get("Retry-After")).toBe("30");
  });
});
