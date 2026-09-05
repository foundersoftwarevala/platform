import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import "@/styles/marketplace-home.css";

/**
 * Where the customer lands after PayU.
 *
 * Landing here proves nothing — the browser can be sent to this URL by anyone.
 * So the page shows nothing until it has asked our own server what the order's
 * status actually is, and that status only ever comes from the verified
 * webhook. While PayU's callback is still in flight the page says the payment
 * is being confirmed rather than claiming success.
 */

type Outcome = {
  status: "paid" | "pending" | "failed" | "unknown";
  order_no?: string | null;
  licence_key?: string | null;
  amount?: number | null;
  currency?: string | null;
};

const LOOK = {
  paid: { icon: CheckCircle2, tone: "text-emerald-300", ring: "border-emerald-400/40 bg-emerald-500/10" },
  pending: { icon: Clock, tone: "text-amber-300", ring: "border-amber-400/40 bg-amber-500/10" },
  failed: { icon: XCircle, tone: "text-rose-300", ring: "border-rose-400/40 bg-rose-500/10" },
  unknown: { icon: Clock, tone: "text-white/60", ring: "border-white/15 bg-white/5" },
} as const;

function PaymentStatusPage() {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const txnid = params.get("txnid") ?? params.get("txnId") ?? "";
    if (!txnid) {
      setOutcome({ status: "unknown" });
      return;
    }

    let cancelled = false;
    const ask = async () => {
      try {
        const response = await fetch(`/api/payment/status?txnid=${encodeURIComponent(txnid)}`);
        const data = (await response.json()) as Outcome;
        if (cancelled) return;
        setOutcome(data);
        // The webhook can arrive a moment after the customer does.
        if (data.status === "pending" && tries < 10) {
          setTimeout(() => setTries((t) => t + 1), 3000);
        }
      } catch {
        if (!cancelled) setOutcome({ status: "unknown" });
      }
    };
    void ask();
    return () => {
      cancelled = true;
    };
  }, [tries]);

  const status = outcome?.status ?? "pending";
  const look = LOOK[status];
  const Icon = look.icon;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050b18] px-4 py-16 text-white">
      <div className="w-full max-w-lg text-center">
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border ${look.ring}`}>
          <Icon className={`h-8 w-8 ${look.tone}`} aria-hidden="true" />
        </div>

        <h1 className="mt-6 text-2xl font-bold">
          {status === "paid" && "Payment received"}
          {status === "pending" && "Confirming your payment"}
          {status === "failed" && "That payment did not go through"}
          {status === "unknown" && "We could not identify that payment"}
        </h1>

        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/70">
          {status === "paid" &&
            "Your licence has been issued. Our team will contact you on the email and WhatsApp you gave us to set up your domain, hosting and branding."}
          {status === "pending" &&
            "We are waiting for the payment provider to confirm. This page updates itself — you do not need to pay again."}
          {status === "failed" &&
            "No money was taken. You can try again from your order, or talk to us and we will sort it out."}
          {status === "unknown" &&
            "We could not match this to an order. If money has left your account, contact us with the transaction id and we will trace it."}
        </p>

        {outcome?.order_no && (
          <p className="mt-4 text-xs text-white/50">Order {outcome.order_no}</p>
        )}

        {status === "paid" && outcome?.licence_key && (
          <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-[11px] uppercase tracking-wider text-white/50">Your licence key</p>
            <p className="mt-1 font-mono text-sm font-bold tracking-wide">{outcome.licence_key}</p>
          </div>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href="/marketplace" className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-gray-900">
            Back to the marketplace
          </a>
          <a
            href="/support"
            className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
          >
            Contact support
          </a>
          <a
            href="https://wa.me/918348838383"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
          >
            WhatsApp us
          </a>
        </div>
      </div>
    </main>
  );
}

export const Route = createFileRoute("/payment/success")({
  head: () => ({ meta: [{ title: "Payment status | Software Vala" }, { name: "robots", content: "noindex" }] }),
  component: PaymentStatusPage,
});
