/**
 * Checks for the two things the customer portal must never get wrong about
 * money, and for the thresholds the rest of it runs on.
 *
 * `chargedPair` is the one that matters. A receipt is the last thing a customer
 * reads before deciding whether they were charged correctly, and the purchases
 * endpoint used to build one out of two unrelated halves: the order's base
 * total, paired with the currency the provider actually charged in. For a card
 * order settled in dollars against a catalogue priced in rupees, that is the
 * right symbol against the wrong number, on the customer's own receipt, with
 * nothing on screen to suggest anything is amiss.
 *
 * These cases are worth testing directly rather than through a browser because
 * each one is a row shape rather than an interaction, and the interesting rows
 * are exactly the ones that are awkward to produce on demand: an order that has
 * not been charged yet, one charged in a currency that is not the base, one
 * whose amount is legitimately zero, and one whose columns are simply absent.
 *
 *   node tests/e2e/portal-config.mjs
 *
 * Exit code is 0 when every check passed, 1 otherwise.
 */

import { register } from "node:module";

register("./resolve-ts.mjs", import.meta.url);

const { chargedPair } = await import(
  new URL("../../src/routes/api/account/purchases.ts", import.meta.url).href
);
const { pollDelay, PAYMENT_POLL, supportMailto, SUPPORT_EMAIL, TIMEOUTS, MAX_VISIBLE_TOASTS } =
  await import(new URL("../../src/lib/portal/config.ts", import.meta.url).href);

const results = [];
function check(name, condition, detail = "") {
  results.push({ name, ok: Boolean(condition), detail });
  console.log(`  ${condition ? "PASS" : "FAIL"}  ${name}${detail ? ` -- ${detail}` : ""}`);
}

/* -------------------------------------------------------------------------- */
console.log("What the customer was charged");
/* -------------------------------------------------------------------------- */

{
  // A card order settled in dollars. The base total is in the catalogue's own
  // currency and must not be the number shown against USD.
  const pair = chargedPair({
    amount_charged: 1299.5,
    currency_charged: "USD",
    total: 108000,
    currency: "INR",
  });
  check(
    "a settled card order shows the charged amount, not the base total",
    pair.amount === 1299.5 && pair.currency === "USD",
    JSON.stringify(pair),
  );
}

{
  // The PayU rail writes amount_inr and currency_charged together.
  const pair = chargedPair({ amount_inr: 108000, currency_charged: "INR", total: 1299.5, currency: "USD" });
  check(
    "an INR rail shows the rupee figure against INR",
    pair.amount === 108000 && pair.currency === "INR",
    JSON.stringify(pair),
  );
}

{
  // Nothing charged yet: the base total is the honest thing to show, and it
  // belongs with the base currency.
  const pair = chargedPair({ total: 1299.5, currency: "USD" });
  check(
    "an unpaid order falls back to the base total and the base currency",
    pair.amount === 1299.5 && pair.currency === "USD",
    JSON.stringify(pair),
  );
}

{
  // The old code defaulted a missing currency to "USD", which is a guess and
  // wrong for most of this catalogue's buyers.
  const pair = chargedPair({ amount_charged: 500, currency_charged: null, total: 500 });
  check(
    "a missing currency is null rather than an invented USD",
    pair.currency === null,
    JSON.stringify(pair),
  );
}

{
  // The old code used `?? 0`, so an order with no amount at all was reported as
  // costing nothing.
  const pair = chargedPair({});
  check(
    "an order with no amount at all reports null, never zero",
    pair.amount === null && pair.currency === null,
    JSON.stringify(pair),
  );
}

{
  // Zero is a real amount -- a fully discounted order -- and must survive.
  const pair = chargedPair({ amount_charged: 0, currency_charged: "INR" });
  check(
    "a legitimately zero amount is kept, not treated as missing",
    pair.amount === 0 && pair.currency === "INR",
    JSON.stringify(pair),
  );
}

{
  // A column that arrived as a string, which PostgREST does for numerics.
  const pair = chargedPair({ amount_charged: "1299.50", currency_charged: "USD" });
  check(
    "a numeric arriving as a string is still read as a number",
    pair.amount === 1299.5 && pair.currency === "USD",
    JSON.stringify(pair),
  );
}

{
  // Garbage must not become NaN on a receipt.
  const pair = chargedPair({ amount_charged: "not a number", total: 42, currency: "GBP" });
  check(
    "an unparseable amount falls through rather than becoming NaN",
    pair.amount === 42 && pair.currency === "GBP",
    JSON.stringify(pair),
  );
}

/* -------------------------------------------------------------------------- */
console.log("The payment poll stays bounded and slows");
/* -------------------------------------------------------------------------- */

check("the first gap is the base delay", pollDelay(0) === PAYMENT_POLL.baseDelayMs, String(pollDelay(0)));
check("the gap grows", pollDelay(3) > pollDelay(0), `${pollDelay(0)} -> ${pollDelay(3)}`);
check(
  "the gap is capped, so a slow provider is never hammered nor waited on for ever",
  pollDelay(999) === PAYMENT_POLL.maxDelayMs,
  String(pollDelay(999)),
);
check("the poll is bounded", PAYMENT_POLL.maxAttempts > 0 && PAYMENT_POLL.maxAttempts <= 50);

{
  // The whole poll must finish inside a wait a person will actually sit through.
  let total = 0;
  for (let i = 0; i < PAYMENT_POLL.maxAttempts; i += 1) total += pollDelay(i);
  check(
    "the whole poll completes within two minutes",
    total <= 120_000,
    `${Math.round(total / 1000)}s`,
  );
}

/* -------------------------------------------------------------------------- */
console.log("Reaching a person, and the thresholds");
/* -------------------------------------------------------------------------- */

{
  const link = supportMailto("Payment ABC123", "My payment reference is ABC123.");
  check("support mail goes to the support inbox", link.startsWith(`mailto:${SUPPORT_EMAIL}?`), link);
  check("the subject is carried", link.includes("subject=Payment%20ABC123"), link);
  check(
    "spaces are percent-encoded, not left as plus signs a mail client shows literally",
    !link.includes("+"),
    link,
  );
  // The whole reason this exists: /support is the operator console and refuses a
  // customer outright.
  check("it never points at the gated operator console", !link.includes("/support"), link);
}

check(
  "the payment handoff waits longer than the server's own deadline, so the server answers first",
  TIMEOUTS.startPayment > TIMEOUTS.read,
  `${TIMEOUTS.startPayment} > ${TIMEOUTS.read}`,
);
check("no more than two notifications at once", MAX_VISIBLE_TOASTS >= 1 && MAX_VISIBLE_TOASTS <= 2);

/* -------------------------------------------------------------------------- */

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log("Failed:");
  for (const f of failed) console.log(`  - ${f.name}${f.detail ? ` -- ${f.detail}` : ""}`);
}
process.exit(failed.length ? 1 : 0);
