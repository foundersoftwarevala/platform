/** The reseller lifecycle: application, membership plans, finance verification. English only. */
export const RESELLER_MESSAGES = {
  // Application (apply/reseller)
  "reseller.apply.sign_in_first":
    "Sign in or create an account to apply — your application is linked to it.",
  "reseller.apply.already_applied": "You have already applied",
  "reseller.apply.submitted": "Application submitted",
  "reseller.apply.failed": "The application could not be submitted.",
  "reseller.apply.number": ["Application number", "label above the reseller application number"],
  "reseller.apply.status": ["Status: {status}", "application status, e.g. pending"],
  "reseller.apply.next":
    "The Reseller Manager reviews it; once approved, your reseller dashboard opens and you can choose a membership plan. There is no application fee.",
  "reseller.apply.home": "Back to home",

  // Membership & Plans (reseller dashboard)
  "reseller.plans.eyebrow": "Reseller Membership",
  "reseller.plans.title": "Membership & Plans",
  "reseller.plans.intro":
    "Applying was free. Membership billing begins only when you choose a plan.",
  "reseller.plans.loading": "Loading membership plans",
  "reseller.plans.load_failed": "Unable to load membership plans.",
  "reseller.plans.current": [
    "Current membership: {plan} · {status} · until {date}",
    "the reseller's active membership",
  ],
  "reseller.plans.none": "No active membership yet.",
  "reseller.plans.per_year": ["/ year", "after a yearly price"],
  "reseller.plans.terms": ["{days} days · {percent}% reseller margin", "plan validity and margin"],
  "reseller.plans.purchase": ["Purchase {plan}", "button that orders a membership plan"],
  "reseller.plans.order_created":
    "Order and invoice created. Submit your payment for finance verification.",
  "reseller.plans.orders": "Your membership orders",
  "reseller.plans.no_orders": "No orders yet.",
  "reseller.plans.col_order": ["Order", "table column"],
  "reseller.plans.col_plan": ["Plan", "table column"],
  "reseller.plans.col_invoice": ["Invoice", "table column"],
  "reseller.plans.col_amount": ["Amount", "table column"],
  "reseller.plans.col_status": ["Status", "table column"],
  "reseller.plans.col_payment": ["Payment", "table column"],
  "reseller.plans.pay": ["Pay", "button that opens the payment form for an order"],
  "reseller.plans.evidence": "Payment evidence",
  "reseller.plans.evidence_summary": [
    "Order {order} · Invoice {invoice} · {amount}",
    "the order being paid",
  ],
  "reseller.plans.reference": ["Payment reference", "input placeholder"],
  "reseller.plans.proof": ["Proof URL (optional)", "input placeholder"],
  "reseller.plans.submit": ["Submit for verification", "button"],
  "reseller.plans.submitted": "Payment submitted for finance verification.",
  "reseller.plans.choose_order": "Choose the order you are paying.",
  "reseller.plans.loading_short": "Loading…",

  // Finance Manager → Reseller memberships
  "reseller.queue.tab": ["Reseller memberships", "Finance Manager tab"],
  "reseller.queue.eyebrow": "Finance Manager",
  "reseller.queue.title": "Reseller memberships",
  "reseller.queue.intro":
    "Verify the payment evidence resellers submitted. Amounts are set by the server from the plan.",
  "reseller.queue.filter_submitted": ["Payment submitted", "filter option"],
  "reseller.queue.filter_awaiting": ["Awaiting payment", "filter option"],
  "reseller.queue.filter_all": ["All orders", "filter option"],
  "reseller.queue.loading": "Loading",
  "reseller.queue.empty": "No orders in this list.",
  "reseller.queue.col_reseller": ["Reseller", "table column"],
  "reseller.queue.col_reference": ["Reference", "table column"],
  "reseller.queue.col_decision": ["Decision", "table column"],
  "reseller.queue.provider_reference": ["Bank / provider reference", "input placeholder"],
  "reseller.queue.verify": ["Verify", "button that confirms a payment"],
  "reseller.queue.reject": ["Reject", "button that rejects a payment"],
  "reseller.queue.waiting": "Waiting for the reseller's payment",
  "reseller.queue.decided": "Decided",
  "reseller.queue.already": "Already verified.",
  "reseller.queue.verified": "Payment verified — membership activated.",
  "reseller.queue.rejected": "Payment rejected.",
} as const;
