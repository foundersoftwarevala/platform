import { useQuery } from "@tanstack/react-query";

import {
  getResellerAttention,
  type ResellerAttention,
} from "@/lib/marketplace-manager/resellers.functions";
import { useTranslation, type Translate } from "@/lib/i18n/use-translation";
import type { ExecAlert, ExecRole } from "./executiveFeed";

/**
 * Banner signals read from the database, for the roles that have them.
 * Every number here is a count the server made when it was asked; a signal
 * the platform has no data for is left out rather than filled in.
 */
export type LiveFeed = {
  items: ExecAlert[];
  loading: boolean;
  /** Why the live signals could not be shown, if they could not. */
  notice: string | null;
  asOf: string | null;
};

const LIVE_ROLES: ReadonlySet<ExecRole> = new Set<ExecRole>(["reseller"]);

export function hasLiveFeed(role: ExecRole): boolean {
  return LIVE_ROLES.has(role);
}

function money(rows: ResellerAttention["commission_available"]): string {
  return (rows ?? []).map((r) => `${r.currency} ${Number(r.amount).toFixed(2)}`).join(" · ");
}

function resellerItems(d: ResellerAttention, t: Translate): ExecAlert[] {
  const pending = Number(d.applications_pending ?? 0);
  const verify = Number(d.membership_payments_to_verify ?? 0);
  const awaiting = Number(d.membership_orders_awaiting_payment ?? 0);
  const expiring = Number(d.memberships_expiring_30d ?? 0);
  const payouts = Number(d.payouts_awaiting_action ?? 0);
  const suspended = Number(d.suspended ?? 0);
  const commission = d.commission_available ?? [];
  const commissionResellers = commission.reduce((s, r) => s + Number(r.resellers ?? 0), 0);

  return [
    {
      id: "applications",
      priority: pending > 0 ? "critical" : "low",
      kind: t("reseller.attention.kind_applications"),
      title: t("reseller.attention.applications", { count: pending }),
      detail: t("reseller.attention.applications_kyc", {
        count: Number(d.applications_kyc_unverified ?? 0),
      }),
      target: "Applications",
      count: pending,
    },
    {
      id: "membership-verify",
      priority: verify > 0 ? "high" : "low",
      kind: t("reseller.attention.kind_membership"),
      title: t("reseller.attention.payments_to_verify", { count: verify }),
      detail: t("reseller.attention.payments_to_verify_detail"),
      target: "Resellers",
      count: verify,
    },
    {
      id: "membership-awaiting",
      priority: awaiting > 0 ? "medium" : "low",
      kind: t("reseller.attention.kind_membership"),
      title: t("reseller.attention.awaiting_payment", { count: awaiting }),
      detail: t("reseller.attention.awaiting_payment_detail"),
      target: "Resellers",
      count: awaiting,
    },
    {
      id: "renewals",
      priority: expiring > 0 ? "medium" : "low",
      kind: t("reseller.attention.kind_renewals"),
      title: t("reseller.attention.expiring", { count: expiring }),
      detail: t("reseller.attention.expiring_detail"),
      target: "Renewals",
      count: expiring,
    },
    {
      id: "commission",
      priority: commission.length > 0 ? "high" : "low",
      kind: t("reseller.attention.kind_commission"),
      title: t("reseller.attention.commission", { count: commissionResellers }),
      detail: commission.length ? money(commission) : t("reseller.attention.commission_none"),
      target: "Payouts",
      count: commissionResellers,
    },
    {
      id: "payouts",
      priority: payouts > 0 ? "high" : "low",
      kind: t("reseller.attention.kind_payouts"),
      title: t("reseller.attention.payouts", { count: payouts }),
      detail: t("reseller.attention.payouts_detail"),
      target: "Payouts",
      count: payouts,
    },
    {
      id: "suspended",
      priority: "low",
      kind: t("reseller.attention.kind_accounts"),
      title: t("reseller.attention.suspended", { count: suspended }),
      detail: t("reseller.attention.suspended_detail"),
      target: "Reseller Directory",
      count: suspended,
    },
  ];
}

export function useLiveExecutiveFeed(role: ExecRole): LiveFeed | null {
  const { t } = useTranslation();
  const live = hasLiveFeed(role);
  const q = useQuery({
    queryKey: ["executive-feed", role],
    queryFn: () => getResellerAttention(),
    enabled: live,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  if (!live) return null;
  const d = q.data;
  if (q.isLoading) return { items: [], loading: true, notice: null, asOf: null };
  if (q.error || !d) {
    return { items: [], loading: false, notice: t("reseller.attention.unavailable"), asOf: null };
  }
  if (!d.ok) {
    return {
      items: [],
      loading: false,
      notice:
        d.reason === "not_permitted"
          ? t("reseller.attention.not_permitted")
          : t("reseller.attention.unavailable"),
      asOf: null,
    };
  }
  return { items: resellerItems(d, t), loading: false, notice: null, asOf: d.as_of ?? null };
}
