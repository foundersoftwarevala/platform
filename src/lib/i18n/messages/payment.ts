/** Where the customer lands after the payment provider (src/components/payment). English only. */
export const PAYMENT_MESSAGES = {
  "payment.title.paid": "Payment received",
  "payment.title.pending": "Confirming your payment",
  "payment.title.failed": "That payment did not go through",
  "payment.title.unknown": "We could not identify that payment",
  "payment.body.paid":
    "Your licence has been issued. Our team will contact you on the email and WhatsApp you gave us to set up your domain, hosting and branding.",
  "payment.body.pending":
    "We are waiting for the payment provider to confirm. This page updates itself — you do not need to pay again.",
  "payment.body.failed":
    "No money was taken. You can try again from your order, or talk to us and we will sort it out.",
  "payment.body.unknown":
    "We could not match this to an order. If money has left your account, contact us with the transaction id and we will trace it.",
  "payment.order": "Order {order}",
  "payment.licence_key": "Your licence key",
  "payment.back": "Back to the marketplace",
  "payment.contact_support": "Contact support",
  "payment.whatsapp": "WhatsApp us",
} as const;
