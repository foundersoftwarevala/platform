import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./commission", () => ({
  recordCommissionsForOrder: vi.fn(async () => ({
    ok: true,
    created: 0,
    skipped: 0,
    unattributed: 0,
  })),
}));
vi.mock("./mailer", () => ({
  licenceEmail: vi.fn(() => ({ subject: "License", html: "<p>License</p>" })),
  send: vi.fn(async () => ({ sent: true, reason: "sent", queued: true })),
}));
vi.mock("@/lib/i18n/server-translate.server", () => ({
  serverTranslator: vi.fn(async () => ({ t: (key: string) => key, lang: "en" })),
}));
vi.mock("./invoices", () => ({
  createInvoiceForOrder: vi.fn(async () => ({
    created: true,
    invoice: { id: "invoice-1", invoice_no: "SV-INV-1" },
  })),
}));

const { fulfilOrder, revokeOrderAccess } = await import("./fulfilment");
const { recordCommissionsForOrder } = await import("./commission");
const { send } = await import("./mailer");
const { createInvoiceForOrder } = await import("./invoices");

const order = {
  id: "order-1",
  buyer_id: "buyer-1",
  status: "paid",
  metadata: {},
  order_no: "SV-1",
  total: 100,
  currency: "USD",
};
const line = {
  id: "line-1",
  product_id: "product-1",
  product_name: "Product",
  seller_id: "seller-1",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_URL = "https://database.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
});

describe("order fulfillment reliability", () => {
  it("throws instead of treating an order-line read failure as an empty order", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const path = new URL(String(input)).pathname;
        if (path.endsWith("/marketplace_orders")) return json([order]);
        if (path.endsWith("/marketplace_order_items")) return json({ message: "read failed" }, 503);
        throw new Error(`Unexpected request: ${path}`);
      }),
    );

    await expect(fulfilOrder("order-1")).rejects.toThrow("Could not read order lines");
  });

  it("throws when entitlement persistence fails after creating a license", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const path = new URL(String(input)).pathname;
        if (path.endsWith("/marketplace_orders")) return json([order]);
        if (path.endsWith("/marketplace_order_items")) return json([line]);
        if (path.endsWith("/profiles")) return json([]);
        if (path.endsWith("/licenses") && !init?.method) return json([]);
        if (path.endsWith("/marketplace_licenses"))
          return json([{ license_key: "MARKET-LICENSE" }]);
        if (path.endsWith("/licenses") && init?.method === "POST")
          return json([{ id: "license-1", license_key: "MARKET-LICENSE" }], 201);
        if (path.endsWith("/entitlements")) return json({ message: "write failed" }, 503);
        if (path.endsWith("/payment_logs")) return new Response(null, { status: 201 });
        throw new Error(`Unexpected request: ${path}`);
      }),
    );

    await expect(fulfilOrder("order-1")).rejects.toThrow("Could not grant product access");
  });

  it("repairs a partial fulfillment when a license already exists", async () => {
    const requests: { path: string; method: string }[] = [];
    vi.mocked(recordCommissionsForOrder).mockRejectedValueOnce(
      new Error("temporary commission failure"),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const path = new URL(String(input)).pathname;
        const method = init?.method ?? "GET";
        requests.push({ path, method });
        if (path.endsWith("/marketplace_orders")) return json([order]);
        if (path.endsWith("/marketplace_order_items")) return json([line]);
        if (path.endsWith("/profiles"))
          return json([{ email: "buyer@example.test", full_name: "Buyer" }]);
        if (path.endsWith("/licenses")) return json([{ id: "license-1", license_key: "EXISTING" }]);
        if (path.endsWith("/marketplace_licenses"))
          return json([{ license_key: "MARKET-LICENSE" }]);
        if (path.endsWith("/entitlements")) return json([{ id: "entitlement-1" }], 201);
        if (path.endsWith("/email_outbox")) return json([]);
        if (path.endsWith("/payment_logs")) return new Response(null, { status: 201 });
        throw new Error(`Unexpected request: ${path}`);
      }),
    );

    await expect(fulfilOrder("order-1")).rejects.toThrow("temporary commission failure");
    expect(createInvoiceForOrder).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();

    await expect(fulfilOrder("order-1")).resolves.toMatchObject({
      ok: true,
      created: false,
      licenceKey: "EXISTING",
      licenceId: "license-1",
      entitlementId: "entitlement-1",
    });
    expect(requests).toContainEqual({ path: "/rest/v1/entitlements", method: "POST" });
    expect(requests.some((request) => request.path === "/rest/v1/email_outbox")).toBe(true);
    expect(recordCommissionsForOrder).toHaveBeenCalledTimes(2);
    expect(recordCommissionsForOrder).toHaveBeenNthCalledWith(2, "order-1");
    expect(createInvoiceForOrder).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("fails fulfillment when commission processing throws so the webhook can retry", async () => {
    vi.mocked(recordCommissionsForOrder).mockRejectedValueOnce(new Error("seller read failed"));
    const paymentEvents: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const path = new URL(String(input)).pathname;
        if (path.endsWith("/marketplace_orders")) return json([order]);
        if (path.endsWith("/marketplace_order_items")) return json([line]);
        if (path.endsWith("/profiles")) return json([]);
        if (path.endsWith("/licenses") && !init?.method) return json([]);
        if (path.endsWith("/marketplace_licenses"))
          return json([{ license_key: "MARKET-LICENSE" }]);
        if (path.endsWith("/licenses") && init?.method === "POST")
          return json([{ id: "license-1", license_key: "MARKET-LICENSE" }], 201);
        if (path.endsWith("/entitlements")) return json([{ id: "entitlement-1" }], 201);
        if (path.endsWith("/invoices")) return json([]);
        if (path.endsWith("/payment_logs")) {
          const body = JSON.parse(String(init?.body));
          paymentEvents.push(body.event_type);
          return new Response(null, { status: 201 });
        }
        throw new Error(`Unexpected request: ${path}`);
      }),
    );

    await expect(fulfilOrder("order-1")).rejects.toThrow("seller read failed");
    expect(paymentEvents).toContain("commission_failed");
  });

  it("uses a single database RPC for atomic license and entitlement revocation", async () => {
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/payment_logs")) return new Response(null, { status: 201 });
      expect(path).toBe("/rest/v1/rpc/revoke_order_access");
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual({
        p_order_id: "order-1",
        p_reason: "chargeback",
      });
      return json({ ok: true, licenses: 1, entitlements: 1 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(revokeOrderAccess("order-1", "chargeback")).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
