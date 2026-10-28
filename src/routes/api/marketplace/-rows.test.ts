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
type Write = (ctx: { request: Request }) => Promise<Response>;
type RouteOptions = { server: { handlers: { GET: Get; PATCH: Write; PUT: Write } } };
const getRows = (Route.options as typeof Route.options & RouteOptions).server.handlers.GET;
const patchRow = (Route.options as typeof Route.options & RouteOptions).server.handlers.PATCH;
const reorderRows = (Route.options as typeof Route.options & RouteOptions).server.handlers.PUT;
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

  it("does not expose hidden rows to a developer-only caller", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const request = new URL(String(input));
      if (request.pathname.endsWith("/marketplace_categories")) {
        return json([{ id: "hidden-category", name: "Hidden", slug: "hidden", is_hidden: true }]);
      }
      if (request.pathname.endsWith("/rpc/marketplace_home_category_counts")) {
        return json([{ category_id: "hidden-category", product_count: 0 }]);
      }
      return json({ error: "unexpected request" }, 500);
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await getRows({
      request: new Request("https://softwarevala.net/api/marketplace/rows"),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ rows: [], total: 0 });
    const readGate = mocks.requireInternalOperator.mock.calls[0]?.[1];
    expect(readGate?.allowedRoles).toEqual(
      expect.arrayContaining(["boss", "admin", "super_admin", "owner"]),
    );
    expect(readGate?.allowedRoles).not.toContain("developer");
  });

  it.each([
    ["PATCH", patchRow, { id: "00000000-0000-4000-8000-000000000001", is_hidden: true }],
    ["PUT", reorderRows, { order: ["00000000-0000-4000-8000-000000000001"] }],
  ] as const)(
    "denies developer-only category writes before database access (%s)",
    async (_, handler, body) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      mocks.requireInternalOperator.mockResolvedValue({
        ok: false,
        response: new Response("Forbidden", { status: 403 }),
      });

      const response = await handler({
        request: new Request("https://softwarevala.net/api/marketplace/rows", {
          method: _,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      });

      expect(response.status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
      const writeGate = mocks.requireInternalOperator.mock.calls[0]?.[1];
      expect(writeGate?.allowedRoles).toEqual(
        expect.arrayContaining(["boss", "admin", "super_admin", "owner"]),
      );
      expect(writeGate?.allowedRoles).not.toContain("developer");
    },
  );
});
