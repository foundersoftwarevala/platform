import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261108T133000_commission_caps_and_currency.sql"),
  "utf8",
);

describe("commission integrity migration", () => {
  it.each([
    ["reseller", "reseller_commissions_for_order", "reseller_commissions"],
    ["influencer", "influencer_commissions_for_order", "partner_commissions"],
  ])("%s commissions are capped and currency-matched", (_kind, functionName, tableName) => {
    const functionBody = migration.match(
      new RegExp(`create or replace function public\\.${functionName}[\\s\\S]*?\\$\\$;`, "i"),
    )?.[0];

    expect(functionBody).toBeDefined();
    expect(functionBody).toMatch(/v_line_currency\s*<>\s*v_rule_currency/i);
    expect(functionBody).toMatch(/least\(v_gross,\s*round\(/i);
    expect(functionBody).toContain(`insert into public.${tableName}`);
  });

  it("adds database checks for both reseller and shared partner commissions", () => {
    expect(migration).toMatch(
      /alter table public\.reseller_commissions[\s\S]*?check \(commission_amount <= gross_amount\) not valid/i,
    );
    expect(migration).toMatch(
      /alter table public\.partner_commissions[\s\S]*?check \(partner_kind <> 'influencer' or commission_amount <= gross_amount\) not valid/i,
    );
    expect(migration).toMatch(
      /validate constraint reseller_commissions_not_over_gross[\s\S]*?validate constraint partner_commissions_influencer_not_over_gross/i,
    );
  });
});
