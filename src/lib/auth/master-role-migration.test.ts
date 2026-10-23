import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261108T190000_master_role_assignment.sql"),
  "utf8",
);

describe("master role assignment migration", () => {
  it("restricts super_admin to the configured owner at the database boundary", () => {
    expect(migration).toMatch(/lower\(email\) = 'bosssoftwarevala@gmail\.com'/);
    expect(migration).toMatch(/NEW\.role::text = 'super_admin'/);
    expect(migration).toMatch(/Only the master owner account may hold super_admin/);
    expect(migration).toMatch(/CREATE TRIGGER user_roles_master_super_admin_guard/);
    expect(migration).toMatch(/role::text = 'super_admin' AND user_id <> master_user_id/);
  });

  it("assigns the marketplace test account its marketplace role, not admin roles", () => {
    expect(migration).toMatch(/lower\(email\) = 'test\.marketplace@softwarevala\.test'/);
    expect(migration).toMatch(/'marketplace-user'::public\.app_role/);
    expect(migration).toMatch(/role::text IN \('admin', 'influencer'\)/);
  });
});
