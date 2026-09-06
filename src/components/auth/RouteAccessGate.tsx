import { useRouterState } from "@tanstack/react-router";
import { type ReactNode } from "react";

import { RequireRole } from "@/components/auth/RequireRole";

/**
 * One central gate for every operator surface.
 *
 * The manager consoles were each rendering in full to anonymous visitors, and
 * there are roughly a hundred and fifty of them once the nested manager routes
 * are counted. Wrapping them one by one would leave gaps and would leave every
 * future route unprotected by default, so the decision is made here, from the
 * path, for the whole application at once.
 *
 * The rule is deliberately allow-by-default: the marketplace, product pages,
 * demos, login, applications and checkout must stay public, and the homepage is
 * a protected production route that must never be gated by accident. Only paths
 * that match a prefix below are gated.
 */

/** Path prefix -> the app_roles allowed there, on top of platform operators. */
const PROTECTED: { prefix: string; roles: string[]; label: string }[] = [
  { prefix: "/control-panel", roles: ["developer", "finance", "support", "sales_support_manager"], label: "Control Panel" },
  { prefix: "/boss", roles: [], label: "Boss Console" },
  { prefix: "/manager", roles: ["developer", "finance", "support", "sales_support_manager"], label: "Manager" },
  { prefix: "/marketplace-manager", roles: ["finance", "support", "sales_support_manager"], label: "Marketplace Manager" },
  { prefix: "/marketplace-recovery", roles: ["developer"], label: "Marketplace Recovery" },
  { prefix: "/reseller-manager", roles: ["finance", "support", "sales_support_manager"], label: "Reseller Manager" },
  { prefix: "/franchise-manager", roles: ["finance", "support", "sales_support_manager"], label: "Franchise Manager" },
  { prefix: "/influencer-manager", roles: ["finance", "support", "sales_support_manager"], label: "Influencer Manager" },
  { prefix: "/affiliate-manager", roles: ["finance", "support", "sales_support_manager"], label: "Affiliate Manager" },
  { prefix: "/vendor-manager", roles: ["finance", "support", "sales_support_manager"], label: "Vendor Manager" },
  { prefix: "/creator-manager", roles: ["finance", "support"], label: "Creator Manager" },
  { prefix: "/finance-manager", roles: ["finance"], label: "Finance Manager" },
  { prefix: "/lead-manager", roles: ["sales", "marketing", "support", "sales_support_manager"], label: "Lead Manager" },
  { prefix: "/seo-manager", roles: ["seo", "marketing"], label: "SEO Manager" },
  { prefix: "/ai-api-manager", roles: ["developer"], label: "AI API Manager" },
  { prefix: "/ams-manager", roles: ["developer", "support"], label: "AMS Manager" },
  { prefix: "/ams", roles: ["developer", "support"], label: "AMS" },
  { prefix: "/demo-manager", roles: ["developer", "support"], label: "Demo Manager" },
  { prefix: "/demo-ops", roles: ["developer", "support"], label: "Demo Ops" },
  { prefix: "/demo-workspace", roles: ["developer", "support"], label: "Demo Workspace" },
  { prefix: "/product-demo-manager", roles: ["developer", "support"], label: "Product Demo Manager" },
  { prefix: "/sales-crm", roles: ["sales", "sales_support_manager"], label: "Sales CRM" },
  { prefix: "/sales-support-manager", roles: ["sales", "support", "sales_support_manager"], label: "Sales Support Manager" },
  { prefix: "/support-agent", roles: ["support"], label: "Support Agent" },
  { prefix: "/support-chatbot", roles: ["support"], label: "Support Chatbot" },
  { prefix: "/internal-support-ai", roles: ["support", "developer"], label: "Internal Support AI" },
  { prefix: "/marketing", roles: ["marketing"], label: "Marketing" },
  { prefix: "/vala-ai", roles: ["developer"], label: "Vala AI" },
  { prefix: "/vala-tv", roles: ["marketing", "support"], label: "Vala TV" },
  { prefix: "/chat-manager", roles: ["support", "sales_support_manager"], label: "Chat Manager" },
  { prefix: "/admin", roles: [], label: "Admin" },
  // Executive only: this console carries platform-wide revenue, risk and
  // customer data. An empty role list means operators and nobody else.
  { prefix: "/ai-ceo", roles: [], label: "AI CEO" },
  // Infrastructure is operator-level. The database enforces the same thing
  // independently through row-level security on all 25 server_* tables.
  { prefix: "/server-manager", roles: ["developer"], label: "Server Manager" },
  // Developer operations. The database enforces the same separation: internal
  // notes are operator-only, so a developer cannot read one about themselves.
  { prefix: "/dev-manager", roles: ["developer"], label: "Developer Manager" },
  { prefix: "/keywords", roles: ["seo", "marketing"], label: "Keywords" },
  { prefix: "/pages", roles: ["seo", "marketing"], label: "Pages" },
];

function matchFor(pathname: string) {
  // Longest prefix wins, so /ams-manager is not swallowed by /ams.
  let best: (typeof PROTECTED)[number] | null = null;
  for (const rule of PROTECTED) {
    if (pathname === rule.prefix || pathname.startsWith(rule.prefix + "/")) {
      if (!best || rule.prefix.length > best.prefix.length) best = rule;
    }
  }
  return best;
}

export function RouteAccessGate({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const rule = matchFor(pathname);
  if (!rule) return <>{children}</>;
  return (
    <RequireRole key={rule.prefix} role={rule.roles}>
      {children}
    </RequireRole>
  );
}

export default RouteAccessGate;
