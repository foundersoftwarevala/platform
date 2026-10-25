import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261108T141000_complete_marketplace_access_revocation.sql"),
  "utf8",
);

describe("complete marketplace access revocation migration", () => {
  it("revokes both legacy and marketplace licenses and entitlements atomically", () => {
    expect(migration).toMatch(/update public\.licenses[\s\S]*?status = 'revoked'/i);
    expect(migration).toMatch(/update public\.entitlements[\s\S]*?status = 'revoked'/i);
    expect(migration).toMatch(/update public\.marketplace_licenses[\s\S]*?status = 'revoked'/i);
    expect(migration).toMatch(/update public\.marketplace_entitlements[\s\S]*?status = 'revoked'/i);
    expect(migration).toContain("grant execute on function public.revoke_order_access(uuid, text) to service_role");
  });
});
