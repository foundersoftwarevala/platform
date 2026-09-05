import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Loader2, LockKeyhole, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  createMarketplaceCheckout,
  getMarketplaceCart,
} from "@/lib/marketplace-commerce.functions";
import { useServerFn } from "@/lib/serverFn";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
});

function createIdempotencyKey() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint32Array(4);
  crypto.getRandomValues(bytes);
  return `${Date.now()}-${Array.from(bytes).map((value) => value.toString(16)).join("")}`;
}

function CheckoutPage() {
  const queryClient = useQueryClient();
  const getCart = useServerFn(getMarketplaceCart);
  const checkout = useServerFn(createMarketplaceCheckout);
  const [idempotencyKey] = useState(createIdempotencyKey);

  const cartQuery = useQuery({
    queryKey: ["marketplace-cart"],
    queryFn: () => getCart(),
  });
  const checkoutMutation = useMutation({
    mutationFn: () => checkout({ data: { idempotencyKey } }),
    onSuccess: (result: any) => {
      toast.success(`Order ${result.order_number} created`);
      queryClient.invalidateQueries({ queryKey: ["marketplace-cart"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const items = cartQuery.data?.items ?? [];
  const result = checkoutMutation.data as { order_number?: string; total?: number; payment_status?: string } | undefined;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <Link to="/marketplace" className="mb-8 inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200">
          <ArrowLeft className="h-4 w-4" /> Back to marketplace
        </Link>
        <div className="mb-8 flex items-center gap-3">
          <ShoppingCart className="h-7 w-7 text-cyan-300" />
          <div>
            <h1 className="text-3xl font-bold">Checkout</h1>
            <p className="text-sm text-slate-400">Prices are calculated on the server from the live catalog.</p>
          </div>
        </div>

        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
          {cartQuery.isLoading ? (
            <div className="flex items-center gap-2 text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading cart</div>
          ) : cartQuery.error ? (
            <div className="flex items-start gap-3 text-amber-300"><AlertTriangle className="mt-0.5 h-5 w-5" /><p>Sign in to use checkout.</p></div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-slate-400">Your cart is empty.</div>
          ) : (
            <div className="space-y-4">
              {items.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <p className="font-semibold">{item.marketplace_products?.name ?? "Product"}</p>
                    <p className="text-sm text-slate-400">Quantity: {item.quantity}</p>
                  </div>
                  <span className="text-sm text-slate-300">{item.marketplace_products?.price_label ?? "Server-priced"}</span>
                </div>
              ))}
              <Button disabled={checkoutMutation.isPending} onClick={() => checkoutMutation.mutate()} className="w-full bg-cyan-500 text-slate-950 hover:bg-cyan-400">
                {checkoutMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-2 h-4 w-4" />}
                Create secure payment intent
              </Button>
              <p className="text-xs text-slate-500">This creates an order in pending-payment state. It does not claim payment success.</p>
            </div>
          )}
        </section>

        {result && (
          <section className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
            <h2 className="font-semibold text-amber-200">Payment pending</h2>
            <p className="mt-2 text-sm text-amber-100/80">Order {result.order_number} was created with server total {result.total}. Provider status: {result.payment_status ?? "pending"}.</p>
          </section>
        )}

        <div className="mt-6 text-center text-xs text-slate-500">Payment completion requires a configured staging provider and verified webhook.</div>
      </div>
    </main>
  );
}
