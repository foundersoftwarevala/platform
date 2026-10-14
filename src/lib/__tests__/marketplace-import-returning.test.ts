import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

function loadImporter(
  fetch: typeof globalThis.fetch,
  requireOperator = vi.fn().mockResolvedValue(undefined),
) {
  const source = readFileSync(
    new URL("../marketplace-import-16-demos.ts", import.meta.url),
    "utf8",
  );
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: Record<string, unknown> = {};
  runInNewContext(output, {
    exports,
    console: { log: vi.fn(), error: vi.fn() },
    process: {
      env: {
        SUPABASE_URL: "https://import-fixture.invalid",
        SUPABASE_SERVICE_ROLE_KEY: "fixture-only",
      },
    },
    require: (id: string) => {
      if (id === "@tanstack/react-start") {
        return {
          createServerFn: () => ({
            handler: (fn: (ctx: object) => Promise<unknown>) => () => fn({}),
          }),
        };
      }
      if (id === "@supabase/supabase-js") {
        return {
          createClient: (url: string, key: string) =>
            createClient(url, key, {
              global: { fetch },
              auth: { persistSession: false, autoRefreshToken: false },
            }),
        };
      }
      if (id === "@/lib/auth/require-operator.server") return { requireOperator };
      throw new Error(`Unexpected importer dependency: ${id}`);
    },
  });
  const run = exports.importSupplied16Demos;
  if (typeof run !== "function") throw new Error("Importer export missing");
  return { run, requireOperator };
}

describe("supplied importer returning contract", () => {
  it("requests returned IDs and links demos by slug even when products return out of order", async () => {
    const calls: Request[] = [];
    let productSlugs: string[] = [];
    const fetch: typeof globalThis.fetch = vi.fn(async (input, init) => {
      const request = new Request(input, init);
      calls.push(request);
      const url = new URL(request.url);
      const body: unknown = await request.json();
      if (!Array.isArray(body)) throw new Error("Expected upsert array");
      expect(request.headers.get("prefer")).toContain("return=representation");
      if (url.pathname.endsWith("/marketplace_categories")) {
        expect(url.searchParams.get("select")).toBe("id");
        return Response.json(body.map((_, i) => ({ id: `category-${i}` })));
      }
      if (url.pathname.endsWith("/marketplace_products")) {
        expect(url.searchParams.get("select")).toBe("id,slug");
        productSlugs = body.map((row) => {
          if (!row || typeof row.slug !== "string") throw new Error("Product slug missing");
          return row.slug;
        });
        return Response.json(
          productSlugs.map((slug) => ({ id: `product-${slug}`, slug })).reverse(),
        );
      }
      if (url.pathname.endsWith("/product_demo_urls")) {
        expect(url.searchParams.get("select")).toBe("id");
        expect(body.map((row) => row.product_id)).toEqual(
          productSlugs.map((slug) => `product-${slug}`),
        );
        return Response.json(body.map((_, i) => ({ id: `demo-${i}` })));
      }
      throw new Error(`Unexpected import request: ${url.pathname}`);
    });
    const { run, requireOperator } = loadImporter(fetch);
    expect(await run()).toMatchObject({
      success: true,
      products: productSlugs.length,
      demos: productSlugs.length,
    });
    expect(productSlugs.length).toBeGreaterThan(0);
    expect(requireOperator).toHaveBeenCalledOnce();
    expect(calls).toHaveLength(3);
  });

  it("preserves the operator guard before any database request", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const { run } = loadImporter(fetch, vi.fn().mockRejectedValue(new Error("Forbidden")));
    await expect(run()).rejects.toThrow("Forbidden");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("surfaces database errors and stops subsequent writes", async () => {
    const fetch: typeof globalThis.fetch = vi.fn(async () =>
      Response.json({ message: "fixture write refused", code: "42501" }, { status: 400 }),
    );
    const { run } = loadImporter(fetch);
    await expect(run()).rejects.toThrow("fixture write refused");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
