import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

import { reportBoundaryError } from "@/lib/client-error-monitor";
import { SUPPORT_WHATSAPP_URL, supportMailto } from "@/lib/portal/config";

/**
 * What a customer sees when a page on their side crashes.
 *
 * Every operator console already declares an `errorComponent`, so a crash inside
 * one is caught at that route and the rest of the application stays up. Not one
 * customer-facing route did. A single bad field in a payment status response, or
 * an order row shaped in a way the purchases page did not expect, escaped all
 * the way to the root boundary and replaced the entire application with the
 * generic "This page didn't load" — losing the route, the reference in the
 * address bar and any way back other than the home page (§48).
 *
 * Catching it here keeps the failure inside the page it happened on. The
 * customer keeps their URL, their reference, and — the part that matters on
 * these particular pages — a way to reach a person about money that may have
 * left their account.
 *
 * ## What it says, and what it does not
 *
 * No stack trace, no error message, no component name. `error.message` on this
 * side of the product is as likely to be a driver string or a failed parse as
 * anything a customer could act on, and putting one in front of a buyer reads as
 * the site being broken rather than one page being. The diagnostics go to
 * `error_events` through the monitor the application already installs, which is
 * what AI API Manager → Alerts → Error Monitor reads.
 *
 * ## The reassurance is not decoration
 *
 * These are the pages a customer reaches with a payment in flight. "Nothing you
 * have paid for is affected" is true — an order's status lives on the server and
 * is decided by a verified provider callback, and no crash in this browser can
 * change it — and it is the one thing a customer needs to hear before they
 * consider paying again.
 */
export function PortalError({ reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // Recorded once, through the existing sink, which throttles and dedupes for
    // itself. Nothing about the customer goes with it beyond the route.
    reportBoundaryError(new Error("customer portal route boundary"));
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050b18] px-4 py-16 text-white">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-500/10">
          <AlertTriangle className="h-8 w-8 text-amber-300" aria-hidden="true" />
        </div>

        <h1 className="mt-6 text-2xl font-bold">This page did not load</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/70">
          Something went wrong on our side while drawing this page. Nothing you have paid for is
          affected — your orders and licences are held on our servers, not here. Try again, and if
          it keeps happening, tell us and we will look at it directly.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {/*
            The router's own reset, so this retries the route rather than
            reloading the browser — which on the payment return pages would
            re-run the whole verification from the top for no reason.
          */}
          <button
            type="button"
            onClick={reset}
            className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-gray-900"
          >
            Try again
          </button>
          <a
            href="/account/purchases"
            className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
          >
            Your purchases
          </a>
          <a
            href={supportMailto("A page did not load")}
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
