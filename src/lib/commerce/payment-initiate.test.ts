import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Starting a PayU payment for an order.
 *
 * The database and the exchange-rate source are replaced by an in-memory
 * stand-in; the handler itself is the real one.
 */

vi.mock("@/lib/commerce/fulfilment", () => ({ logPaymentEvent: vi.fn(async () => undefined) }));
vi.mock("@/lib/i18n/server-translate.server", () => ({ languageOf: () => "en" }));
vi.mock("@/lib/affiliate/core", () => ({
  REFERRAL_COOKIE: "sv_ref",
  readCookie: () => null,
  attributionForSession: vi.fn(),
  attributeOrder: vi.fn(),
  rest: vi.fn(),
}));

const { Route } = await import("@/routes/api/payment/initiate");
const handler = (Route.options as unknown as { server: { handlers: { POST: (ctx: { request: Request }) => Promise<Response> } } })
  .server.handlers.POST;

type Row = Record<string, unknown>;
let order: Row;
let intents: Row[];
let fxCalls: number;
let lines: Row[];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  Object.assign(process.env, {
    SUPABASE_URL: "http://db.test",
    SUPABASE_SERVICE_ROLE_KEY: "service",
    SUPABASE_PUBLISHABLE_KEY: "public",
    PAYU_MERCHANT_KEY: "KEY",
    PAYU_MERCHANT_SALT: "SALT",
    FX_API_URL: "http://fx.test/?amount={AMOUNT}",
  });
  order = {
    id: "o1", buyer_id: "u1", user_id: null, status: "pending_payment", total: 249, currency: "USD",
    txnid: null, amount_inr: null, fx_rate: null, payu_status: null, metadata: {},
  };
  intents = [{ id: "i1", order_id: "o1", status: "pending" }];
  fxCalls = 0;
  lines = [{ product_name: "School ERP", currency: "USD" }];

  vi.stubGlobal("fetch", vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    if (url.origin === "http://fx.test") {
      fxCalls += 1;
      const amount = Number(url.searchParams.get("amount"));
      return json({ result: amount * 83, info: { rate: 83 } });
    }
    if (url.pathname === "/auth/v1/user") return json({ id: "u1", email: "buyer@test" });
    const table = url.pathname.replace("/rest/v1/", "");
    if (table === "marketplace_order_items") return json(lines);
    if (table === "marketplace_payment_intents") {
      if (method === "PATCH") {
        Object.assign(intents[0], JSON.parse(String(init?.body)));
        return json(intents);
      }
      return json(intents);
    }
    if (table === "marketplace_orders") {
      if (method === "GET") return json([order]);
      if (method === "PATCH") {
        // The same filters PostgREST applies: status, and the attempt's txnid.
        const wantStatus = url.searchParams.get("status")?.replace("eq.", "");
        if (wantStatus && order.status !== wantStatus) return json([]);
        const wantTxn = url.searchParams.get("txnid");
        if (wantTxn === "is.null" && order.txnid != null) return json([]);
        if (wantTxn?.startsWith("eq.") && order.txnid !== wantTxn.slice(3)) return json([]);
        Object.assign(order, JSON.parse(String(init?.body)));
        return json([order]);
      }
    }
    return json({ message: `unexpected ${method} ${url}` }, 500);
  }));
});

function start() {
  return handler({
    request: new Request("http://app.test/api/payment/initiate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
      body: JSON.stringify({ orderId: "o1" }),
    }),
  });
}

