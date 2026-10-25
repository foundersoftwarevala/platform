import { beforeEach, describe, expect, it, vi } from "vitest";

import { recordCommissionsForOrder } from "./commission";

/**
 * Author and vendor commission on an order. The database is an in-memory
 * stand-in that keeps marketplace_commissions unique per order line, as the
 * real table does.
 */

type Row = Record<string, unknown>;
let order: Row;
let commissions: Row[];
let commissionRules: Row[];
let orderItems: Row[];
let sellerReadStatus: number;
let ruleReadStatus: number;

function json(body: unknown, status = 200) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (Array.isArray(body)) {
    headers.set(
      "content-range",
      body.length ? `0-${body.length - 1}/${body.length}` : "*/0",
    );
  }
  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}

beforeEach(() => {
  process.env.SUPABASE_URL = "http://db.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  order = { id: "o1", status: "paid", buyer_id: "buyer", user_id: null };
  commissions = [];
  commissionRules = [];
  orderItems = [
    {
      id: "line1",
      order_id: "o1",
      product_id: "p1",
      seller_id: "s1",
      product_name: "ERP",
      line_total: 249,
      quantity: 1,
      currency: "USD",
    },
  ];
  sellerReadStatus = 200;
  ruleReadStatus = 200;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const table = url.pathname.replace("/rest/v1/", "");
      const method = init?.method ?? "GET";
      if (table === "marketplace_orders") return json([order]);
      if (table === "marketplace_order_items") return json(orderItems);
      if (table === "marketplace_sellers")
        return sellerReadStatus === 200
          ? json([{ id: "s1", owner_user_id: "author" }])
          : json({}, sellerReadStatus);
      if (table === "marketplace_products")
        return json([{ id: "p1", category_id: null, seller_id: "s1" }]);
      if (table === "marketplace_commission_rules")
        return ruleReadStatus === 200 ? json(commissionRules) : json({}, ruleReadStatus);
      if (table === "marketplace_commissions") {
        if (method === "GET") {
          const filter = url.searchParams.get("order_item_id") ?? "";
          const ids = filter.startsWith("in.(")
            ? filter.slice(4, -1).split(",")
            : [filter.replace("eq.", "")];
          return json(commissions.filter((c) => ids.includes(String(c.order_item_id))));
        }
        const body = JSON.parse(String(init?.body));
        if (commissions.some((c) => c.order_item_id === body.order_item_id))
          return json({ code: "23505" }, 409);
        commissions.push(body);
        return json([body], 201);
      }
      return json([]);
    }),
  );
});

describe("author commission", () => {
  it("is refused for an order that is not paid", async () => {
    for (const status of ["pending_payment", "cancelled", "refunded"]) {
      order.status = status;
      const out = await recordCommissionsForOrder("o1");
      expect(out.ok).toBe(false);
    }
    expect(commissions).toHaveLength(0);
  });

  it("is not paid to someone buying their own product", async () => {
    order.buyer_id = "author";
    const out = await recordCommissionsForOrder("o1");
    expect(out).toMatchObject({ created: 0, skipped: 1 });
    expect(commissions).toHaveLength(0);
  });

  it("is recorded once for a paid sale, however often or concurrently it is asked", async () => {
    const results = await Promise.all([
      recordCommissionsForOrder("o1"),
      recordCommissionsForOrder("o1"),
    ]);
    await recordCommissionsForOrder("o1");
    expect(commissions).toHaveLength(1);
    expect(results.reduce((n, r) => n + r.created, 0)).toBe(1);
    expect(commissions[0]).toMatchObject({
      order_item_id: "line1",
      seller_id: "s1",
      gross_amount: 249,
      status: "pending",
    });
  });

  it("rejects an author commission rule in a different currency", async () => {
    commissionRules = [
      {
        id: "rule-1",
        seller_id: "s1",
        product_id: null,
        category_id: null,
        rate_percent: 30,
        fixed_amount: 0,
        priority: 1,
        currency: "INR",
        active: true,
      },
    ];

    const result = await recordCommissionsForOrder("o1");

    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("does not match") });
    expect(commissions).toHaveLength(0);
  });

  it("throws when the seller owner read fails instead of treating it as no seller", async () => {
    sellerReadStatus = 503;

    await expect(recordCommissionsForOrder("o1")).rejects.toThrow("Seller owner read failed");
    expect(commissions).toHaveLength(0);
  });

  it("throws when the commission rule read fails instead of applying the default rate", async () => {
    ruleReadStatus = 503;

    await expect(recordCommissionsForOrder("o1")).rejects.toThrow("Commission rules read failed");
    expect(commissions).toHaveLength(0);
  });

  it("loads existing commissions, products, owners, and active rules outside the item loop", async () => {
    orderItems = [
      {
        id: "line1",
        order_id: "o1",
        product_id: "p1",
        seller_id: "s1",
        product_name: "ERP",
        line_total: 249,
        quantity: 1,
        currency: "USD",
      },
      {
        id: "line2",
        order_id: "o1",
        product_id: "p1",
        seller_id: "s1",
        product_name: "ERP",
        line_total: 149,
        quantity: 1,
        currency: "USD",
      },
    ];

    const result = await recordCommissionsForOrder("o1");
    const calls = vi.mocked(fetch).mock.calls.map(([input]) => new URL(String(input)).pathname);

    expect(result).toMatchObject({ ok: true, created: 2 });
    expect(calls.filter((path) => path.endsWith("/marketplace_commissions"))).toHaveLength(3);
    expect(calls.filter((path) => path.endsWith("/marketplace_products"))).toHaveLength(1);
    expect(calls.filter((path) => path.endsWith("/marketplace_sellers"))).toHaveLength(1);
    expect(calls.filter((path) => path.endsWith("/marketplace_commission_rules"))).toHaveLength(1);
  });
});
