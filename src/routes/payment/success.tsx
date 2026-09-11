import { createFileRoute } from "@tanstack/react-router";
import { PaymentOutcome } from "@/components/portal/PaymentOutcome";
import "@/styles/marketplace-home.css";
import { PortalError } from "@/components/portal/PortalError";

/**
 * Where a card provider and PayU's `surl` send the customer back to.
 *
 * The name of this route is the provider's word, not ours. Nothing here decides
 * that a payment succeeded: the view asks our own server, and the server only
 * ever reports a status a verified provider response produced. So a customer
 * landing here on a payment that has not settled is told it is being verified,
 * and one landing here on a payment that failed is told it failed.
 *
 * The whole of that view now lives in one component, shared with /payment/fail,
 * which providers use as the other return URL for the same payment. It was
 * duplicated across the two routes and the copies had drifted apart.
 */
export const Route = createFileRoute("/payment/success")({
  head: () => ({
    meta: [
      { title: "Payment status | Software Vala" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaymentOutcome,
  // A crash here is contained to this route rather than replacing the whole
  // application, so the customer keeps the reference in their address bar.
  errorComponent: PortalError,
});
