import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo-head";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Loader2, LockKeyhole, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  createMarketplaceCheckout,
  getMarketplaceCart,
  listMarketplaceOrders,
} from "@/lib/marketplace-commerce.functions";
import { useServerFn } from "@/lib/serverFn";
import { authHeaders } from "@/lib/auth/operator-fetch";

export const Route = createFileRoute("/checkout")({
  head: pageHead("Checkout", "Complete your purchase. One fixed price, lifetime access, full source code."),
  component: CheckoutPage,
});

/**
 * Hand the order to PayU.
 *
 * The browser sends an order id and nothing else. /api/payment/initiate reads
 * the price from that order, converts it server side and signs the request
 * with a salt this page never sees, so what the customer is charged is not
 * something the customer can choose. What comes back is the exact field set to
 * POST, which is submitted as a real form because that is how PayU's hosted
 * page is entered.
 */
async function payWithPayU(orderId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await fetch("/api/payment/initiate", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ orderId }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    action?: string;
    method?: string;
    fields?: Record<string, string>;
    error?: string;
  };

  if (!response.ok || !payload.action || !payload.fields) {
    return {
      ok: false,
      message:
        payload.error ??
        "The payment could not be started. The order is saved and nothing was charged.",
    };
  }

  const form = document.createElement("form");
  form.method = payload.method ?? "POST";
  form.action = payload.action;
  form.style.display = "none";
  for (const [name, value] of Object.entries(payload.fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = String(value ?? "");
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
  return { ok: true };
}

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
  const listOrders = useServerFn(listMarketplaceOrders);
  const [payNote, setPayNote] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const checkoutMutation = useMutation({
    mutationFn: () => checkout({ data: { idempotencyKey } }),
    onSuccess: async (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-cart"] });
      setPayNote(null);
      setPaying(true);

      // The order id, from the checkout result if it carries one and from the
      // buyer's own orders if it does not. Either way it is the server's id.
      let orderId = String(result?.order_id ?? result?.id ?? "");
      if (!orderId && result?.order_number) {
        try {
          const orders = (await listOrders()) as { id: string; order_number: string }[];
          orderId = orders.find((o) => o.order_number === result.order_number)?.id ?? "";
        } catch {
          orderId = "";
        }
      }

      if (!orderId) {
        setPaying(false);
        setPayNote(
          `Order ${result?.order_number ?? ""} was created but we could not find it again to start the payment. Nothing was charged. It is in your purchases.`,
        );
        return;
      }

      const handoff = await payWithPayU(orderId);
      if (!handoff.ok) {
        setPaying(false);
        setPayNote(handoff.message);
      }
      // On success the browser is already on its way to PayU.
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
              <Button disabled={checkoutMutation.isPending || paying} onClick={() => checkoutMutation.mutate()} className="w-full bg-cyan-500 text-slate-950 hover:bg-cyan-400">
                {checkoutMutation.isPending || paying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-2 h-4 w-4" />}
                {paying ? "Opening secure payment…" : "Pay securely"}
              </Button>
              <p className="text-xs text-slate-500">
                The order is created here and the payment is taken on the provider's own page. Nothing on
                this site decides that a payment succeeded — the provider's signed callback does, and it is
                checked against the provider before an order is marked paid.
              </p>
            </div>
          )}
        </section>

        {payNote && (
          <section className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
            <h2 className="flex items-center gap-2 font-semibold text-amber-200">
              <AlertTriangle className="h-4 w-4" /> The payment was not started
            </h2>
            <p className="mt-2 text-sm text-amber-100/80">{payNote}</p>
            <Link to="/account/purchases" className="mt-3 inline-block text-sm text-cyan-300 hover:text-cyan-200">
              See your orders
            </Link>
          </section>
        )}

        {result && !payNote && (
          <section className="mt-6 rounded-xl border border-slate-700 bg-slate-900/70 p-6">
            <h2 className="font-semibold text-slate-200">Order {result.order_number}</h2>
            <p className="mt-2 text-sm text-slate-400">
              Created with server total {result.total}. Status: {result.payment_status ?? "pending"} until
              the provider's callback is verified.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
