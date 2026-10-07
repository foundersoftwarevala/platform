import { useRouterState } from "@tanstack/react-router";
import { DEMO_ROUTE_ROLES } from "@/lib/auth/demo-roles";
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
  {
    prefix: "/control-panel",
    roles: ["developer", "finance", "support", "sales_support_manager"],
    label: "Control Panel",
  },
  { prefix: "/boss", roles: [], label: "Boss Console" },
  {
    prefix: "/manager",
    roles: ["developer", "finance", "support", "sales_support_manager"],
    label: "Manager",
  },
  // These are the roles public.mm_is_operator() honours, on top of the
  // platform operators RequireRole always admits. The list used to be
  // finance/support/sales_support_manager, none of which that function
  // accepts: they reached the console and every read it makes was refused,
  // which is what an empty Marketplace Manager actually was. Marketing and
  // SEO, which the database does accept, were kept out of it entirely.
  { prefix: "/marketplace-manager", roles: ["marketing", "seo"], label: "Marketplace Manager" },
  { prefix: "/marketplace-recovery", roles: ["developer"], label: "Marketplace Recovery" },
  {
    prefix: "/reseller-manager",
    roles: ["finance", "support", "sales_support_manager"],
    label: "Reseller Manager",
  },
  {
    prefix: "/franchise-manager",
    roles: ["finance", "support", "sales_support_manager"],
    label: "Franchise Manager",
  },
  {
    prefix: "/influencer-manager",
    roles: ["finance", "support", "sales_support_manager"],
    label: "Influencer Manager",
  },
  {
    prefix: "/affiliate-manager",
    roles: ["finance", "support", "sales_support_manager"],
    label: "Affiliate Manager",
  },
  {
    prefix: "/vendor-manager",
    roles: ["finance", "support", "sales_support_manager"],
    label: "Vendor Manager",
  },
  // The same roles the database's application_staff() lets decide an application.
  { prefix: "/application-manager", roles: ["marketing"], label: "Application Manager" },
  { prefix: "/creator-manager", roles: ["finance", "support"], label: "Creator Manager" },
  { prefix: "/finance-manager", roles: ["finance"], label: "Finance Manager" },
  {
    prefix: "/lead-manager",
    roles: ["sales", "marketing", "support", "sales_support_manager"],
    label: "Lead Manager",
  },
  { prefix: "/seo-manager", roles: ["seo", "marketing"], label: "SEO Manager" },
  { prefix: "/ai-api-manager", roles: ["developer"], label: "AI API Manager" },
  { prefix: "/ams-manager", roles: ["developer", "support"], label: "AMS Manager" },
  { prefix: "/ams", roles: ["developer", "support"], label: "AMS" },
  // Publishing a demo puts third-party software on the storefront under Software
  // Vala branding, so the pipeline behind these screens accepts only boss, admin,
  // super_admin, owner and developer. The door used to admit support as well, so a
  // support user could open the console and be refused the moment they acted.
  // Aligned with the pipeline rather than widening it.
  { prefix: "/demo-manager", roles: [...DEMO_ROUTE_ROLES], label: "Demo Manager" },
  { prefix: "/demo-ops", roles: [...DEMO_ROUTE_ROLES], label: "Demo Ops" },
  { prefix: "/demo-workspace", roles: [...DEMO_ROUTE_ROLES], label: "Demo Workspace" },
  { prefix: "/product-demo-manager", roles: [...DEMO_ROUTE_ROLES], label: "Product Demo Manager" },
  { prefix: "/sales-crm", roles: ["sales", "sales_support_manager"], label: "Sales CRM" },
  {
    prefix: "/sales-support-manager",
    roles: ["sales", "support", "sales_support_manager"],
    label: "Sales Support Manager",
  },
  { prefix: "/support-agent", roles: ["support"], label: "Support Agent" },
  { prefix: "/support-chatbot", roles: ["support"], label: "Support Chatbot" },
  { prefix: "/internal-support-ai", roles: ["support", "developer"], label: "Internal Support AI" },
  { prefix: "/marketing", roles: ["marketing"], label: "Marketing" },
  { prefix: "/vala-ai", roles: ["developer"], label: "Vala AI" },
  // /vala-tv is deliberately NOT here. It is a storefront page - the public
  // film listing the homepage and the marketplace both link to, and whose
  // "Learn" footer column carries it. It was gated to marketing and support,
  // so every visitor who followed one of those links was shown "Access
  // restricted" on a page meant to sell to them. The gate was protecting
  // nothing: the route's loader calls sf_vala_tv, which returns published
  // videos only, and the homepage's own Vala TV section already renders that
  // same list to anonymous visitors.
  //
  // Managing the films is a different surface and stays protected: Marketplace
  // Manager -> Growth -> Vala TV (ValaTvSection), behind the
  // /marketplace-manager prefix above.
  // /support gates itself, with <RequireRole role="support"> inside the route.
  // Naming it here as well is what this gate is for - the route-by-route
  // wrapping is the arrangement that leaves gaps - and it is what lets the
  // sitemap ask one question, of one list, about whether a page is public.
  // The wrapper inside the route stays; the two agree, so nothing changes for
  // anyone who is allowed in.
  { prefix: "/support", roles: ["support"], label: "Support Operations" },
  { prefix: "/chat-manager", roles: ["support", "sales_support_manager"], label: "Chat Manager" },
  { prefix: "/admin", roles: [], label: "Admin" },
  // Languages, the translation engine, memory, glossary and review.
  { prefix: "/language-manager", roles: [], label: "Language Manager" },
  // Executive only: this console carries platform-wide revenue, risk and
  // customer data. An empty role list means operators and nobody else.
  { prefix: "/ai-ceo", roles: [], label: "AI CEO" },
  // Infrastructure is operator-level. The database enforces the same thing
  // independently through row-level security on all 25 server_* tables.
  { prefix: "/server-manager", roles: ["developer"], label: "Server Manager" },
  // Developer operations. The database enforces the same separation: internal
  // notes are operator-only, so a developer cannot read one about themselves.
  { prefix: "/dev-manager", roles: ["developer"], label: "Developer Manager" },
  // The task control tower. The database enforces the same separation: a member
  // sees their own work and whatever is still claimable, an operator sees all.
  { prefix: "/task-manager", roles: ["developer", "support", "sales"], label: "Task Manager" },
  { prefix: "/keywords", roles: ["seo", "marketing"], label: "Keywords" },
  { prefix: "/pages", roles: ["seo", "marketing"], label: "Pages" },
];

/**
 * Whether a path is reachable by someone who is not signed in.
 *
 * The sitemap kept its own hand-written list of public pages, and the two
 * lists drifted: /support and /vala-tv were gated here and advertised there,
 * so a crawler asking for either was served "Checking workspace access..."
 * and nothing else. Asking the gate directly is the only way the two cannot
 * disagree again.
 *
 * /vala-tv has since been recognised as the storefront page it is and is no
 * longer gated, so the sitemap may advertise it again; that follows from this
 * function without anyone having to remember to change a second list.
 */
export function isPubliclyReachable(pathname: string): boolean {
  return matchFor(pathname) === null;
}

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
  // Language Manager has its own native sign-in and server-side operator guard.
  if (rule.prefix === "/language-manager") return <>{children}</>;
  return (
    <RequireRole key={rule.prefix} role={rule.roles}>
      {children}
    </RequireRole>
  );
}

export default RouteAccessGate;
