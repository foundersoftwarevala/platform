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
type PostOptions = { server: { handlers: { POST: Handler } } };
const create = (Route.options as typeof Route.options & PostOptions).server.handlers.POST;

const franchiseId = "11111111-1111-4111-8111-111111111111";
const productId = "22222222-2222-4222-8222-222222222222";
const ownerId = "33333333-3333-4333-8333-333333333333";

function request(resource: string, values: Record<string, unknown>) {
  return new Request("https://softwarevala.net/api/manager/resource", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resource, values }),
  });
}

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

describe("franchise manager create links", () => {
  it("resolves the directory email to an existing owner account before creating", async () => {
    const inserted = {
      id: franchiseId,
      name: "North Franchise",
      owner_user_id: ownerId,
      email: "owner@example.test",
    };
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/rpc/franchise_owner_id_for_email")) return Response.json(ownerId);
      if (url.endsWith("/rpc/mm_audit")) return Response.json({ ok: true });
      if (init?.method === "POST") return Response.json([inserted]);
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetch);

    const response = await create({
      request: request("franchises", {
        code: "NORTH-01",
        franchise: "North Franchise",
        owner_name: "Account Owner",
        email: " OWNER@example.test ",
        phone: "+1-555-0100",
      }),
    });

    expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, row: inserted });
    expect(fetch).toHaveBeenCalledWith(
      "http://db.test/rest/v1/rpc/franchise_owner_id_for_email",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ p_email: "OWNER@example.test" }),
      }),
    );
    const insertCall = fetch.mock.calls.find(
      ([input, init]) => String(input).includes("/rest/v1/franchises?") && init?.method === "POST",
    );
    expect(JSON.parse(String(insertCall?.[1]?.body))).toMatchObject({
      code: "NORTH-01",
      name: "North Franchise",
      email: "OWNER@example.test",
      owner_user_id: ownerId,
    });
  });

  it("refuses a directory row if the email has no matching account", async () => {
    const fetch = vi.fn(async (input: string | URL | Request) =>
      String(input).endsWith("/rpc/franchise_owner_id_for_email")
        ? Response.json(null)
        : Response.json({ ok: true }),
    );
    vi.stubGlobal("fetch", fetch);

    const response = await create({
      request: request("franchises", {
        code: "NORTH-02",
        franchise: "North Franchise",
        owner_name: "Account Owner",
        email: "missing@example.test",
        phone: "+1-555-0100",
      }),
    });

    expect(response.status, JSON.stringify(await response.clone().json())).toBe(422);
    expect(await response.json()).toEqual({
      error: "No existing account matches this franchise contact email",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("requires and saves the franchise link for a lead", async () => {
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) =>
      String(input).endsWith("/rpc/mm_audit")
        ? Response.json({ ok: true })
        : Response.json([{ id: productId, franchise_id: franchiseId, name: "Lead" }]),
    );
    vi.stubGlobal("fetch", fetch);

    const missingId = await create({
      request: request("franchise_leads", { name: "A valid lead" }),
    });
    expect(missingId.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();

    const response = await create({
      request: request("franchise_leads", {
        franchise_id: franchiseId,
        name: "A valid lead",
      }),
    });
    expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
    const insertCall = fetch.mock.calls.find(([, init]) => init?.method === "POST");
    expect(String(insertCall?.[0])).toContain("/rest/v1/franchise_leads?");
    expect(JSON.parse(String(insertCall?.[1]?.body))).toMatchObject({
      franchise_id: franchiseId,
      name: "A valid lead",
    });
  });

  it("creates product assignments as active links between franchise and product", async () => {
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) =>
      String(input).endsWith("/rpc/mm_audit")
        ? Response.json({ ok: true })
        : Response.json([
            { id: productId, franchise_id: franchiseId, product_id: productId, active: true },
          ]),
    );
    vi.stubGlobal("fetch", fetch);

    const response = await create({
      request: request("franchise_product_assignments", {
        franchise_id: franchiseId,
        product_id: productId,
      }),
    });

    expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
    const insertCall = fetch.mock.calls.find(([, init]) => init?.method === "POST");
    expect(String(insertCall?.[0])).toContain("/rest/v1/franchise_product_assignments?");
    expect(JSON.parse(String(insertCall?.[1]?.body))).toEqual({
      franchise_id: franchiseId,
      product_id: productId,
      active: true,
    });
  });
});
