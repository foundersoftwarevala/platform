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

type Get = (ctx: { request: Request }) => Promise<Response>;
type Post = (ctx: { request: Request }) => Promise<Response>;
type RouteOptions = { server: { handlers: { GET: Get; POST: Post } } };
const mediaHandlers = (Route.options as typeof Route.options & RouteOptions).server.handlers;
const mediaGet = mediaHandlers.GET;
const mediaPost = mediaHandlers.POST;
const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  Response.json(body, { status, headers });
const emptyRows = () => json([], 200, { "content-range": "*/0" });
const request = () => new Request("https://softwarevala.net/api/marketplace/media");

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

describe("Media Library source completeness", () => {
  it("returns a gateway error when the storage bucket inventory cannot be read", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ error: "unavailable" }, 503)),
    );

    const response = await mediaGet({ request: request() });

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      error: "Could not read the media library",
      source: "storage buckets",
    });
  });

  it("does not report a successful empty inventory when a source table fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) =>
        String(input).includes("/storage/v1/bucket")
          ? json([])
          : String(input).includes("/rest/v1/marketplace_products")
            ? json({ error: "unavailable" }, 503)
            : emptyRows(),
      ),
    );

    const response = await mediaGet({ request: request() });

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      error: "Could not read the media library",
      source: "marketplace_products",
    });
  });

  it("counts all products across the PostgREST row cap", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const path = String(input);
        if (path.includes("/storage/v1/bucket")) return json([]);
        if (!path.includes("/rest/v1/marketplace_products")) return emptyRows();
        const offset = new URL(path).searchParams.get("offset");
        const products = Array.from({ length: offset === "0" ? 200 : 1 }, (_, index) => ({
          id: `product-${Number(offset) + index}`,
          content_status: "published",
          icon: "Sparkles",
        }));
        return offset === "0"
          ? json(products, 200, { "content-range": "0-199/201" })
          : json(products, 200, { "content-range": "200-200/201" });
      }),
    );

    const response = await mediaGet({ request: request() });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.references).toMatchObject({
      products: 201,
      products_without_image: 201,
      published_without_image: 201,
    });
  });

  it("does not issue a signed URL when its audit write fails", async () => {
    const fetchMock = vi.fn(async (input: string | URL) =>
      String(input).includes("/storage/v1/object/sign/")
        ? json({ signedURL: "/object/sign/public-bucket/file.png?token=fixture" })
        : json({ error: "audit unavailable" }, 503),
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await mediaPost({
      request: new Request("https://softwarevala.net/api/marketplace/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset_id: "storage:public-bucket:file.png" }),
      }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      ok: false,
      reason: "marketplace_bucket_not_allowed",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not return exported metadata when its audit write fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const path = String(input);
        if (path.includes("/storage/v1/bucket")) return json([]);
        if (path.includes("/rpc/mm_audit_operator"))
          return json({ error: "audit unavailable" }, 503);
        return emptyRows();
      }),
    );

    const response = await mediaGet({
      request: new Request("https://softwarevala.net/api/marketplace/media?format=csv"),
    });

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      error: "Could not record the media export audit",
    });
  });
});
