import { createFileRoute } from "@tanstack/react-router";
import { PaymentOutcome } from "@/components/portal/PaymentOutcome";
import "@/styles/marketplace-home.css";
import { PortalError } from "@/components/portal/PortalError";

/**
 * Where PayU's `furl` and a cancelled card checkout send the customer back to.
 *
 * This route is reached because a provider classified the attempt as not
 * successful, and that classification is the provider's, made before our server
 * has verified anything. It is not the answer, so this page does not state one:
 * it asks our own server, exactly as /payment/success does, and shows whatever
 * the verified status turns out to be — including "paid", for the case where a
 * provider bounced the customer here on a payment that did in fact settle.
 *
 * This file used to be a second, older copy of the success page's view. It had
 * fallen behind: it read the response body without guarding the parse, so an
 * HTML error page from a proxy became a silent failure; it never checked the
 * response status, so a 503 from our own server was shown to the customer as
 * "We could not identify that payment" — the most frightening thing this page can
 * say — when the truthful answer was that we did not know yet; its retry timer
 * was never cleared, so leaving the page mid-verification left a timer running
 * against a component that no longer existed; and it displayed no reference at
 * all, while telling the customer to contact us quoting one.
 *
 * All of that is fixed by there being one implementation of this view rather than
 * two. Nothing about the design changed; the duplicate did.
 */
export const Route = createFileRoute("/payment/fail")({
  head: () => ({
    meta: [
      { title: "Payment status | Software Vala" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaymentOutcome,
  errorComponent: PortalError,
});
