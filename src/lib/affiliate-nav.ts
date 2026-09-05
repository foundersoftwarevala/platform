export type WallNav = {
  to: string;
  label: string;
  group: "overview" | "network" | "growth" | "commerce" | "finance" | "ops" | "system";
};

export const AFFILIATE_NAV: WallNav[] = [
  { to: "/affiliate-manager", label: "Dashboard", group: "overview" },
  { to: "/affiliate-manager/applications", label: "Applications", group: "overview" },
  { to: "/affiliate-manager/affiliates", label: "Affiliates", group: "network" },
  { to: "/affiliate-manager/referral-network", label: "Referral Network", group: "network" },
  { to: "/affiliate-manager/affiliate-links", label: "Affiliate Links", group: "growth" },
  { to: "/affiliate-manager/referral-codes", label: "Referral Codes", group: "growth" },
  { to: "/affiliate-manager/campaigns", label: "Campaigns", group: "growth" },
  { to: "/affiliate-manager/leads", label: "Leads", group: "growth" },
  { to: "/affiliate-manager/customers", label: "Customers", group: "commerce" },
  { to: "/affiliate-manager/products", label: "Products", group: "commerce" },
  { to: "/affiliate-manager/marketplace", label: "Marketplace", group: "commerce" },
  { to: "/affiliate-manager/coupons", label: "Coupons", group: "commerce" },
  { to: "/affiliate-manager/sales", label: "Sales", group: "commerce" },
  { to: "/affiliate-manager/orders", label: "Orders", group: "commerce" },
  { to: "/affiliate-manager/commissions", label: "Commissions", group: "finance" },
  { to: "/affiliate-manager/wallet", label: "Wallet", group: "finance" },
  { to: "/affiliate-manager/payouts", label: "Payouts", group: "finance" },
  { to: "/affiliate-manager/performance", label: "Performance", group: "ops" },
  { to: "/affiliate-manager/marketing", label: "Marketing", group: "ops" },
  { to: "/affiliate-manager/communication", label: "Communication", group: "ops" },
  { to: "/affiliate-manager/support", label: "Support", group: "ops" },
  { to: "/affiliate-manager/compliance", label: "Compliance", group: "ops" },
  { to: "/affiliate-manager/documents", label: "Documents", group: "ops" },
  { to: "/affiliate-manager/analytics", label: "Analytics", group: "system" },
  { to: "/affiliate-manager/reports", label: "Reports", group: "system" },
  { to: "/affiliate-manager/audit-log", label: "Audit Log", group: "system" },
  { to: "/affiliate-manager/bulk-actions", label: "Bulk Actions", group: "system" },
  { to: "/affiliate-manager/import", label: "Import", group: "system" },
  { to: "/affiliate-manager/export", label: "Export", group: "system" },
  { to: "/affiliate-manager/settings", label: "Settings", group: "system" },
  { to: "/affiliate-manager/realtime-test", label: "Realtime Test", group: "system" },
];
