import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261108T180000_auth_security_fixes.sql"),
  "utf8",
);

describe("auth security migration contract", () => {
  it("assigns the default customer role without reading signup role metadata", () => {
    const signupFunction = migration.match(
      /CREATE OR REPLACE FUNCTION public\.handle_new_user\(\)([\s\S]*?)REVOKE ALL ON FUNCTION public\.handle_new_user/s,
    )?.[1];

    expect(signupFunction).toBeDefined();
    expect(signupFunction).toMatch(/VALUES \(NEW\.id, 'customer'::public\.app_role\)/);
    expect(signupFunction).not.toMatch(/raw_user_meta_data\s*->>\s*'role'/);
    expect(migration).toMatch(
      /DROP TRIGGER IF EXISTS on_auth_user_created_bootstrap_admin ON auth\.users/,
    );
  });

  it("limits role changes and role promotion to super-admins", () => {
    expect(migration).toMatch(/DROP POLICY IF EXISTS "Admins manage all roles"/);
    expect(migration).toMatch(/CREATE POLICY user_roles_super_admin_manage[\s\S]*?FOR ALL/);
    expect(migration).toMatch(
      /USING \(public\.has_role\(auth\.uid\(\), 'super_admin'::public\.app_role\)\)[\s\S]*?WITH CHECK \(public\.has_role\(auth\.uid\(\), 'super_admin'::public\.app_role\)\)/,
    );
    expect(migration).toMatch(
      /CREATE POLICY user_roles_super_admin_insert_guard[\s\S]*?AS RESTRICTIVE/,
    );
    expect(migration).toMatch(
      /CREATE POLICY user_roles_super_admin_update_guard[\s\S]*?AS RESTRICTIVE/,
    );
    expect(migration).toMatch(
      /CREATE POLICY user_roles_super_admin_delete_guard[\s\S]*?AS RESTRICTIVE/,
    );
    expect(migration).toMatch(/polcmd IN \('\*', 'a', 'w', 'd'\)/);
    expect(migration).toMatch(
      /GRANT INSERT \(user_id, role\), UPDATE \(role\), DELETE[\s\S]*?TO authenticated/,
    );
  });

  it("grants developer task updates only to progress and submission columns", () => {
    expect(migration).toMatch(
      /REVOKE UPDATE ON TABLE public\.developer_tasks FROM PUBLIC, anon, authenticated/,
    );
    expect(migration).toMatch(/REVOKE UPDATE \(%I\) ON TABLE public\.developer_tasks/);
    expect(migration).toMatch(
      /GRANT UPDATE \([\s\S]*?status,[\s\S]*?progress_percent,[\s\S]*?progress_note,[\s\S]*?links,[\s\S]*?attachments,[\s\S]*?tech_stack,[\s\S]*?delivery_notes[\s\S]*?\) ON TABLE public\.developer_tasks TO authenticated/,
    );

    const protectedColumnAssertions = migration.match(
      /protected_columns text\[\] := ARRAY\[([\s\S]*?)\];/,
    )?.[1];
    expect(protectedColumnAssertions).toContain("'developer_id'");
    expect(protectedColumnAssertions).toContain("'task_amount'");
    expect(protectedColumnAssertions).toContain("'completed_at'");
    expect(migration).toMatch(
      /IF has_column_privilege\('authenticated', 'public\.developer_tasks', protected_column, 'UPDATE'\) THEN/,
    );
  });
});
