import { beforeEach, describe, expect, it, vi } from "vitest";

import { responseHash, type PayuConfig } from "./payu";

/**
 * How a PayU result settles an order.
 *
 * PostgREST and PayU's verify endpoint are replaced by an in-memory stand-in
 * that applies the same filters the real requests carry, so the conditional
 * updates are exercised as written: an update that names status=eq.pending_payment
 * really does nothing once the order is paid.
 */

const fulfilOrder = vi.fn();
vi.mock("./fulfilment", () => ({
  fulfilOrder: (...args: unknown[]) => fulfilOrder(...args),
  logPaymentEvent: vi.fn(async () => undefined),
}));

const { settlePayuCallback, orderForTxnid } = await import("./payu-settle");

const config: PayuConfig = {
  merchantKey: "KEY",
  merchantSalt: "SALT",
  baseUrl: "https://payu.test",
  paymentEndpoint: "/_payment",
  verifyEndpoint: "/verify",
  appBaseUrl: "https://app.test",
};

type Order = Record<string, unknown> & { id: string; status: string; txnid: string | null };
let orders: Order[];
let intents: Record<string, unknown>[];
let events: Record<string, unknown>[];
let payu: Record<string, { status: string; amt: string; mihpayid: string }>;
let paidTransitions: number;

function matches(row: Record<string, unknown>, params: URLSearchParams): boolean {
  for (const [key, value] of params) {
    if (["select", "limit", "on_conflict", "order"].includes(key)) continue;
    if (key === "metadata->payu_attempts") {
      const wanted = JSON.parse(decodeURIComponent(value.replace(/^cs\./, ""))) as { txnid: string }[];
      const attempts = ((row.metadata as { payu_attempts?: { txnid: string }[] })?.payu_attempts ?? []);
      if (!wanted.every((w) => attempts.some((a) => a.txnid === w.txnid))) return false;
      continue;
    }
    const expected = value.replace(/^eq\./, "");
    if (String(row[key] ?? "") !== expected) return false;
  }
  return true;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  process.env.SUPABASE_URL = "http://db.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  fulfilOrder.mockReset();
  fulfilOrder.mockResolvedValue({ ok: true, created: true, licenceKey: "K", licenceId: "L", entitlementId: null });
  paidTransitions = 0;
  orders = [
    { id: "o1", status: "pending_payment", total: 249, amount_inr: 20750, txnid: "T2",
      metadata: { payu_attempts: [{ txnid: "T1", amount_inr: 20700 }] } },
    { id: "o2", status: "cancelled", total: 249, amount_inr: 20750, txnid: "T9", metadata: {} },
  ];
  intents = [{ id: "i1", order_id: "o1", status: "pending" }];
  events = [];
  payu = {};

  vi.stubGlobal("fetch", vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    if (url.origin === "https://payu.test") {
      const txnid = new URLSearchParams(String(init?.body)).get("var1") ?? "";
      const detail = payu[txnid];
      return json({ status: 1, transaction_details: detail ? { [txnid]: detail } : {} });
    }
    const table = url.pathname.replace("/rest/v1/", "");
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    const rowsOf: Record<string, Record<string, unknown>[]> = {
      marketplace_orders: orders, marketplace_payment_intents: intents, marketplace_payment_events: events,
    };
    const rows = rowsOf[table];
    if (!rows) return json({ message: "unknown table" }, 404);
    if (method === "GET") return json(rows.filter((r) => matches(r, url.searchParams)));
    if (method === "PATCH") {
      const hit = rows.filter((r) => matches(r, url.searchParams));
      for (const r of hit) {
        if (table === "marketplace_orders" && body.status === "paid" && r.status !== "paid") paidTransitions += 1;
        Object.assign(r, body);
      }
      return json(hit);
    }
    if (method === "POST") {
      if (table === "marketplace_payment_events" &&
          events.some((e) => e.provider_event_id === body.provider_event_id)) return json([], 201);
      const row = { id: `${table}-${rows.length + 1}`, ...body };
      rows.push(row);
      return json([row], 201);
    }
    return json({}, 405);
  }));
});

function callback(fields: { txnid: string; status: string; amount: string; mihpayid?: string }, salt = "SALT") {
  const base = { productinfo: "Product", firstname: "Buyer", email: "b@test", ...fields };
  const hash = responseHash({ ...config, merchantSalt: salt }, base);
  return { ...base, mihpayid: fields.mihpayid ?? "M1", hash } as Record<string, string>;
}

