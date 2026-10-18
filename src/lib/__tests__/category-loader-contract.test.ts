import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

function fixture(seo: unknown, seoFails = false) {
  const products = { category: null, products: [] };
  const respondNotFound = vi.fn();
  const log = vi.fn();
  const exports: Record<string, unknown> = {};
  const source = readFileSync(
    new URL("../../routes/marketplace.category.$slug.tsx", import.meta.url),
    "utf8",
  );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  runInNewContext(output, {
    exports,
    console: { error: log },
    require: (id: string) => {
      if (id === "@tanstack/react-router")
        return { createFileRoute: () => (options: object) => options, redirect: vi.fn() };
      if (id === "react/jsx-runtime") return {};
      if (id === "@/components/ui/sonner") return {};
      if (id === "@/components/marketplace-home/CategoryDetail") return {};
      if (id === "@/lib/marketplace/merged-categories") return { mergedInto: () => null };
      if (id === "@/lib/seo/site-url") return { siteUrl: () => "https://fixture.invalid" };
      if (id === "@/lib/seo/category-seo")
        return {
          getCategorySeo: async () => {
            if (seoFails) throw new Error("Fixture SEO unavailable");
            return seo;
          },
        };
      if (id === "@/lib/marketplace.functions")
        return { getPublicProductsByCategory: async () => products };
      if (id === "@/lib/seo/not-found.server") return { respondNotFound };
      throw new Error(`Unexpected category route dependency: ${id}`);
    },
  });
  const route = exports.Route;
  if (
    !route ||
    typeof route !== "object" ||
    !("loader" in route) ||
    typeof route.loader !== "function" ||
    !("head" in route) ||
    typeof route.head !== "function"
  )
    throw new Error("Route contracts missing");
  return { loader: route.loader, head: route.head, respondNotFound, log, products };
}
describe("category loader missing-state contract", () => {
  it("preserves fulfilled-empty missing state, 404 signal and noindex head", async () => {
    const f = fixture(null);
    const result: unknown = await f.loader({ params: { slug: "fixture" } });
    expect(result).toEqual({ seo: null, missing: true, products: f.products });
    expect(f.respondNotFound).toHaveBeenCalledOnce();
    const head = f.head({ loaderData: result, params: { slug: "fixture" } });
    expect(head).toMatchObject({
      meta: expect.arrayContaining([
        expect.objectContaining({ name: "robots", content: expect.stringContaining("noindex") }),
      ]),
    });
  });

  it("does not turn an unavailable SEO lookup into a missing-category verdict", async () => {
    const f = fixture(null, true);
    expect(await f.loader({ params: { slug: "fixture" } })).toEqual({
      seo: null,
      missing: false,
      products: f.products,
    });
    expect(f.respondNotFound).not.toHaveBeenCalled();
    expect(f.log).toHaveBeenCalled();
  });
});
