import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const paymentMethods = ["wise", "upi", "bank_transfer", "binance"] as const;
type Plan = { id: string; code: string; name: string; price_usd: number; validity_days: number; profit_percent: number; features: string[] };
type PurchaseResult = { order?: { id: string; order_number: string }; invoice?: { invoice_number: string }; payment_intent?: { id: string; intent_number: string; amount: number } };

export function ResellerMembershipPlans() {
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<PurchaseResult | null>(null);
  const [method, setMethod] = useState<string>(paymentMethods[0]);
  const [reference, setReference] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [purchaseKeys, setPurchaseKeys] = useState<Record<string, string>>({});
  const plans = useQuery({
    queryKey: ["reseller-membership-plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reseller_membership_plans" as never).select("*").eq("enabled", true).order("sort_order") as { data: Plan[] | null; error: Error | null };
      if (error) throw error;
      return data ?? [];
    },
  });
  const createOrder = useMutation({
    mutationFn: async (planId: string) => {
      const key = purchaseKeys[planId] ?? `${planId}-${crypto.randomUUID()}`;
      if (!purchaseKeys[planId]) setPurchaseKeys((current) => ({ ...current, [planId]: key }));
      const { data, error } = await supabase.rpc("create_reseller_membership_order" as never, { p_plan_code: planId, p_idempotency_key: key } as never) as { data: PurchaseResult | null; error: Error | null };
      if (error) throw error;
      return data!;
    },
    onSuccess: (data) => { setSelectedOrder(data); queryClient.invalidateQueries({ queryKey: ["reseller-membership-orders"] }); toast.success("Order and invoice created. Submit payment evidence for finance verification."); },
    onError: (error) => toast.error(error.message),
  });
  const submitPayment = useMutation({
    mutationFn: async () => {
      if (!selectedOrder?.payment_intent?.id) throw new Error("Payment intent unavailable");
      const { data, error } = await supabase.rpc("submit_reseller_membership_payment" as never, { p_order_id: selectedOrder.order?.id, p_rail_code: method, p_reference: reference, p_proof: proofUrl || null } as never) as { data: unknown; error: Error | null };
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success("Payment submitted for finance verification."); setReference(""); setProofUrl(""); },
    onError: (error) => toast.error(error.message),
  });

  if (plans.isLoading) return <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading membership plans</div>;
  if (plans.error) return <div className="p-6 text-sm text-destructive">Unable to load membership plans.</div>;

  return (
    <section className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Reseller Membership</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight">Choose a yearly plan</h1>
        <p className="mt-1 text-sm text-muted-foreground">Application approval is free. Membership billing begins only after you choose a plan.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        {plans.data?.map((plan) => (
          <article key={plan.id} className="border border-border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-bold">{plan.name}</h2>
            <p className="mt-3 text-3xl font-black">${Number(plan.price_usd).toFixed(0)}<span className="text-sm font-medium text-muted-foreground"> / year</span></p>
            <p className="mt-2 text-xs text-muted-foreground">{plan.validity_days} days · up to {plan.profit_percent}% reseller margin</p>
            <ul className="mt-5 space-y-2 text-sm">{plan.features.map((feature) => <li key={feature} className="flex gap-2"><Check className="h-4 w-4 text-emerald-500" />{feature}</li>)}</ul>
            <button type="button" disabled={createOrder.isPending} onClick={() => createOrder.mutate(plan.code)} className="mt-6 inline-flex w-full items-center justify-center gap-2 bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">
              {createOrder.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Purchase {plan.name}
            </button>
          </article>
        ))}
      </div>
      {selectedOrder?.payment_intent && (
        <div className="border border-border bg-card p-5">
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-500" /><h2 className="font-bold">Payment evidence</h2></div>
          <p className="mt-2 text-sm text-muted-foreground">Order {selectedOrder.order?.order_number} · Invoice {selectedOrder.invoice?.invoice_number} · ${Number(selectedOrder.payment_intent.amount).toFixed(2)} USD</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <select value={method} onChange={(event) => setMethod(event.target.value)} className="border border-border bg-background px-3 py-2 text-sm"><option value="wise">Wise</option><option value="upi">UPI</option><option value="bank_transfer">Bank Transfer</option><option value="binance">Binance</option></select>
            <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Payment reference" className="border border-border bg-background px-3 py-2 text-sm" />
            <input value={proofUrl} onChange={(event) => setProofUrl(event.target.value)} placeholder="Proof URL (optional)" className="border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <button type="button" disabled={!reference.trim() || submitPayment.isPending} onClick={() => submitPayment.mutate()} className="mt-4 inline-flex items-center gap-2 bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{submitPayment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Submit for verification</button>
        </div>
      )}
    </section>
  );
}
