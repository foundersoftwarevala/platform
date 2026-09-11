/**
 * Reading the URL a payment provider hands the customer back on.
 *
 * This is the least trustworthy input in the whole portal. The browser can be
 * sent to either return URL by anyone, every provider spells the reference
 * differently, several of them attach a great deal more than the reference, and
 * PayU returns the customer by POSTing — so the query string can be absent
 * entirely on a real, successful payment.
 *
 * The functions live here rather than inside the page for two reasons: nothing
 * in them renders, and every interesting case is one that is awkward to produce
 * in a browser on demand — a duplicated parameter, a reference kilobytes long,
 * a query string that is nothing but a signature and the buyer's phone number.
 * `tests/e2e/payment-return.mjs` covers them directly.
 */

/**
 * The names providers use for the reference, in the order they are tried.
 *
 * PayU and the manual rails use `txnid`; Flutterwave appends `tx_ref` and
 * `transaction_id`; Paystack appends `trxref` and `reference`. Reading all of
 * them is what lets one return page serve every provider.
 */
export const REFERENCE_KEYS = [
  "txnid",
  "txnId",
  "tx_ref",
  "reference",
  "trxref",
  "transaction_id",
] as const;

/** Far above any real reference; only stops a hand-crafted URL putting kilobytes on screen. */
const MAX_REFERENCE_LENGTH = 120;

/**
 * The payment reference in a query string, or an empty string.
 *
 * Defensive about every way a query string can be wrong (§42). A duplicated
 * parameter yields the first value rather than a comma-joined pair. An empty or
 * whitespace-only one is skipped rather than accepted as a reference, so the page
 * says "we could not identify that payment" instead of asking the server about
 * nothing. Anything absurdly long is refused rather than put into a request URL
 * and an accessible label. And the whole read is guarded, because it runs before
 * the page is painted and a throw here is a blank page.
 */
export function referenceFrom(search: string): string {
  try {
    const params = new URLSearchParams(search);
    for (const key of REFERENCE_KEYS) {
      const value = (params.get(key) ?? "").trim();
      if (value && value.length <= MAX_REFERENCE_LENGTH) return value;
    }
  } catch {
    /* an unreadable query string is simply no reference */
  }
  return "";
}

/**
 * The path a return URL should be rewritten to: the reference, and nothing else.
 *
 * Providers put a great deal into the return URL — a status, a signature or
 * response hash, and, in PayU's field set, the buyer's firstname, email and
 * phone. That lands in the address bar, in browser history, in a screenshot sent
 * to support, and in the session the browser restores next time it opens. None of
 * it is needed once the reference has been read, because the page asks our own
 * server for everything it displays rather than trusting any of it (§41).
 *
 * The reference itself is kept. Dropping it too would break the reload a customer
 * watching a slow verification is most likely to try.
 */
export function cleanedReturnPath(
  pathname: string,
  reference: string,
  hash = "",
): string {
  const keep = new URLSearchParams();
  if (reference) keep.set("txnid", reference);
  const query = keep.toString();
  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}

/** The four statuses the status endpoint promises, and nothing else. */
export type PaymentStatus = "paid" | "pending" | "failed" | "unknown";

/**
 * The status the server reported, if it is one the server actually promises.
 *
 * `null` means "not a status we can read", which the caller must treat as *not
 * settled yet* rather than as any particular outcome.
 *
 * The page used to compare the raw field against each literal in turn and let
 * anything unrecognised fall through to the verifying branch — which also stopped
 * the poll, because the poll only continued on a literal "pending". A value the
 * server never promised therefore left the page spinning "Verifying your
 * payment" for ever with nothing behind it. Normalising here means an unexpected
 * value keeps the bounded poll running and ends on the honest "still verifying,
 * your money is safe" state, which is the truthful thing to say about a status
 * that cannot be read (§43).
 */
export function settledStatus(value: unknown): PaymentStatus | null {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "paid" || raw === "pending" || raw === "failed" || raw === "unknown") return raw;
  return null;
}
