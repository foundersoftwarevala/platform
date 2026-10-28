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

const request = () => new Request("https://softwarevala.net/api/governance/console");

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:3010");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-service");
  mocks.requireInternalOperator.mockResolvedValue({ ok: true, via: "operator:admin" });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("governance console endpoint", () => {
  it("fails explicitly when an audit or history read fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "database unavailable" }, { status: 503 })),
    );

    const response = await getConsole({ request: request() });

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Could not read governance history." });
  });

  it("does not substitute a limited list for a failed exact count", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const path = String(input);
        if (
          path.includes("marketplace_backups") ||
          path.includes("marketplace_schedules") ||
          path.includes("marketplace_approvals") ||
          path.includes("marketplace_bulk_operations")
        ) {
          return new Response(null, { status: 404 });
        }
        if (path.includes("&limit=1")) {
          return new Response("[]", {
            headers: { "content-range": "0-0/*", "content-type": "application/json" },
          });
        }
        return Response.json([]);
      }),
    );

    const response = await getConsole({ request: request() });

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Could not read governance history." });
  });
});
