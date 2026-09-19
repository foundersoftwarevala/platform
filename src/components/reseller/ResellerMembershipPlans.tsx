import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";

/**
 * Reseller dashboard → Membership & Plans.
 *
 * Plans, prices and margins come from reseller_membership_plans. Buying one
 * goes through create_reseller_membership_order, which prices the order from
 * the plan on the server and creates the invoice and payment intent; the
 * browser never sends an amount. Payment evidence goes through
 * submit_reseller_membership_payment, which refuses a payment rail that is not
 * configured. Finance verifies the payment; activation follows on the server.
 *
 * The reseller's membership and orders are read back from the database, so
 * they survive a refresh and a new sign-in.
 */

const paymentMethods = [
  { code: "wise", label: "Wise" },
  { code: "upi", label: "UPI" },
  { code: "bank_transfer", label: "Bank Transfer" },
  { code: "binance", label: "Binance" },
] as const;

type Plan = {
  id: string;
  code: string;
  name: string;
  price_usd: number;
  validity_days: number;
  profit_percent: number;
  features: string[];
};
type Order = {
  id: string;
  order_number: string;
  amount_usd: number;
  currency: string;
  status: string;
  payment_status: string;
  proof_reference: string | null;
  created_at: string;
  plan_id: string;
  finance_invoices?: { invoice_no: string; status: string; total: number } | null;
};
type Membership = {
  id: string;
  plan_code: string;
  status: string;
  starts_at: string | null;
  expires_at: string | null;
};
type PurchaseResult = {
  order?: Order;
  invoice?: { invoice_no: string; total: number };
  payment_intent?: { id: string; amount: number; status: string };
  duplicate?: boolean;
};

