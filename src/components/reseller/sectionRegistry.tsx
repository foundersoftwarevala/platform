// Maps every Reseller Manager sidebar label to a working feature surface.
import { ModuleDashboard } from "@/components/creator/ModuleDashboard";
import { resellerConfig } from "@/components/creator/moduleConfigs";
import { makeWall } from "@/components/manager-suite/makeWall";
import type { SectionEntry } from "@/components/manager-suite/ManagerWorkspace";

import { config as approvals } from "./walls/approvals";
import { config as audit } from "./walls/audit";
import { config as commission } from "./walls/commission";
import { config as kyc } from "./walls/kyc";
import { config as licenses } from "./walls/licenses";
import { config as notifications } from "./walls/notifications";
import { config as reports } from "./walls/reports";
import { config as subscriptions } from "./walls/subscriptions";
import { config as support } from "./walls/support";
import { config as wallet } from "./walls/wallet";
import { customersConfig, ordersConfig, productsConfig, resellersConfig } from "./walls/core";
import { resellerGroups } from "./navigation";

function ResellerDashboard() {
  return <ModuleDashboard config={resellerConfig} />;
}

const explicit: Record<string, SectionEntry> = {
  Dashboard: ResellerDashboard,
  "Command Console": ResellerDashboard,
  Resellers: resellersConfig,
  "Reseller Directory": resellersConfig,
  Applications: approvals,
  Approvals: approvals,
  Customers: customersConfig,
  Orders: ordersConfig,
  Products: productsConfig,
  Catalog: productsConfig,
  Subscriptions: subscriptions,
  Renewals: subscriptions,
  "Commission Rules": commission,
  "Commission Ledger": commission,
  Wallet: wallet,
  Withdrawals: wallet,
  "KYC & Verification": kyc,
  Compliance: kyc,
  "Audit Trail": audit,
  Notifications: notifications,
  "Support Desk": support,
  Tickets: support,
  Reports: reports,
  "Manager Reports": reports,
  License: licenses,
};

export const resellerRegistry: Record<string, SectionEntry> = (() => {
  const out: Record<string, SectionEntry> = { ...explicit };
  for (const group of resellerGroups) {
    for (const item of group.items) {
      if (out[item.label]) continue;
      out[item.label] = makeWall({
        scope: `reseller-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        entity: "record",
        eyebrow: group.label,
        title: item.label,
        subtitle: `${item.label} operations across the reseller channel — create, filter, act and export.`,
        icon: item.icon,
      });
    }
  }
  return out;
})();