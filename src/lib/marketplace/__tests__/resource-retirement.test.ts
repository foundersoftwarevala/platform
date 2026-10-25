import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  operator: vi.fn(),
  catalogueChanged: vi.fn(),
}));

vi.mock("@/lib/auth/internal-guard", () => ({
  requireInternalOperator: mocks.operator,
}));
vi.mock("@/lib/seo/seo-store.server", () => ({
  storeOwns: () => false,
  readResourceRows: vi.fn(),
}));
vi.mock("@/lib/marketplace/catalogue-invalidation", () => ({
  catalogueChanged: mocks.catalogueChanged,
  STOREFRONT_TABLES: new Set(["marketplace_products"]),
}));

import { Route } from "@/routes/api/manager/resource";

type Handler = (ctx: { request: Request }) => Promise<Response>;
type DeleteOptions = { server: { handlers: { DELETE: Handler } } };
const retire = (Route.options as typeof Route.options & DeleteOptions).server.handlers.DELETE;
const id = "11111111-1111-4111-8111-111111111111";
const request = (resource: string, rowId = id) =>
  new Request(`https://softwarevala.net/api/manager/resource?resource=${resource}&id=${rowId}`, {
    method: "DELETE",
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUPABASE_URL", "http://db.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-service");
  mocks.operator.mockResolvedValue({ ok: true, via: "internal token" });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("manager resource retirement", () => {
  it.each([
    ["products", "marketplace_products", { visible: false, content_status: "archived" }],
    ["reseller_commission_rules", "reseller_commission_rules", { active: false }],
  ] as const)(
    "archives %s using PATCH and records an audit without deleting data",
    async (resource, table, archive) => {
      const row = { id, ...archive };
      const fetch = vi.fn(async (input: string | URL | Request, _init?: RequestInit) =>
        String(input).endsWith("/rpc/mm_audit_operator")
          ? Response.json({ ok: true })
          : Response.json([row]),
      );
      vi.stubGlobal("fetch", fetch);
      const response = await retire({ request: request(resource) });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true, row, retired: archive });
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/rest/v1/${table}?id=eq.${id}`),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify(archive),
          headers: expect.objectContaining({ Prefer: "return=representation" }),
        }),
      );
      expect(fetch).toHaveBeenCalledWith(
        "http://db.test/rest/v1/rpc/mm_audit_operator",
        expect.objectContaining({ method: "POST" }),
      );
      expect(fetch.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
      expect(mocks.catalogueChanged).toHaveBeenCalledTimes(resource === "products" ? 1 : 0);
      expect(console.error).not.toHaveBeenCalled();
    },
  );

  it.each(["vala_tv_videos", "vala_tv_categories", "franchise_notifications"])(
    "does not enable retirement for %s merely because retirable is true",
    async (resource) => {
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      const response = await retire({ request: request(resource) });
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        error: expect.stringContaining("cannot be retired"),
      });
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("rejects invalid ids before any database request", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const response = await retire({ request: request("products", "invalid") });
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("preserves the authorization gate", async () => {
    const denied = Response.json({ error: "Unauthorized" }, { status: 401 });
    mocks.operator.mockResolvedValue({ ok: false, response: denied });
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await retire({ request: request("products") })).toBe(denied);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports a missing row without auditing or invalidating the catalogue", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json([]));
    vi.stubGlobal("fetch", fetch);
    const response = await retire({ request: request("products") });
    expect(response.status).toBe(404);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(mocks.catalogueChanged).not.toHaveBeenCalled();
  });

  it("reports and logs a failed archive write", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ error: "unavailable" }, { status: 503 }));
    vi.stubGlobal("fetch", fetch);
    const response = await retire({ request: request("products") });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "That row was not retired" });
    expect(console.error).toHaveBeenCalledWith(
      "[manager] retire failed",
      "marketplace_products",
      503,
    );
    expect(mocks.catalogueChanged).not.toHaveBeenCalled();
  });
});
