/** Cart and checkout (src/routes/checkout.tsx). English only. */
export const CHECKOUT_MESSAGES = {
  "checkout.title": ["Checkout", "page heading"],
  "checkout.subtitle": "Prices are calculated on the server from the live catalog.",
  "checkout.back": "Back to marketplace",
  "checkout.loading_cart": "Loading cart",
  "checkout.sign_in_required": "Sign in to use checkout.",
  "checkout.empty": "Your cart is empty.",
  "checkout.product_fallback": ["Product", "shown when a cart item has no product name"],
  "checkout.quantity": "Quantity: {quantity}",
  "checkout.server_priced": ["Server-priced", "the price is set by the server at checkout"],
  "checkout.opening_payment": "Opening secure payment…",
  "checkout.pay_securely": ["Pay securely", "button that starts the payment"],
  "checkout.provider_note":
    "The order is created here and the payment is taken on the provider's own page. Nothing on this site decides that a payment succeeded — the provider's signed callback does, and it is checked against the provider before an order is marked paid.",
  "checkout.not_started": "The payment was not started",
  "checkout.see_orders": "See your orders",
  "checkout.order": "Order {order}",
  "checkout.created_total":
    "Created with server total {total}. Status: {status} until the provider's callback is verified.",
  "checkout.status_pending": ["pending", "payment status"],
  "checkout.order_not_found":
    "Order {order} was created but we could not find it again to start the payment. Nothing was charged. It is in your purchases.",
  "checkout.start_failed":
    "The payment could not be started. The order is saved and nothing was charged.",
} as const;
