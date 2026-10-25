import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rateLimited: vi.fn(),
  requireInternalOperator: vi.fn(),
  onCatalogueChange: vi.fn(),
}));

vi.mock("@/lib/server/rate-limit", () => ({ rateLimited: mocks.rateLimited }));
vi.mock("@/lib/auth/internal-guard", () => ({
  requireInternalOperator: mocks.requireInternalOperator,
}));
vi.mock("@/lib/marketplace/catalogue-invalidation", () => ({
  onCatalogueChange: mocks.onCatalogueChange,
}));

import { Route } from "./rows";

type Get = (ctx: { request: Request }) => Promise<Response>;
type RouteOptions = { server: { handlers: { GET: Get } } };
const getRows = (Route.options as typeof Route.options & RouteOptions).server.handlers.GET;
const invalidateRows = mocks.onCatalogueChange.mock.calls[0]?.[0] as (() => void) | undefined;

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

beforeEach(() => {
  vi.clearAllMocks();
  invalidateRows?.();
  vi.stubEnv("SUPABASE_URL", "http://db.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-service");
  mocks.rateLimited.mockReturnValue(null);
  mocks.requireInternalOperator.mockResolvedValue({ ok: false });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("marketplace category row reads", () => {
  it("returns an error instead of partial counts when the database aggregate fails", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/marketplace_categories")) {
        return json([{ id: "category-1", name: "Category", slug: "category" }]);
      }
      if (url.pathname.endsWith("/rpc/marketplace_home_category_counts")) {
        return json({ error: "database unavailable" }, 503);
      }
      return json({ error: "unexpected request" }, 500);
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await getRows({
      request: new Request("https://softwarevala.net/api/marketplace/rows"),
    });

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      rows: [],
      error: "Could not load rows",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new URL(String(fetchMock.mock.calls[1]?.[0])).pathname).toContain(
      "/rpc/marketplace_home_category_counts",
    );
  });

  it("uses the database GROUP BY result without fetching product rows", async () => {
    const productCount = 8501;
    const fetchMock = vi.fn(async (input: string | URL) => {
      const request = new URL(String(input));
      if (request.pathname.endsWith("/marketplace_categories")) {
        return json([{ id: "category-1", name: "Category", slug: "category", sort_order: 1 }]);
      }
      if (request.pathname.endsWith("/rpc/marketplace_home_category_counts")) {
        return json([{ category_id: "category-1", product_count: productCount }]);
      }
      return json({ error: "unexpected request" }, 500);
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await getRows({
      request: new Request("https://softwarevala.net/api/marketplace/rows"),
    });
    const payload = (await response.json()) as {
      rows: { products: number }[];
    };

    expect(response.status).toBe(200);
    expect(payload.rows[0]?.products).toBe(productCount);
    const aggregateRequests = fetchMock.mock.calls
      .map(([input]) => new URL(String(input)))
      .filter((request) => request.pathname.endsWith("/rpc/marketplace_home_category_counts"));
    expect(aggregateRequests).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
