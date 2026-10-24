import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const file = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("influencer security migration contracts", () => {
  const migration = file(
    "supabase/migrations/20261108T114000_influencer_manager_authorization.sql",
  );

  it("gates each manager RPC on the admin/boss-only helper", () => {
    for (const name of ["mm_influencers", "mm_influencer_code_create", "mm_influencer_status"]) {
      const functionBody = migration.match(
        new RegExp(`create or replace function public\\.${name}[\\s\\S]*?\\$\\$;`, "i"),
      )?.[0];
      expect(functionBody, name).toBeDefined();
      expect(functionBody).toContain("public.influencer_manager_access()");
      expect(functionBody).not.toContain("public.mm_is_operator()");
    }
  });

  it("removes anonymous/public RPC execution and grants authenticated calls", () => {
    for (const signature of [
      "mm_influencers(jsonb)",
      "mm_influencer_code_create(uuid, text)",
      "mm_influencer_status(uuid, text, text)",
    ]) {
      expect(migration).toMatch(
        new RegExp(
          `revoke all on function public\\.${signature.replace(/[()]/g, "\\$&")} from public, anon, authenticated, service_role`,
          "i",
        ),
      );
      expect(migration).toMatch(
        new RegExp(
          `grant execute on function public\\.${signature.replace(/[()]/g, "\\$&")} to authenticated`,
          "i",
        ),
      );
    }
  });

  it("replaces legacy mm_is_operator RLS policies without widening finance policies", () => {
    expect(migration).toContain("drop policy if exists influencer_profiles_operator");
    expect(migration).toContain("drop policy if exists influencer_profiles_own");
    expect(migration).toContain("drop policy if exists influencer_earnings_own");
    expect(migration).toContain("drop policy if exists influencer_payouts_own");
    expect(migration).toContain("public.influencer_manager_access()");
    expect(migration).not.toContain("public.mm_is_operator()");
    expect(migration).not.toContain("drop policy if exists influencer_finance_read");
    expect(migration).not.toContain("drop policy if exists influencer_payout_finance_read");
  });

  it("limits direct influencer payout writes and enforces the transition state machine", () => {
    expect(migration).toMatch(
      /revoke update on public\.partner_payouts from public, anon, authenticated/i,
    );
    expect(migration).toMatch(
      /revoke update \([\s\S]*?partner_id, amount, currency, status[\s\S]*?\) on public\.partner_payouts from public, anon, authenticated/i,
    );
    const updateColumns = migration.match(
      /grant update \(([\s\S]*?)\) on public\.partner_payouts to authenticated/i,
    )?.[1];
    expect(updateColumns).toBeDefined();
    expect(updateColumns).toMatch(
      /status, payment_method, provider, provider_reference, failure_reason/i,
    );
    expect(updateColumns).not.toMatch(/approved_at|approved_by|completed_at|partner_id/i);
    expect(migration).toMatch(
      /create policy "the platform decides a payout"[\s\S]*?partner_kind = 'influencer' and public\.influencer_manager_access\(\)[\s\S]*?partner_kind <> 'influencer' and public\.is_platform_operator\(\)/i,
    );
    expect(migration).toMatch(
      /create or replace function public\.guard_influencer_payout_transition\(\)[\s\S]*?when 'requested' then new\.status in \('approved', 'cancelled'\)[\s\S]*?when 'approved' then new\.status in \('processing', 'failed', 'cancelled'\)[\s\S]*?when 'processing' then new\.status in \('completed', 'failed'\)/i,
    );
    expect(migration).toMatch(
      /create trigger partner_payouts_influencer_transition[\s\S]*?execute function public\.guard_influencer_payout_transition\(\)/i,
    );
  });
});

describe("influencer manager and application authorization consistency", () => {
  it("limits the manager screen and service-backed summary to the database manager roles", () => {
    const managerRoute = file("src/routes/influencer-manager.tsx");
    const summaryFunction = file("src/lib/influencer/programme.functions.ts");

    expect(managerRoute).toMatch(
      /<RequireRole role=\{\["admin", "boss"\]\} allowOperators=\{false\}>/,
    );
    expect(summaryFunction).toMatch(/allowedRoles:\s*\["admin", "boss"\]/);
  });

  it("keeps Influencer Manager applications on the dedicated review queue", () => {
    const managerRoute = file("src/routes/influencer-manager.tsx");

    expect(managerRoute).toContain("import { InfluencerApplicationsQueue }");
    expect(managerRoute).toMatch(/Applications:\s*InfluencerApplicationsQueue/);
  });

  it("keeps central and compatibility application review aligned with application_staff RLS", () => {
    const appRoute = file("src/routes/application-manager.tsx");
    const appApi = file("src/routes/api/applications/queue.ts");
    const compatibilityApi = file("src/routes/api/influencer/applications.ts");
    const applicationSql = file("supabase/migrations/20260920130000_role_applications.sql");

    expect(appRoute).toMatch(
      /role=\{\["marketing", "admin", "boss", "super_admin", "boss_owner", "founder"\]\}\s+allowOperators=\{false\}/,
    );
    expect(applicationSql).toMatch(
      /create or replace function public\.application_staff\(\)[\s\S]*?in \('admin', 'boss', 'super_admin', 'boss_owner', 'founder', 'marketing'\)/i,
    );
    expect(applicationSql).toMatch(
      /create policy influencer_applications_staff[\s\S]*?using \(public\.application_staff\(\)\) with check \(public\.application_staff\(\)\)/i,
    );
    expect(appApi).toContain("isApplicationStaff");
    expect(compatibilityApi).toContain("Authorization: `Bearer ${token}`");
    expect(compatibilityApi).toContain("rpc/review_influencer_application");
  });
});

describe("attributed summary migration contract", () => {
  it("counts leads from attributed records and sales only from paid orders", () => {
    const migration = file("supabase/migrations/20261108T115000_influencer_paid_sales_metrics.sql");
    expect(migration).toContain(
      "select count(*) from public.leads where influencer_profile_id is not null",
    );
    expect(migration).toContain(
      "select count(*) from public.leads where influencer_profile_id = p.id",
    );
    expect(migration.match(/count\(distinct a\.order_id\)/gi)).toHaveLength(2);
    expect(
      migration.match(/join public\.marketplace_orders o on o\.id = a\.order_id/gi),
    ).toHaveLength(2);
    expect(migration.match(/o\.status::text = 'paid'/gi)).toHaveLength(2);
  });
});
