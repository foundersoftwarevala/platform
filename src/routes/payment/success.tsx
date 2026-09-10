import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, Loader2, RefreshCw, XCircle } from "lucide-react";
import { authHeaders } from "@/lib/auth/operator-fetch";
import "@/styles/marketplace-home.css";

/**
 * Where the customer lands after the payment provider.
 *
 * Landing here proves nothing — the browser can be sent to this URL by anyone,
 * and every provider hands it back a query string it does not control. So the
 * page shows nothing until it has asked our own server what the order's status
 * actually is, and that status only ever comes from a provider the server
 * verified for itself.
 *
 * While the provider's callback is still in flight the page says the payment is
 * being verified rather than claiming success. The states it can show are the
 * true ones and no others: verifying, paid, failed, expired, unidentified.
 *
 * The polling is bounded — a fixed number of attempts, slowing as it goes, then
 * stopping with an honest "still verifying" and a manual check. It is a read
 * that asks the provider, never a write that decides anything.
 */

type Outcome = {
  status: "paid" | "pending" | "failed" | "unknown";
  order_no?: string | null;
  licence_key?: string | null;
  amount?: number | null;
  currency?: string | null;
  gateway?: string | null;
  card_last4?: string | null;
  card_brand?: string | null;
  verified_at?: string | null;
};

type Phase = "verifying" | "paid" | "failed" | "expired" | "unknown";

const LOOK: Record<Phase, { tone: string; ring: string }> = {
  paid: { tone: "text-emerald-300", ring: "border-emerald-400/40 bg-emerald-500/10" },
  verifying: { tone: "text-amber-300", ring: "border-amber-400/40 bg-amber-500/10" },
  failed: { tone: "text-rose-300", ring: "border-rose-400/40 bg-rose-500/10" },
  expired: { tone: "text-rose-300", ring: "border-rose-400/40 bg-rose-500/10" },
  unknown: { tone: "text-white/60", ring: "border-white/15 bg-white/5" },
};

/**
 * Every provider names the reference differently on the way back. Reading all
 * of them means one return page serves all of them.
 */
function referenceFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  for (const key of ["txnid", "txnId", "tx_ref", "reference", "trxref", "transaction_id"]) {
    const value = params.get(key);
    if (value) return value;
  }
  return "";
}

/** How long we keep asking before saying so plainly. Bounded, and slowing. */
const MAX_POLLS = 12;
function delayFor(attempt: number): number {
  return Math.min(2000 + attempt * 1000, 8000);
}

