import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOperator: vi.fn(),
  loadMatrix: vi.fn(),
  recordDenial: vi.fn(),
  rolesOf: vi.fn(),
  resolveAction: vi.fn(),
}));

vi.mock("@/lib/auth/internal-guard", () => ({
  requireInternalOperator: mocks.requireOperator,
}));
vi.mock("@/lib/marketplace/permission-guard", () => ({
  resolveAction: mocks.resolveAction,
}));
vi.mock("@/lib/marketplace/permission-store.server", () => ({
  loadMatrix: mocks.loadMatrix,
  recordDenial: mocks.recordDenial,
  rolesOf: mocks.rolesOf,
}));

import { Route } from "./media";

type Post = (context: { request: Request }) => Promise<Response>;
type RouteOptions = { server: { handlers: { POST: Post } } };
const mediaPost = (Route.options as typeof Route.options & RouteOptions).server.handlers.POST;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUPABASE_URL", "http://db.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-service");
  mocks.requireOperator.mockResolvedValue({ ok: true });
  mocks.loadMatrix.mockResolvedValue({ matrix: {} });
  mocks.rolesOf.mockResolvedValue({ roles: ["owner"], via: "session" });
  mocks.resolveAction.mockReturnValue({ visible: true, enabled: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Marketplace media signing", () => {
  it("refuses caller-selected buckets that are not explicitly Marketplace-owned", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await mediaPost({
      request: new Request("https://softwarevala.net/api/marketplace/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_id: "storage:franchise-documents:private/contract.pdf",
        }),
      }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      ok: false,
      reason: "marketplace_bucket_not_allowed",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
