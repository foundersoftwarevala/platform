import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import { requireJsonObject } from "@/lib/json";

const TASK = "10000000-0000-4000-8000-000000000001";
const mocks = {
  db: null as SupabaseClient<Database> | null,
  signedIn: true,
  roles: ["boss"],
  member: false,
};
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
const source = readFileSync(new URL("../tm/task-service.functions.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports: Record<string, unknown> = {};
runInNewContext(output, {
  exports,
  console,
  Date,
  Set,
  Map,
  require: (id: string) => {
    if (id === "zod") return { z };
    if (id === "@/lib/json") return { requireJsonObject };
    if (id === "@tanstack/react-start") return { createServerFn };
    if (id === "@tanstack/react-start/server")
      return {
        getRequestHeader: () => (mocks.signedIn ? "Bearer isolated-fixture" : undefined),
      };
    if (id === "@/lib/auth/bearer-user.server")
      return {
        userFromBearerToken: async () => ({ id: "20000000-0000-4000-8000-000000000002" }),
      };
    if (id === "@/integrations/supabase/client.server") {
      if (!mocks.db) throw new Error("Missing isolated fixture client");
      return { supabaseAdmin: mocks.db };
    }
    throw new Error("Unexpected task-service test import: " + id);
  },
});
async function getTaskWallet(input: { data: { taskId: string } }) {
  if (typeof exports.getTaskWallet !== "function") throw new Error("Missing task wallet handler");
  return exports.getTaskWallet(input);
}

function fixture(seconds: unknown[] = []) {
  const requests: URL[] = [];
  const methods: string[] = [];
  const state = { failure: "", missing: false, pageCap: 500, shortPage: false, omitCount: false };
  const wallet = {
    id: TASK,
    code: "TASK-FIXTURE",
    title: "Isolated wallet",
    billable: true,
    cost: 1250,
    currency: "INR",
    billing_status: "invoiced",
    invoice_reference: "INV-FIXTURE",
    payment_reference: null,
    settled_at: null,
    actual_minutes: 99,
    estimated_hours: 2,
    client_name: "Fixture only",
    project_name: "Local test",
  };
  mocks.db = createClient<Database>("https://wallet-fixture.invalid", "fixture-only", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        const request = new Request(input, init);
        if (request.method !== "GET") throw new Error("Task wallet must not write");
        const url = new URL(request.url);
        requests.push(url);
        methods.push(request.method);
        const relation = url.pathname.split("/").at(-1);
        if (state.failure === relation) {
          return Response.json({ message: "Fixture read refused", code: "42501" }, { status: 403 });
        }
        if (relation === "user_roles") return Response.json(mocks.roles.map((role) => ({ role })));
        if (relation === "tm_members") return Response.json(mocks.member ? { id: TASK } : null);
        if (relation === "tm_tasks") return Response.json(state.missing ? null : wallet);
        if (relation === "tm_time_logs") {
          expect(url.searchParams.get("select")).toBe("id,seconds");
          expect(url.searchParams.get("task_id")).toBe(`eq.${TASK}`);
          expect(url.searchParams.get("order")).toBe("id.asc");
          const offset = Number(url.searchParams.get("offset") ?? 0);
          const limit = Math.min(Number(url.searchParams.get("limit") ?? 500), state.pageCap);
          const logs =
            state.shortPage && offset > 0
              ? []
              : seconds
                  .slice(offset, offset + limit)
                  .map((value, index) => ({ id: `log-${offset + index}`, seconds: value }));
          return Response.json(logs, {
            headers: state.omitCount
              ? {}
              : { "content-range": `${offset}-${offset + limit - 1}/${seconds.length}` },
          });
        }
        throw new Error("Unexpected wallet fixture relation: " + relation);
      },
    },
  });
  return { state, requests, methods, wallet };
}
beforeEach(() => {
  mocks.signedIn = true;
  mocks.roles = ["boss"];
  mocks.member = false;
});

