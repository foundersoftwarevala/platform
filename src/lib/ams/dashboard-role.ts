/**
 * The AMS role each role dashboard belongs to.
 *
 * It mirrors public.ams_role_of(), which maps the platform role a person holds
 * to the AMS role their activity is recognised under: a dashboard shows the
 * journey of the role it serves, and nothing from any other role the same
 * person may hold. AMS has exactly eleven roles - User, Reseller, Franchise,
 * Author, Vendor, Affiliate, Influencer, Developer, Creator, SEO and Support -
 * so the admin, dev-manager and promise-tracker dashboards show no AMS summary.
 */
const DASHBOARD_AMS_ROLE: Record<string, string> = {
  author: "author",
  vendor: "vendor",
  reseller: "reseller",
  affiliate: "affiliate",
  influencer: "influencer",
  franchise: "franchise",
  seo: "seo",
  developer: "developer",
};

export function amsRoleForDashboard(dashboardRole: string): string | null {
  return DASHBOARD_AMS_ROLE[dashboardRole] ?? null;
}
