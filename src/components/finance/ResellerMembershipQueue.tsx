import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { authHeaders } from "@/lib/auth/operator-fetch";
import { useTranslation } from "@/lib/i18n/use-translation";

/**
 * Finance Manager → Reseller memberships.
 *
 * The queue of reseller membership orders (server-priced by
 * create_reseller_membership_order) with the payment evidence each reseller
 * submitted. A decision goes through /api/finance/reseller-membership, i.e.
 * verify_reseller_membership_payment, which refuses anyone but finance, refuses
 * an order with no submitted payment, refuses verifying your own order, never
 * activates twice, and on success activates the membership (entitlements,
 * notification, audit event) on the server. Nothing here edits an order row.
 */

type Row = {
  id: string;
  order_number: string;
  amount_usd: number;
  currency: string;
  status: string;
  payment_status: string;
  proof_reference: string | null;
  proof_metadata: { proof?: string } | null;
  created_at: string;
  resellers: { name: string | null; code: string | null } | null;
  reseller_membership_plans: { name: string; price_usd: number } | null;
  finance_invoices: { invoice_no: string; total: number } | null;
};

export function ResellerMembershipQueue() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [references, setReferences] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"processing" | "pending" | "all">("processing");

  const orders = useQuery({
    queryKey: ["finance-reseller-membership-orders", filter],
    queryFn: async () => {
      let query = supabase
        .from("reseller_membership_orders" as never)
        .select(
          "id, order_number, amount_usd, currency, status, payment_status, proof_reference, proof_metadata, created_at, resellers(name, code), reseller_membership_plans(name, price_usd), finance_invoices(invoice_no, total)",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (filter !== "all") query = query.eq("status", filter);
      const { data, error } = (await query) as { data: Row[] | null; error: Error | null };
      if (error) throw error;
      return data ?? [];
    },
  });

  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "SUCCESS" | "FAILED" }) => {
      const response = await fetch("/api/finance/reseller-membership", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          action: "verify",
          orderId: id,
          status,
          providerReference: references[id] ?? null,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
        duplicate?: boolean;
      };
      if (!response.ok) throw new Error(body.message ?? body.error ?? `HTTP ${response.status}`);
      return body;
    },
    onSuccess: (body, vars) => {
      toast.success(
        body.duplicate
          ? t("reseller.queue.already")
          : vars.status === "SUCCESS"
            ? t("reseller.queue.verified")
            : t("reseller.queue.rejected"),
      );
      void queryClient.invalidateQueries({ queryKey: ["finance-reseller-membership-orders"] });
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <section className="space-y-4 p-4" data-membership-queue>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {t("reseller.queue.eyebrow")}
          </p>
          <h1 className="text-2xl font-black tracking-tight">{t("reseller.queue.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("reseller.queue.intro")}</p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="processing">{t("reseller.queue.filter_submitted")}</option>
          <option value="pending">{t("reseller.queue.filter_awaiting")}</option>
          <option value="all">{t("reseller.queue.filter_all")}</option>
        </select>
      </header>
      {orders.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("reseller.queue.loading")}
        </p>
      ) : orders.error ? (
        <p className="text-sm text-destructive">{(orders.error as Error).message}</p>
      ) : (orders.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("reseller.queue.empty")}</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th>{t("reseller.plans.col_order")}</th>
              <th>{t("reseller.queue.col_reseller")}</th>
              <th>{t("reseller.plans.col_plan")}</th>
              <th>{t("reseller.plans.col_invoice")}</th>
              <th>{t("reseller.plans.col_amount")}</th>
              <th>{t("reseller.plans.col_status")}</th>
              <th>{t("reseller.queue.col_reference")}</th>
              <th>{t("reseller.queue.col_decision")}</th>
            </tr>
          </thead>
          <tbody>
            {(orders.data ?? []).map((o) => (
              <tr
                key={o.id}
                className="border-t border-border align-top"
                data-queue-order={o.order_number}
              >
                <td className="py-2 font-mono text-xs">{o.order_number}</td>
                <td>
                  {o.resellers?.name ?? "—"}
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {o.resellers?.code}
                  </div>
                </td>
                <td>{o.reseller_membership_plans?.name ?? "—"}</td>
                <td className="font-mono text-xs">{o.finance_invoices?.invoice_no ?? "—"}</td>
                <td>
                  ${Number(o.amount_usd).toFixed(2)} {o.currency}
                </td>
                <td>
                  {o.status} / {o.payment_status}
                </td>
                <td className="text-xs">
                  {o.proof_reference ?? "—"}
                  {o.proof_metadata?.proof ? (
                    <div className="truncate text-muted-foreground">{o.proof_metadata.proof}</div>
                  ) : null}
                </td>
                <td>
                  {o.status === "processing" ? (
                    <div className="flex flex-col gap-1.5">
                      <input
                        value={references[o.id] ?? ""}
                        onChange={(e) => setReferences((r) => ({ ...r, [o.id]: e.target.value }))}
                        placeholder={t("reseller.queue.provider_reference")}
                        className="border border-border bg-background px-2 py-1 text-xs"
                      />
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          disabled={decide.isPending}
                          onClick={() => decide.mutate({ id: o.id, status: "SUCCESS" })}
                          className="inline-flex items-center gap-1 bg-emerald-600 px-2 py-1 text-xs font-bold text-white disabled:opacity-60"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> {t("reseller.queue.verify")}
                        </button>
                        <button
                          type="button"
                          disabled={decide.isPending}
                          onClick={() => decide.mutate({ id: o.id, status: "FAILED" })}
                          className="inline-flex items-center gap-1 bg-destructive px-2 py-1 text-xs font-bold text-white disabled:opacity-60"
                        >
                          <XCircle className="h-3.5 w-3.5" /> {t("reseller.queue.reject")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {o.status === "pending"
                        ? t("reseller.queue.waiting")
                        : t("reseller.queue.decided")}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
