import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  author: vi.fn(),
  rest: vi.fn(),
  baseUrl: vi.fn(),
}));

vi.mock("@/lib/marketplace/author-guard", () => ({
  requireAuthor: mocks.author,
  rest: mocks.rest,
  supabaseUrl: mocks.baseUrl,
}));

import { Route } from "@/routes/api/author/product-files";

type Post = (ctx: { request: Request }) => Promise<Response>;
type RouteOptions = { server: { handlers: { POST: Post } } };
const post = (Route.options as typeof Route.options & RouteOptions).server.handlers.POST;
const json = (body: unknown, status = 200) => Response.json(body, { status });
const seller = { id: "11111111-1111-4111-8111-111111111111" };
const user = { id: "22222222-2222-4222-8222-222222222222" };
const productId = "33333333-3333-4333-8333-333333333333";
const fileId = "44444444-4444-4444-8444-444444444444";
const requestKey = "55555555-5555-4555-8555-555555555555";
const fileRow = {
  id: fileId,
  seller_id: seller.id,
  product_id: productId,
  storage_path: `${seller.id}/${productId}/${fileId}/package.pdf`,
  file_name: "package.pdf",
  mime_type: "application/pdf",
  size_bytes: 20,
  sha256: "a".repeat(64),
  idempotency_key: requestKey,
  created_at: "2026-10-20T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-service");
  mocks.baseUrl.mockReturnValue("https://db.example");
  mocks.author.mockResolvedValue({ ok: true, seller, user });
  mocks.rest.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path.startsWith("marketplace_products")) {
      return json([{ id: productId, moderation_status: "draft" }]);
    }
    if (path.includes("idempotency_key=eq.")) {
      return json([]);
    }
    if (path.startsWith("marketplace_product_files?select=id,product_id,storage_path,seller_id")) {
      return json([
        {
          id: fileId,
          product_id: productId,
          storage_path: fileRow.storage_path,
          seller_id: seller.id,
        },
      ]);
    }
    if (path === "marketplace_product_files" && init?.method === "POST") {
      return json([{ ...fileRow, ...(JSON.parse(String(init.body)) as object) }], 201);
    }
    if (path === "marketplace_product_file_events" && init?.method === "POST") {
      return new Response(null, { status: 201 });
    }
    return json({ error: "Unexpected fixture request" }, 500);
  });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("author product file API", () => {
  it("stores files only after seller ownership and editable-state checks, with an audit event", async () => {
    const storageFetch = vi.fn(async () => json({ Key: fileRow.storage_path }));
    vi.stubGlobal("fetch", storageFetch);
    const form = new FormData();
    form.set("product_id", productId);
    form.set("file", new File(["a private file"], "package.pdf", { type: "application/pdf" }));

    const response = await post({
      request: new Request("https://softwarevala.net/api/author/product-files", {
        method: "POST",
        headers: { "Idempotency-Key": requestKey },
        body: form,
      }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      file: { product_id: productId, file_name: "package.pdf", mime_type: "application/pdf" },
      replayed: false,
    });
    expect(mocks.rest).toHaveBeenCalledWith(
      "marketplace_product_files",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining(`"seller_id":"${seller.id}"`),
      }),
    );
    expect(storageFetch).toHaveBeenCalledWith(
      expect.stringContaining(
        `/storage/v1/object/marketplace-product-files/${seller.id}/${productId}/`,
      ),
      expect.objectContaining({ method: "POST" }),
    );
    expect(mocks.rest).toHaveBeenCalledWith(
      "marketplace_product_file_events",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"action":"uploaded"'),
      }),
    );
  });

  it("refuses files for products that do not belong to the signed-in author", async () => {
    const storageFetch = vi.fn();
    vi.stubGlobal("fetch", storageFetch);
    mocks.rest.mockResolvedValueOnce(json([]));
    const form = new FormData();
    form.set("product_id", productId);
    form.set("file", new File(["private"], "package.pdf", { type: "application/pdf" }));

    const response = await post({
      request: new Request("https://softwarevala.net/api/author/product-files", {
        method: "POST",
        headers: { "Idempotency-Key": requestKey },
        body: form,
      }),
    });

    expect(response.status).toBe(404);
    expect(storageFetch).not.toHaveBeenCalled();
  });

  it("issues a short-lived signed link only for the author's own file and audits it", async () => {
    const storageFetch = vi.fn(async () =>
      json({ signedURL: "/object/sign/private/path?token=fixture" }),
    );
    vi.stubGlobal("fetch", storageFetch);

    const response = await post({
      request: new Request("https://softwarevala.net/api/author/product-files", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": requestKey,
        },
        body: JSON.stringify({ action: "download", file_id: fileId }),
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      url: "https://db.example/storage/v1/object/sign/private/path?token=fixture",
      expires_in: 300,
    });
    expect(storageFetch).toHaveBeenCalledWith(
      expect.stringContaining("/storage/v1/object/sign/marketplace-product-files/"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(mocks.rest).toHaveBeenCalledWith(
      "marketplace_product_file_events",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"action":"download_link_issued"'),
      }),
    );
  });

  it("rejects a missing idempotency key before receiving a file", async () => {
    const form = new FormData();
    form.set("product_id", productId);
    form.set("file", new File(["private"], "package.pdf", { type: "application/pdf" }));
    const response = await post({
      request: new Request("https://softwarevala.net/api/author/product-files", {
        method: "POST",
        body: form,
      }),
    });
    expect(response.status).toBe(400);
    expect(mocks.rest).not.toHaveBeenCalled();
  });
});
