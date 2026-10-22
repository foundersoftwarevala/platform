import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { beforeEach, describe, expect, it } from "vitest";

const ACTOR_ID = "20000000-0000-4000-8000-000000000002";
const OTHER_ACTOR_ID = "20000000-0000-4000-8000-000000000003";
const TASK_ID = "10000000-0000-4000-8000-000000000001";
const BID_ID = "30000000-0000-4000-8000-000000000001";
const mocks = {
  authorization: "Bearer fixture-token" as string | undefined,
  roles: ["developer"],
  rows: [] as { sql: string; values: unknown[] }[],
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

const source = readFileSync(new URL("../core.functions.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports: Record<string, unknown> = {};
const load: unknown = runInThisContext(`(function(exports, require) { ${output}\n})`);
if (typeof load !== "function") throw new Error("Cannot load real bidding handlers");
load(exports, (id: string) => {
  if (id === "zod") return { z };
  if (id === "@tanstack/react-start") return { createServerFn };
  if (id === "@tanstack/react-start/server")
    return { getRequestHeader: () => mocks.authorization };
  if (id === "@/lib/auth/bearer-user.server")
    return {
      userFromBearerToken: async () =>
        mocks.authorization ? { id: ACTOR_ID } : null,
    };
  if (id === "@/lib/tasks/db.server")
    return {
      withTaskTransaction: async (
        actorId: string,
        run: (tx: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>) => Promise<unknown>,
      ) => {
        if (actorId !== ACTOR_ID) throw new Error("Unexpected bidding test actor.");
        const tx = async (strings: TemplateStringsArray, ...values: unknown[]) => {
          const sql = strings.join("$value");
          mocks.rows.push({ sql, values });
          if (sql.includes("from public.user_roles")) {
            return mocks.roles.map((role) => ({ role }));
          }
          if (sql.includes("from public.tm_members")) {
            return [{ id: "40000000-0000-4000-8000-000000000001", role: "developer", active: true }];
          }
          if (sql.includes("from public.tm_tasks")) return [];
          if (sql.includes("from public.tm_task_bids")) {
            const ownBid = { id: BID_ID, bidder_user_id: ACTOR_ID, taskId: TASK_ID };
            const anotherBid = {
              id: "30000000-0000-4000-8000-000000000002",
              bidder_user_id: OTHER_ACTOR_ID,
              taskId: TASK_ID,
            };
            if (sql.includes("where b.bidder_user_id") && values.includes(ACTOR_ID)) {
              return [ownBid];
            }
            return [ownBid, anotherBid];
          }
          throw new Error(`Unexpected bidding test query: ${sql}`);
        };
        return run(tx);
      },
    };
  throw new Error(`Unexpected bidding-test import: ${id}`);
});

async function getWorkspace() {
  const handler = exports.getBiddingWorkspace;
  if (typeof handler !== "function") throw new Error("Missing real bidding workspace handler");
  return handler({ data: undefined });
}

async function submitBid(data: unknown) {
  const handler = exports.submitBid;
  if (typeof handler !== "function") throw new Error("Missing real bid submission handler");
  return handler({ data });
}

beforeEach(() => {
  mocks.authorization = "Bearer fixture-token";
  mocks.roles = ["developer"];
  mocks.rows = [];
});

describe("task bidding authorization boundaries", () => {
  it("scopes a developer's bid history to the authenticated user in the real SQL handler", async () => {
    const result = (await getWorkspace()) as {
      isManager: boolean;
      bids: { id: string; bidder_user_id: string }[];
    };
    const bidQuery = mocks.rows.find((row) => row.sql.includes("from public.tm_task_bids"));

    expect(result.isManager).toBe(false);
    expect(result.bids.map((bid) => bid.id)).toEqual([BID_ID]);
    expect(bidQuery?.sql).toContain("where b.bidder_user_id");
    expect(bidQuery?.values).toContain(ACTOR_ID);
  });

  it("rejects signed-out workspace requests before opening the task database transaction", async () => {
    mocks.authorization = undefined;
    await expect(getWorkspace()).rejects.toThrow("Unauthorized");
    expect(mocks.rows).toEqual([]);
  });

  it("rejects zero amounts and validates bid identifiers before database writes", async () => {
    await expect(
      submitBid({
        taskId: TASK_ID,
        amount: "0.00",
        proposal: "A valid proposal",
      }),
    ).rejects.toThrow("greater than zero");
    expect(mocks.rows.some((row) => row.sql.includes("insert into public.tm_task_bids"))).toBe(false);
    mocks.rows = [];
    await expect(
      submitBid({
        taskId: "not-a-uuid",
        amount: "25",
        proposal: "A valid proposal",
      }),
    ).rejects.toThrow();
    expect(mocks.rows).toEqual([]);
  });
});
