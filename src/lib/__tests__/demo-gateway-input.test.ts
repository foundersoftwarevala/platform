import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

function fixture() {
  const state = { product: true, demo: true, fail: false };
  const requests: { url: URL; method: string; key: string | null }[] = [];
  const db = createClient("https://gateway-fixture.invalid", "fixture-public-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        const request = new Request(input, init),
          url = new URL(request.url);
        requests.push({ url, method: request.method, key: request.headers.get("apikey") });
        if (state.fail)
          return Response.json(
            { message: "Fixture gateway refused", code: "42501" },
            { status: 403 },
          );
        if (url.pathname.endsWith("/marketplace_products"))
          return Response.json(state.product ? [{ id: "product", name: "Actual name" }] : []);
        if (url.pathname.endsWith("/product_demo_urls"))
          return Response.json(
            state.demo
              ? [{ demo_name: "Actual demo", url: "https://demo.lovable.app/", status: "active" }]
              : [],
          );
        throw new Error("Unexpected demo relation");
      },
    },
  });
  const source = readFileSync(new URL("../demo-gateway.ts", import.meta.url), "utf8").replaceAll(
    "import.meta",
    "({})",
  );
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: Record<string, unknown> = {},
    log = vi.fn();
  runInNewContext(output, {
    exports,
    console: { error: log },
    URL,
    process: {
      env: {
        SUPABASE_URL: "https://gateway-fixture.invalid",
        SUPABASE_ANON_KEY: "fixture-public-key",
      },
    },
    require: (name: string) => {
      if (name === "@supabase/supabase-js") return { createClient: () => db };
      if (name === "@/lib/supplied-demos-catalog") return { SUPPLIED_DEMOS_16: [] };
      if (name === "@tanstack/react-start")
        return {
          createServerFn: () => {
            let validate = (value: unknown) => value;
            const builder = {
              middleware: () => builder,
              inputValidator: (run: typeof validate) => {
                validate = run;
                return builder;
              },
              handler:
                (run: (context: { data: unknown }) => Promise<unknown>) =>
                async (input: { data?: unknown }) =>
                  run({ data: validate(input.data) }),
            };
            return builder;
          },
        };
      throw new Error(`Unexpected demo dependency: ${name}`);
    },
  });
  const run = exports.getDemoConfig;
  if (typeof run !== "function") throw new Error("Demo configuration handler missing");
  return { run: (data: unknown) => run({ data }), requests, state, log };
}

describe("demo gateway input boundary", () => {
  it.each([undefined, null, "", 42, {}, { slug: "product" }])(
    "rejects invalid slug %j before database access",
    async (slug) => {
      const f = fixture();
      await expect(f.run(slug)).rejects.toThrow("Product slug required");
      expect(f.requests).toEqual([]);
    },
  );

  it("keeps the public-reader filters, supplied slug and active-demo ordering", async () => {
    const f = fixture();
    expect(await f.run("actual-product")).toEqual({
      slug: "actual-product",
      demo_url: "https://demo.lovable.app/",
      demo_name: "Actual demo",
      error: null,
    });
    expect(
      f.requests.every(
        (request) => request.method === "GET" && request.key === "fixture-public-key",
      ),
    ).toBe(true);
    expect(f.requests[0].url.searchParams.get("slug")).toBe("eq.actual-product");
    expect(f.requests[0].url.searchParams.get("visible")).toBe("eq.true");
    expect(f.requests[1].url.searchParams.get("status")).toBe("eq.active");
    expect(f.requests[1].url.searchParams.get("order")).toBe("sort_order.asc,created_at.desc");
    expect(f.requests[1].url.searchParams.get("limit")).toBe("1");
  });

  it("preserves genuine missing-product and missing-demo responses", async () => {
    const f = fixture();
    f.state.product = false;
    expect(await f.run("missing")).toEqual({
      slug: "missing",
      demo_url: null,
      demo_name: null,
      error: "Product not found",
    });
    expect(f.requests).toHaveLength(1);
    f.state.product = true;
    f.state.demo = false;
    expect(await f.run("no-demo")).toEqual({
      slug: "no-demo",
      demo_url: null,
      demo_name: "Actual name",
      error: "No active demo found",
    });
  });

  it("logs and propagates database failures rather than reporting missing data", async () => {
    const f = fixture();
    f.state.fail = true;
    await expect(f.run("refused")).rejects.toMatchObject({ message: "Fixture gateway refused" });
    expect(f.log).toHaveBeenCalledOnce();
  });
});
