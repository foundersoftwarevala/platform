import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, CalendarClock, CheckCircle2, Crown, XCircle } from "lucide-react";

import { plansQuery, subscriptionsQuery } from "@/lib/finance/queries";
import { useUpdateSubscription } from "@/lib/finance/mutations";
import type { FinanceView } from "@/lib/finance/views";
import type { Plan, Subscription } from "@/lib/finance/types";
import { PanelCard, QueryState, SectionShell, StatCard, StatGrid, StatusBadge } from "@/components/finance/ui-kit";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/finance/format";

const VIEW_META: Record<string, { title: string; description: string }> = {
  plan_active: { title: "Active Plans", description: "Subscriptions currently active" },
  plan_expired: { title: "Expired Plans", description: "Subscriptions that have lapsed" },
  plan_renewal: { title: "Renewal Tracking", description: "Subscriptions nearing expiry, bucketed by urgency" },
  plan_upgrade: { title: "Upgrade Requests", description: "Subscriptions eligible for a plan upgrade" },
  plan_downgrade: { title: "Downgrade Requests", description: "Subscriptions eligible for a plan downgrade" },
};

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function annualized(sub: Subscription) {
  const plan = sub.finance_plans;
  const amount = Number(sub.amount);
  if (!plan) return amount * 12;
  switch (plan.billing_cycle) {
    case "monthly":
      return amount * 12;
    case "quarterly":
      return amount * 4;
    case "yearly":
      return amount;
    default:
      return amount * 12;
  }
}

function monthly(sub: Subscription) {
  return annualized(sub) / 12;
}

