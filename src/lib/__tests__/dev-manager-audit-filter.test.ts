import { describe, expect, it } from "vitest";

import { loadAuditTrail } from "../dev-manager.server";

/** Records the PostgREST filters loadAuditTrail asks for. */
function fakeDb() {
  const calls: string[] = [];
  const query = {
    select: () => query,
    order: () => query,
    eq: (c: string, v: string) => (calls.push(`eq ${c} ${v}`), query),
    like: (c: string, v: string) => (calls.push(`like ${c} ${v}`), query),
    ilike: (c: string, v: string) => (calls.push(`ilike ${c} ${v}`), query),
    or: (v: string) => (calls.push(`or ${v}`), query),
    range: async () => ({ data: [], error: null, count: 0 }),
  };
  return { db: { from: () => query } as never, calls };
}

describe("Dev Manager audit filter", () => {
  it("matches every Dev Manager writer for 'Dev Manager'", async () => {
    const { db, calls } = fakeDb();
    await loadAuditTrail(db, 1, 25, "", "dev_manager");
    expect(calls).toEqual(["or entity_type.like.dev_manager.*,entity_type.eq.developer_management"]);
  });

  it("maps Escalations and Tasks to the entity types their writers use", async () => {
    for (const [option, entity] of [
      ["escalations", "dev_manager.escalations"],
      ["tasks", "dev_manager.tasks"],
    ]) {
      const { db, calls } = fakeDb();
      await loadAuditTrail(db, 1, 25, "", option);
      expect(calls).toEqual([`eq entity_type ${entity}`]);
    }
  });

  it("applies no module filter for 'all' and keeps the action search", async () => {
    const { db, calls } = fakeDb();
    await loadAuditTrail(db, 1, 25, "reassign", "all");
    expect(calls).toEqual(["ilike action %reassign%"]);
  });
});
