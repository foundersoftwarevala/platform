import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";
import { isOperatorRole, SQL_OPERATOR_ROLES } from "./operator-roles.generated";

/**
 * Server functions are reachable by anyone who can POST to /_serverFn, so the
 * ones that write with the service role or spend AI credit check their caller
 * with requireOperator (operators, plus the roles a screen admits through
 * alsoAllow). These tests pin that helper's answers and that each of those
 * functions asks it.
 */

let header: string | undefined;
let user: { id: string; email: string } | null;
let roles: string[];

vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: () => header,
}));
vi.mock("@/lib/auth/bearer-user.server", () => ({
  userFromBearerToken: async () => user,
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: async () => ({ data: roles.map((role) => ({ role })), error: null }),
      }),
    }),
  },
}));

afterEach(() => {
  header = undefined;
  user = null;
  roles = [];
});

describe("requireOperator", () => {
  it("refuses a caller with no session", async () => {
    const { requireOperator } = await import("./require-operator.server");
    await expect(requireOperator("This")).rejects.toThrow(/sign in/);
  });

  it("admits an operator", async () => {
    header = "Bearer t";
    user = { id: "u1", email: "a@b.c" };
    roles = ["admin"];
    const { requireOperator } = await import("./require-operator.server");
    await expect(requireOperator("This")).resolves.toMatchObject({ userId: "u1" });
  });

  it("admits a role only where the action allows it", async () => {
    header = "Bearer t";
    user = { id: "u2", email: "d@b.c" };
    roles = ["developer"];
    const { requireOperator } = await import("./require-operator.server");
    await expect(requireOperator("This")).rejects.toThrow(/operator rights/);
    await expect(requireOperator("This", { alsoAllow: ["developer"] })).resolves.toMatchObject({
      userId: "u2",
    });
  });

  it("refuses a customer even where staff roles are allowed", async () => {
    header = "Bearer t";
    user = { id: "u3", email: "c@b.c" };
    roles = ["customer"];
    const { requireOperator } = await import("./require-operator.server");
    await expect(
      requireOperator("This", { alsoAllow: ["developer", "support", "sales"] }),
    ).rejects.toThrow(/operator rights/);
  });

  it("matches the generated SQL allowlist for every allowed and denied role", async () => {
    const sqlPath = resolve(
      process.cwd(),
      "supabase/migrations/20260907010000_operator_gate_fix.sql",
    );
    const sql = readFileSync(sqlPath, "utf8");
    const canonicalRoles = sql.match(
      /create\s+or\s+replace\s+function\s+public\.mm_is_operator\b[\s\S]*?ur\.role\s+in\s*\(([^)]*)\)/i,
    )?.[1];
    if (!canonicalRoles) throw new Error("Could not find the canonical mm_is_operator role list.");
    const sqlRoles = [...canonicalRoles.matchAll(/'([a-z_]+)'/gi)].map(([, role]) => role);
    expect([...SQL_OPERATOR_ROLES]).toEqual(sqlRoles);

    const deniedRoles = [
      "employee",
      "sales",
      "support",
      "finance",
      "sales_support_manager",
      "customer",
      "owner",
      "unknown_role",
    ];
    const allRoles = [...new Set([...sqlRoles, ...deniedRoles])];
    const { requireOperator } = await import("./require-operator.server");
    header = "Bearer parity-test-token";
    header = "Bearer parity-test-token";
    user = { id: "role-parity", email: "role-parity@example.test" };

    for (const role of allRoles) {
      roles = [role];
      const sqlAllows = sqlRoles.includes(role);
      expect(isOperatorRole(role), role).toBe(sqlAllows);
      if (sqlAllows) {
        await expect(requireOperator("Role parity")).resolves.toMatchObject({
          userId: "role-parity",
        });
      } else {
        await expect(requireOperator("Role parity")).rejects.toThrow(/operator rights/);
      }
    }
  });
});

describe("server functions that spend AI credit or write with the service role", () => {
  const source = (path: string) => readFileSync(resolve(__dirname, path), "utf8");

  it("every SEO console function checks its caller", () => {
    const seo = source("../seo.functions.ts");
    // Each function body, from its export to the next one.
    const bodies = seo.split(/(?=export const \w+ = createServerFn)/).slice(1);
    expect(bodies.length).toBeGreaterThan(0);
    for (const body of bodies) {
      // generateWithAi's first step is generateSeo, which checks the caller
      // (below) before anything is written.
      expect(body).toMatch(/await seoOperator\(|await generateSeo\(/);
    }
  });

  it("SEO AI generation checks its caller", () => {
    expect(source("../seo-ai.functions.ts")).toMatch(/requireOperator\("Generating SEO content", \{ alsoAllow: \["seo", "marketing"\] \}\)/);
  });

  it("the AI Task Generator checks its caller", () => {
    expect(source("../tm/ai.functions.ts")).toMatch(/requireOperator\("The AI Task Generator", \{ alsoAllow: \[\.\.\.TASK_MANAGER_ROLES\] \}\)/);
  });
});
