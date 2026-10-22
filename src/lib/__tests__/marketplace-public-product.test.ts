import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { describe, expect, it } from "vitest";

function fixture(productResult: { data: unknown; error: { message: string } | null }) {
  const source = readFileSync(
    new URL("../marketplace.functions.ts", import.meta.url),
    "utf8",
  ).replace(
    "const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;",
    "const viteEnv = undefined;",
  );
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: Record<string, unknown> = {};
  const query = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    or() {
      return this;
    },
    maybeSingle: async () => productResult,
  };

  runInNewContext(output, {
    exports,
    process: {
      env: {
        SUPABASE_URL: "https://marketplace-fixture.invalid",
        SUPABASE_PUBLISHABLE_KEY: "fixture-only",
      },
    },
    console,
    Date,
    Set,
    Promise,
    require: (name: string) => {
      if (name === "@tanstack/react-start") {
        return {
          createServerFn: () => {
            let validate = (value: unknown) => value;
            const builder = {
              middleware() {
                return builder;
              },
              validator(fn: typeof validate) {
                validate = fn;
                return builder;
              },
              inputValidator(fn: typeof validate) {
                validate = fn;
                return builder;
              },
              handler(fn: (input: { data: unknown }) => Promise<unknown>) {
                return (input: { data?: unknown } = {}) => fn({ data: validate(input.data) });
              },
            };
            return builder;
          },
        };
      }
      if (name === "@tanstack/react-start/server") return { getRequestIP: () => "fixture" };
      if (name === "@supabase/supabase-js") {
        return { createClient: () => ({ from: () => query }) };
      }
      if (name === "zod") return { z };
      if (name === "@/integrations/supabase/auth-middleware")
        return { requireSupabaseAuth: () => {} };
      if (name === "@/lib/i18n/limits") {
        return {
          SlidingWindowLimiter: class {
            hit() {
              return false;
            }
          },
        };
      }
      throw new Error(`Unexpected marketplace function dependency: ${name}`);
    },
  });

  const getProduct = exports.getPublicProduct;
  if (typeof getProduct !== "function") throw new Error("getPublicProduct handler missing");
  return getProduct as (input: { data: { slug: string } }) => Promise<{
    product: { slug: string } | null;
    active_demos: unknown[];
  }>;
}

describe("public marketplace product lookup", () => {
  it("does not publish a static catalogue fallback when no public database row exists", async () => {
    const getProduct = fixture({ data: null, error: null });

    await expect(getProduct({ data: { slug: "school-management-system" } })).resolves.toEqual({
      product: null,
      active_demos: [],
      seo: null,
    });
  });

  it("surfaces a product lookup failure instead of returning a fabricated product or not-found result", async () => {
    const getProduct = fixture({
      data: null,
      error: { message: "database unavailable" },
    });

    await expect(getProduct({ data: { slug: "school-management-system" } })).rejects.toThrow(
      "Could not read the public product: database unavailable",
    );
  });
});
