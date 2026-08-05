// Maps every Franchise Manager sidebar label to a working feature surface,
// using the shared wall engine rendered in this project's own UI.
import { ModuleDashboard } from "@/components/creator/ModuleDashboard";
import { franchiseConfig } from "@/components/creator/moduleConfigs";
import { makeWall } from "@/components/manager-suite/makeWall";
import type { SectionEntry } from "@/components/manager-suite/ManagerWorkspace";

import { config as analytics } from "./walls/analytics";
import { config as applications } from "./walls/applications";
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
import { franchiseGroups } from "./navigation";

function FranchiseDashboard({ onNavigate }: { onNavigate?: (id: string) => void }) {
  return <ModuleDashboard config={franchiseConfig} onNavigate={onNavigate} />;
}

const explicit: Record<string, SectionEntry> = {
  Dashboard: FranchiseDashboard,
  "Command Console": FranchiseDashboard,
  "Franchise Directory": directory,
  Applications: applications,
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

export const franchiseRegistry: Record<string, SectionEntry> = (() => {
  const out: Record<string, SectionEntry> = { ...explicit };
  for (const group of franchiseGroups) {
    for (const item of group.items) {
      if (out[item.label]) continue;
      out[item.label] = makeWall({
        scope: `franchise-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        entity: "record",
        eyebrow: group.label,
        title: item.label,
        subtitle: `${item.label} operations for the global franchise network — create, filter, act and export.`,
        icon: item.icon,
      });
    }
  }
  return out;
})();