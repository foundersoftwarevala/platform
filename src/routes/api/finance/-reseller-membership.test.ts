import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  bearerToken: vi.fn(),
  userFromBearerToken: vi.fn(),
}));

vi.mock("@/lib/auth/bearer-user.server", () => mocks);

import { Route } from "./reseller-membership";

type Post = (ctx: { request: Request }) => Promise<Response>;
type RouteOptions = { server: { handlers: { POST: Post } } };
const verifyMembership = (Route.options as typeof Route.options & RouteOptions).server.handlers
  .POST;

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function request(authorization = "Bearer finance-token") {
  return new Request("https://softwarevala.net/api/finance/reseller-membership", {
    method: "POST",
    headers: { Authorization: authorization, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "verify", orderId: "order-1", status: "SUCCESS" }),
  });
}

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "http://db.test");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "fixture-publishable");
  mocks.bearerToken.mockImplementation((authorization: string | null) =>
    authorization?.startsWith("Bearer ") ? authorization.slice(7) : null,
  );
  mocks.userFromBearerToken.mockResolvedValue({ id: "finance-user", email: "finance@test" });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("reseller membership verification authorization", () => {
  it("requires a bearer session before making database requests", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await verifyMembership({ request: request("invalid") });

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 403 and does not call the payment RPC for non-finance users", async () => {
    const fetchMock = vi.fn(async (_input: string | URL, _init?: RequestInit) =>
      json([{ role: "reseller" }]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await verifyMembership({ request: request() });

    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/rest/v1/user_roles?select=role&user_id=eq.finance-user",
    );
  });

  it.each(["admin", "boss", "finance"])(
    "allows the %s role to reach the database-guarded verification RPC",
    async (role) => {
      const fetchMock = vi.fn(async (input: string | URL, _init?: RequestInit) =>
        String(input).includes("/user_roles") ? json([{ role }]) : json({ ok: true }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const response = await verifyMembership({ request: request() });

      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const rpcCall = fetchMock.mock.calls[1];
      expect(String(rpcCall?.[0])).toContain("/rpc/verify_reseller_membership_payment");
      expect((rpcCall?.[1] as RequestInit).headers).toMatchObject({
        Authorization: "Bearer finance-token",
      });
      expect(JSON.parse(String((rpcCall?.[1] as RequestInit).body))).toEqual({
        p_order_id: "order-1",
        p_status: "SUCCESS",
        p_provider_reference: null,
      });
    },
  );

  it("fails closed when the caller's roles cannot be verified", async () => {
    const fetchMock = vi.fn(async (_input: string | URL, _init?: RequestInit) =>
      json({ error: "unavailable" }, 503),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await verifyMembership({ request: request() });

    expect(response.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails closed when bearer authentication fails", async () => {
    mocks.userFromBearerToken.mockResolvedValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await verifyMembership({ request: request() });

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
