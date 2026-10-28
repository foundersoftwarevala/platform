import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireInternalOperator: vi.fn(),
}));

vi.mock("@/lib/auth/internal-guard", () => ({
  requireInternalOperator: mocks.requireInternalOperator,
}));

import { Route } from "./console";

type Get = (ctx: { request: Request }) => Promise<Response>;
type RouteOptions = { server: { handlers: { GET: Get } } };
const getConsole = (Route.options as typeof Route.options & RouteOptions).server.handlers.GET;

const request = () => new Request("https://softwarevala.net/api/security/console");

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUPABASE_URL", "http://vps.local");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-service");
  mocks.requireInternalOperator.mockResolvedValue({ ok: true, via: "operator:admin" });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("scanner console endpoint", () => {
  it("returns an explicit failure instead of successful zero metrics when a count fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "database unavailable" }, { status: 503 })),
    );

    const response = await getConsole({ request: request() });

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Could not read the scanner data." });
  });
});
