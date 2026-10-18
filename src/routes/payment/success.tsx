import { createFileRoute } from "@tanstack/react-router";

import { PaymentStatusPage } from "@/components/payment/PaymentStatusPage";
import { payuReturn } from "@/lib/commerce/payu-return";

export const Route = createFileRoute("/payment/success")({
  head: () => ({
    meta: [{ title: "Payment status | Software Vala" }, { name: "robots", content: "noindex" }],
  }),
  // PayU sends the buyer back with a form POST carrying the signed result.
  server: { handlers: { POST: ({ request }) => payuReturn(request, "/payment/success") } },
  component: PaymentStatusPage,
});
