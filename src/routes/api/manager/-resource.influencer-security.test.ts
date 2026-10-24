import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (context: { request: Request }) => Promise<Response>;
type RouteHandlers = {
  GET: Handler;
  POST: Handler;
  DELETE: Handler;
  PATCH: Handler;
};

const state = vi.hoisted(() => ({
  handlers: null as RouteHandlers | null,
  role: undefined as string | undefined,
  roles: [] as string[],
  authenticated: true,
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { server: { handlers: RouteHandlers } }) => {
    state.handlers = options.server.handlers;
    return options;
  },
}));
vi.mock("@/lib/auth/internal-guard", () => ({
  requireInternalOperator: async () =>
    state.authenticated
      ? { ok: true, via: `operator:${state.role}`, role: state.role, roles: state.roles }
      : { ok: false, response: Response.json({ error: "Sign in required" }, { status: 401 }) },
}));
vi.mock("@/lib/marketplace/catalogue-invalidation", () => ({
  STOREFRONT_TABLES: new Set<string>(),
  catalogueChanged: vi.fn(),
}));
vi.mock("@/lib/seo/seo-store.server", () => ({
  readResourceRows: vi.fn(),
  storeOwns: () => false,
}));
vi.mock("@/lib/marketplace/product-safety", () => ({
  logProductReview: vi.fn(),
  productCreationReview: vi.fn(),
  productReviewFields: vi.fn(),
}));

import "./resource";

const payoutId = "c733350b-27f5-424e-9b21-f6b837c48018";

function call(
  method: keyof RouteHandlers,
  resource: string,
  role: string | undefined,
  payload?: Record<string, unknown>,
  query = "",
): Promise<Response> {
  if (!state.handlers) throw new Error("Manager resource handlers were not registered");
  state.role = role;
  state.roles = role ? [role] : [];
  const url = `https://fixture.invalid/api/manager/resource?resource=${resource}${query}`;
  const request = new Request(url, {
    method,
    headers: {
      authorization: "Bearer fixture",
      ...(payload ? { "content-type": "application/json" } : {}),
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  return state.handlers[method]({ request });
}

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://supabase.fixture.invalid");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-fixture");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "publishable-fixture");
  state.role = undefined;
  state.roles = [];
  state.authenticated = true;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("manager resource influencer authorization", () => {
  it("rejects unauthenticated access before reading influencer PII", async () => {
    state.authenticated = false;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect((await call("GET", "influencer", undefined)).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["developer", "marketing", "seo", "finance", "support"])(
    "denies %s and ignores a client-supplied admin role",
    async (role) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const response = await call("PATCH", "influencer", role, {
        resource: "influencer",
        id: payoutId,
        role: "admin",
        changes: { status: "active" },
      });
      expect(response.status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("does not treat the shared internal token as an influencer-manager role", async () => {
    state.role = undefined;
    state.roles = [];
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect((await call("GET", "influencer", undefined)).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["admin", "boss"])("allows verified %s access to the roster", async (role) => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(JSON.stringify([{ id: payoutId, email: "creator@example.test" }]), {
          status: 200,
          headers: { "content-range": "0-0/1" },
        }),
    );

    const response = await call("GET", "influencer", role);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      rows: [{ email: "creator@example.test" }],
    });
  });

  it("uses all verified roles for a multi-role operator", async () => {
    state.role = "developer";
    state.roles = ["developer", "admin"];
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(JSON.stringify([{ id: payoutId, email: "creator@example.test" }]), {
          status: 200,
          headers: { "content-range": "0-0/1" },
        }),
    );

    const response = await state.handlers!.GET({
      request: new Request("https://fixture.invalid/api/manager/resource?resource=influencer"),
    });
    expect(response.status).toBe(200);
  });

  it("routes influencer status changes through the lifecycle RPC, not generic PATCH", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await call("PATCH", "influencer", "admin", {
      resource: "influencer",
      id: payoutId,
      changes: { status: "suspended" },
    });
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("removes application PII and decisions from the generic service-role resource API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const read = await call("GET", "influencer_applications", "admin");
    const decision = await call("PATCH", "influencer_applications", "admin", {
      resource: "influencer_applications",
      id: payoutId,
      changes: { status: "approved" },
    });
    expect(read.status).toBe(400);
    expect(decision.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("denies payout access to broader internal-operator roles before service-role reads", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await call("GET", "influencer_order_payouts", "developer");
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("scopes generic partner commission reads away from influencer PII for broader operators", async () => {
    let requestedUrl = "";
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify([{ id: payoutId, partner_kind: "author" }]), {
        status: 200,
        headers: { "content-range": "0-0/1" },
      });
    });

    const response = await call("GET", "partner_commissions", "developer");

    expect(response.status).toBe(200);
    expect(requestedUrl).toContain("partner_kind=neq.influencer");
  });

  it("prevents generic partner commission updates from reaching influencer rows", async () => {
    const requestedUrls: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      requestedUrls.push(String(input));
      if (init?.method === "PATCH") return new Response("[]", { status: 200 });
      return new Response("[]", { status: 200 });
    });

    const response = await call("PATCH", "partner_commissions", "developer", {
      resource: "partner_commissions",
      id: payoutId,
      changes: { status: "approved" },
    });

    expect(response.status).toBe(409);
    expect(requestedUrls).toHaveLength(2);
    expect(requestedUrls.every((url) => url.includes("partner_kind=neq.influencer"))).toBe(true);
  });

  it("makes a direct requested-to-completed payout jump conditional on processing state", async () => {
    const writes: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = String(input);
      writes.push({ url: requestUrl, init });
      if (init?.method === "PATCH") return new Response("[]", { status: 200 });
      return new Response(JSON.stringify([{ id: payoutId, status: "requested" }]), {
        status: 200,
      });
    });

    const response = await call("PATCH", "influencer_order_payouts", "admin", {
      resource: "influencer_order_payouts",
      id: payoutId,
      changes: { status: "completed" },
    });
    expect(response.status).toBe(409);
    const write = writes.find(({ init }) => init?.method === "PATCH");
    expect(write?.url).toContain("status=in.(processing)");
  });

  it("allows only a valid payout transition and stamps its transition time", async () => {
    const writes: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = String(input);
      writes.push({ url: requestUrl, init });
      if (init?.method === "PATCH") {
        return new Response(JSON.stringify([{ id: payoutId, status: "approved" }]), {
          status: 200,
        });
      }
      if (requestUrl.endsWith("/rpc/mm_audit")) return new Response("null", { status: 200 });
      return new Response(JSON.stringify([{ id: payoutId, status: "requested" }]), {
        status: 200,
      });
    });

    const response = await call("PATCH", "influencer_order_payouts", "boss", {
      resource: "influencer_order_payouts",
      id: payoutId,
      changes: { status: "approved" },
    });
    expect(response.status).toBe(200);
    const write = writes.find(({ init }) => init?.method === "PATCH");
    expect(write?.url).toContain("status=in.(requested)");
    expect(JSON.parse(String(write?.init?.body))).toMatchObject({
      status: "approved",
      approved_at: expect.any(String),
    });
  });

  it("keeps legacy influencer payouts read-only", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await call("PATCH", "influencer_payouts", "admin", {
      resource: "influencer_payouts",
      id: payoutId,
      changes: { status: "paid" },
    });
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
