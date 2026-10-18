import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  CreditCard,
  Plus,
  Trash2,
  Edit,
  Check,
  X,
  Download,
  Tag,
  DollarSign,
  Users,
  Settings,
} from "lucide-react";
import {
  PageHeader,
  GlassCard,
  StatCard,
  StatusBadge,
  EmptyState,
  ErrorState,
  LoadingBlock,
  downloadRows,
  formatDate,
  inr,
  num,
} from "../primitives";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useManyRecords, type Row } from "@/lib/manager-queries";
import { useTranslation } from "@/lib/i18n/use-translation";

/**
 * Subscriptions & Payments reads the finance tables directly:
 * finance_subscriptions, finance_plans, finance_invoices, the company's
 * marketplace_coupons and the payment rails. Nothing on this screen is
 * invented: an empty table is shown as empty, and an unconfigured payment
 * provider is shown as not configured.
 */

const CYCLE_MONTHS: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
  annual: 12,
  annually: 12,
};

function n(row: Row | undefined, key: string): number {
  const value = Number(row?.[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function featureCount(features: unknown): string {
  return Array.isArray(features) ? String(features.length) : "—";
}

function DisabledIcon({
  reason,
  label,
  children,
}: {
  reason: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled
      title={reason}
      aria-label={`${label} — ${reason}`}
      className="cursor-not-allowed text-muted-foreground opacity-50"
    >
      {children}
    </button>
  );
}

export default function SubscriptionScreen() {
  const { t } = useTranslation();
  const SUBSCRIPTION_EDIT_REASON = t("manager.console.sub_edit_reason");
  const SUBSCRIPTION_DELETE_REASON = t("manager.console.sub_delete_reason");
  const PLAN_EDIT_REASON = t("manager.console.plan_edit_reason");
  const PAYMENT_METHOD_REASON = t("manager.console.payment_method_reason");
  const title = t("manager.console.subscriptions_title");
  const description = t("manager.console.subscriptions_description");
  const many = useManyRecords([
    {
      table: "finance_subscriptions",
      select:
        "id,plan_id,customer_name,customer_type,amount,status,auto_renew,started_at,expires_at,created_at",
      orderBy: "created_at",
      limit: 500,
    },
    {
      table: "finance_plans",
      select: "id,code,name,price,billing_cycle,features,status",
      orderBy: "price",
      ascending: true,
    },
    {
      table: "finance_invoices",
      select: "id,invoice_no,client_name,total,status,issue_date,due_date,paid_at,created_at",
      orderBy: "created_at",
      limit: 500,
    },
    {
      table: "marketplace_coupons",
      select: "id,code,kind,value,currency,max_redemptions,expires_at,active,created_at",
      orderBy: "created_at",
    },
    {
      table: "finance_payment_rails",
      select: "id,code,display_name,enabled,health_status,supported_currencies",
      orderBy: "code",
      ascending: true,
    },
  ]);

  const [subscriptions = [], plans = [], invoices = [], coupons = [], rails = []] = many.data ?? [];

  const planById = useMemo(() => new Map(plans.map((p) => [String(p["id"]), p])), [plans]);

  const stats = useMemo(() => {
    const active = subscriptions.filter((s) => s["status"] === "active");
    const mrr = active.reduce((sum, s) => {
      const plan = planById.get(String(s["plan_id"]));
      const months = CYCLE_MONTHS[String(plan?.["billing_cycle"] ?? "monthly")] ?? 1;
      return sum + n(s, "amount") / months;
    }, 0);
    return {
      active: active.length,
      mrr,
      arpu: active.length > 0 ? mrr / active.length : null,
    };
  }, [subscriptions, planById]);

  const [openPlan, setOpenPlan] = useState<string | null>(null);
  const stripeRail = rails.find((r) => String(r["code"]).toLowerCase() === "stripe");

  if (many.isLoading) {
    return (
      <>
        <PageHeader title={title} description={description} />
        <LoadingBlock rows={6} />
      </>
    );
  }

  if (many.error) {
    return (
      <>
        <PageHeader title={title} description={description} />
        <ErrorState error={many.error} onRetry={() => many.refetch()} />
      </>
    );
  }

  return (
    <>
      <PageHeader title={title} description={description} />

      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={t("manager.console.active_subscriptions")}
            value={num(stats.active)}
            tone="primary"
            icon={<Users className="h-4 w-4" />}
          />
          <StatCard
            label="MRR"
            value={inr(stats.mrr)}
            tone="green"
            icon={<DollarSign className="h-4 w-4" />}
            change={t("manager.console.mrr_note")}
          />
          <StatCard
            label={t("manager.console.churn_rate")}
            value="—"
            tone="amber"
            icon={<X className="h-4 w-4" />}
            change={t("manager.console.churn_not_tracked")}
          />
          <StatCard
            label="ARPU"
            value={stats.arpu === null ? "—" : inr(stats.arpu)}
            tone="cyan"
            icon={<CreditCard className="h-4 w-4" />}
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="subscriptions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="subscriptions">
              <Users className="mr-2 h-4 w-4" /> Subscriptions
            </TabsTrigger>
            <TabsTrigger value="plans">
              <CreditCard className="mr-2 h-4 w-4" /> Plans
            </TabsTrigger>
            <TabsTrigger value="invoices">
              <DollarSign className="mr-2 h-4 w-4" /> Invoices
            </TabsTrigger>
            <TabsTrigger value="coupons">
              <Tag className="mr-2 h-4 w-4" /> Coupons
            </TabsTrigger>
            <TabsTrigger value="payments">
              <CreditCard className="mr-2 h-4 w-4" /> Payment Methods
            </TabsTrigger>
            <TabsTrigger value="stripe">
              <Settings className="mr-2 h-4 w-4" /> Stripe
            </TabsTrigger>
          </TabsList>

          {/* Subscriptions Tab */}
          <TabsContent value="subscriptions">
            <GlassCard title={t("manager.console.active_subscriptions")}>
              {subscriptions.length === 0 ? (
                <EmptyState message={t("manager.console.no_subscriptions")} />
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead className="text-right">Next Billing</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {subscriptions.map((sub) => {
                          const plan = planById.get(String(sub["plan_id"]));
                          return (
                            <TableRow key={String(sub["id"])}>
                              <TableCell className="font-medium">
                                {String(sub["customer_name"] ?? "—")}
                              </TableCell>
                              <TableCell>{String(plan?.["name"] ?? "—")}</TableCell>
                              <TableCell>
                                {inr(n(sub, "amount"))}
                                {plan?.["billing_cycle"] ? `/${String(plan["billing_cycle"])}` : ""}
                              </TableCell>
                              <TableCell className="text-right">
                                {sub["status"] === "active" && sub["auto_renew"]
                                  ? formatDate(sub["expires_at"] as string | null)
                                  : "—"}
                              </TableCell>
                              <TableCell>
                                <StatusBadge value={String(sub["status"] ?? "unknown")} />
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <DisabledIcon reason={SUBSCRIPTION_EDIT_REASON} label="Edit">
                                    <Edit className="h-4 w-4" />
                                  </DisabledIcon>
                                  <DisabledIcon reason={SUBSCRIPTION_DELETE_REASON} label="Delete">
                                    <Trash2 className="h-4 w-4" />
                                  </DisabledIcon>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </GlassCard>
          </TabsContent>

          {/* Plans Tab */}
          <TabsContent value="plans">
            <GlassCard title="Subscription Plans">
              {plans.length === 0 ? (
                <EmptyState message={t("manager.console.no_plans")} />
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  {plans.map((plan) => (
                    <div
                      key={String(plan["id"])}
                      className="rounded-lg border border-border p-6 text-center"
                    >
                      <p className="font-bold">{String(plan["name"] ?? plan["code"] ?? "—")}</p>
                      <p className="text-2xl font-bold text-primary">{inr(n(plan, "price"))}</p>
                      <p className="text-sm text-muted-foreground">
                        /{String(plan["billing_cycle"] ?? "—")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("manager.console.plan_features", {
                          count: featureCount(plan["features"]),
                          status: String(plan["status"] ?? "—"),
                        })}
                      </p>
                      <div className="mt-4 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          disabled
                          title={PLAN_EDIT_REASON}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          aria-expanded={openPlan === String(plan["id"])}
                          onClick={() =>
                            setOpenPlan((cur) =>
                              cur === String(plan["id"]) ? null : String(plan["id"]),
                            )
                          }
                        >
                          View
                        </Button>
                      </div>
                      {openPlan === String(plan["id"]) && Array.isArray(plan["features"]) ? (
                        <ul className="mt-3 space-y-1 text-left text-xs text-muted-foreground">
                          {(plan["features"] as unknown[]).map((feature, i) => (
                            <li key={i}>• {String(feature)}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices">
            <GlassCard title="Billing History">
              {invoices.length === 0 ? (
                <EmptyState message={t("manager.console.no_invoices")} />
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice #</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.map((inv) => (
                          <TableRow key={String(inv["id"])}>
                            <TableCell className="font-mono">
                              {String(inv["invoice_no"] ?? "—")}
                            </TableCell>
                            <TableCell>{String(inv["client_name"] ?? "—")}</TableCell>
                            <TableCell className="text-right font-semibold">
                              {inr(n(inv, "total"))}
                            </TableCell>
                            <TableCell>
                              {formatDate(
                                (inv["issue_date"] ?? inv["created_at"]) as string | null,
                              )}
                            </TableCell>
                            <TableCell>
                              <StatusBadge value={String(inv["status"] ?? "unknown")} />
                            </TableCell>
                            <TableCell className="text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  downloadRows(
                                    `invoice-${String(inv["invoice_no"] ?? inv["id"])}.csv`,
                                    [inv],
                                  )
                                }
                                aria-label={`Download invoice ${String(inv["invoice_no"] ?? "")}`}
                                className="text-primary hover:underline flex items-center gap-1"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </GlassCard>
          </TabsContent>

          {/* Coupons Tab */}
          <TabsContent value="coupons">
            <GlassCard title="Discount Coupons">
              {coupons.length === 0 ? (
                <EmptyState
                  message={t("manager.console.no_coupons")}
                  action={
                    <Button size="sm" asChild>
                      <Link to="/affiliate-manager/coupons">
                        <Plus className="mr-2 h-4 w-4" /> {t("manager.console.manage_coupons")}
                      </Link>
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Discount</TableHead>
                          <TableHead className="text-right">Limit</TableHead>
                          <TableHead>Expires</TableHead>
                          <TableHead>Active</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {coupons.map((coupon) => (
                          <TableRow key={String(coupon["id"])}>
                            <TableCell className="font-mono">
                              {String(coupon["code"] ?? "—")}
                            </TableCell>
                            <TableCell className="font-bold text-status-success">
                              {coupon["kind"] === "percent"
                                ? `${n(coupon, "value")}%`
                                : `${n(coupon, "value")} ${String(coupon["currency"] ?? "")}`.trim()}
                            </TableCell>
                            <TableCell className="text-right">
                              {coupon["max_redemptions"] == null
                                ? t("manager.console.unlimited")
                                : num(n(coupon, "max_redemptions"))}
                            </TableCell>
                            <TableCell>
                              {formatDate(coupon["expires_at"] as string | null)}
                            </TableCell>
                            <TableCell>
                              {coupon["active"] ? (
                                <Check className="h-4 w-4 text-status-success" />
                              ) : (
                                <X className="h-4 w-4 text-status-error" />
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Link
                                to="/affiliate-manager/coupons"
                                aria-label={`Manage coupon ${String(coupon["code"] ?? "")}`}
                                className="inline-flex text-muted-foreground hover:text-foreground"
                              >
                                <Edit className="h-4 w-4" />
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </GlassCard>
          </TabsContent>

          {/* Payment Methods Tab */}
          <TabsContent value="payments">
            <GlassCard title="Payment Methods">
              <div className="space-y-4">
                <Button disabled title={PAYMENT_METHOD_REASON}>
                  <Plus className="mr-2 h-4 w-4" /> Add Payment Method
                </Button>
                {rails.length === 0 ? (
                  <EmptyState message={t("manager.console.no_rails")} />
                ) : (
                  rails.map((rail) => {
                    const configured =
                      Boolean(rail["enabled"]) && rail["health_status"] !== "unconfigured";
                    return (
                      <div key={String(rail["id"])} className="rounded-lg border border-border p-4">
                        <p className="font-medium">
                          {String(rail["display_name"] ?? rail["code"])}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {t("manager.console.rail_state", {
                            configured: configured ? "yes" : "no",
                            health: String(rail["health_status"] ?? "unknown"),
                          })}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </GlassCard>
          </TabsContent>

          {/* Stripe Tab */}
          <TabsContent value="stripe">
            <GlassCard title="Stripe Connection">
              <div className="space-y-4">
                <div className="rounded-lg bg-surface p-4">
                  <p className="text-sm font-medium">
                    {stripeRail && stripeRail["enabled"]
                      ? t("manager.console.status_value", {
                          status: String(stripeRail["health_status"] ?? "enabled"),
                        })
                      : t("manager.console.status_not_configured")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {stripeRail
                      ? t("manager.console.rail_name", {
                          name: String(stripeRail["display_name"] ?? "Stripe"),
                        })
                      : t("manager.console.no_stripe_rail")}
                  </p>
                </div>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled
                    title={t("manager.console.stripe_not_connected")}
                  >
                    {t("manager.console.view_stripe_dashboard")}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled
                    title={PAYMENT_METHOD_REASON}
                  >
                    {t("manager.console.reconnect_account")}
                  </Button>
                </div>
              </div>
            </GlassCard>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
