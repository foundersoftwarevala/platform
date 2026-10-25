import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  authorization: "Bearer demo-manager-fixture-token" as string | undefined,
  requests: [] as {
    url: URL;
    method: string;
    headers: Headers;
    body: string | undefined;
  }[],
  responses: [] as Response[],
  fetch: vi.fn(),
}));

const userId = "00000000-0000-4000-8000-000000000011";
const demoId = "00000000-0000-4000-8000-000000000021";
const productId = "00000000-0000-4000-8000-000000000031";
const nodeRequire = createRequire(import.meta.url);
let functions: Record<string, unknown>;

function loadFunctions(): Record<string, unknown> {
  const exports: Record<string, unknown> = {};
  const source = readFileSync(new URL("./demos.functions.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const createServerFn = () => {
    let validate = (input: unknown) => input;
    const builder = {
      inputValidator(validator: (input: unknown) => unknown) {
        validate = validator;
        return builder;
      },
      handler(handler: (context: { data: unknown }) => unknown) {
        return async (argument?: { data?: unknown }) => handler({ data: validate(argument?.data) });
      },
    };
    return builder;
  };
  runInNewContext(output, {
    exports,
    process,
    fetch: state.fetch,
    URLSearchParams,
    console,
    require: (id: string) => {
      if (id === "@tanstack/react-start") return { createServerFn };
      if (id === "@tanstack/react-start/server") {
        return { getRequestHeader: () => state.authorization };
      }
      if (id === "zod") return nodeRequire("zod");
      throw new Error(`Unexpected server-function dependency: ${id}`);
    },
  });
  return exports;
}

function invoke<T = unknown>(name: string, data?: unknown): Promise<T> {
  const fn = functions[name];
  if (typeof fn !== "function") throw new Error(`Missing server function: ${name}`);
  return (fn as (argument?: { data?: unknown }) => Promise<T>)(
    data === undefined ? undefined : { data },
  );
}

function demoRow() {
  return {
    id: demoId,
    title: "Fixture demo",
    category: "Software",
    url: "https://demo.example.test",
    login_url: null,
    demo_type: "web",
    status: "active",
    description: null,
    created_at: "2026-10-26T00:00:00.000Z",
    expiry_date: null,
    created_by: userId,
    tech_stack: "other",
    total_login_roles: 0,
    health_score: 0,
    uptime_percentage: 0,
  };
}

function queueResponse(body: unknown, status = 200, headers?: HeadersInit) {
  state.responses.push(
    new Response(body === null ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...Object.fromEntries(new Headers(headers)) },
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  functions = loadFunctions();
  state.authorization = "Bearer demo-manager-fixture-token";
  state.requests = [];
  state.responses = [];
  vi.stubGlobal("fetch", state.fetch);
  vi.stubEnv("SUPABASE_URL", "https://vps.fixture.invalid");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "fixture-publishable-key");
  vi.stubEnv("SUPABASE_ANON_KEY", "");
  vi.stubEnv("VITE_SUPABASE_URL", "https://hosted.fixture.invalid");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "fixture-hosted-key");
  state.fetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    state.requests.push({
      url: new URL(request.url),
      method: request.method,
      headers: request.headers,
      body:
        request.method === "GET" || request.method === "DELETE" ? undefined : await request.text(),
    });
    return (
      state.responses.shift() ??
      new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Demo Manager server-function transport", () => {
  it("reads demos from the server-configured database with a bounded limit", async () => {
    queueResponse([]);
    await expect(invoke("listManagedDemos", { limit: 200 })).resolves.toEqual([]);
    const request = state.requests[0];
    expect(request.url.origin).toBe("https://vps.fixture.invalid");
    expect(request.url.pathname).toBe("/rest/v1/demos");
    expect(request.url.searchParams.get("limit")).toBe("200");
    expect(request.headers.get("Authorization")).toBe("Bearer demo-manager-fixture-token");
  });

  it("does not fall back to the browser database URL or key", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("SUPABASE_ANON_KEY", "");
    await expect(invoke("listManagedDemos", { limit: 200 })).rejects.toThrow(
      /not configured on this server/,
    );
    expect(state.fetch).not.toHaveBeenCalled();

    vi.stubEnv("SUPABASE_URL", "https://vps.fixture.invalid");
    await expect(invoke("listManagedDemos", { limit: 200 })).rejects.toThrow(
      /publishable key is not configured/,
    );
    expect(state.fetch).not.toHaveBeenCalled();
  });

  it("requires a signed-in caller before making a database request", async () => {
    state.authorization = undefined;
    await expect(invoke("listManagedDemos", { limit: 200 })).rejects.toThrow(/sign in/);
    expect(state.fetch).not.toHaveBeenCalled();
  });

  it("resolves product names server-side for pending requests", async () => {
    queueResponse([
      {
        id: demoId,
        company: "Fixture Co.",
        requester_name: "Fixture User",
        product_id: productId,
        created_at: "2026-10-26T00:00:00.000Z",
        status: "pending",
      },
    ]);
    queueResponse([{ id: productId, name: "Fixture product" }]);

    await expect(invoke("listPendingDemoRequests")).resolves.toEqual([
      {
        request: {
          id: demoId,
          company: "Fixture Co.",
          requester_name: "Fixture User",
          product_id: productId,
          created_at: "2026-10-26T00:00:00.000Z",
          status: "pending",
        },
        productName: "Fixture product",
      },
    ]);
    expect(state.requests).toHaveLength(2);
    expect(state.requests[0].url.searchParams.get("status")).toBe("eq.pending");
    expect(state.requests[1].url.searchParams.get("id")).toBe(`in.(${productId})`);
  });

  it("does not report a rejected request write as successful", async () => {
    queueResponse({ message: "permission denied" }, 403);
    await expect(
      invoke("respondToDemoRequest", { id: demoId, status: "approved" }),
    ).rejects.toThrow(/Demo request is no longer pending or is inaccessible failed: 403/);
    expect(state.requests[0].url.searchParams.get("status")).toBe("eq.pending");
    expect(JSON.parse(state.requests[0].body ?? "{}")).toEqual({
      status: "approved",
      updated_at: expect.any(String),
    });
  });

  it("validates IDs before sending status changes", async () => {
    await expect(
      invoke("setManagedDemoStatus", { id: "not-a-uuid", status: "active" }),
    ).rejects.toThrow();
    expect(state.fetch).not.toHaveBeenCalled();
  });

  it("creates through the caller token and records the verified caller as creator", async () => {
    queueResponse([{ name: "Software" }]);
    queueResponse({ id: userId });
    queueResponse([demoRow()]);

    await expect(
      invoke("createManagedDemo", {
        title: "Fixture demo",
        category: "software",
        url: "https://demo.example.test",
        demo_type: "web",
        login_url: "",
        description: "",
      }),
    ).resolves.toMatchObject({ id: demoId, status: "active" });

    expect(state.requests.map(({ url }) => url.origin)).toEqual([
      "https://vps.fixture.invalid",
      "https://vps.fixture.invalid",
      "https://vps.fixture.invalid",
    ]);
    expect(state.requests[1].url.pathname).toBe("/auth/v1/user");
    expect(JSON.parse(state.requests[2].body ?? "{}")).toMatchObject({
      category: "Software",
      created_by: userId,
      status: "active",
      lifecycle_status: "live",
    });
    expect(state.requests[2].headers.get("Authorization")).toBe(
      "Bearer demo-manager-fixture-token",
    );
  });

  it("surfaces database failures from exact demo counts", async () => {
    queueResponse({ message: "gateway unavailable" }, 503);
    await expect(invoke("countDemos")).rejects.toThrow(/Demo count could not be read: 503/);
  });
});
