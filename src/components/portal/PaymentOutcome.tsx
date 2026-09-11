import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Loader2, RefreshCw, XCircle } from "lucide-react";
import { authHeaders } from "@/lib/auth/operator-fetch";
import { money, readJson } from "@/lib/portal/format";
import { CopyButton } from "@/components/portal/CopyButton";
import { useOnlineRecovery } from "@/lib/portal/use-online";
import {
  PAYMENT_POLL,
  SUPPORT_WHATSAPP_URL,
  TIMEOUTS,
  pollDelay,
  supportMailto,
} from "@/lib/portal/config";
import {
  cleanedReturnPath,
  referenceFrom,
  settledStatus,
  type PaymentStatus,
} from "@/lib/portal/payment-return";

/**
 * What actually happened to a payment, as the server sees it.
 *
 * This is the page a provider hands the customer back to. Landing on it proves
 * nothing — the browser can be sent to either return URL by anyone, and every
 * provider decorates it with a query string the browser does not control. So
 * nothing is shown until our own server has been asked what the order's status
 * is, and that status only ever comes from a provider the server verified for
 * itself. While the callback is still in flight the page says the payment is
 * being verified rather than claiming success.
 *
 * ## Why this is a component and not two pages
 *
 * PayU is given two return URLs — `surl` is /payment/success, `furl` is
 * /payment/fail — and both routes were separate files rendering the same
 * layout, the same icon tile, the same heading and the same button row, with
 * the same job. That was one design maintained twice, and it had drifted:
 * /payment/success had been given a bounded poll, a safe body reader, a copyable
 * reference and a manual re-check, and /payment/fail still had none of them. A
 * customer whose payment succeeded but who was bounced to the failure URL — a
 * provider's own status mapping decides that, not us — got the worse of the two.
 *
 * So there is now one implementation and both routes render it. Nothing about
 * the appearance changes: the markup here is /payment/success's, unaltered.
 * What changes is that /payment/fail stops being a second, older copy of it.
 *
 * ## Everything here is a read
 *
 * The poll is bounded, it slows as it goes, and it stops on an honest "still
 * verifying, your money is safe". It never writes, never decides an outcome and
 * never re-submits a payment. Recovering a payment whose result is unknown is
 * the server's job, through the status endpoint that asks the provider.
 */

