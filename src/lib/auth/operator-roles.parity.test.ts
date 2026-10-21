import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { isOperatorRole, SQL_OPERATOR_ROLES } from "./operator-roles.generated";

const sqlPath = resolve(
  process.cwd(),
  "supabase/migrations/20260907010000_operator_gate_fix.sql",
);

function rolesFromCanonicalSql(): string[] {
  const sql = readFileSync(sqlPath, "utf8");
  const functionBody = sql.match(
    /create\s+or\s+replace\s+function\s+public\.mm_is_operator\b[\s\S]*?ur\.role\s+in\s*\(([^)]*)\)/i,
  )?.[1];
  if (!functionBody) throw new Error("Could not find the canonical mm_is_operator role list.");
  return [...functionBody.matchAll(/'([a-z_]+)'/gi)].map(([, role]) => role);
}

describe("TypeScript operator roles stay derived from the canonical SQL policy", () => {
  it("keeps the generated TypeScript snapshot identical to mm_is_operator()", () => {
    expect([...SQL_OPERATOR_ROLES]).toEqual(rolesFromCanonicalSql());

    const implementation = readFileSync(
      resolve(process.cwd(), "src/lib/auth/require-operator.server.ts"),
      "utf8",
    );
    expect(implementation).toContain('import { isOperatorRole } from "./operator-roles.generated";');
    expect(implementation).toContain("isOperatorRole(r)");
    expect(implementation).not.toMatch(/const OPERATOR_ROLES\s*=\s*new Set/);
  });

  it("allows every SQL role and denies TypeScript-only, customer and unknown roles", () => {
    const sqlRoles = rolesFromCanonicalSql();
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

    for (const role of sqlRoles) expect(isOperatorRole(role), role).toBe(true);
    for (const role of deniedRoles) expect(isOperatorRole(role), role).toBe(false);
  });
});
