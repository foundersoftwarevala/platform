import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import { requireJsonObject } from "../json";
import { isManagerTable, MANAGER_TABLES } from "../manager-tables";

const id = "10000000-0000-4000-8000-000000000001";
function fixture() {
  const state = { authenticated: true, role: "boss", fail: false };
  const requests: { method: string; url: URL; body: Record<string, unknown> }[] = [];
  const db = createClient("https://manager-fixture.invalid", "fixture-only", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        const request = new Request(input, init);
        const url = new URL(request.url);
        const body = ["GET", "DELETE"].includes(request.method)
          ? {}
          : requireJsonObject(await request.json(), "Manager fixture body");
        requests.push({ method: request.method, url, body });
        const table = url.pathname.split("/").at(-1);
        if (table === "has_role") return Response.json(body._role === state.role);
        if (table === "audit_logs") return new Response(null, { status: 204 });
        if (table !== "finance_expenses") throw new Error(`Unexpected fixture relation: ${table}`);
        if (state.fail)
          return Response.json({ message: "Fixture read refused", code: "42501" }, { status: 403 });
        if (request.method === "DELETE") return new Response(null, { status: 204 });
        const row = { id, amount: 0, approved: false, ...body };
        return Response.json(request.headers.get("accept")?.includes("object") ? row : [row]);
      },
    },
  });
  const output = ts.transpileModule(
    readFileSync(new URL("../manager-data.functions.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const exports: Record<string, unknown> = {};
  const unused = () => {
    throw new Error("Unexpected credential/provider operation");
  };
  runInNewContext(output, {
    exports,
    console,
    Date,
    Set,
    Promise,
    setTimeout,
    require: (name: string) => {
      if (name === "zod") return { z };
      if (name === "@tanstack/react-start")
        return {
          createServerFn: () => {
            let validate = (value: unknown) => value;
            const builder = {
              inputValidator: (fn: typeof validate) => {
                validate = fn;
                return builder;
              },
              handler:
                (run: (input: { data: unknown }) => Promise<unknown>) =>
                async (input: { data?: unknown } = {}) =>
                  run({ data: validate(input.data) }),
            };
            return builder;
          },
        };
      if (name === "@tanstack/react-start/server")
        return {
          getRequestHeader: () => (state.authenticated ? "Bearer fixture" : undefined),
        };
      if (name === "./manager-tables") return { isManagerTable, MANAGER_TABLES };
      if (name === "./ai-credentials.server")
        return {
          encryptAiCredential: unused,
          credentialFingerprint: unused,
          isEncryptedAiCredential: unused,
        };
      if (name === "./ai-local-services.server")
        return {
          getLocalAiService: () => null,
          isConfiguredLocalAiService: () => false,
        };
      if (name === "./managed-api-endpoints.server")
        return { assertManagedProviderEndpoint: unused };
      if (name === "./ai-gateway.server") return { aiComplete: unused };
      if (name === "node:crypto") return { randomUUID };
      if (name === "@/integrations/supabase/client.server") return { supabaseAdmin: db };
      if (name === "@/lib/auth/bearer-user.server")
        return {
          userFromBearerToken: async () =>
            state.authenticated ? { id, email: "fixture@example.invalid" } : null,
        };
      throw new Error(`Unexpected manager dependency: ${name}`);
    },
  });
  const run = (name: string, data?: unknown) => {
    const handler = exports[name];
    if (typeof handler !== "function") throw new Error(`Unknown fixture handler: ${name}`);
    return handler({ data });
  };
  return { state, requests, run };
}

describe("manager schema/query boundary", () => {
  it.each([
    "finance_bank_transfers",
    "finance_currency_rates",
    "customer_finance_profiles",
    "reseller_payment_intents",
  ])("reports missing %s explicitly for every generic operation", async (table) => {
    const f = fixture();
    for (const name of ["listRecords", "insertRecord", "updateRecord", "deleteRecord"]) {
      await expect(f.run(name, { table, id, values: {}, accessToken: "fixture" })).rejects.toThrow(
        `${table}: no table exists in the current database schema.`,
      );
    }
    expect(f.requests.every((request) => request.url.pathname.endsWith("/rpc/has_role"))).toBe(
      true,
    );
    expect(await f.run("getManagerTables")).toEqual(MANAGER_TABLES);
  });

  it("preserves available-table reads, writes, ID filters and audit rows", async () => {
    const f = fixture();
    const data = {
      table: "finance_expenses",
      id,
      accessToken: "fixture",
      values: { amount: 0, approved: false },
    };
    expect(await f.run("listRecords", data)).toEqual([{ id, amount: 0, approved: false }]);
    expect(await f.run("insertRecord", data)).toMatchObject({ id, amount: 0, approved: false });
    expect(await f.run("updateRecord", data)).toMatchObject({ id, amount: 0, approved: false });
    expect(await f.run("deleteRecord", data)).toEqual({ ok: true });
    const operations = f.requests.filter((request) =>
      request.url.pathname.endsWith("/finance_expenses"),
    );
    expect(operations.map((request) => request.method)).toEqual(["GET", "POST", "PATCH", "DELETE"]);
    expect(operations[2].url.searchParams.get("id")).toBe(`eq.${id}`);
    expect(operations[3].url.searchParams.get("id")).toBe(`eq.${id}`);
    expect(
      f.requests.filter((request) => request.url.pathname.endsWith("/audit_logs")),
    ).toHaveLength(3);
    expect(await f.run("getManagerTables", { accessToken: "fixture" })).toEqual(MANAGER_TABLES);
  });

  it("retains authentication before any generic relation access", async () => {
    const f = fixture();
    f.state.authenticated = false;
    await expect(
      f.run("listRecords", { table: "finance_expenses", accessToken: "fixture" }),
    ).rejects.toThrow("Manager authentication required");
    expect(f.requests).toHaveLength(0);
  });

  it("retains finance-role AI governance denial", async () => {
    const f = fixture();
    f.state.role = "finance";
    await expect(
      f.run("listRecords", { table: "api_keys", accessToken: "fixture" }),
    ).rejects.toThrow("Finance role cannot access AI/API Manager governance data.");
  });

  it("retains financial workflow and append-only write refusals", async () => {
    const f = fixture();
    await expect(
      f.run("updateRecord", {
        table: "marketplace_orders",
        id,
        values: {},
        accessToken: "fixture",
      }),
    ).rejects.toThrow("changed only through its own workflow");
    await expect(
      f.run("deleteRecord", { table: "finance_ledger_entries", id, accessToken: "fixture" }),
    ).rejects.toThrow("append-only record");
    expect(
      f.requests.every((request) =>
        ["/rpc/has_role", "/audit_logs"].some((path) => request.url.pathname.endsWith(path)),
      ),
    ).toBe(true);
  });

  it("retains hidden-column rejection and explicit backend failures", async () => {
    const f = fixture();
    await expect(
      f.run("listRecords", {
        table: "api_keys",
        select: "secret_encrypted",
        accessToken: "fixture",
      }),
    ).rejects.toThrow("that column is not available here");
    f.state.fail = true;
    await expect(
      f.run("listRecords", { table: "finance_expenses", accessToken: "fixture" }),
    ).rejects.toThrow("finance_expenses: Fixture read refused");
  });
});