type Outcome = {
  status: PaymentStatus;
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
 * The reference the provider sent the customer back with.
 *
 * The rules for reading it, and for what may be left in the address bar
 * afterwards, live in lib/portal/payment-return so they can be tested directly
 * against the inputs that are awkward to produce in a browser: a duplicated
 * parameter, an empty one, a reference kilobytes long, a query string that is
 * nothing but a signature and the buyer's phone number.
 */
function referenceFromUrl(): string {
  try {
    return referenceFrom(window.location.search);
  } catch {
    return "";
  }
}

/**
 * Keep the reference in the address bar and drop everything else (§41), once it
 * has actually been consumed.
 *
 * replaceState rather than pushState, so the customer's Back button still goes
 * where they expect (§25) instead of returning them to the provider.
 */
function cleanUrl(reference: string): void {
  try {
    const url = new URL(window.location.href);
    if (!url.search) return;
    window.history.replaceState(
      window.history.state,
      "",
      cleanedReturnPath(url.pathname, reference, url.hash),
    );
  } catch {
    // A browser that refuses replaceState keeps its query string. That is a
    // tidiness loss, not a functional one, and must not stop the page.
  }
}

/*
 * How long we keep asking before saying so plainly is a threshold, not a design
 * decision, so it lives with the portal's other thresholds rather than here.
 * The values are unchanged: twelve attempts, slowing from two seconds to eight.
 */

export function PaymentOutcome() {
  const queryClient = useQueryClient();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [phase, setPhase] = useState<Phase>("verifying");
  const [attempt, setAttempt] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  const [checking, setChecking] = useState(false);
  const reference = useRef<string>("");

  /**
   * Which read owns the screen. Only the newest one may write to it.
   *
   * A background poll and a customer pressing "Check again" can be in flight at
   * the same time, and so can two reads either side of a reconnection. Without
   * this, an older answer arriving late overwrites a newer one — the customer
   * presses Check again, is told "paid", and a poll response from four seconds
   * earlier puts the page back to "verifying" (§3, §32).
   */
  const generation = useRef(0);
  const alive = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const ask = useCallback(async (): Promise<Outcome | null> => {
    if (!reference.current) return null;
    const response = await fetch(
      `/api/payment/status?txnid=${encodeURIComponent(reference.current)}`,
      // Signed in, so the server can confirm this is the buyer before it
      // recovers a missed callback or returns the licence key. Bounded, so a
      // provider that has stopped answering cannot leave this pending for ever.
      { headers: { ...(await authHeaders()) }, signal: AbortSignal.timeout(TIMEOUTS.read) },
    );

    // Reading the body blindly used to mean an HTML error page threw inside the
    // parse, and a JSON error body arrived with no `status` field, fell through
    // every branch in `apply`, and was silently treated as "still verifying".
    //
    // The distinction that matters to a customer is between "we do not know
    // yet" and "we cannot find this at all", because the second one is
    // frightening and must only be said when it is true.
    //
    //   429, or anything 5xx  → we do not know yet. Stay pending: the poll is
    //                           bounded and ends on the honest "still
    //                           verifying, your money is safe" state.
    //   401 / 403 / 404       → this genuinely is not a payment we can show
    //                           them, which is what "unknown" is for.
    const parsed = await readJson<Outcome>(response);
    if (!parsed.ok) {
      if (response.status === 429 || response.status >= 500) return { status: "pending" };
      return null;
    }
    return parsed.data;
  }, []);

  const apply = useCallback((data: Outcome | null) => {
    if (!data) {
      setPhase("unknown");
      return;
    }
    setOutcome(data);
    const status = settledStatus(data?.status);
    if (status === "paid") {
      setPhase("paid");

      /*
       * The payment settled, so everything that describes what this customer
       * owns is now out of date (§21).
       *
       * This was the gap: the cart the order was created from was still cached
       * from before the payment, so a customer who paid and then went back to
       * the marketplace was shown their old cart, still holding the thing they
       * had just bought — which reads as the payment not having worked, and is
       * exactly how somebody talks themselves into paying a second time. The
       * available payment methods go with it, because which of them this buyer
       * can use is answered per order.
       *
       * The purchases page is not listed because it does not read through this
       * cache; it holds its own state and re-reads on its own signals.
       *
       * Invalidated rather than written: nothing here asserts what the new
       * values are, it only marks the old ones stale so the next render asks the
       * server. The server stays authoritative, which is the whole point on a
       * page whose entire job is to report a status it did not decide.
       *
       * The existing query cache, through the existing client. There is no
       * second cache layer here.
       */
      for (const key of [["marketplace-cart"], ["payment-methods"]]) {
        void queryClient.invalidateQueries({ queryKey: key });
      }

      // The one preference worth keeping: which kind of method worked. Never a
      // card number, never a token, nothing that could authorise a payment.
      try {
        if (data.gateway) localStorage.setItem("sv.lastPaymentMethod", String(data.gateway));
      } catch {
        /* a browser that refuses storage simply has no preference */
      }
    } else if (status === "failed") {
      setPhase("failed");
    } else if (status === "unknown") {
      setPhase("unknown");
    } else {
      setPhase("verifying");
    }
  }, [queryClient]);

  /**
   * One bounded run of the poll. Shared by the first load, by "Check again" and
   * by a reconnection, so all three behave identically and none of them can
   * leave a timer behind.
   */
  const poll = useCallback(
    async (count: number, mine: number) => {
      try {
        const data = await ask();
        // A newer read has started, or the page is gone. Either way this answer
        // is stale and must not be painted.
        if (!alive.current || mine !== generation.current) return;
        apply(data);
        // An unreadable status counts as "not settled yet" and keeps the bounded
        // poll going, rather than stopping on a spinner that never resolves.
        const status = settledStatus(data?.status);
        if (data && (status === "pending" || status === null)) {
          if (count + 1 >= PAYMENT_POLL.maxAttempts) {
            setExhausted(true);
            return;
          }
          setAttempt(count + 1);
          timer.current = setTimeout(() => void poll(count + 1, mine), pollDelay(count));
        }
      } catch {
        if (alive.current && mine === generation.current) setPhase("unknown");
      }
    },
    [apply, ask],
  );

  /** Abandon whatever is in flight and start a fresh, bounded run. */
  const restart = useCallback(() => {
    generation.current += 1;
    if (timer.current) clearTimeout(timer.current);
    setExhausted(false);
    setAttempt(0);
    void poll(0, generation.current);
  }, [poll]);

  useEffect(() => {
    reference.current = referenceFromUrl();
    // Read first, then cleaned: the parameters are removed only once they have
    // actually been consumed, which is the whole of §41's rule.
    cleanUrl(reference.current);

    if (!reference.current) {
      setPhase("unknown");
      return;
    }

    generation.current += 1;
    void poll(0, generation.current);

    return () => {
      // The generation is bumped so any answer still in flight is ignored, and
      // the pending timer is cleared, so navigating away mid-verification leaves
      // nothing behind (§30).
      generation.current += 1;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [poll]);

  /**
   * The connection came back. Ask the server again (§13).
   *
   * This is the one place on the customer's side where a reconnection genuinely
   * should trigger work, and it is safe precisely because it is a read: it asks
   * what the status is, it does not assert one. A customer whose connection
   * dropped during a verification is exactly the person most likely to be
   * staring at a stalled "verifying", and asking again is what resolves it.
   * Nothing here retries the payment, and coming back online is never taken as
   * evidence that one succeeded.
   *
   * Only while the outcome is still open. Once the server has said paid or
   * failed, that is settled and a reconnection has nothing to add.
   */
  useOnlineRecovery(() => {
    if (phase === "verifying" || phase === "unknown") restart();
  });

  const checkAgain = () => {
    setChecking(true);
    generation.current += 1;
    const mine = generation.current;
    if (timer.current) clearTimeout(timer.current);
    setExhausted(false);
    setAttempt(0);
    void (async () => {
      try {
        const data = await ask();
        if (!alive.current || mine !== generation.current) return;
        apply(data);
      } catch {
        if (alive.current && mine === generation.current) setPhase("unknown");
      } finally {
        // Released on every path — success, failure, timeout and abort — so the
        // button can never be left spinning and unusable (§2, §39).
        if (alive.current && mine === generation.current) setChecking(false);
      }
    })();
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

  // Formatted with the currency the server recorded, never a symbol we picked.
  // The old test also dropped a legitimately zero amount, because 0 is falsy.
  const amountLabel =
    outcome?.amount != null && Number.isFinite(Number(outcome.amount))
      ? money(outcome.amount, outcome.currency)
      : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050b18] px-4 py-16 text-white">
      {/*
        This page rewrites itself while the customer watches, from "verifying"
        to "successful" or "did not go through", with no interaction of their
        own. Without a live region a screen-reader user is told none of it — the
        page simply goes quiet and stays on "verifying" as far as they know.
        Polite, so the announcement waits for a pause rather than interrupting.
      */}
      <div className="w-full max-w-lg text-center" aria-live="polite" aria-atomic="false">
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
          {amountLabel && <p>{amountLabel}</p>}
          {/* Only what the provider volunteered, and only to the buyer. */}
          {outcome?.card_last4 && (
            <p>
              {outcome.card_brand ? `${outcome.card_brand} ` : "Card "}ending {outcome.card_last4}
            </p>
          )}
          {/* The reference is what support traces a missing payment by, and
              every message above asks the customer to quote it. */}
          {reference.current && (
            <p className="flex flex-wrap items-center justify-center gap-2">
              <span className="font-mono">Reference {reference.current}</span>
              <CopyButton
                value={reference.current}
                label={`payment reference ${reference.current}`}
              />
            </p>
          )}
          {phase === "verifying" && !exhausted && attempt > 0 && <p>Checked {attempt} times</p>}
        </div>

        {phase === "paid" && outcome?.licence_key && (
          <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-[11px] uppercase tracking-wider text-white/50">Your licence key</p>
            {/* This is the single most valuable string a customer is given, and
                it was display-only — they had to select it by hand off a page
                they may well close. */}
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
              <p className="font-mono text-sm font-bold tracking-wide">{outcome.licence_key}</p>
              <CopyButton value={outcome.licence_key} label="your licence key" />
            </div>
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
              onClick={checkAgain}
              disabled={checking}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
              {checking ? "Checking…" : "Check again"}
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
          {/*
            This pointed at /support, which is the support team's own operations
            console and is gated on the `support` role. A customer following it —
            having just been told, on this page, to contact us about a payment we
            could not verify — was shown "Access restricted. This authenticated
            account does not have the required Control Panel role." At the single
            most alarming moment the portal has, the way out was a locked door.

            It now opens the support inbox the marketplace homepage has always
            used, with the reference already in the subject and the body: that
            reference is the only thing tying a missing payment to an order, and
            asking a worried customer to retype it correctly is how a trace
            starts by failing.
          */}
          <a
            href={supportMailto(
              reference.current
                ? `Payment ${reference.current}`
                : "Payment support request",
              reference.current
                ? `My payment reference is ${reference.current}.

Please tell me what happened to this payment.`
                : undefined,
            )}
            className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
          >
            Contact support
          </a>
          <a
            href={SUPPORT_WHATSAPP_URL}
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
