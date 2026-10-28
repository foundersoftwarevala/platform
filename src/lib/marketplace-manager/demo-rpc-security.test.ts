import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20261108T152000_mm_demo_eligibility_operator_gate.sql",
  ),
  "utf8",
);
const auditMigration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20261108T153000_mm_audit_operator_gate.sql"),
  "utf8",
);
const auditServiceRoleMigration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20261108T203000_mm_audit_operator_service_role.sql",
  ),
  "utf8",
);
const approvalFunctions = readFileSync(
  join(process.cwd(), "src", "lib", "marketplace-manager", "approvals.functions.ts"),
  "utf8",
);

describe("demo RPC authorization migration", () => {
  it.each([
    ["mm_demo_eligibility", "select * into v_p"],
    ["mm_sandbox_activity", "select * into v_s"],
  ])("authorizes before reading or changing data in %s", (functionName, firstDataAccess) => {
    const definition = migration.match(
      new RegExp(
        `create or replace function public\\.${functionName}[\\s\\S]*?as \\$\\$([\\s\\S]*?)\\$\\$;`,
        "i",
      ),
    );
    expect(definition).not.toBeNull();

    const body = definition?.[1] ?? "";
    expect(body).toMatch(/if not public\.mm_is_operator\(\) then/i);
    expect(body.indexOf("if not public.mm_is_operator()")).toBeLessThan(
      body.indexOf(firstDataAccess),
    );
    expect(body).toMatch(/'reason', 'not_permitted'/i);
  });

  it("removes anonymous execution while retaining authenticated operator and service execution", () => {
    expect(migration).toMatch(
      /revoke all on function public\.mm_demo_eligibility\(uuid\) from public, anon/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.mm_demo_eligibility\(uuid\) to authenticated, service_role/i,
    );
    expect(migration).toMatch(
      /revoke all on function public\.mm_sandbox_activity\(uuid, text, text, integer, integer\)\s+from public, anon/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.mm_sandbox_activity\(uuid, text, text, integer, integer\)\s+to authenticated, service_role/i,
    );
  });
});

describe("Marketplace audit RPC authorization migration", () => {
  it("prevents direct authenticated writes and keeps server-side callers", () => {
    expect(auditMigration).toMatch(
      /revoke all on function public\.mm_audit\(text, text, text, jsonb, jsonb, text\)\s+from public, anon, authenticated/i,
    );
    expect(auditMigration).toMatch(
      /grant execute on function public\.mm_audit\(text, text, text, jsonb, jsonb, text\)\s+to service_role/i,
    );
  });

  it("provides an operator-checked wrapper for authenticated manager calls", () => {
    const definition = auditMigration.match(
      /create or replace function public\.mm_audit_operator[\s\S]*?as \$\$([\s\S]*?)\$\$;/i,
    );
    expect(definition).not.toBeNull();

    const body = definition?.[1] ?? "";
    expect(body).toMatch(/if not public\.mm_is_operator\(\) then/i);
    expect(body.indexOf("if not public.mm_is_operator()")).toBeLessThan(
      body.indexOf("return public.mm_audit("),
    );
    expect(auditMigration).toMatch(
      /grant execute on function public\.mm_audit_operator\(text, text, text, jsonb, jsonb, text\)\s+to authenticated, service_role/i,
    );
    expect(approvalFunctions).toContain('callAsUser<string>("mm_audit_operator"');
  });

  it("rewires SECURITY INVOKER layout writes before revoking direct audit execution", () => {
    expect(auditMigration).toMatch(/to_regprocedure\(v_signature\)::oid/i);
    expect(auditMigration).toContain("'public.mm_section_set_enabled(text, boolean)'");
    expect(auditMigration).toContain("'public.mm_sections_reorder(jsonb)'");
    expect(auditMigration).toContain(
      "replace(v_definition, 'public.mm_audit(', 'public.mm_audit_operator(')",
    );
  });

  it("allows trusted server routes while retaining operator checks for user JWTs", () => {
    const definition = auditServiceRoleMigration.match(
      /create or replace function public\.mm_audit_operator[\s\S]*?as \$\$([\s\S]*?)\$\$;/i,
    );
    expect(definition).not.toBeNull();

    const body = definition?.[1] ?? "";
    expect(body).toMatch(/auth\.role\(\)\s+is distinct from 'service_role'/i);
    expect(body).toMatch(/and not public\.mm_is_operator\(\)/i);
    expect(body.indexOf("auth.role()")).toBeLessThan(body.indexOf("return public.mm_audit("));
    expect(auditServiceRoleMigration).toMatch(
      /grant execute on function public\.mm_audit_operator\(text, text, text, jsonb, jsonb, text\)\s+to authenticated, service_role/i,
    );
  });
});
