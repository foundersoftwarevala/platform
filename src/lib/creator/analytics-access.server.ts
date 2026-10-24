import { requireOperator } from "@/lib/auth/require-operator.server";
import { getRequestHeader } from "@tanstack/react-start/server";
import type { ModuleId } from "./analytics.functions";

const MODULE_ROLES: Partial<Record<ModuleId, string[]>> = {
  creator: ["creator_manager"],
  reseller: ["finance", "support", "sales_support_manager"],
  franchise: ["finance", "support", "sales_support_manager"],
  marketplace: ["marketplace_manager"],
};

export async function requireModuleAnalyticsAccess(
  module: ModuleId,
  scopeId?: string | undefined,
): Promise<boolean> {
  if (scopeId !== undefined) {
    throw new Error("Scoped analytics are unavailable until the scope is verified for the caller.");
  }

  const authorization = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  if (!authorization?.startsWith("Bearer ")) return false;

  const access =
    module === "influencer"
      ? { allowedRoles: ["admin", "boss"] }
      : { alsoAllow: MODULE_ROLES[module] ?? [] };

  await requireOperator(`Reading ${module} analytics`, access);
  return true;
}
