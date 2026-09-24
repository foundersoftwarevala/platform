/**
 * The operator consoles: the SEO Centre, the Marketplace Manager's live
 * modules, the Orders wall, the Finance ledger and the AMS role engine.
 * English only.
 *
 * These screens are read by the people who run the platform rather than by
 * buyers, but they are read in whatever language that person works in, so the
 * text belongs here like any other. Database table and column names are not
 * here: those are identifiers, and an identifier that has been translated no
 * longer names anything.
 */
export const MANAGER_MESSAGES = {
  // Finance ledger.
  "manager.finance.ledger": ["Ledger", "the tab and heading over the finance tables"],
  "manager.finance.ledger_title": "The money that has moved",
  "manager.finance.ledger_note":
    "Read from the finance tables themselves. An amount is what happened and cannot be edited here; what an operator decides is whether it is approved, rejected or settled.",

  // AMS role engine.
  "manager.ams.no_ladder": ["no ladder recorded", "a role with no XP stages stored"],
  "manager.ams.ends_at": ["· ends at {title}", "the last stage of a role's XP ladder"],

  // The live modules, whose titles name the thing each one manages.
  "manager.module.product_media": "Product Media",
  "manager.module.demo_system": "Demo System",
  "manager.module.blog": "Blog",
  "manager.module.license": "License",
  "manager.module.downloads": "Downloads",
  "manager.module.authors": "Authors",
  "manager.module.vendors": "Vendors",
  "manager.module.resellers": "Resellers",
  "manager.module.affiliate": "Affiliate",
  "manager.module.influencer": "Influencer",
  "manager.module.qr_system": "QR System",
  "manager.module.reports": "Reports",

  // The orders wall.
  "manager.orders.title": "Orders",
  "manager.orders.paid": "Paid",
  "manager.orders.refunded": "Refunded",
  "manager.orders.awaiting": "Awaiting payment",
  "manager.orders.invoices": "Invoices",
  "manager.orders.payment_log": "Payment log",
  "manager.orders.refunds": "Refunds",
  "manager.orders.returns": "Returns",
  "manager.orders.endpoint_note_before": "Every tab above reads the real table through",
  "manager.orders.endpoint_note_after":
    ". An order's money is never editable from a screen; what an operator may change is its state.",

  // The home page's chat button.
  "manager.home.open_chat": ["Open Connect Chat", "the button that opens the chat panel"],
  "manager.home.chat_with_us": "Chat with us",
} as const;
