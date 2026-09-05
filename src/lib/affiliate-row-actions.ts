import { supabase } from "@/integrations/supabase/client";
import { logRowAction } from "./affiliate-audit";

/**
 * Single-row operator actions. Each helper performs the primary mutation
 * and then writes exactly ONE activity_log event via logRowAction. Tests
 * in src/lib/__tests__/affiliate-row-actions.test.ts enforce the "one
 * mutation + one audit row per action" contract.
 */

async function mutate(
  table: string,
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from(table as never).update(patch as never).eq("id", id);
  if (error) throw error;
}

export async function activateAffiliate(id: string): Promise<void> {
  await mutate("affiliates", id, { status: "verified" });
  await logRowAction("affiliate", id, "activate", { status: "verified" });
}

export async function deactivateAffiliate(id: string, reason?: string): Promise<void> {
  await mutate("affiliates", id, { status: "suspended" });
  await logRowAction("affiliate", id, "deactivate", { status: "suspended", reason });
}

export async function setAffiliateStatus(
  id: string,
  status: "verified" | "pending" | "suspended",
): Promise<void> {
  await mutate("affiliates", id, { status });
  await logRowAction("affiliate", id, "status_change", { status });
}

export async function updateCommission(
  id: string,
  patch: { status?: string; amount_cents?: number },
): Promise<void> {
  await mutate("commissions", id, patch);
  await logRowAction("commission", id, "update", patch);
}

export async function updateWallet(
  id: string,
  patch: { balance_cents?: number },
): Promise<void> {
  await mutate("wallets", id, patch);
  await logRowAction("wallet", id, "update", patch);
}

export async function updatePayout(
  id: string,
  patch: { status?: string; amount_cents?: number },
): Promise<void> {
  await mutate("payouts", id, patch);
  await logRowAction("payout", id, "update", patch);
}
