// Maps every Franchise Manager sidebar label to a working feature surface or
// an explicit coming-soon state.
import { ModuleDashboard } from "@/components/creator/ModuleDashboard";
import { franchiseConfig } from "@/components/creator/moduleConfigs";
import { makeWall, type WallStatus } from "@/components/manager-suite/makeWall";
import type { SectionEntry } from "@/components/manager-suite/ManagerWorkspace";

import { FranchiseApplicationsQueue } from "@/components/applications/RoleApplicationsQueue";
import { config as analytics } from "./walls/analytics";
import { config as commission } from "./walls/commission";
import { config as communication } from "./walls/communication";
import { config as compliance } from "./walls/compliance";
import { config as countries } from "./walls/countries";
import { config as directory } from "./walls/directory";
import { config as documents } from "./walls/documents";
import { config as leads } from "./walls/leads";
import { config as legal } from "./walls/legal";
import { config as license } from "./walls/license";
import { config as marketing } from "./walls/marketing";
import { config as onboarding } from "./walls/onboarding";
import { config as products } from "./walls/products";
import { config as regions } from "./walls/regions";
import { config as reports } from "./walls/reports";
import { config as revenue } from "./walls/revenue";
import { config as settings } from "./walls/settings";
import { config as support } from "./walls/support";
import { config as training } from "./walls/training";
import { config as users } from "./walls/users";
import { franchiseGroups, franchisePrimary } from "./navigation";

function FranchiseDashboard({ onNavigate }: { onNavigate?: (id: string) => void }) {
  return <ModuleDashboard config={franchiseConfig} onNavigate={onNavigate} />;
}

const connected: Record<string, SectionEntry> = {
  Dashboard: FranchiseDashboard,
  "Command Console": FranchiseDashboard,
  "Franchise Directory": directory,
  Applications: FranchiseApplicationsQueue,
  Onboarding: onboarding,
  License: license,
  Compliance: compliance,
  Countries: countries,
  Regions: regions,
  "Territory Map": regions,
  Revenue: revenue,
  Commission: commission,
  Royalty: commission,
  Payouts: commission,
  Products: products,
  Catalog: products,
  Marketing: marketing,
  Leads: leads,
  Legal: legal,
  Documents: documents,
  Contracts: legal,
  "Users & Roles": users,
  Training: training,
  Support: support,
  Communication: communication,
  Analytics: analytics,
  Reports: reports,
  Settings: settings,
};

export const franchiseStatuses: Record<string, WallStatus> = {
  Dashboard: "connected",
  "AI Studio": "coming_soon",
  "Command Console": "connected",
  "Franchise Directory": "connected",
  Applications: "connected",
  Onboarding: "connected",
  License: "connected",
  Renewals: "coming_soon",
  "Tiers & Levels": "coming_soon",
  "Performance Review": "coming_soon",
  Compliance: "connected",
  Countries: "connected",
  Regions: "connected",
  "Territory Map": "connected",
  "Master Franchise": "coming_soon",
  "Expansion Planner": "coming_soon",
  Products: "connected",
  Catalog: "connected",
  Orders: "coming_soon",
  Marketing: "connected",
  Leads: "connected",
  Marketplace: "coming_soon",
  Revenue: "connected",
  Royalty: "connected",
  Commission: "connected",
  Invoices: "coming_soon",
  Payouts: "connected",
  Wallet: "coming_soon",
  Billing: "coming_soon",
  Legal: "connected",
  Contracts: "connected",
  Documents: "connected",
  Approvals: "coming_soon",
  "Audit Trail": "coming_soon",
  "Users & Roles": "connected",
  Verification: "coming_soon",
  Training: "connected",
  Support: "connected",
  Communication: "connected",
  Notifications: "coming_soon",
  Inbox: "coming_soon",
  "Partner Relations": "coming_soon",
  Calendar: "coming_soon",
  Settings: "connected",
  Leaderboard: "coming_soon",
  Achievements: "coming_soon",
  "Hall of Fame": "coming_soon",
  "AI Chat": "coming_soon",
  Analytics: "connected",
  Reports: "connected",
};

export const franchiseRegistry: Record<string, SectionEntry> = (() => {
  const out: Record<string, SectionEntry> = {};
  const items = [
    ...franchisePrimary.map((item) => ({ ...item, group: "Franchise Manager" })),
    ...franchiseGroups.flatMap((group) =>
      group.items.map((item) => ({ ...item, group: group.label })),
    ),
  ];

  for (const item of items) {
    if (item.label in out) continue;
    const status = franchiseStatuses[item.label];
    if (!status) throw new Error(`Franchise navigation item has no status: ${item.label}`);
    if (status === "removed") continue;

    if (status === "connected") {
      const entry = connected[item.label];
      if (!entry) throw new Error(`Connected franchise item has no implementation: ${item.label}`);
      out[item.label] = entry;
      continue;
    }

    const entry = makeWall({
      status,
      scope: `franchise-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      entity: "record",
      eyebrow: item.group,
      title: item.label,
      subtitle: `${item.label} operations for the global franchise network.`,
      icon: item.icon,
    });
    if (!entry) throw new Error(`Coming-soon franchise item was removed: ${item.label}`);
    out[item.label] = entry;
  }

  return out;
})();