describe("starting a payment", () => {
  it("charges a dollar order in rupees at the looked-up rate", async () => {
    const response = await start();
    const body = (await response.json()) as { fields: Record<string, string> };
    expect(response.status).toBe(200);
    expect(body.fields.amount).toBe("20667.00");
    expect(body.fields.productinfo).toBe("School ERP");
    expect(order).toMatchObject({ amount_inr: 20667, currency_charged: "INR", amount_usd: 249 });
    expect(intents[0]).toMatchObject({ status: "pending", provider: "payu", amount: 20667, currency: "INR" });
  });

  it("charges the same amount and transaction again on a second attempt, never $249 as ₹249", async () => {
    const first = (await (await start()).json()) as { fields: Record<string, string> };
    const second = (await (await start()).json()) as { fields: Record<string, string> };
    expect(second.fields.amount).toBe(first.fields.amount);
    expect(second.fields.amount).not.toBe("249.00");
    expect(second.fields.txnid).toBe(first.fields.txnid);
    expect(fxCalls).toBe(1);
  });

  it("starts a fresh transaction after PayU failed the last one, and keeps the old id", async () => {
    const first = (await (await start()).json()) as { fields: Record<string, string> };
    order.payu_status = "failure";
    const second = (await (await start()).json()) as { fields: Record<string, string> };
    expect(second.fields.txnid).not.toBe(first.fields.txnid);
    expect(second.fields.amount).toBe("20667.00");
    expect((order.metadata as { payu_attempts: unknown[] }).payu_attempts).toEqual([
      { txnid: first.fields.txnid, amount_inr: 20667 },
    ]);
    expect(order.payu_status).toBeNull();
  });

  it("charges a rupee order as it is, without a rate lookup", async () => {
    order.currency = "INR";
    order.total = 4999;
    lines = [{ product_name: "School ERP", currency: "INR" }];
    const body = (await (await start()).json()) as { fields: Record<string, string> };
    expect(body.fields.amount).toBe("4999.00");
    expect(fxCalls).toBe(0);
    expect(order.amount_usd).toBeNull();
  });

  it.each(["paid", "cancelled", "refunded"])("refuses a %s order", async (status) => {
    order.status = status;
    const response = await start();
    expect(response.status).toBe(409);
    expect(order.txnid).toBeNull();
  });

  it("refuses an order that was settled while the payment was being started", async () => {
    // Paid between the read and the write: the conditional update touches nothing.
    const original = globalThis.fetch;
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "PATCH" && String(input).includes("marketplace_orders")) order.status = "paid";
      return original(input, init);
    }));
    const response = await start();
    expect(response.status).toBe(409);
    expect(order.status).toBe("paid");
  });

  it("charges a rupee order the same amount again on a retry", async () => {
    order.currency = "INR";
    order.total = 4999;
    lines = [{ product_name: "School ERP", currency: "INR" }];
    const first = (await (await start()).json()) as { fields: Record<string, string> };
    const second = (await (await start()).json()) as { fields: Record<string, string> };
    expect([first.fields.amount, second.fields.amount]).toEqual(["4999.00", "4999.00"]);
    expect(second.fields.txnid).toBe(first.fields.txnid);
  });

  it("refuses a currency it cannot charge", async () => {
    order.currency = "EUR";
    lines = [{ product_name: "School ERP", currency: "EUR" }];
    expect((await start()).status).toBe(409);
    expect(order.txnid).toBeNull();
  });

  it("refuses an order whose lines are priced in another currency", async () => {
    order.currency = "INR";
    order.total = 2490;
    lines = [{ product_name: "School ERP", currency: "USD" }];
    expect((await start()).status).toBe(409);
    expect(order.txnid).toBeNull();
  });

  it("lets only one of two simultaneous starts mint the transaction", async () => {
    // Both read the order before either writes: the second write must lose,
    // or its transaction id would never be found when PayU answers.
    const [a, b] = await Promise.all([start(), start()]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);
    const winner = (await (a.status === 200 ? a : b).json()) as { fields: Record<string, string> };
    expect(order.txnid).toBe(winner.fields.txnid);
    // Trying again reuses the winner's attempt.
    const again = (await (await start()).json()) as { fields: Record<string, string> };
    expect(again.fields.txnid).toBe(winner.fields.txnid);
  });

  it("keeps the same attempt after a timeout with no answer from PayU", async () => {
    const first = (await (await start()).json()) as { fields: Record<string, string> };
    // No callback ever arrived: payu_status is still empty.
    const retry = (await (await start()).json()) as { fields: Record<string, string> };
    expect(retry.fields).toMatchObject({ txnid: first.fields.txnid, amount: first.fields.amount });
  });

  it("refuses someone else's order", async () => {
    order.buyer_id = "someone-else";
    expect((await start()).status).toBe(403);
  });
});