describe("settling a PayU result", () => {
  it("refuses a result whose hash does not verify", async () => {
    payu.T2 = { status: "success", amt: "20750.00", mihpayid: "M1" };
    const out = await settlePayuCallback(config, callback({ txnid: "T2", status: "success", amount: "20750.00" }, "WRONG"), "webhook");
    expect(out.httpStatus).toBe(400);
    expect(orders[0].status).toBe("pending_payment");
    expect(fulfilOrder).not.toHaveBeenCalled();
  });

  it("marks a verified payment paid once, issues access, and records intent and event", async () => {
    payu.T2 = { status: "success", amt: "20750.00", mihpayid: "M1" };
    const out = await settlePayuCallback(config, callback({ txnid: "T2", status: "success", amount: "20750.00" }), "webhook");
    expect(out.httpStatus).toBe(200);
    expect(orders[0]).toMatchObject({ status: "paid", payu_status: "success", payu_txn_id: "M1", currency_charged: "INR" });
    expect(fulfilOrder).toHaveBeenCalledTimes(1);
    expect(intents[0]).toMatchObject({ status: "succeeded", provider: "payu", provider_intent_id: "T2", currency: "INR" });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ provider: "payu", provider_event_id: "M1:success", signature_verified: true, amount: 20750 });
    expect((events[0].payload as Record<string, string>).hash).toBeUndefined();
  });

  it("settles a repeated delivery and a concurrent one exactly once", async () => {
    payu.T2 = { status: "success", amt: "20750.00", mihpayid: "M1" };
    const fields = callback({ txnid: "T2", status: "success", amount: "20750.00" });
    const [a, b] = await Promise.all([
      settlePayuCallback(config, fields, "webhook"),
      settlePayuCallback(config, fields, "return"),
    ]);
    const c = await settlePayuCallback(config, fields, "webhook");
    expect([a.httpStatus, b.httpStatus, c.httpStatus]).toEqual([200, 200, 200]);
    expect(paidTransitions).toBe(1);
    // Exactly one delivery settles it; the others see it already settled.
    expect([a.message, b.message].filter((m) => m === "OK")).toHaveLength(1);
    expect(events).toHaveLength(1);
    expect(c.message).toBe("Already recorded");
  });

  it("refuses an amount that is not what this attempt was charged", async () => {
    payu.T2 = { status: "success", amt: "249.00", mihpayid: "M1" };
    const out = await settlePayuCallback(config, callback({ txnid: "T2", status: "success", amount: "249.00" }), "webhook");
    expect(out.httpStatus).toBe(409);
    expect(orders[0].status).toBe("pending_payment");
  });

  it("does not settle when PayU's verify endpoint disagrees or reports another amount", async () => {
    payu.T2 = { status: "failure", amt: "20750.00", mihpayid: "M1" };
    await settlePayuCallback(config, callback({ txnid: "T2", status: "success", amount: "20750.00" }), "webhook");
    expect(orders[0].status).toBe("pending_payment");

    payu.T2 = { status: "success", amt: "100.00", mihpayid: "M1" };
    await settlePayuCallback(config, callback({ txnid: "T2", status: "success", amount: "20750.00" }), "webhook");
    expect(orders[0].status).toBe("pending_payment");
    expect(fulfilOrder).not.toHaveBeenCalled();
  });

  it("records a failed attempt without an invalid status, so the buyer can pay again", async () => {
    payu.T2 = { status: "failure", amt: "20750.00", mihpayid: "M2" };
    const out = await settlePayuCallback(config, callback({ txnid: "T2", status: "failure", amount: "20750.00", mihpayid: "M2" }), "return");
    expect(out.httpStatus).toBe(200);
    expect(orders[0].status).toBe("pending_payment");
    expect(orders[0].payu_status).toBe("failure");
    expect(intents[0].status).toBe("failed");
  });

  it("matches a late answer for an earlier attempt, without overwriting the current one", async () => {
    expect((await orderForTxnid("T1"))?.id).toBe("o1");
    payu.T1 = { status: "failure", amt: "20700.00", mihpayid: "M0" };
    const out = await settlePayuCallback(config, callback({ txnid: "T1", status: "failure", amount: "20700.00", mihpayid: "M0" }), "webhook");
    expect(out.httpStatus).toBe(200);
    expect(orders[0].payu_status).toBeUndefined();
    expect(orders[0].txnid).toBe("T2");
  });

  it("settles a late success for an earlier attempt at that attempt's amount", async () => {
    payu.T1 = { status: "success", amt: "20700.00", mihpayid: "M0" };
    const out = await settlePayuCallback(config, callback({ txnid: "T1", status: "success", amount: "20700.00", mihpayid: "M0" }), "webhook");
    expect(out.httpStatus).toBe(200);
    expect(orders[0]).toMatchObject({ status: "paid", txnid: "T1", amount_inr: 20700 });
  });

  it("asks PayU to deliver again when access could not be issued, and finishes on the retry", async () => {
    payu.T2 = { status: "success", amt: "20750.00", mihpayid: "M1" };
    fulfilOrder.mockResolvedValueOnce({ ok: false, error: "db down", status: 502 });
    const fields = callback({ txnid: "T2", status: "success", amount: "20750.00" });
    expect((await settlePayuCallback(config, fields, "webhook")).httpStatus).toBe(500);
    expect(orders[0].status).toBe("paid");
    expect((await settlePayuCallback(config, fields, "webhook")).httpStatus).toBe(200);
    expect(fulfilOrder).toHaveBeenCalledTimes(2);
  });

  it("never reopens a cancelled order, and records the money for a person", async () => {
    payu.T9 = { status: "success", amt: "20750.00", mihpayid: "M9" };
    const out = await settlePayuCallback(config, callback({ txnid: "T9", status: "success", amount: "20750.00", mihpayid: "M9" }), "webhook");
    expect(out.message).toBe("Recorded for review");
    expect(orders[1].status).toBe("cancelled");
    expect(fulfilOrder).not.toHaveBeenCalled();
  });

  it("ignores a failure that arrives after the success, intent included", async () => {
    payu.T2 = { status: "success", amt: "20750.00", mihpayid: "M1" };
    await settlePayuCallback(config, callback({ txnid: "T2", status: "success", amount: "20750.00" }), "webhook");
    payu.T2 = { status: "failure", amt: "20750.00", mihpayid: "M1" };
    const late = await settlePayuCallback(config, callback({ txnid: "T2", status: "failure", amount: "20750.00" }), "webhook");
    expect(late.httpStatus).toBe(200);
    expect(orders[0]).toMatchObject({ status: "paid", payu_status: "success" });
    expect(intents[0].status).toBe("succeeded");
    expect(fulfilOrder).toHaveBeenCalledTimes(1);
  });

  it("settles a success that follows a failure of the same attempt", async () => {
    payu.T2 = { status: "failure", amt: "20750.00", mihpayid: "M1" };
    await settlePayuCallback(config, callback({ txnid: "T2", status: "failure", amount: "20750.00" }), "webhook");
    await settlePayuCallback(config, callback({ txnid: "T2", status: "failure", amount: "20750.00" }), "webhook");
    expect(orders[0].status).toBe("pending_payment");
    expect(fulfilOrder).not.toHaveBeenCalled();
    payu.T2 = { status: "success", amt: "20750.00", mihpayid: "M1" };
    await settlePayuCallback(config, callback({ txnid: "T2", status: "success", amount: "20750.00" }), "webhook");
    expect(orders[0].status).toBe("paid");
    expect(intents[0].status).toBe("succeeded");
    expect(fulfilOrder).toHaveBeenCalledTimes(1);
  });

  it("never lets a simultaneous failure undo or block a success (25 runs)", async () => {
    for (let run = 0; run < 25; run++) {
      orders[0] = { ...orders[0], status: "pending_payment", payu_status: undefined, txnid: "T2", amount_inr: 20750 };
      intents[0] = { id: "i1", order_id: "o1", status: "pending" };
      fulfilOrder.mockClear();
      paidTransitions = 0;
      // PayU itself reports success; a forged-looking failure races it.
      payu.T2 = { status: "success", amt: "20750.00", mihpayid: "M1" };
      const calls = [
        settlePayuCallback(config, callback({ txnid: "T2", status: "success", amount: "20750.00" }), "webhook"),
        settlePayuCallback(config, callback({ txnid: "T2", status: "failure", amount: "20750.00" }), "return"),
      ];
      if (run % 2) calls.reverse();
      await Promise.all(calls);
      expect(orders[0].status).toBe("paid");
      expect(paidTransitions).toBe(1);
      expect(intents[0].status).toBe("succeeded");
      expect(fulfilOrder).toHaveBeenCalledTimes(1);
    }
  });

  it("answers 404 for a transaction no order has", async () => {
    const out = await settlePayuCallback(config, callback({ txnid: "NOPE", status: "success", amount: "1.00" }), "webhook");
    expect(out.httpStatus).toBe(404);
  });
});