function PaymentStatusPage() {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [phase, setPhase] = useState<Phase>("verifying");
  const [attempt, setAttempt] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  const [checking, setChecking] = useState(false);
  const reference = useRef<string>("");

  const ask = useCallback(async (): Promise<Outcome | null> => {
    if (!reference.current) return null;
    const response = await fetch(
      `/api/payment/status?txnid=${encodeURIComponent(reference.current)}`,
      // Signed in, so the server can confirm this is the buyer before it
      // recovers a missed callback or returns the licence key.
      { headers: { ...(await authHeaders()) } },
    );
    return (await response.json()) as Outcome;
  }, []);

  const apply = useCallback((data: Outcome | null) => {
    if (!data) {
      setPhase("unknown");
      return;
    }
    setOutcome(data);
    if (data.status === "paid") {
      setPhase("paid");
      // The one preference worth keeping: which kind of method worked. Never a
      // card number, never a token, nothing that could authorise a payment.
      try {
        if (data.gateway) localStorage.setItem("sv.lastPaymentMethod", String(data.gateway));
      } catch {
        /* a browser that refuses storage simply has no preference */
      }
    } else if (data.status === "failed") {
      setPhase("failed");
    } else if (data.status === "unknown") {
      setPhase("unknown");
    } else {
      setPhase("verifying");
    }
  }, []);

  useEffect(() => {
    reference.current = referenceFromUrl();
    if (!reference.current) {
      setPhase("unknown");
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async (count: number) => {
      try {
        const data = await ask();
        if (cancelled) return;
        apply(data);
        if (data?.status === "pending") {
          if (count + 1 >= MAX_POLLS) {
            setExhausted(true);
            return;
          }
          setAttempt(count + 1);
          timer = setTimeout(() => void run(count + 1), delayFor(count));
        }
      } catch {
        if (!cancelled) setPhase("unknown");
      }
    };

    void run(0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [ask, apply]);

  const checkAgain = async () => {
    setChecking(true);
    try {
      apply(await ask());
      setExhausted(false);
      setAttempt(0);
    } catch {
      setPhase("unknown");
    } finally {
      setChecking(false);
    }
  };

  const look = LOOK[phase];
  const Icon =
    phase === "paid"
      ? CheckCircle2
      : phase === "failed" || phase === "expired"
        ? XCircle
        : phase === "verifying"
          ? Loader2
          : Clock;

  const money =
    outcome?.amount && outcome?.currency ? `${outcome.currency} ${outcome.amount}` : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050b18] px-4 py-16 text-white">
      <div className="w-full max-w-lg text-center">
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border ${look.ring}`}
        >
          <Icon
            className={`h-8 w-8 ${look.tone} ${phase === "verifying" ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
        </div>

        <h1 className="mt-6 text-2xl font-bold">
          {phase === "paid" && "Payment successful"}
          {phase === "verifying" &&
            (exhausted ? "Still verifying your payment" : "Verifying your payment")}
          {phase === "failed" && "That payment did not go through"}
          {phase === "expired" && "That payment window has closed"}
          {phase === "unknown" && "We could not identify that payment"}
        </h1>

        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/70">
          {phase === "paid" &&
            "Your licence has been issued. Our team will contact you on the email and WhatsApp you gave us to set up your domain, hosting and branding."}
          {phase === "verifying" && !exhausted &&
            "We are confirming this with the payment provider. This page updates itself — you do not need to pay again."}
          {phase === "verifying" && exhausted &&
            "The provider has not confirmed yet. Your money is safe and your order is saved — nothing is lost. Check again in a moment, or contact us with the reference below and we will trace it."}
          {phase === "failed" &&
            "No money was taken. You can try again, or pay another way — both start a fresh, verified payment for the same order."}
          {phase === "expired" &&
            "Nothing was charged. Start the payment again from your order and it will be re-issued."}
          {phase === "unknown" &&
            "We could not match this to an order. If money has left your account, contact us with the reference below and we will trace it."}
        </p>

        <div className="mt-4 space-y-1 text-xs text-white/50">
          {outcome?.order_no && <p>Order {outcome.order_no}</p>}
          {money && <p>{money}</p>}
          {/* Only what the provider volunteered, and only to the buyer. */}
          {outcome?.card_last4 && (
            <p>
              {outcome.card_brand ? `${outcome.card_brand} ` : "Card "}ending {outcome.card_last4}
            </p>
          )}
          {reference.current && <p className="font-mono">Reference {reference.current}</p>}
          {phase === "verifying" && !exhausted && attempt > 0 && <p>Checked {attempt} times</p>}
        </div>

        {phase === "paid" && outcome?.licence_key && (
          <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-[11px] uppercase tracking-wider text-white/50">Your licence key</p>
            <p className="mt-1 font-mono text-sm font-bold tracking-wide">{outcome.licence_key}</p>
          </div>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {(phase === "failed" || phase === "expired") && (
            <a
              href="/checkout"
              className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-gray-900"
            >
              Try again
            </a>
          )}
          {(phase === "failed" || phase === "expired") && (
            <a
              href="/checkout?methods=1"
              className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
            >
              Try another method
            </a>
          )}
          {(phase === "verifying" || phase === "unknown") && (
            <button
              type="button"
              onClick={() => void checkAgain()}
              disabled={checking}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
              Check again
            </button>
          )}
          <a
            href="/marketplace"
            className={
              phase === "paid"
                ? "rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-gray-900"
                : "rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
            }
          >
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
  head: () => ({
    meta: [{ title: "Payment status | Software Vala" }, { name: "robots", content: "noindex" }],
  }),
  component: PaymentStatusPage,
});
