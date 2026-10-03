// Maps every Reseller Manager sidebar label to a working feature surface.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { ModuleDashboard, type ModuleConfig } from "@/components/creator/ModuleDashboard";
import { resellerConfig } from "@/components/creator/moduleConfigs";
import {
  getResellerAttention, getResellers,
  type ResellerAttention, type ResellerOverview,
} from "@/lib/marketplace-manager/resellers.functions";
import { makeWall } from "@/components/manager-suite/makeWall";
import type { SectionEntry } from "@/components/manager-suite/ManagerWorkspace";

import { config as audit } from "./walls/audit";
import { config as commission } from "./walls/commission";
import { config as kyc } from "./walls/kyc";
import { config as licenses } from "./walls/licenses";
import { config as notifications } from "./walls/notifications";
import { config as reports } from "./walls/reports";
import { config as subscriptions } from "./walls/subscriptions";
import { config as support } from "./walls/support";
import { config as wallet } from "./walls/wallet";
import { customersConfig, ordersConfig, productsConfig } from "./walls/core";
import { resellerGroups } from "./navigation";
import { ResellerManager } from "@/components/marketplace-manager/sections/ResellerManager";

const fmt = (amount: number, currency: string) =>
  `${currency === "USD" ? "$" : `${currency} `}${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

/**
 * The dashboard's queue, profile, leaderboard and attention lines, from the
 * reseller system itself.
 *
 * Read as the signed-in operator through mm_resellers and mm_reseller_attention
 * (the same functions the console and the attention banner use), so a viewer
 * the database does not admit sees the static "—" figures and nothing else.
 * Every line is a count or a sum the database returned; nothing is estimated.
 */
function liveResellerConfig(
  overview: ResellerOverview | undefined,
  attention: ResellerAttention | undefined,
): ModuleConfig {
  const config: ModuleConfig = { ...resellerConfig };
  if (overview?.ok) {
    config.profile = {
      ...resellerConfig.profile,
      stats: [
        ["Resellers", String(overview.total ?? 0)],
        ["Active", String(overview.active ?? 0)],
        ["Pending", String(overview.pending ?? 0)],
      ],
    };
    // Ranked by commission earned. mm_resellers sums a reseller's lines without
    // regard to currency, so the figure carries no currency sign.
    config.leaderboardRows = (overview.resellers ?? [])
      .filter((r) => Number(r.commission) > 0)
      .sort((a, b) => Number(b.commission) - Number(a.commission))
      .slice(0, 5)
      .map((r) => [r.name, `${Number(r.commission).toLocaleString(undefined, { maximumFractionDigits: 2 })} earned`]);
  }
  if (attention?.ok) {
    const payable = attention.commission_available ?? [];
    const payableText = payable.length
      ? payable.map((c) => fmt(Number(c.amount), c.currency)).join(" · ")
      : "0";
    config.plan = [
      ["Applications awaiting a decision", "Onboarding", String(attention.applications_pending ?? 0)],
      ["Payouts awaiting an operator", "Finance", String(attention.payouts_awaiting_action ?? 0)],
      ["Membership payments to verify", "Finance", String(attention.membership_payments_to_verify ?? 0)],
      ["Commission released and payable", "Finance", payableText],
    ];
    const lines: string[] = [];
    const pending = attention.applications_pending ?? 0;
    if (pending) {
      const unverified = attention.applications_kyc_unverified ?? 0;
      lines.push(
        `${pending} reseller application(s) are waiting for a decision` +
          (unverified ? `; ${unverified} of them have not passed KYC.` : "."),
      );
    }
    if (attention.payouts_awaiting_action) {
      lines.push(`${attention.payouts_awaiting_action} payout(s) are pending, approved or with the provider.`);
    }
    if (attention.membership_payments_to_verify) {
      lines.push(`${attention.membership_payments_to_verify} membership payment(s) are waiting to be verified.`);
    }
    for (const c of payable) {
      lines.push(`${fmt(Number(c.amount), c.currency)} of commission is released and payable to ${c.resellers} reseller(s).`);
    }
    if (attention.memberships_expiring_30d) {
      lines.push(`${attention.memberships_expiring_30d} membership(s) expire in the next 30 days.`);
    }
    config.suggestions = lines.length ? lines : ["Nothing in the reseller queue is waiting on an operator."];
  }
  return config;
}

function ResellerDashboard({ onNavigate }: { onNavigate?: (id: string) => void }) {
  const overview = useQuery({
    queryKey: ["marketplace", "resellers", "dashboard"],
    queryFn: () => getResellers({ data: { limit: 500 } }),
    staleTime: 30_000,
  });
  // The same query, and so the same cached answer, as the attention banner.
  const attention = useQuery({
    queryKey: ["executive-feed", "reseller"],
    queryFn: () => getResellerAttention(),
    staleTime: 30_000,
  });
  const config = useMemo(
    () => liveResellerConfig(overview.data, attention.data),
    [overview.data, attention.data],
  );
  return <ModuleDashboard config={config} onNavigate={onNavigate} />;
}

const explicit: Record<string, SectionEntry> = {
  Dashboard: ResellerDashboard,
  "Command Console": ResellerDashboard,
  // The reseller records themselves - applications (status pending),
  // approvals, plans, codes, payouts - from the database through the
  // reseller console (mm_resellers, mm_reseller_status, ...). The Applications
  // screen used to be a list kept in the browser.
  Resellers: ResellerManager,
  "Reseller Directory": ResellerManager,
  Applications: ResellerManager,
  Approvals: ResellerManager,
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
  // The attention banner's commission and payout alerts open "Payouts", which
  // was an empty, unconnected wall while the real payouts sat on this one.
  Payouts: wallet,
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