import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { requireJsonObject } from "@/lib/json";
import { resolveMarketplacePublicConfig } from "../marketplace-public-config";

const ID = "10000000-0000-4000-8000-000000000001";

function fixture() {
  const requests: {
    method: string;
    url: URL;
    body: Record<string, unknown>;
    authorization: string | null;
    apikey: string | null;
  }[] = [];
  const state = {
    authorized: true,
    roles: ["boss"],
    sectionStatus: "published",
    taskStatus: "submitted",
    failure: false,
    recoveryRpcFails: false,
  };
  const fetch: typeof globalThis.fetch = vi.fn(async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const body =
      request.method === "GET"
        ? {}
        : requireJsonObject(await request.json(), "Fixture request body");
    requests.push({
      method: request.method,
      url,
      body,
      authorization: request.headers.get("authorization"),
      apikey: request.headers.get("apikey"),
    });
    if (state.failure)
      return Response.json({ message: "fixture write refused", code: "42501" }, { status: 400 });
    const endpoint = url.pathname.split("/").at(-1);
    if (endpoint === "mm_record_public_demo_click") return Response.json(true);
    if (endpoint === "mm_recover_marketplace_catalogue") {
      if (state.recoveryRpcFails) {
        return Response.json(
          { message: "Injected failure after a product write.", code: "P0001" },
          { status: 400 },
        );
      }
      return Response.json({ productsInserted: 10 });
    }
    if (endpoint === "marketplace_audit_logs" && request.method === "POST") {
      return new Response(null, { status: 201 });
    }
    if (endpoint === "user_roles") return Response.json(state.roles.map((role) => ({ role })));
    if (request.method === "GET" && endpoint === "marketplace_homepage_sections")
      return Response.json({ status: state.sectionStatus });
    if (request.method === "GET" && endpoint === "tm_tasks")
      return Response.json({ status: state.taskStatus });
    if (endpoint === "tm_allowed_transitions")
      return Response.json(["approved", "completed", "in_progress"]);
    if (endpoint === "mm_layout_history") return Response.json({ entries: [] });
    if (endpoint === "mm_layout_restore" || endpoint === "legal_log")
      return Response.json({ ok: true });
    if (
      ["tm_tasks", "tm_activity", "legal_ai_requests", "marketplace_homepage_sections"].includes(
        endpoint ?? "",
      )
    ) {
      if (typeof body.status === "string") state.taskStatus = body.status;
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected fixture request: ${request.method} ${url.pathname}`);
  });
  const client = createClient("https://assignment-fixture.invalid", "fixture-only", {
    global: { fetch, headers: { Authorization: "Bearer fixture-user" } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const catalogueChanged = vi.fn();
  const requireOperator = vi.fn(async () => {
    if (!state.authorized) throw new Error("Unauthorized");
    return { userId: ID, roles: state.roles };
  });

  function load(path: string, context: object = { supabase: client }) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    const output = ts
      .transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      })
      .outputText.replaceAll("import.meta.env", "({})");
    const exports: Record<string, unknown> = {};
    runInNewContext(output, {
      exports,
      console,
      Date,
      Set,
      Map,
      URL,
      Headers,
      fetch,
      process: {
        env: {
          SUPABASE_URL: "https://assignment-fixture.invalid",
          SUPABASE_ANON_KEY: "fixture-anon-key",
          SUPABASE_SERVICE_ROLE_KEY: "fixture-service-role-key",
        },
      },
      require: (id: string) => {
        if (id === "zod") return { z };
        if (id === "@tanstack/react-start")
          return {
            createServerFn: () => {
              let validate = (input: unknown) => input;
              const builder = {
                inputValidator: (fn: typeof validate) => {
                  validate = fn;
                  return builder;
                },
                validator: (fn: typeof validate) => {
                  validate = fn;
                  return builder;
                },
                middleware: () => builder,
                handler:
                  (fn: (value: { data: unknown; context: object }) => Promise<unknown>) =>
                  async (input: { data?: unknown } = {}) =>
                    fn({ data: validate(input.data), context }),
              };
              return builder;
            },
          };
        if (id === "@tanstack/react-start/server")
          return {
            getRequestHeader: () => (state.authorized ? "Bearer fixture-user" : undefined),
            getRequestIP: () => "127.0.0.1",
          };
        if (id === "@/integrations/supabase/client.server") return { supabaseAdmin: client };
        if (id === "@/lib/auth/bearer-user.server")
          return { userFromBearerToken: async () => (state.authorized ? { id: ID } : null) };
        if (id === "@/lib/auth/require-operator.server") return { requireOperator };
        if (id === "@/lib/json") return { requireJsonObject };
        if (id === "@/lib/marketplace/catalogue-invalidation") return { catalogueChanged };
        if (id === "@/integrations/supabase/auth-middleware") return { requireSupabaseAuth: {} };
        if (id === "@/lib/i18n/limits")
          return {
            SlidingWindowLimiter: class {
              hit() {
                return false;
              }
            },
          };
        if (id === "@/lib/marketplace-public-config") return { resolveMarketplacePublicConfig };
        if (id === "@/lib/supplied-demos-catalog") return { SUPPLIED_DEMOS_16: [] };
        if (id === "@/data/catalogue") return { catalogueEntries: [] };
        if (id === "@/lib/site-content/constants") return { LIFETIME_PRICE: 0 };
        if (id === "@supabase/supabase-js")
          return {
            createClient: (url: string, key: string, options: Record<string, unknown> = {}) =>
              createClient(url, key, {
                ...options,
                global: {
                  ...((options.global as Record<string, unknown> | undefined) ?? {}),
                  fetch:
                    ((options.global as Record<string, unknown> | undefined)?.fetch as
                      typeof fetch | undefined) ?? fetch,
                },
              }),
          };
        if (id === "@/lib/ai-gateway.server") return { aiComplete: vi.fn() };
        if (id === "@/lib/legal-ai.server") return { buildLegalPrompts: vi.fn() };
        throw new Error(`Unexpected handler dependency: ${id}`);
      },
    });
    return (name: string, data?: unknown) => {
      const run = exports[name];
      if (typeof run !== "function") throw new Error(`Missing handler: ${name}`);
      return run({ data });
    };
  }
  return { state, requests, load, requireOperator, catalogueChanged };
}

function recoveryMigration(): string {
  return readFileSync(
    new URL(
      "../../../supabase/migrations/20261108T113000_marketplace_demo_click_and_recovery.sql",
      import.meta.url,
    ),
    "utf8",
  );
}

describe("typed homepage section updates", () => {
  it("preserves false, zero and cleared nullable fields; strips noneditable keys", async () => {
    const f = fixture();
    const run = f.load("../marketplace-manager/rows.functions.ts");
    await expect(
      run("configureSection", {
        key: "hero",
        patch: { enabled: false, sort_order: 0, subtitle: null, starts_at: null, id: ID },
      }),
    ).resolves.toMatchObject({ ok: true });
    const update = f.requests.find((r) => r.method === "PATCH");
    expect(update?.body).toMatchObject({
      enabled: false,
      sort_order: 0,
      subtitle: null,
      starts_at: null,
    });
    expect(update?.body).not.toHaveProperty("id");
    expect(update?.body.updated_at).toEqual(expect.any(String));
    expect(update?.url.searchParams.get("key")).toBe("eq.hero");
    expect(f.requireOperator).toHaveBeenCalledOnce();
    expect(f.catalogueChanged).toHaveBeenCalledOnce();
  });

  it.each([{ enabled: "false" }, { sort_order: "1" }, { sort_order: 1.5 }, { title: null }])(
    "rejects incorrectly typed fields: %j",
    async (patch) => {
      const f = fixture();
      await expect(
        f.load("../marketplace-manager/rows.functions.ts")("configureSection", {
          key: "hero",
          patch,
        }),
      ).rejects.toThrow();
      expect(f.requests).toHaveLength(0);
    },
  );

  it("rejects an empty or entirely noneditable patch without database calls", async () => {
    for (const patch of [{}, { id: ID }]) {
      const f = fixture();
      await expect(
        f.load("../marketplace-manager/rows.functions.ts")("configureSection", {
          key: "hero",
          patch,
        }),
      ).rejects.toThrow("Nothing in that change");
      expect(f.requests).toHaveLength(0);
    }
  });

  it("keeps archived sections retired and restricts the service-role write to operators", async () => {
    const f = fixture();
    f.state.sectionStatus = "archived";
    const run = f.load("../marketplace-manager/rows.functions.ts");
    await expect(
      run("configureSection", { key: "hero", patch: { enabled: true } }),
    ).rejects.toThrow("archived");
    expect(f.requests.every((r) => r.method === "GET")).toBe(true);
    f.state.roles = ["customer"];
    f.requests.length = 0;
    await expect(
      run("configureSection", { key: "hero", patch: { enabled: true } }),
    ).rejects.toThrow("operator rights");
    expect(f.requests).toHaveLength(0);
  });

  it("surfaces failed writes without invalidating the catalogue", async () => {
    const f = fixture();
    f.state.failure = true;
    await expect(
      f.load("../marketplace-manager/rows.functions.ts")("configureSection", {
        key: "hero",
        patch: { enabled: true },
      }),
    ).rejects.toThrow("fixture write refused");
    expect(f.catalogueChanged).not.toHaveBeenCalled();
  });
});

describe("migration-backed layout RPC contract", () => {
  it("uses the existing authenticated client, argument names and user bearer", async () => {
    const f = fixture();
    const run = f.load("../marketplace.functions.ts");
    await expect(run("layoutHistory")).resolves.toEqual({ entries: [] });
    await expect(run("layoutRestore", { auditId: ID })).resolves.toEqual({ ok: true });
    expect(f.requests.map((r) => r.body)).toEqual([{ p_limit: 20 }, { p_audit_id: ID }]);
    expect(f.requests.map((r) => r.url.pathname)).toEqual([
      "/rest/v1/rpc/mm_layout_history",
      "/rest/v1/rpc/mm_layout_restore",
    ]);
    expect(f.requests.every((r) => r.authorization === "Bearer fixture-user")).toBe(true);
  });

  it("keeps missing-context, malformed-ID and database refusals explicit", async () => {
    const f = fixture();
    await expect(f.load("../marketplace.functions.ts", {})("layoutHistory")).rejects.toThrow(
      "Unauthorized",
    );
    const run = f.load("../marketplace.functions.ts");
    await expect(run("layoutRestore", { auditId: "bad" })).rejects.toThrow();
    expect(f.requests).toHaveLength(0);
    f.state.failure = true;
    await expect(run("layoutHistory")).rejects.toThrow("fixture write refused");
  });
});

describe("Marketplace privileged server functions", () => {
  it.each(["listProductDemos", "recoverMarketplaceData"])(
    "denies direct calls to %s before privileged database access",
    async (name) => {
      const f = fixture();
      f.state.authorized = false;
      await expect(f.load("../marketplace.functions.ts")(name)).rejects.toThrow("Unauthorized");
      expect(f.requireOperator).toHaveBeenCalledOnce();
      expect(f.requests).toHaveLength(0);
    },
  );

  it("records public demo clicks through the anonymous-only RPC", async () => {
    const f = fixture();
    await expect(
      f.load("../marketplace.functions.ts")("recordPublicDemoClick", {
        productId: ID,
        demoUrlId: "20000000-0000-4000-8000-000000000002",
        sourcePage: "/demo/sample",
        referrer: "https://example.test/",
        deviceType: "desktop",
        browser: "fixture-browser",
      }),
    ).resolves.toEqual({ ok: true, recorded: true });

    expect(f.requests).toHaveLength(1);
    expect(f.requests[0].url.pathname).toBe("/rest/v1/rpc/mm_record_public_demo_click");
    expect(f.requests[0].apikey).toBe("fixture-anon-key");
    expect(f.requests[0].apikey).not.toBe("fixture-service-role-key");
    expect(f.requests[0].body).toEqual({
      p_product_id: ID,
      p_demo_url_id: "20000000-0000-4000-8000-000000000002",
      p_source_page: "/demo/sample",
      p_referrer: "https://example.test/",
      p_device_type: "desktop",
      p_browser: "fixture-browser",
    });

    const migration = recoveryMigration();
    expect(migration).toContain('DROP POLICY IF EXISTS "demo_clicks anyone insert"');
    expect(migration).toContain(
      "REVOKE INSERT ON TABLE public.demo_clicks FROM anon, authenticated",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.mm_record_public_demo_click(uuid, uuid, text, text, text, text)",
    );
    expect(migration).toContain("d.product_id = p_product_id");
    expect(migration).toContain("d.status = 'active'");
  });

  it("uses one transactional recovery RPC and keeps an audit row per inserted product", async () => {
    const f = fixture();
    await expect(f.load("../marketplace.functions.ts")("recoverMarketplaceData")).resolves.toEqual({
      success: true,
      productsInserted: 10,
      message: "Marketplace data recovery completed",
    });

    expect(f.requireOperator).toHaveBeenCalledOnce();
    expect(f.requests).toHaveLength(1);
    expect(f.requests[0].url.pathname).toBe("/rest/v1/rpc/mm_recover_marketplace_catalogue");
    expect(f.requests[0].apikey).toBe("fixture-service-role-key");
    expect(f.requests[0].body.p_actor_id).toBe(ID);
    const migration = recoveryMigration();
    const recoverySql = migration.split(
      "CREATE OR REPLACE FUNCTION public.mm_recover_marketplace_catalogue",
    )[1];
    expect(recoverySql).toContain("INSERT INTO public.marketplace_audit_logs");
    expect(recoverySql.indexOf("INSERT INTO public.marketplace_audit_logs")).toBeLessThan(
      recoverySql.indexOf("RETURN jsonb_build_object"),
    );
    expect(recoverySql).toContain("'marketplace.recovery.product_inserted'");
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.mm_recover_marketplace_catalogue(uuid, jsonb)",
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.mm_recover_marketplace_catalogue\(uuid, jsonb\)\s+TO service_role/,
    );
  });

  it("surfaces transactional recovery failure and separately audits the failed attempt", async () => {
    const f = fixture();
    f.state.recoveryRpcFails = true;

    await expect(f.load("../marketplace.functions.ts")("recoverMarketplaceData")).rejects.toThrow(
      "the transaction was rolled back and the failed attempt was audited",
    );
    expect(f.requests.map((request) => request.url.pathname)).toEqual([
      "/rest/v1/rpc/mm_recover_marketplace_catalogue",
      "/rest/v1/marketplace_audit_logs",
    ]);
    expect(f.requests[1].body).toMatchObject({
      actor_id: ID,
      action: "marketplace.recovery.failed",
      entity_type: "marketplace_data_recovery",
      metadata: { products_requested: 10, transaction_outcome: "rolled_back" },
    });
  });

  it("does not write failure audit when recovery authorization is denied", async () => {
    const f = fixture();
    f.state.authorized = false;

    await expect(f.load("../marketplace.functions.ts")("recoverMarketplaceData")).rejects.toThrow(
      "Unauthorized",
    );
    expect(f.requests).toHaveLength(0);
  });
});

describe("canonical task and legal update payloads", () => {
  it("keeps a zero quality score, reviewer decision, lifecycle transition and audit", async () => {
    const f = fixture();
    await expect(
      f.load("../tm/task-service.functions.ts")("reviewTask", {
        taskId: ID,
        decision: "approved",
        qualityScore: 0,
      }),
    ).resolves.toMatchObject({ ok: true });
    expect(f.requests.find((r) => r.method === "PATCH")?.body).toEqual({
      approval_status: "approved",
      quality_score: 0,
    });
    expect(f.requests.some((r) => r.body.status === "approved")).toBe(true);
    expect(f.requests.some((r) => r.url.pathname.endsWith("/tm_activity"))).toBe(true);
  });

  it("retains completion timestamps/progress and start timestamps", async () => {
    for (const [verb, status, field] of [
      ["completeTask", "completed", "completed_at"],
      ["startTask", "in_progress", "started_at"],
    ]) {
      const f = fixture();
      await expect(
        f.load("../tm/task-service.functions.ts")(verb, { taskId: ID }),
      ).resolves.toMatchObject({ ok: true, status });
      const patch = f.requests.find((r) => r.method === "PATCH")?.body;
      expect(patch?.[field]).toEqual(expect.any(String));
      expect(patch?.updated_at).toEqual(expect.any(String));
      if (status === "completed") expect(patch?.progress).toBe(100);
    }
  });

  it("refuses a nonoperator review without writing", async () => {
    const f = fixture();
    f.state.roles = ["customer"];
    await expect(
      f.load("../tm/task-service.functions.ts")("reviewTask", { taskId: ID, decision: "approved" }),
    ).resolves.toMatchObject({ ok: false, reason: "forbidden" });
    expect(f.requests.some((r) => r.method !== "GET")).toBe(false);
  });

  it.each([undefined, "", "Reviewed against the record"])(
    "preserves legal logging defaults and explicit notes: %j",
    async (note) => {
      const f = fixture();
      await expect(
        f.load("../legal-ai.functions.ts")("reviewLegalAI", {
          requestId: ID,
          decision: "accepted",
          note,
        }),
      ).resolves.toMatchObject({ ok: true });
      const body = f.requests.find((r) => r.url.pathname.endsWith("/legal_log"))?.body;
      if (note === undefined) expect(body).not.toHaveProperty("p_reason");
      else expect(body?.p_reason).toBe(note);
      expect(f.requests.find((r) => r.method === "PATCH")?.body.reviewed_by).toBe(ID);
    },
  );
});
