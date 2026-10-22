import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const productId = "20000000-0000-4000-8000-000000000001";
const sellerId = "10000000-0000-4000-8000-000000000001";
const ownerId = "30000000-0000-4000-8000-000000000001";

function fixture(notificationResponse: Response = Response.json({ ok: true, delivered: 1 })) {
  const calls: { path: string; init?: RequestInit }[] = [];
  const source = readFileSync(new URL("./author-review.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: Record<string, unknown> = {};

  runInNewContext(output, {
    exports,
    Request,
    Response,
    URL,
    encodeURIComponent,
    console: { error: vi.fn() },
    require: (name: string) => {
      if (name === "@tanstack/react-router") {
        return { createFileRoute: () => (options: unknown) => options };
      }
      if (name === "@/lib/auth/internal-guard") {
        return { requireInternalOperator: async () => ({ ok: true, via: "internal token" }) };
      }
      if (name === "@/lib/auth/bearer-user.server") {
        return { bearerToken: () => null, userFromBearerToken: async () => null };
      }
      if (name === "@/lib/marketplace/author-guard") {
        return {
          REVIEW_TRANSITIONS: { submitted: ["under_review", "approved", "rejected"] },
          rest: async (path: string, init?: RequestInit) => {
            calls.push({ path, init });
            if (path.startsWith("marketplace_products?")) {
              return Response.json([
                {
                  id: productId,
                  seller_id: sellerId,
                  moderation_status: "submitted",
                  name: "Fixture Product",
                },
              ]);
            }
            if (path.startsWith("marketplace_sellers?")) {
              return Response.json([{ owner_user_id: ownerId }]);
            }
            if (path === `marketplace_products?id=eq.${productId}` && init?.method === "PATCH") {
              return Response.json([{ id: productId, moderation_status: "approved" }]);
            }
            if (path === "rpc/mm_notify") return notificationResponse;
            throw new Error(`Unexpected review request: ${path}`);
          },
        };
      }
      throw new Error(`Unexpected review dependency: ${name}`);
    },
  });

  const route = exports.Route as {
    server?: { handlers?: { POST?: (input: { request: Request }) => Promise<Response> } };
  };
  const post = route.server?.handlers?.POST;
  if (!post) throw new Error("Author review POST handler missing");
  return { post, calls };
}

describe("author review notification delivery", () => {
  it("sends a targeted notification through the bell notification pipeline", async () => {
    const f = fixture();
    const response = await f.post({
      request: new Request("https://fixture.invalid/api/internal/author-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, decision: "approved" }),
      }),
    });
    const payload = await response.json();
    const delivery = f.calls.find((call) => call.path === "rpc/mm_notify");

    expect(payload.notification).toEqual({ ok: true });
    expect(delivery).toBeDefined();
    expect(JSON.parse(String(delivery?.init?.body))).toMatchObject({
      p_user: ownerId,
      p_event: `marketplace.author_review.${productId}.approved`,
      p_action_url: "/dashboard/author?module=products",
    });
  });

  it("surfaces notification failure without pretending the persisted review was rolled back", async () => {
    const f = fixture(Response.json({ error: "unavailable" }, { status: 503 }));
    const response = await f.post({
      request: new Request("https://fixture.invalid/api/internal/author-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, decision: "approved" }),
      }),
    });
    const payload = await response.json();

    expect(payload.ok).toBe(true);
    expect(payload.notification).toEqual({
      ok: false,
      reason: "Notification request failed (503)",
    });
  });
});
