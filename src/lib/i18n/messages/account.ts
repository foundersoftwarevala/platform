/** The customer's account: purchases, licences, invoices (src/routes/account). English only. */
export const ACCOUNT_MESSAGES = {
  "account.back": "← Back to marketplace",
  "account.purchases.title": "Your purchases",
  "account.purchases.intro":
    "Every order you have placed, and the licence for each one that is paid.",
  "account.loading": "Loading…",
  "account.not_configured": "This page is not configured.",
  "account.load_failed": "Could not load your purchases",
  "account.error": "Something went wrong",
  "account.signed_out": "Sign in to see what you have bought.",
  "account.sign_in": ["Sign in", "button"],
  "account.empty": "You have not bought anything yet.",
  "account.browse": "Browse the catalogue",
  "account.order": "Order {order}",
  "account.status": [
    "{status, select, paid {Paid} awaiting_payment {Awaiting payment} failed {Failed} cancelled {Cancelled} other {{status}}}",
    "order status badge",
  ],
  "account.licence_status": [
    "{status, select, active {Active} revoked {Revoked} suspended {Suspended} expired {Expired} other {{status}}}",
    "licence status badge",
  ],
  "account.copy": ["Copy", "button that copies the licence key"],
  "account.copied": ["Copied", "the licence key was copied"],
  "account.licence_pending": "Your licence is being issued. Refresh in a moment.",
  "account.invoice": "Invoice {number} — {link}",
  "account.invoice_open": ["open", "link that opens the invoice"],
  "account.setup_note":
    "Our team contacts you on your email and WhatsApp to set up your domain, hosting and branding. Questions? {link}.",
  "account.talk_to_support": "Talk to support",
} as const;
