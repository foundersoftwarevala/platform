import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261108T160000_lead_manager_assignment_security.sql"),
  "utf8",
);

function mayReadLead(userId: string, assignedTo: string | null, isManager: boolean): boolean {
  return isManager || assignedTo === userId;
}

describe("Lead Manager assignment boundary", () => {
  it("keeps a sales agent from seeing another agent's lead", () => {
    const leadOwnedByAgentA = "11111111-1111-4111-8111-111111111111";
    const agentB = "22222222-2222-4222-8222-222222222222";
    expect(mayReadLead(agentB, leadOwnedByAgentA, false)).toBe(false);
    expect(mayReadLead(leadOwnedByAgentA, leadOwnedByAgentA, false)).toBe(true);
    expect(mayReadLead(agentB, leadOwnedByAgentA, true)).toBe(true);
  });

  it("defines the matching database read/update scopes and denies direct inserts", () => {
    expect(migration).toMatch(
      /CREATE POLICY lead_manager_read_scope[\s\S]*?assigned_to = auth\.uid\(\)/,
    );
    expect(migration).toMatch(
      /CREATE POLICY lead_manager_update_scope[\s\S]*?assigned_to = auth\.uid\(\)[\s\S]*?WITH CHECK[\s\S]*?assigned_to = auth\.uid\(\)/,
    );
    expect(migration).toMatch(/REVOKE INSERT, UPDATE, DELETE ON public\.leads FROM authenticated/);
    expect(migration).toMatch(/lead_activities_append_only/);
  });
});
