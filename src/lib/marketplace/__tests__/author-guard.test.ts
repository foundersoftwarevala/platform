import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it } from "vitest";

function fixture(status: string, sellerKind = "author") {
  const source = readFileSync(new URL("../author-guard.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: Record<string, unknown> = {};

  runInNewContext(output, {
    exports,
    process: {
      env: {
        SUPABASE_URL: "https://author-fixture.invalid",
        SUPABASE_PUBLISHABLE_KEY: "fixture-public",
        SUPABASE_SERVICE_ROLE_KEY: "fixture-service",
      },
    },
    fetch: async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.pathname === "/auth/v1/user") {
        return Response.json({ id: "user-1", email: "author@example.invalid" });
      }
      if (url.pathname === "/rest/v1/marketplace_sellers") {
        return Response.json([
          {
            id: "seller-1",
            owner_user_id: "user-1",
            display_name: "Fixture Author",
            slug: "fixture-author",
            status,
            seller_kind: sellerKind,
            payout_currency: "USD",
          },
        ]);
      }
      throw new Error(`Unexpected fixture request: ${url.pathname}`);
    },
    URL,
    Response,
    encodeURIComponent,
    console,
  });

  const requireAuthor = exports.requireAuthor;
  if (typeof requireAuthor !== "function") throw new Error("requireAuthor export missing");
  return requireAuthor as (
    request: Request,
    options?: { allowPending?: boolean; sellerKinds?: readonly string[] },
  ) => Promise<{ ok: boolean; response?: Response }>;
}

describe("author server authorization status", () => {
  it.each(["rejected", "suspended", "deactivated", "unknown"])(
    "denies %s sellers even for read-only author endpoints",
    async (status) => {
      const requireAuthor = fixture(status);
      const result = await requireAuthor(
        new Request("https://fixture.invalid", { headers: { authorization: "Bearer fixture" } }),
        { allowPending: true },
      );

      expect(result.ok).toBe(false);
      expect(result.response?.status).toBe(403);
    },
  );

  it("allows pending accounts only on explicitly pending-safe reads", async () => {
    const requireAuthor = fixture("pending");
    const request = new Request("https://fixture.invalid", {
      headers: { authorization: "Bearer fixture" },
    });

    expect((await requireAuthor(request, { allowPending: true })).ok).toBe(true);
    expect((await requireAuthor(request)).ok).toBe(false);
  });

  it("denies vendor sellers from author-only endpoints", async () => {
    const requireAuthor = fixture("approved", "vendor");
    const result = await requireAuthor(
      new Request("https://fixture.invalid", { headers: { authorization: "Bearer fixture" } }),
    );

    expect(result.ok).toBe(false);
    expect(result.response?.status).toBe(403);
  });

  it("allows vendor sellers only when an endpoint explicitly supports that seller kind", async () => {
    const requireAuthor = fixture("approved", "vendor");
    const result = await requireAuthor(
      new Request("https://fixture.invalid", { headers: { authorization: "Bearer fixture" } }),
      { sellerKinds: ["author", "vendor"] },
    );

    expect(result.ok).toBe(true);
  });
});
