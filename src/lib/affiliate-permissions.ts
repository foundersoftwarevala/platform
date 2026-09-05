import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Permission =
  | "affiliates.read" | "affiliates.write" | "affiliates.approve" | "affiliates.suspend" | "affiliates.terminate"
  | "campaigns.read" | "campaigns.write"
  | "commissions.read" | "commissions.write" | "commissions.approve"
  | "payouts.read" | "payouts.write" | "payouts.issue"
  | "wallet.read" | "wallet.write"
  | "bulk.execute" | "import.execute" | "export.execute"
  | "messaging.send" | "settings.write" | "roles.assign";

export type PermissionMatrix = {
  roles: string[];
  permissions: Permission[];
  is_boss: boolean;
  authenticated: boolean;
};

const EMPTY: PermissionMatrix = { roles: [], permissions: [], is_boss: false, authenticated: false };

export function usePermissions() {
  return useQuery({
    queryKey: ["affiliate", "permissions"],
    staleTime: 60_000,
    queryFn: async (): Promise<PermissionMatrix> => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return EMPTY;
      const { data, error } = await supabase.rpc("get_my_permissions");
      if (error) throw error;
      const payload = data as { roles?: string[]; permissions?: string[]; is_boss?: boolean } | null;
      return {
        roles: payload?.roles ?? [],
        permissions: (payload?.permissions ?? []) as Permission[],
        is_boss: !!payload?.is_boss,
        authenticated: true,
      };
    },
  });
}

export function can(matrix: PermissionMatrix | undefined, permission: Permission): boolean {
  if (!matrix) return false;
  return matrix.permissions.includes(permission);
}

// Map bulk action ids → required permission
export const BULK_ACTION_PERMISSIONS: Record<string, Permission> = {
  approve: "affiliates.approve",
  suspend: "affiliates.suspend",
  terminate: "affiliates.terminate",
  message: "messaging.send",
  "assign-campaign": "campaigns.write",
  "generate-payouts": "payouts.issue",
  "approve-commissions": "commissions.approve",
  "reject-commissions": "commissions.approve",
  "retry-payouts": "payouts.issue",
  tag: "affiliates.write",
  invite: "affiliates.write",
  delete: "affiliates.write",
};

// Map RightActionPanel labels → required permission
export const QUICK_ACTION_PERMISSIONS: Record<string, Permission> = {
  "Add Affiliate": "affiliates.write",
  "Launch Campaign": "campaigns.write",
  "Generate Codes": "campaigns.write",
  "Issue Payout": "payouts.issue",
  "Adjust Commission": "commissions.write",
  "Create Workflow": "settings.write",
  "Mass Bulk Actions": "bulk.execute",
  "Mass Approve": "affiliates.approve",
  "Import Center": "import.execute",
  "Export Center": "export.execute",
};

/**
 * Route-level permission requirements for every affiliate-manager wall.
 * Consumed by the layout RouteGate so each URL renders a consistent 403
 * empty state when the operator lacks access. `null` means the route is
 * accessible to any authenticated operator (dashboard, search, settings).
 */
export const ROUTE_PERMISSIONS: Record<string, Permission | null> = {
  "/affiliate-manager": null,
  "/affiliate-manager/search": null,
  "/affiliate-manager/settings": "settings.write",
  "/affiliate-manager/realtime-test": null,
  "/affiliate-manager/applications": "affiliates.approve",
  "/affiliate-manager/affiliates": "affiliates.read",
  "/affiliate-manager/referral-network": "affiliates.read",
  "/affiliate-manager/affiliate-links": "campaigns.read",
  "/affiliate-manager/referral-codes": "campaigns.read",
  "/affiliate-manager/campaigns": "campaigns.read",
  "/affiliate-manager/leads": "affiliates.read",
  "/affiliate-manager/customers": "affiliates.read",
  "/affiliate-manager/products": "campaigns.read",
  "/affiliate-manager/marketplace": "campaigns.read",
  "/affiliate-manager/coupons": "campaigns.read",
  "/affiliate-manager/sales": "commissions.read",
  "/affiliate-manager/orders": "commissions.read",
  "/affiliate-manager/commissions": "commissions.read",
  "/affiliate-manager/wallet": "wallet.read",
  "/affiliate-manager/payouts": "payouts.read",
  "/affiliate-manager/performance": "affiliates.read",
  "/affiliate-manager/marketing": "campaigns.read",
  "/affiliate-manager/communication": "messaging.send",
  "/affiliate-manager/support": "messaging.send",
  "/affiliate-manager/compliance": "affiliates.read",
  "/affiliate-manager/documents": "affiliates.read",
  "/affiliate-manager/analytics": "affiliates.read",
  "/affiliate-manager/reports": "affiliates.read",
  "/affiliate-manager/audit-log": "settings.write",
  "/affiliate-manager/bulk-actions": "bulk.execute",
  "/affiliate-manager/import": "import.execute",
  "/affiliate-manager/export": "export.execute",
};

export function permissionForPath(pathname: string): Permission | null {
  const trimmed = pathname.replace(/\/+$/, "") || "/affiliate-manager";
  if (trimmed in ROUTE_PERMISSIONS) return ROUTE_PERMISSIONS[trimmed];
  // Fallback: match the longest known prefix (handles nested detail routes).
  const match = Object.keys(ROUTE_PERMISSIONS)
    .filter((k) => trimmed === k || trimmed.startsWith(k + "/"))
    .sort((a, b) => b.length - a.length)[0];
  return match ? ROUTE_PERMISSIONS[match] : null;
}
