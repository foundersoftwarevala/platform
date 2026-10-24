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

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

beforeEach(() => {
  vi.clearAllMocks();
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
  it("returns an error instead of partial counts when a product page fails", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/marketplace_categories")) {
        return json([{ id: "category-1", name: "Category", slug: "category" }]);
      }
      if (url.pathname.endsWith("/marketplace_products")) {
        const offset = url.searchParams.get("offset");
        if (offset === "0") {
          return json(Array.from({ length: 1000 }, () => ({ category_id: "category-1" })));
        }
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
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
