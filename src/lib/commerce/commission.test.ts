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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  process.env.SUPABASE_URL = "http://db.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  order = { id: "o1", status: "paid", buyer_id: "buyer", user_id: null };
  commissions = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const table = url.pathname.replace("/rest/v1/", "");
    const method = init?.method ?? "GET";
    if (table === "marketplace_orders") return json([order]);
    if (table === "marketplace_order_items") {
      return json([{ id: "line1", order_id: "o1", product_id: "p1", seller_id: "s1", product_name: "ERP", line_total: 249, quantity: 1, currency: "USD" }]);
    }
    if (table === "marketplace_sellers") return json([{ owner_user_id: "author" }]);
    if (table === "marketplace_products") return json([{ category_id: null, seller_id: "s1" }]);
    if (table === "marketplace_commission_rules") return json([]);
    if (table === "marketplace_commissions") {
      if (method === "GET") {
        const line = url.searchParams.get("order_item_id")?.replace("eq.", "");
        return json(commissions.filter((c) => c.order_item_id === line));
      }
      const body = JSON.parse(String(init?.body));
      if (commissions.some((c) => c.order_item_id === body.order_item_id)) return json({ code: "23505" }, 409);
      commissions.push(body);
      return json([body], 201);
    }
    return json([]);
  }));
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
    const results = await Promise.all([recordCommissionsForOrder("o1"), recordCommissionsForOrder("o1")]);
    await recordCommissionsForOrder("o1");
    expect(commissions).toHaveLength(1);
    expect(results.reduce((n, r) => n + r.created, 0)).toBe(1);
    expect(commissions[0]).toMatchObject({ order_item_id: "line1", seller_id: "s1", gross_amount: 249, status: "pending" });
  });
});
