import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOperator: vi.fn(),
  withVpsDatabase: vi.fn(),
  queries: [] as { sql: string; values: unknown[] }[],
  failAudit: false,
}));

vi.mock("@/lib/auth/internal-guard", () => ({
  requireInternalOperator: mocks.requireOperator,
}));
vi.mock("@/lib/marketplace-manager/vps-rpc.server", () => ({
  withVpsPublicDatabase: mocks.withVpsDatabase,
}));

import { DEFAULT_ACTIONS, REGISTRY_KEY } from "@/lib/marketplace/action-layer";
import { Route } from "./registry";

type Handler = (context: { request: Request }) => Promise<Response>;
type RouteOptions = {
  server: { handlers: { GET: Handler; PATCH: Handler } };
};
const handlers = (Route.options as typeof Route.options & RouteOptions).server.handlers;

function fakeTx(strings: TemplateStringsArray, ...values: unknown[]) {
  const sql = strings.join("?");
  mocks.queries.push({ sql, values });
  if (mocks.failAudit && sql.includes("public.mm_audit")) {
    throw new Error("audit write refused");
  }
  if (sql.includes("from public.system_settings") && sql.includes("for update")) {
    return Promise.resolve([]);
  }
  if (sql.includes("from public.system_settings")) return Promise.resolve([]);
  if (sql.includes("from public.marketplace_products")) {
    return Promise.resolve([{ visible: 5, with_demo: 2, purchasable: 3, hidden: 1 }]);
  }
  return Promise.resolve([]);
}

const USER_ID = "00000000-0000-4000-8000-000000000001";
const USER_TOKEN = `Bearer header.${Buffer.from(JSON.stringify({ sub: USER_ID })).toString("base64url")}.signature`;

function request(method: "GET" | "PATCH", body?: unknown, auth = USER_TOKEN) {
  return new Request("http://127.0.0.1/api/actions/registry", {
    method,
    headers: {
      ...(auth ? { Authorization: auth } : {}),
      ...(method === "PATCH" ? { "Content-Type": "application/json" } : {}),
    },
    ...(method === "PATCH" ? { body: JSON.stringify(body) } : {}),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.queries.length = 0;
  mocks.failAudit = false;
  vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:3010");
  mocks.requireOperator.mockResolvedValue({ ok: true, via: "operator:admin", role: "admin" });
  mocks.withVpsDatabase.mockImplementation((run: (tx: typeof fakeTx) => Promise<unknown>) =>
    run(fakeTx),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("VPS Action Layer registry", () => {
  it("reads defaults and product counts through the VPS PostgreSQL helper", async () => {
    const response = await handlers.GET({ request: request("GET") });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      configured: false,
      source: "defaults (nothing stored yet)",
      actions: DEFAULT_ACTIONS,
      environment: { products_visible: 5, products_with_demo: 2 },
    });
    expect(mocks.requireOperator).toHaveBeenCalledOnce();
    expect(mocks.withVpsDatabase).toHaveBeenCalledTimes(2);
    expect(mocks.queries.map((q) => q.sql).join("\n")).toContain("public.system_settings");
    expect(mocks.queries.map((q) => q.sql).join("\n")).toContain("public.marketplace_products");
  });

  it("upserts settings and writes mm_audit in the same PostgreSQL transaction", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const actions = DEFAULT_ACTIONS.map((action) => ({ ...action, enabled: false }));
    const response = await handlers.PATCH({
      request: request("PATCH", { actions, reason: "test configuration" }, USER_TOKEN),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, configured: true, actions });
    expect(mocks.withVpsDatabase).toHaveBeenCalledOnce();
    expect(mocks.queries.some((q) => q.sql.includes("insert into public.system_settings"))).toBe(
      true,
    );
    expect(mocks.queries.some((q) => q.sql.includes("public.mm_audit"))).toBe(true);
    expect(mocks.queries.some((q) => q.values.includes(USER_ID))).toBe(true);
    expect(mocks.queries.some((q) => q.values.includes(REGISTRY_KEY))).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not claim success when the audit insert fails", async () => {
    mocks.failAudit = true;
    const response = await handlers.PATCH({
      request: request("PATCH", { actions: DEFAULT_ACTIONS }),
    });

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("no success") });
  });

  it("preserves internal-token access and records no fabricated user claim", async () => {
    mocks.requireOperator.mockResolvedValue({ ok: true, via: "internal token" });
    const response = await handlers.PATCH({
      request: request("PATCH", { actions: DEFAULT_ACTIONS }, "x-internal-token"),
    });

    expect(response.status).toBe(200);
    expect(mocks.queries.some((q) => q.sql.includes("set_config('request.jwt.claim.sub'"))).toBe(
      false,
    );
  });

  it("refuses malformed or partial configurations before database access", async () => {
    const response = await handlers.PATCH({
      request: request("PATCH", { actions: DEFAULT_ACTIONS.slice(1) }),
    });

    expect(response.status).toBe(400);
    expect(mocks.withVpsDatabase).not.toHaveBeenCalled();
  });

  it("retains the operator gate and performs no database operation when denied", async () => {
    mocks.requireOperator.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "denied" }, { status: 403 }),
    });

    const response = await handlers.GET({ request: request("GET") });

    expect(response.status).toBe(403);
    expect(mocks.withVpsDatabase).not.toHaveBeenCalled();
  });
});
