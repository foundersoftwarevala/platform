import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { supabase } from "@/integrations/supabase/client";
import { leadApi } from "../api";
import { maskLeadEmail, maskLeadPhone } from "../contact-privacy";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn() },
}));

afterEach(() => vi.clearAllMocks());

describe("permission-aware lead reads", () => {
  it("uses the masking RPC for filtered and paginated lead lists", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [{ id: "lead-1", email: "p***@example.invalid", phone: "98*****123" }],
      error: null,
    } as never);

    const rows = await leadApi.listLeads({
      status: "new",
      source: "website",
      search: "  private@example.invalid  ",
      limit: 50,
      offset: 10,
    });

    expect(supabase.rpc).toHaveBeenCalledWith("lead_manager_list_leads", {
      p_status: "new",
      p_source: "website",
      p_search: "private@example.invalid",
      p_limit: 50,
      p_offset: 10,
    });
    expect(rows[0]).toMatchObject({
      email: "p***@example.invalid",
      phone: "98*****123",
    });
  });

  describe("lead contact privacy boundary", () => {
    it("masks contact values consistently for server-returned reseller leads", () => {
      expect(maskLeadEmail("private.person@example.invalid")).toBe(
        "p*************@example.invalid",
      );
      expect(maskLeadPhone("+91 (98765) 43210")).toBe("91*******210");
    });

    it("revokes direct browser reads of raw contacts and requires the RPC boundary", () => {
      const migration = readFileSync(
        resolve(process.cwd(), "supabase/migrations/20261108T134000_lead_contact_privacy.sql"),
        "utf8",
      );
      const grantedColumns = migration.match(
        /grant select \(([\s\S]*?)\) on table public\.leads/i,
      )?.[1];
      expect(migration).toMatch(
        /revoke select on table public\.leads from public, anon, authenticated/i,
      );
      expect(grantedColumns).toBeDefined();
      expect(grantedColumns).not.toMatch(/\b(email|phone)\b/i);
      expect(migration).toMatch(
        /create or replace function public\.lead_manager_get_lead[\s\S]*?security definer/i,
      );
      expect(migration).toMatch(
        /create or replace function public\.lead_manager_list_leads[\s\S]*?security definer/i,
      );
      expect(migration).toMatch(/lead_manager_can_unmask_contacts\(\)/i);
      expect(migration).toMatch(
        /grant execute on function public\.lead_manager_get_lead\(uuid\) to authenticated/i,
      );
      expect(migration).toMatch(
        /grant execute on function public\.lead_manager_list_leads\(text, text, text, integer, integer\)\s+to authenticated/i,
      );
    });
  });

  it("uses the masking RPC for individual leads and propagates database errors", async () => {
    vi.mocked(supabase.rpc)
      .mockResolvedValueOnce({
        data: { id: "lead-1", email: "p***@example.invalid", phone: "98*****123" },
        error: null,
      } as never)
      .mockResolvedValueOnce({
        data: null,
        error: { message: "Lead Manager access required" },
      } as never);

    const lead = await leadApi.getLead("lead-1");
    expect(lead.email).toBe("p***@example.invalid");
    await expect(leadApi.getLead("lead-2")).rejects.toThrow("Lead Manager access required");
    expect(supabase.rpc).toHaveBeenNthCalledWith(1, "lead_manager_get_lead", { p_id: "lead-1" });
    expect(supabase.rpc).toHaveBeenNthCalledWith(2, "lead_manager_get_lead", { p_id: "lead-2" });
  });
});
