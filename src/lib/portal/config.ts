/**
 * The numbers and addresses the customer portal runs on, in one place.
 *
 * These were each written inline where they were used — a 20-second deadline in
 * the checkout, a 15-second one in two other files, a poll bound in the payment
 * view, an order cap in the purchases endpoint, a support address typed out
 * twice on the homepage. None of them is a secret and none of them is a design
 * decision; they are operating thresholds, and the reason to gather them is that
 * changing one currently means finding every copy of it and hoping.
 *
 * Nothing here is new behaviour. Every value below is the value that was already
 * in the code, moved rather than chosen, so importing this file changes where a
 * threshold is written and not what it is.
 *
 * Secrets stay on the server. Nothing in this file is one: an address a customer
 * is invited to write to, and a handful of durations.
 */

/* -------------------------------------------------------------------------- */
/* How long the browser waits                                                  */
/* -------------------------------------------------------------------------- */

export const TIMEOUTS = {
  /**
   * Opening a payment with a provider.
   *
   * Sits just beyond the server's own 15-second deadline for the same operation,
   * so the server always gets to answer first and the customer sees its reason
   * rather than a generic timeout. Long enough to be a wait; short enough that a
   * provider which has stopped answering cannot leave a spinner running for ever.
   */
  startPayment: 20_000,

  /** Every other customer-side read: which methods are available, what a payment's status is. */
  read: 15_000,
} as const;

/**
 * When a wait stops looking like progress and needs saying out loud.
 *
 * Past the point where a spinner alone starts to read as "stuck", and well
 * inside every deadline above — so the message is always "still going", never
 * "failed".
 */
export const SLOW_REQUEST_NOTICE_MS = 6_000;

/* -------------------------------------------------------------------------- */
/* Asking the server what happened to a payment                                */
/* -------------------------------------------------------------------------- */

export const PAYMENT_POLL = {
  /** How many times before the page says plainly that it does not know yet. */
  maxAttempts: 12,
  /** The first gap, and how much each one grows, up to the ceiling. */
  baseDelayMs: 2_000,
  stepMs: 1_000,
  maxDelayMs: 8_000,
} as const;

/** The gap before attempt `n`, slowing as it goes so a slow provider is not hammered. */
export function pollDelay(attempt: number): number {
  return Math.min(
    PAYMENT_POLL.baseDelayMs + attempt * PAYMENT_POLL.stepMs,
    PAYMENT_POLL.maxDelayMs,
  );
}

/* -------------------------------------------------------------------------- */
/* How much is loaded at once                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Orders in one page of a customer's purchase history.
 *
 * The endpoint enforces this; the page is told the number so it can say which
 * of the two situations the customer is in — a hundred orders, or more than a
 * hundred of which these are the newest.
 */
export const PURCHASES_PAGE_SIZE = 100;

/* -------------------------------------------------------------------------- */
/* Notifications                                                               */
/* -------------------------------------------------------------------------- */

/**
 * How many notifications may be on screen at once.
 *
 * Two, so a second message can correct or follow the first, and a customer
 * pressing a button repeatedly cannot bury the page under a column of identical
 * refusals.
 */
export const MAX_VISIBLE_TOASTS = 2;

/* -------------------------------------------------------------------------- */
/* Reaching a person                                                           */
/* -------------------------------------------------------------------------- */

/**
 * How a *customer* reaches support.
 *
 * Worth stating, because getting this wrong is what the portal was doing. The
 * customer-facing pages all offered "Contact support" pointing at `/support`,
 * which is the support team's own operations console and is gated on the
 * `support` role — so a buyer who followed it, having just been told to contact
 * us about a payment we could not verify, was shown "Access restricted. This
 * authenticated account does not have the required Control Panel role."
 *
 * These two are the routes that actually reach a person, and they are the ones
 * the marketplace homepage has always used.
 */
export const SUPPORT_EMAIL = "support@softwarevala.net";
export const SUPPORT_WHATSAPP = "918348838383";

/** `mailto:` for the support inbox, optionally carrying what the customer was looking at. */
export function supportMailto(subject = "Support request", body?: string): string {
  const query = new URLSearchParams({ subject });
  if (body) query.set("body", body);
  // URLSearchParams encodes a space as "+", which some mail clients render
  // literally in a subject line. Percent-encoding is understood everywhere.
  return `mailto:${SUPPORT_EMAIL}?${query.toString().replace(/\+/g, "%20")}`;
}

/** The WhatsApp thread, which is the faster of the two for most buyers. */
export const SUPPORT_WHATSAPP_URL = `https://wa.me/${SUPPORT_WHATSAPP}`;
