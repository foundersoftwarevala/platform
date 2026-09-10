import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo-head";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Loader2, LockKeyhole, ShieldCheck, ShoppingCart } from "lucide-react";
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
 * Hand the order to whichever provider the customer picked.
 *
 * The browser sends an order id and a method name. It never sends a price: the
 * server reads that from the order, and for a card rail it signs nothing the
 * browser can see. What comes back is one of two things.
 *
 * A card provider returns a URL to its own hosted checkout, and the browser is
 * simply sent there — the card number, the CVV and any 3-D Secure step happen
 * on the provider's page, inside the provider's PCI scope. Nothing on this page
 * has a card field, and nothing on this site ever receives one.
 *
 * PayU returns the exact field set to POST, which is submitted as a real form
 * because that is how PayU's hosted page is entered.
 */
type ManualHandoff = {
  gateway: string;
  displayName: string;
  reference: string;
  amount: number;
  currency: string;
  payLink: string | null;
  instructions: string;
};

async function startPayment(
  orderId: string,
  gateway: string | null,
): Promise<
  { ok: true } | { ok: true; manual: ManualHandoff } | { ok: false; message: string }
> {
  const response = await fetch("/api/payment/initiate", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ orderId, ...(gateway ? { gateway } : {}) }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    mode?: string;
    redirectUrl?: string;
    action?: string;
    method?: string;
    fields?: Record<string, string>;
    error?: string;
    detail?: string;
  } & Partial<ManualHandoff>;

  if (!response.ok) {
    return {
      ok: false,
      message:
        payload.error ??
        "The payment could not be started. The order is saved and nothing was charged.",
    };
  }

  if (payload.mode === "redirect" && payload.redirectUrl) {
    window.location.assign(payload.redirectUrl);
    return { ok: true };
  }

  // A rail a person settles. The customer gets the route and the reference; the
  // order stays reserved until Finance confirms the money arrived. Returning
  // from Wise is not proof of payment, so nothing is activated here.
  if (payload.mode === "manual") {
    return {
      ok: true,
      manual: {
        gateway: String(payload.gateway ?? ""),
        displayName: String(payload.displayName ?? payload.gateway ?? "This method"),
        reference: String(payload.reference ?? ""),
        amount: Number(payload.amount ?? 0),
        currency: String(payload.currency ?? ""),
        payLink: payload.payLink ?? null,
        instructions: String(payload.instructions ?? ""),
      },
    };
  }

  if (!payload.action || !payload.fields) {
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

type PaymentOption = {
  code: string;
  displayName: string;
  trustLabel: string | null;
  kind: string;
  ready: boolean;
  reason: string;
};

/**
 * Which methods this buyer can actually use, asked of the server rather than
 * assumed from where they are. A method that could not complete is shown
 * greyed with the real reason instead of being offered and then refusing.
 */
/**
 * The only payment preference kept in the browser: which method last worked.
 * Never a card number, never a token, nothing that could authorise a payment.
 */
function safeLastMethod(): string | null {
  try {
    return localStorage.getItem("sv.lastPaymentMethod");
  } catch {
    return null;
  }
}

async function fetchPaymentOptions(): Promise<PaymentOption[]> {
  const response = await fetch("/api/payment/methods", {
    headers: { ...(await authHeaders()) },
  });
  if (!response.ok) return [];
  const payload = (await response.json()) as { options?: PaymentOption[] };
  return payload.options ?? [];
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
  const [gateway, setGateway] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [manual, setManual] = useState<ManualHandoff | null>(null);

  // Asked before the choice is drawn, so nothing unusable is ever offered. The
  // server ranks by what actually works for this buyer's country and currency;
  // this page does not decide that a region means a method.
  const methodsQuery = useQuery({
    queryKey: ["payment-methods"],
    queryFn: fetchPaymentOptions,
    staleTime: 60_000,
  });
  const methods = methodsQuery.data ?? [];
  const readyMethods = methods.filter((option) => option.ready);

  // The method that worked last time, if it is still one of the real options.
  // It is a preference and nothing more: it cannot skip a check, and the
  // amount, the currency and the verification are decided on the server either
  // way.
  const remembered = typeof window === "undefined" ? null : safeLastMethod();
  const primary =
    readyMethods.find((option) => option.code === gateway) ??
    readyMethods.find((option) => option.code === remembered) ??
    readyMethods[0];
  const alternatives = readyMethods.filter((option) => option.code !== primary?.code);

  // Somebody arriving from a failed payment asked for the other options.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("methods") === "1") setShowAll(true);
  }, []);

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

      const handoff = await startPayment(orderId, primary?.code ?? null);
      if (!handoff.ok) {
        setPaying(false);
        setPayNote(handoff.message);
      } else if ("manual" in handoff) {
        setPaying(false);
        setManual(handoff.manual);
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
              {methodsQuery.isLoading ? (
                <p className="flex items-center gap-2 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking what is available
                </p>
              ) : readyMethods.length === 0 ? (
                <p className="text-sm text-amber-300">
                  No payment method is available for this order yet. Your cart is saved — please
                  contact support and we will take the payment directly.
                </p>
              ) : (
                <div className="space-y-3">
                  {/* One prominent method. The rest stay out of the way. */}
                  <div className="flex items-center justify-between rounded-lg border border-cyan-400/60 bg-cyan-500/10 px-3 py-2.5 text-sm">
                    <span className="flex items-center gap-2 font-medium text-white">
                      <ShieldCheck className="h-4 w-4 text-cyan-300" />
                      {primary?.displayName}
                    </span>
                    {alternatives.length > 0 && !showAll ? (
                      <button
                        type="button"
                        onClick={() => setShowAll(true)}
                        className="text-xs text-cyan-300 underline-offset-2 hover:underline"
                      >
                        More payment options
                      </button>
                    ) : null}
                  </div>

                  {showAll && alternatives.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {alternatives.map((option) => (
                        <button
                          key={option.code}
                          type="button"
                          onClick={() => {
                            setGateway(option.code);
                            setShowAll(false);
                          }}
                          disabled={paying}
                          className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-left text-sm text-slate-300 transition hover:border-slate-600"
                        >
                          {option.displayName}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}

              <Button disabled={checkoutMutation.isPending || paying || !primary} onClick={() => checkoutMutation.mutate()} className="w-full bg-cyan-500 py-6 text-base font-semibold text-slate-950 hover:bg-cyan-400">
                {checkoutMutation.isPending || paying ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LockKeyhole className="mr-2 h-5 w-5" />}
                {paying ? "Processing payment…" : "Pay now"}
              </Button>

              {/* Only ever the provider that is genuinely taking the payment. */}
              {primary?.trustLabel ? (
                <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                  <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" /> {primary.trustLabel}
                </p>
              ) : null}

              <p className="text-xs text-slate-500">
                The order is created here and the payment is taken on the provider's own page. Your card
                details are entered with the provider and never reach Software Vala. Nothing on this site
                decides that a payment succeeded — the provider's signed callback does, and it is checked
                against the provider before an order is marked paid.
              </p>
            </div>
          )}
        </section>

        {manual && (
          <section className="mt-6 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-6">
            <h2 className="font-semibold text-cyan-200">Pay with {manual.displayName}</h2>
            <p className="mt-2 text-sm text-slate-300">
              {manual.currency} {manual.amount}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Use reference <span className="font-mono text-slate-200">{manual.reference}</span>
            </p>
            {manual.payLink && (
              <a
                href={manual.payLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
              >
                Open {manual.displayName}
              </a>
            )}
            <p className="mt-4 text-xs text-slate-400">{manual.instructions}</p>
            <p className="mt-2 text-xs text-amber-300">
              Your order is reserved and shows as pending verification. It is activated once our
              team confirms the payment arrived — coming back from {manual.displayName} is not by
              itself proof that it did.
            </p>
          </section>
        )}

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
