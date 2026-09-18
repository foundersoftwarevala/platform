import { createFileRoute } from "@tanstack/react-router";

import { PaymentStatusPage } from "@/components/payment/PaymentStatusPage";

export const Route = createFileRoute("/payment/fail")({
  head: () => ({
    meta: [{ title: "Payment status | Software Vala" }, { name: "robots", content: "noindex" }],
  }),
  component: PaymentStatusPage,
});