describe("Task wallet canonical seconds aggregation", () => {
  it("reports 3600 seconds as 60 logged minutes and preserves all recorded financial fields", async () => {
    const f = fixture([3600]);
    const result = await getTaskWallet({ data: { taskId: TASK } });
    expect(result).toEqual({ ok: true, wallet: { ...f.wallet, logged_minutes: 60 } });
    expect(f.methods.every((method) => method === "GET")).toBe(true);
  });

  it("sums seconds before one conversion, preserving sub-minute time without inventing a rounding policy", async () => {
    fixture([30, 30, 1]);
    const result = await getTaskWallet({ data: { taskId: TASK } });
    expect(result).toMatchObject({ ok: true, wallet: { logged_minutes: 61 / 60 } });
  });

  it("returns zero only for a successful empty log read", async () => {
    fixture();
    expect(await getTaskWallet({ data: { taskId: TASK } })).toMatchObject({
      ok: true,
      wallet: { logged_minutes: 0 },
    });
  });

  it("includes more than the default REST row cap and scopes every page to the requested task", async () => {
    const f = fixture(Array.from({ length: 1201 }, () => 60));
    f.state.pageCap = 200;
    expect(await getTaskWallet({ data: { taskId: TASK } })).toMatchObject({
      ok: true,
      wallet: { logged_minutes: 1201 },
    });
    expect(f.requests.filter((url) => url.pathname.endsWith("/tm_time_logs"))).toHaveLength(7);
  });

  it.each(["tm_tasks", "tm_time_logs"])(
    "throws on failed %s reads instead of zero or no-such-task",
    async (relation) => {
      const f = fixture([3600]);
      f.state.failure = relation;
      await expect(getTaskWallet({ data: { taskId: TASK } })).rejects.toThrow(
        "Fixture read refused",
      );
    },
  );

  it.each([null, -1, 1.5, "60"])(
    "rejects invalid stored seconds %s instead of coercing to zero",
    async (value) => {
      fixture([value]);
      await expect(getTaskWallet({ data: { taskId: TASK } })).rejects.toThrow("invalid seconds");
    },
  );

  it("fails explicitly if later pages are missing", async () => {
    const f = fixture([60, 60]);
    f.state.pageCap = 1;
    f.state.shortPage = true;
    await expect(getTaskWallet({ data: { taskId: TASK } })).rejects.toThrow("incomplete time logs");
  });

  it("fails explicitly if the required exact-count contract is missing", async () => {
    const f = fixture([60]);
    f.state.omitCount = true;
    await expect(getTaskWallet({ data: { taskId: TASK } })).rejects.toThrow("incomplete time logs");
  });

  it("retains the distinct not-found contract without reading logs", async () => {
    const f = fixture();
    f.state.missing = true;
    expect(await getTaskWallet({ data: { taskId: TASK } })).toEqual({
      ok: false,
      reason: "no_such_task",
    });
    expect(f.requests.some((url) => url.pathname.endsWith("/tm_time_logs"))).toBe(false);
  });

  it("refuses signed-out users before any database query", async () => {
    const f = fixture();
    mocks.signedIn = false;
    await expect(getTaskWallet({ data: { taskId: TASK } })).rejects.toThrow("Unauthorized");
    expect(f.requests).toHaveLength(0);
  });

  it("refuses a signed-in nonstaff account without a roster entry", async () => {
    const f = fixture();
    mocks.roles = ["client"];
    expect(await getTaskWallet({ data: { taskId: TASK } })).toEqual({
      ok: false,
      reason: "forbidden",
    });
    expect(f.requests.some((url) => url.pathname.endsWith("/tm_tasks"))).toBe(false);
  });

  it("preserves roster-based access for existing task staff", async () => {
    fixture([60]);
    mocks.roles = [];
    mocks.member = true;
    expect(await getTaskWallet({ data: { taskId: TASK } })).toMatchObject({
      ok: true,
      wallet: { logged_minutes: 1 },
    });
  });

  it("rejects malformed task IDs before authentication/database work", async () => {
    const f = fixture();
    await expect(getTaskWallet({ data: { taskId: "not-a-uuid" } })).rejects.toThrow();
    expect(f.requests).toHaveLength(0);
  });
});