export function ResellerMembershipPlans() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [method, setMethod] = useState<string>(paymentMethods[0].code);
  const [reference, setReference] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  // One key per plan for this visit: pressing "Purchase" twice, or a retry
  // after a dropped connection, returns the same order.
  const [purchaseKeys, setPurchaseKeys] = useState<Record<string, string>>({});

  const plans = useQuery({
    queryKey: ["reseller-membership-plans"],
    queryFn: async () => {
      const { data, error } = (await supabase
        .from("reseller_membership_plans" as never)
        .select("*")
        .eq("enabled", true)
        .order("sort_order")) as { data: Plan[] | null; error: Error | null };
      if (error) throw error;
      return data ?? [];
    },
  });
  const orders = useQuery({
    queryKey: ["reseller-membership-orders"],
    queryFn: async () => {
      const { data, error } = (await supabase
        .from("reseller_membership_orders" as never)
        .select(
          "id, order_number, amount_usd, currency, status, payment_status, proof_reference, created_at, plan_id, finance_invoices(invoice_no, status, total)",
        )
        .order("created_at", { ascending: false })) as {
        data: Order[] | null;
        error: Error | null;
      };
      if (error) throw error;
      return data ?? [];
    },
  });
  const membership = useQuery({
    queryKey: ["reseller-membership-current"],
    queryFn: async () => {
      const { data, error } = (await supabase
        .from("reseller_memberships" as never)
        .select("id, plan_code, status, starts_at, expires_at")
        .eq("status", "active")
        .order("activated_at", { ascending: false })
        .limit(1)) as { data: Membership[] | null; error: Error | null };
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const createOrder = useMutation({
    mutationFn: async (planCode: string) => {
      const key = purchaseKeys[planCode] ?? `${planCode}-${crypto.randomUUID()}`;
      if (!purchaseKeys[planCode]) setPurchaseKeys((current) => ({ ...current, [planCode]: key }));
      const { data, error } = (await supabase.rpc(
        "create_reseller_membership_order" as never,
        { p_plan_code: planCode, p_idempotency_key: key } as never,
      )) as { data: PurchaseResult | null; error: Error | null };
      if (error) throw error;
      return data!;
    },
    onSuccess: (data) => {
      setSelectedOrderId(data.order?.id ?? null);
      void queryClient.invalidateQueries({ queryKey: ["reseller-membership-orders"] });
      toast.success(t("reseller.plans.order_created"));
    },
    onError: (error) => toast.error(error.message),
  });

  const submitPayment = useMutation({
    mutationFn: async () => {
      if (!selectedOrderId) throw new Error(t("reseller.plans.choose_order"));
      const { data, error } = (await supabase.rpc(
        "submit_reseller_membership_payment" as never,
        {
          p_order_id: selectedOrderId,
          p_rail_code: method,
          p_reference: reference,
          p_proof: proofUrl || null,
        } as never,
      )) as { data: unknown; error: Error | null };
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(t("reseller.plans.submitted"));
      setReference("");
      setProofUrl("");
      void queryClient.invalidateQueries({ queryKey: ["reseller-membership-orders"] });
    },
    onError: (error) => toast.error(error.message),
  });

  if (plans.isLoading)
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("reseller.plans.loading")}
      </div>
    );
  if (plans.error)
    return <div className="p-6 text-sm text-destructive">{t("reseller.plans.load_failed")}</div>;

  const planName = (id: string) => plans.data?.find((p) => p.id === id)?.name ?? "Plan";
  const payable = (orders.data ?? []).filter(
    (o) => o.status === "pending" || o.status === "processing",
  );
  const selected = (orders.data ?? []).find((o) => o.id === selectedOrderId) ?? null;

  return (
    <section className="space-y-6" data-membership-screen>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          {t("reseller.plans.eyebrow")}
        </p>
        <h1 className="mt-2 text-2xl font-black tracking-tight">{t("reseller.plans.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("reseller.plans.intro")}</p>
      </header>

      <div
        className="border border-border bg-card p-4 text-sm"
        data-current-membership={membership.data?.plan_code ?? "none"}
      >
        {membership.data ? (
          <p>
            {t("reseller.plans.current", {
              plan: membership.data.plan_code,
              status: membership.data.status,
              date: membership.data.expires_at
                ? new Date(membership.data.expires_at).toLocaleDateString()
                : "—",
            })}
          </p>
        ) : (
          <p className="text-muted-foreground">{t("reseller.plans.none")}</p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.data?.map((plan) => (
          <article
            key={plan.id}
            className="border border-border bg-card p-5 shadow-sm"
            data-plan={plan.code}
          >
            <h2 className="text-lg font-bold">{plan.name}</h2>
            <p className="mt-3 text-3xl font-black">
              ${Number(plan.price_usd).toFixed(0)}
              <span className="text-sm font-medium text-muted-foreground">
                {" "}
                {t("reseller.plans.per_year")}
              </span>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("reseller.plans.terms", {
                days: plan.validity_days,
                percent: plan.profit_percent,
              })}
            </p>
            <ul className="mt-5 space-y-2 text-sm">
              {(Array.isArray(plan.features) ? plan.features : []).map((feature) => (
                <li key={feature} className="flex gap-2">
                  <Check className="h-4 w-4 text-emerald-500" />
                  {feature}
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={createOrder.isPending}
              onClick={() => createOrder.mutate(plan.code)}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
              data-purchase={plan.code}
            >
              {createOrder.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{" "}
              {t("reseller.plans.purchase", { plan: plan.name })}
            </button>
          </article>
        ))}
      </div>

      <div className="border border-border bg-card p-5">
        <h2 className="font-bold">{t("reseller.plans.orders")}</h2>
        {orders.isLoading ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("reseller.plans.loading_short")}</p>
        ) : (orders.data ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("reseller.plans.no_orders")}</p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th>{t("reseller.plans.col_order")}</th>
                <th>{t("reseller.plans.col_plan")}</th>
                <th>{t("reseller.plans.col_invoice")}</th>
                <th>{t("reseller.plans.col_amount")}</th>
                <th>{t("reseller.plans.col_status")}</th>
                <th>{t("reseller.plans.col_payment")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(orders.data ?? []).map((o) => (
                <tr
                  key={o.id}
                  className="border-t border-border"
                  data-order={o.order_number}
                  data-order-status={o.status}
                >
                  <td className="py-2 font-mono">{o.order_number}</td>
                  <td>{planName(o.plan_id)}</td>
                  <td className="font-mono">{o.finance_invoices?.invoice_no ?? "—"}</td>
                  <td>
                    ${Number(o.amount_usd).toFixed(2)} {o.currency}
                  </td>
                  <td>{o.status}</td>
                  <td>
                    {o.payment_status}
                    {o.proof_reference ? ` · ref ${o.proof_reference}` : ""}
                  </td>
                  <td>
                    {(o.status === "pending" || o.status === "processing") && (
                      <button
                        type="button"
                        className="text-xs font-bold text-primary"
                        onClick={() => setSelectedOrderId(o.id)}
                      >
                        {t("reseller.plans.pay")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && payable.some((o) => o.id === selected.id) && (
        <div className="border border-border bg-card p-5" data-payment-panel>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            <h2 className="font-bold">{t("reseller.plans.evidence")}</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("reseller.plans.evidence_summary", {
              order: selected.order_number,
              invoice: selected.finance_invoices?.invoice_no ?? "—",
              amount: `$${Number(selected.amount_usd).toFixed(2)} ${selected.currency}`,
            })}
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <select
              value={method}
              onChange={(event) => setMethod(event.target.value)}
              className="border border-border bg-background px-3 py-2 text-sm"
            >
              {paymentMethods.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.label}
                </option>
              ))}
            </select>
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder={t("reseller.plans.reference")}
              className="border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={proofUrl}
              onChange={(event) => setProofUrl(event.target.value)}
              placeholder={t("reseller.plans.proof")}
              className="border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            disabled={!reference.trim() || submitPayment.isPending}
            onClick={() => submitPayment.mutate()}
            className="mt-4 inline-flex items-center gap-2 bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {submitPayment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{" "}
            {t("reseller.plans.submit")}
          </button>
        </div>
      )}
    </section>
  );
}
