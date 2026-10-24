import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route } from "./purchases";

type Get = (ctx: { request: Request }) => Promise<Response>;
type RouteOptions = { server: { handlers: { GET: Get } } };
const getPurchases = (Route.options as typeof Route.options & RouteOptions).server.handlers.GET;

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function order(id: string, createdAt: string) {
  return {
    id,
    created_at: createdAt,
    buyer_id: "buyer-1",
    order_no: id,
    status: "paid",
    total: 12,
    currency: "USD",
    metadata: {},
  };
}

function request() {
  return new Request("https://softwarevala.net/api/account/purchases", {
    headers: { Authorization: "Bearer fixture-token" },
  });
}

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "http://db.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-service");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "fixture-publishable");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("account purchases reads", () => {
  it.each(["licenses", "marketplace_order_items", "finance_invoices"])(
    "returns a server error instead of partial purchases when %s read fails",
    async (failedTable) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: string | URL) => {
          const url = new URL(String(input));
          if (url.pathname.endsWith("/auth/v1/user")) return json({ id: "buyer-1" });
          if (url.pathname.endsWith(`/rest/v1/${failedTable}`)) {
            return json({ error: "database unavailable" }, 503);
          }
          if (url.pathname.endsWith("/rest/v1/marketplace_orders")) {
            return json([order("order-1", "2026-10-24T12:00:00.000Z")]);
          }
          return json([]);
        }),
      );

      const response = await getPurchases({ request: request() });

      expect(response.status).toBe(500);
      expect(await response.json()).toMatchObject({ error: "Could not load your purchases" });
    },
  );

  it("reads every order beyond 100 using the stable created_at/id cursor", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) =>
      order(
        `order-${String(index).padStart(3, "0")}`,
        `2026-10-${String(24 - Math.floor(index / 24)).padStart(2, "0")}T12:00:00.000Z`,
      ),
    );
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/auth/v1/user")) return json({ id: "buyer-1" });
      if (url.pathname.endsWith("/rest/v1/marketplace_orders")) {
        return json(
          url.searchParams.has("or") ? [order("order-100", "2026-10-19T12:00:00.000Z")] : firstPage,
        );
      }
      return json([]);
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await getPurchases({ request: request() });
    const payload = (await response.json()) as { purchases: unknown[]; total: number };
    const orderRequests = fetchMock.mock.calls
      .map(([input]) => new URL(String(input)))
      .filter((url) => url.pathname.endsWith("/rest/v1/marketplace_orders"));

    expect(response.status).toBe(200);
    expect(payload.total).toBe(101);
    expect(payload.purchases).toHaveLength(101);
    expect(orderRequests).toHaveLength(2);
    expect(orderRequests[0]?.searchParams.get("order")).toBe("created_at.desc,id.desc");
    expect(orderRequests[1]?.searchParams.get("or")).toContain("created_at.lt.");
    expect(orderRequests[1]?.searchParams.get("or")).toContain("id.lt.order-099");
  });
});
