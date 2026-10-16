import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorization: "Bearer isolated-reject-fixture" as string | undefined,
}));
vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: () => mocks.authorization,
}));
import { callAsUser } from "../supabase-rpc.server";

const ITEM = "10000000-0000-4000-8000-000000000001";
const source = readFileSync(
  new URL("../marketplace-manager/aicontent.functions.ts", import.meta.url),
  "utf8",
);
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports: Record<string, unknown> = {};
function createServerFn() {
  let validate = (input: unknown) => input;
  const builder = {
    inputValidator: (validator: typeof validate) => {
      validate = validator;
      return builder;
    },
    handler:
      (handler: (input: { data: unknown }) => Promise<unknown>) =>
      async (input: { data?: unknown } = {}) =>
        handler({ data: validate(input.data) }),
  };
  return builder;
}
const load: unknown = runInThisContext(`(function(exports, require) { ${output}\n})`);
if (typeof load !== "function") throw new Error("Cannot load real AI-content handlers");
load(exports, (id: string) => {
  if (id === "zod") return { z };
  if (id === "@tanstack/react-start") return { createServerFn };
  if (id === "@/lib/supabase-rpc.server") return { callAsUser };
  if (id === "@/lib/ai/content-provider")
    return {
      generate: () => {
        throw new Error("Rejection must never call an AI provider");
      },
      buildUserMessage: () => {
        throw new Error("Rejection must never generate content");
      },
    };
  throw new Error("Unexpected rejection-test import: " + id);
});
async function rejectContent(data: unknown) {
  if (typeof exports.rejectContent !== "function")
    throw new Error("Missing real rejection handler");
  return exports.rejectContent({ data });
}

function fixture(response: object = { ok: true, status: "REJECTED" }, status = 200) {
  const requests: {
    url: URL;
    authorization: string | null;
    apikey: string | null;
    body: unknown;
  }[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (
      url.origin !== "https://reject-fixture.invalid" ||
      url.pathname !== "/rest/v1/rpc/mm_ai_item_reject" ||
      request.method !== "POST"
    ) {
      throw new Error("Unexpected rejection-test request: " + request.method + " " + url);
    }
    requests.push({
      url,
      authorization: request.headers.get("authorization"),
      apikey: request.headers.get("apikey"),
      body: await request.json(),
    });
    return Response.json(response, { status });
  });
  return requests;
}
beforeEach(() => {
  mocks.authorization = "Bearer isolated-reject-fixture";
  vi.stubEnv("SUPABASE_URL", "https://reject-fixture.invalid");
  vi.stubEnv("SUPABASE_ANON_KEY", "fixture-publishable-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-service-key-must-not-be-used");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("AI-content real rejection validator and caller-scoped RPC", () => {
  it("maps the canonical UUID/code/reason through the actual validator and SDK to the existing RPC", async () => {
    const requests = fixture();
    expect(
      await rejectContent({
        item_id: ITEM,
        code: "incorrect_information",
        reason: "Incorrect factual claim",
      }),
    ).toEqual({ ok: true, status: "REJECTED" });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      authorization: "Bearer isolated-reject-fixture",
      apikey: "fixture-publishable-key",
      body: { p_item: ITEM, p_code: "incorrect_information", p_reason: "Incorrect factual claim" },
    });
  });

  it("preserves the existing optional-reason null default and explicit empty string", async () => {
    const requests = fixture();
    await rejectContent({ item_id: ITEM, code: "other" });
    await rejectContent({ item_id: ITEM, code: "other", reason: "" });
    expect(requests.map((request) => request.body)).toEqual([
      { p_item: ITEM, p_code: "other", p_reason: null },
      { p_item: ITEM, p_code: "other", p_reason: "" },
    ]);
  });

  it.each([
    { id: ITEM, code: "other" },
    { item_id: "invalid", code: "other" },
    { item_id: ITEM, code: "unapproved_code" },
    { item_id: ITEM, code: "other", reason: "x".repeat(1001) },
  ])("refuses an invalid request before RPC access: %j", async (data) => {
    const requests = fixture();
    await expect(rejectContent(data)).rejects.toThrow();
    expect(requests).toHaveLength(0);
  });

  it("refuses missing bearer authorization without a service-key bypass", async () => {
    const requests = fixture();
    mocks.authorization = undefined;
    await expect(rejectContent({ item_id: ITEM, code: "other" })).rejects.toThrow("Unauthorized");
    expect(requests).toHaveLength(0);
  });

  it("propagates transport/database permission failures", async () => {
    fixture({ message: "Fixture rejection forbidden", code: "42501" }, 403);
    await expect(rejectContent({ item_id: ITEM, code: "other" })).rejects.toThrow(
      "Fixture rejection forbidden",
    );
  });

  it.each(["not_authorized", "item_not_found", "not_rejectable"])(
    "preserves the real RPC business refusal %s",
    async (reason) => {
      fixture({ ok: false, reason });
      expect(await rejectContent({ item_id: ITEM, code: "other" })).toEqual({ ok: false, reason });
    },
  );
});