export default function PlanSections({ view }: { view: FinanceView }) {
  const meta = VIEW_META[view] ?? VIEW_META['plan_active']!;
  const plansState = useQuery(plansQuery());
  const subsState = useQuery(subscriptionsQuery());
  const updateSubscription = useUpdateSubscription();

  const subs = subsState.data ?? [];
  const plans = plansState.data ?? [];

  const activeSubs = useMemo(() => subs.filter((s) => s.status === "active"), [subs]);
  const expiredSubs = useMemo(() => subs.filter((s) => s.status === "expired"), [subs]);

  const mrr = useMemo(() => activeSubs.reduce((sum, s) => sum + monthly(s), 0), [activeSubs]);
  const arr = mrr * 12;
  const churnRate = subs.length ? (expiredSubs.length / subs.length) * 100 : 0;

  const renewalBuckets = useMemo(() => {
    const now = activeSubs.map((s) => ({ sub: s, days: daysUntil(s.expires_at) }));
    return {
      overdue: now.filter((x) => x.days < 0),
      urgent: now.filter((x) => x.days >= 0 && x.days <= 7),
      soon: now.filter((x) => x.days > 7 && x.days <= 30),
      later: now.filter((x) => x.days > 30 && x.days <= 90),
    };
  }, [activeSubs]);

  const displayedSubs = useMemo(() => {
    if (view === "plan_active") return activeSubs;
    if (view === "plan_expired") return expiredSubs;
    if (view === "plan_renewal") {
      return activeSubs
        .filter((s) => daysUntil(s.expires_at) <= 90)
        .sort((a, b) => daysUntil(a.expires_at) - daysUntil(b.expires_at));
    }
    if (view === "plan_upgrade") {
      return subs.filter((s) => {
        const currentPrice = s.finance_plans?.price ?? 0;
        return plans.some((p) => p.price > currentPrice);
      });
    }
    if (view === "plan_downgrade") {
      return subs.filter((s) => {
        const currentPrice = s.finance_plans?.price ?? 0;
        return plans.some((p) => p.price < currentPrice && p.price > 0);
      });
    }
    return subs;
  }, [view, activeSubs, expiredSubs, subs, plans]);

  const bestUpgradeFor = (sub: Subscription): Plan | undefined => {
    const currentPrice = sub.finance_plans?.price ?? 0;
    return plans.filter((p) => p.price > currentPrice).sort((a, b) => a.price - b.price)[0];
  };

  const bestDowngradeFor = (sub: Subscription): Plan | undefined => {
    const currentPrice = sub.finance_plans?.price ?? 0;
    return plans
      .filter((p) => p.price < currentPrice && p.price > 0)
      .sort((a, b) => b.price - a.price)[0];
  };

  return (
    <SectionShell title={meta.title} description={meta.description} icon={Crown}>
      <div className="space-y-6">
        <StatGrid>
          <StatCard label="Active Subscriptions" value={activeSubs.length} icon={CheckCircle2} tone="success" />
          <StatCard label="Expired" value={expiredSubs.length} icon={XCircle} tone="danger" />
          <StatCard label="MRR" value={formatCurrency(mrr)} tone="info" />
          <StatCard label="ARR" value={formatCurrency(arr)} hint={`Churn ${churnRate.toFixed(1)}%`} tone="default" />
        </StatGrid>

        {view === "plan_renewal" && (
          <StatGrid>
            <StatCard label="Overdue" value={renewalBuckets.overdue.length} tone="danger" icon={CalendarClock} />
            <StatCard label="Due in ≤7 days" value={renewalBuckets.urgent.length} tone="warning" icon={CalendarClock} />
            <StatCard label="Due in 8-30 days" value={renewalBuckets.soon.length} tone="info" icon={CalendarClock} />
            <StatCard label="Due in 31-90 days" value={renewalBuckets.later.length} tone="default" icon={CalendarClock} />
          </StatGrid>
        )}

        <PanelCard title="Plan Catalog">
          <QueryState isLoading={plansState.isLoading} error={plansState.error} isEmpty={plans.length === 0}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => (
                <div key={plan.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-foreground">{plan.name}</p>
                    <StatusBadge status={plan.status} />
                  </div>
                  <p className="mt-2 text-xl font-bold text-foreground">
                    {formatCurrency(plan.price)}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">/{plan.billing_cycle}</span>
                  </p>
                  <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                    {(Array.isArray(plan.features) ? (plan.features as string[]) : []).map((f, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3 w-3 text-success" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </QueryState>
        </PanelCard>

        <PanelCard title="Subscriptions">
          <QueryState
            isLoading={subsState.isLoading}
            error={subsState.error}
            isEmpty={displayedSubs.length === 0}
            emptyLabel="No matching subscriptions"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="pb-2 font-medium">Customer</th>
                    <th className="pb-2 font-medium">Plan</th>
                    <th className="pb-2 font-medium">Amount</th>
                    <th className="pb-2 font-medium">Period</th>
                    <th className="pb-2 font-medium">Days Left</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {displayedSubs.map((sub) => {
                    const days = daysUntil(sub.expires_at);
                    const upgradeTo = bestUpgradeFor(sub);
                    const downgradeTo = bestDowngradeFor(sub);
                    return (
                      <tr key={sub.id}>
                        <td className="py-2 font-medium text-foreground">{sub.customer_name}</td>
                        <td className="py-2 text-muted-foreground">{sub.finance_plans?.name ?? "—"}</td>
                        <td className="py-2 font-semibold text-foreground">{formatCurrency(sub.amount)}</td>
                        <td className="py-2 text-xs text-muted-foreground">
                          {formatDate(sub.started_at)} - {formatDate(sub.expires_at)}
                        </td>
                        <td className="py-2 text-xs text-muted-foreground">{days >= 0 ? `${days}d` : "Overdue"}</td>
                        <td className="py-2">
                          <StatusBadge status={sub.status} />
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-1">
                            {view === "plan_upgrade" && upgradeTo && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1 px-2 text-xs"
                                disabled={updateSubscription.isPending}
                                onClick={() =>
                                  updateSubscription.mutate({ id: sub.id, status: "active", planId: upgradeTo.id, actor: "finance_manager" })
                                }
                              >
                                <ArrowUpRight className="h-3 w-3" />
                                Upgrade to {upgradeTo.name}
                              </Button>
                            )}
                            {view === "plan_downgrade" && downgradeTo && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1 px-2 text-xs"
                                disabled={updateSubscription.isPending}
                                onClick={() =>
                                  updateSubscription.mutate({ id: sub.id, status: "active", planId: downgradeTo.id, actor: "finance_manager" })
                                }
                              >
                                <ArrowDownRight className="h-3 w-3" />
                                Downgrade to {downgradeTo.name}
                              </Button>
                            )}
                            {sub.status === "active" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                disabled={updateSubscription.isPending}
                                onClick={() =>
                                  updateSubscription.mutate({ id: sub.id, status: "cancelled", actor: "finance_manager" })
                                }
                              >
                                Cancel
                              </Button>
                            )}
                            {sub.status === "expired" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                disabled={updateSubscription.isPending}
                                onClick={() =>
                                  updateSubscription.mutate({ id: sub.id, status: "active", actor: "finance_manager" })
                                }
                              >
                                Renew
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </QueryState>
        </PanelCard>
      </div>
    </SectionShell>
  );
}
