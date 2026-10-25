import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { requireJsonObject } from "@/lib/json";
import * as constants from "@/lib/promise-tracker/constants";

function fixture(path: string) {
  const requests: { url: URL; body: Record<string, unknown> }[] = [];
  const demoCalls: { name: string; input: unknown }[] = [];
  const state = { failure: false };
  const reportHealth = vi.fn().mockResolvedValue(undefined);
  const errorToast = vi.fn();
  const fetch: typeof globalThis.fetch = vi.fn(async (input, init) => {
    const request = new Request(input, init);
    const body = requireJsonObject(await request.json(), "Fixture request body");
    requests.push({ url: new URL(request.url), body });
    if (state.failure)
      return Response.json({ message: "fixture mutation refused", code: "42501" }, { status: 400 });
    return request.method === "PATCH"
      ? new Response(null, { status: 204 })
      : Response.json({ ok: true });
  });
  const supabase = createClient("https://hook-fixture.invalid", "fixture-only", {
    global: { fetch },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const exports: Record<string, unknown> = {};
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(output, {
    exports,
    Date,
    console,
    require: (id: string) => {
      if (id === "react") return {};
      if (id === "@tanstack/react-query")
        return {
          useMutation: (options: object) => options,
          useQuery: () => ({ data: [], isLoading: false }),
          useQueryClient: () => ({ invalidateQueries: vi.fn() }),
        };
      if (id === "@/integrations/supabase/client") return { supabase };
      if (id === "@/lib/demo-manager/demos.functions") {
        const call = (name: string) => async (input: unknown) => {
          demoCalls.push({ name, input });
          if (state.failure) throw new Error("fixture mutation refused");
        };
        return {
          listManagedDemos: async () => [],
          listPendingDemoRequests: async () => [],
          setManagedDemoStatus: call("setManagedDemoStatus"),
          extendManagedDemo: call("extendManagedDemo"),
          cloneManagedDemo: call("cloneManagedDemo"),
          respondToDemoRequest: call("respondToDemoRequest"),
        };
      }
      if (id === "sonner") return { toast: { error: errorToast } };
      if (id === "@/lib/promise-tracker/constants") return constants;
      if (id === "@/lib/promise-tracker/monitoring")
        return {
          reportHealth,
          errorMessage: (error: { message?: string }) => error.message,
        };
      throw new Error(`Unexpected hook dependency: ${id}`);
    },
  });
  function call(name: string, ...args: unknown[]) {
    const run = exports[name];
    if (typeof run !== "function") throw new Error(`Missing hook export: ${name}`);
    return run(...args);
  }
  function mutate(name: string, input: unknown) {
    const options: unknown = call(name);
    if (
      !options ||
      typeof options !== "object" ||
      !("mutationFn" in options) ||
      typeof options.mutationFn !== "function"
    )
      throw new Error("Mutation callback missing");
    return options.mutationFn(input);
  }
  return { requests, demoCalls, state, reportHealth, errorToast, call, mutate };
}

describe("nullable SQL RPC defaults", () => {
  it.each([undefined, null])(
    "omits absent audit fields so SQL NULL defaults apply: %j",
    async (value) => {
      const f = fixture("../../hooks/usePromiseTracker.ts");
      await f.call("writeAuditLog", {
        action: "Fixture audit",
        details: "Fixture details",
        promiseId: value,
        oldValue: value,
        newValue: value,
      });
      expect(f.requests[0].body).toEqual({
        p_action: "Fixture audit",
        p_details: "Fixture details",
      });
    },
  );

  it("keeps explicitly empty audit values and surfaces audit failures", async () => {
    const f = fixture("../../hooks/usePromiseTracker.ts");
    await f.call("writeAuditLog", {
      action: "Fixture audit",
      details: "",
      oldValue: "",
      newValue: "",
    });
    expect(f.requests[0].body).toMatchObject({ p_details: "", p_old: "", p_new: "" });
    f.state.failure = true;
    await expect(
      f.call("writeAuditLog", { action: "Fixture audit", details: "" }),
    ).rejects.toMatchObject({ message: "fixture mutation refused" });
    expect(f.reportHealth).toHaveBeenCalledOnce();
    expect(f.errorToast).toHaveBeenCalledOnce();
  });

  it.each(["useApplyFine", "useReleaseTip"])(
    "omits optional note/base but preserves explicit zero and empty note: %s",
    async (hook) => {
      const f = fixture("../../hooks/usePromiseTracker.ts");
      const input = { promise: { id: "promise-fixture", code: "FIX-1" }, ruleId: "rule-fixture" };
      await f.mutate(hook, input);
      expect(f.requests[0].body).not.toHaveProperty("p_note");
      expect(f.requests[0].body).not.toHaveProperty("p_basis");
      await f.mutate(hook, { ...input, base: 0, note: "" });
      expect(f.requests[1].body).toMatchObject({ p_basis: 0, p_note: "", p_actor: "user" });
      f.state.failure = true;
      await expect(f.mutate(hook, input)).rejects.toMatchObject({
        message: "fixture mutation refused",
      });
    },
  );

  it("preserves approval note defaults and explicit empty notes", async () => {
    const f = fixture("../../hooks/usePromiseTracker.ts");
    const input = { promise: { id: "promise-fixture", code: "FIX-1" }, decision: "approved" };
    await f.mutate("useApprovePromise", input);
    expect(f.requests[0].body).toEqual({ p_promise_id: "promise-fixture", p_decision: "approved" });
    await f.mutate("useApprovePromise", { ...input, note: "" });
    expect(f.requests[1].body.p_note).toBe("");
  });
});

describe("demo request schema updates", () => {
  it.each(["approved", "rejected"])(
    "delegates request decisions to the server function: %s",
    async (status) => {
      const f = fixture("../../hooks/useDemoOverview.ts");
      const overview: unknown = f.call("useDemoOverview");
      if (!overview || typeof overview !== "object" || !("respondToRequest" in overview))
        throw new Error("Request mutation missing");
      const mutation = overview.respondToRequest;
      if (
        !mutation ||
        typeof mutation !== "object" ||
        !("mutationFn" in mutation) ||
        typeof mutation.mutationFn !== "function"
      )
        throw new Error("Request callback missing");
      const id = "00000000-0000-4000-8000-000000000001";
      await mutation.mutationFn({ id, status });
      expect(f.demoCalls).toEqual([
        {
          name: "respondToDemoRequest",
          input: { data: { id, status } },
        },
      ]);
      f.state.failure = true;
      await expect(mutation.mutationFn({ id, status })).rejects.toMatchObject({
        message: "fixture mutation refused",
      });
    },
  );
});
