/**
 * Checks for the customer portal's display helpers.
 *
 * These are the functions that stand between a customer and the four things
 * this platform must never show them: a currency symbol we guessed, an amount
 * rounded to something they were not charged, the words "Invalid Date", and a
 * developer's error message.
 *
 * They are worth testing directly rather than through a browser because every
 * case here is a pure input and a pure output, and the interesting inputs are
 * exactly the ones that are hard to produce on demand in a real session: a null
 * amount, a malformed currency code, an HTML error page where JSON was
 * expected, a stack trace arriving as a server message.
 *
 *   node tests/e2e/portal-format.mjs
 *
 * Exit code is 0 when every check passed, 1 otherwise.
 */

import { register } from "node:module";

register("./resolve-ts.mjs", import.meta.url);

const { money, dateLabel, whenLabel, readJson, safeMessage, friendlyError, friendlyThrown } =
  await import(new URL("../../src/lib/portal/format.ts", import.meta.url).href);

const results = [];
function check(name, condition, detail = "") {
  results.push({ name, ok: Boolean(condition), detail });
  console.log(`  ${condition ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

/* -------------------------------------------------------------------------- */
/* Money                                                                       */
/* -------------------------------------------------------------------------- */

console.log("Money");

{
  // The bug this replaced: every amount was forced through en-IN with the
  // decimals suppressed, so a customer charged $1,299.50 was shown "$1,299".
  const usd = money(1299.5, "USD");
  check(
    "a dollar amount keeps its cents",
    usd.includes("1,299.50"),
    usd,
  );
  check("a dollar amount is not grouped the Indian way", !usd.includes("1,299.5,0"), usd);

  const inr = money(125000, "INR");
  check("rupees still format", /125,000|1,25,000/.test(inr), inr);

  // A currency with no minor unit must not be given two decimal places.
  const jpy = money(5000, "JPY");
  check("a zero-decimal currency gets no decimals", !jpy.includes(".00"), jpy);

  check("a euro amount carries its own symbol", money(10, "EUR").includes("€"), money(10, "EUR"));
  check("a pound amount carries its own symbol", money(10, "GBP").includes("£"), money(10, "GBP"));
}

{
  // Never invent a value, and never invent a currency.
  check("a null amount is an em dash, not zero", money(null, "USD") === "—", money(null, "USD"));
  check(
    "an undefined amount is an em dash",
    money(undefined, "USD") === "—",
    money(undefined, "USD"),
  );
  check("NaN is an em dash, never rendered", money(Number.NaN, "USD") === "—");
  check("Infinity is an em dash", money(Number.POSITIVE_INFINITY, "USD") === "—");

  const noCurrency = money(1234.5, null);
  check(
    "a missing currency never becomes a dollar sign",
    !noCurrency.includes("$") && noCurrency.includes("1,234"),
    noCurrency,
  );

  const nonsense = money(50, "NOTACURRENCY");
  check(
    "an unusable currency code is shown as itself, not decorated",
    nonsense.includes("NOTACURRENCY") && !nonsense.includes("$"),
    nonsense,
  );

  // Zero is a real amount and must survive: an order genuinely worth nothing,
  // or a fully discounted one, still has to render.
  check("zero is a real amount, not a missing one", money(0, "USD") !== "—", money(0, "USD"));

  // Numeric strings come back from JSON APIs constantly.
  check("a numeric string is accepted", money("42.5", "USD").includes("42.50"), money("42.5", "USD"));
}

/* -------------------------------------------------------------------------- */
/* Dates                                                                       */
/* -------------------------------------------------------------------------- */

console.log("\nDates");

{
  check("a null date is an em dash", dateLabel(null) === "—");
  check("an empty date is an em dash", dateLabel("") === "—");
  check(
    "an unparseable date never renders as 'Invalid Date'",
    dateLabel("not a date") === "—",
    dateLabel("not a date"),
  );
  const real = dateLabel("2026-03-12T18:30:00.000Z");
  check("a real date renders", real !== "—" && real.length > 5, real);

  check("whenLabel guards a null the same way", whenLabel(null) === "—");
  check("whenLabel guards rubbish the same way", whenLabel("nonsense") === "—");
  const stamped = whenLabel("2026-03-12T18:30:00.000Z");
  check(
    "whenLabel names the zone rather than leaving it ambiguous",
    stamped.includes("("),
    stamped,
  );
}

/* -------------------------------------------------------------------------- */
/* Reading a response                                                          */
/* -------------------------------------------------------------------------- */

console.log("\nReading a response");

const json = (body, status = 200) =>
  new Response(body, { status, headers: { "content-type": "application/json" } });

{
  const ok = await readJson(json(JSON.stringify({ purchases: [1, 2] })));
  check("a good body parses", ok.ok === true && ok.data.purchases.length === 2);

  // The one that used to reach customers as "Unexpected token < in JSON".
  const html = await readJson(json("<html><body>502 Bad Gateway</body></html>", 502));
  check(
    "an HTML error page becomes a sentence, not a parser error",
    html.ok === false && !html.error.includes("<") && !html.error.toLowerCase().includes("token"),
    html.error,
  );

  const empty = await readJson(json("", 200));
  check("an empty 200 body does not throw", empty.ok === true);

  const emptyError = await readJson(json("", 500));
  check("an empty error body still yields a message", emptyError.ok === false && !!emptyError.error);

  // A server refusal written for customers is passed straight through.
  const refusal = await readJson(json(JSON.stringify({ error: "That order is already paid" }), 409));
  check(
    "a customer-safe server message is kept",
    refusal.ok === false && refusal.error === "That order is already paid",
    refusal.error,
  );

  // One written for developers is not.
  const leak = await readJson(
    json(JSON.stringify({ error: "TypeError: Cannot read properties of undefined" }), 500),
  );
  check(
    "a developer's error is replaced before it reaches a customer",
    leak.ok === false && !leak.error.includes("TypeError"),
    leak.error,
  );

  const status = await readJson(json("{}", 401));
  check("the status is preserved for the caller", status.ok === false && status.status === 401);
}

/* -------------------------------------------------------------------------- */
/* Error messages                                                              */
/* -------------------------------------------------------------------------- */

console.log("\nWhat a customer is told");

{
  check("a plain refusal is safe", safeMessage("Please sign in to pay.") !== null);
  check("a stack frame is not", safeMessage("Error\n    at handler (/app/x.js:1:1)") === null);
  check(
    "a database URL is not",
    safeMessage("connect ECONNREFUSED postgres://db.internal:5432") === null,
  );
  check("a SQL fragment is not", safeMessage("select * from finance_payments where id = 1") === null);
  check("a serialised object is not", safeMessage('{"code":"PGRST116"}') === null);
  check("a Supabase internal is not", safeMessage("PostgREST returned PGRST301") === null);
  check("an essay is not", safeMessage("x".repeat(400)) === null);
  check("a non-string is not", safeMessage(undefined) === null && safeMessage(42) === null);

  check("401 tells them to sign in", /sign in/i.test(friendlyError(401)));
  check("429 tells them to wait", /wait/i.test(friendlyError(429)));
  check("503 says temporary", /temporar/i.test(friendlyError(503)));
  check(
    "no status message leaks a code number to the customer",
    ![400, 401, 403, 404, 409, 429, 500, 502, 503].some((code) =>
      friendlyError(code).includes(String(code)),
    ),
  );

  // A dropped connection is the single most common thing a customer hits.
  const offline = friendlyThrown(new TypeError("Failed to fetch"), "fallback");
  check(
    "a dropped connection is named, not shown as 'Failed to fetch'",
    !offline.includes("Failed to fetch") && /connection/i.test(offline),
    offline,
  );

  const aborted = friendlyThrown(new DOMException("aborted", "AbortError"), "fallback");
  check(
    "a timed-out request says nothing was charged",
    /nothing was charged/i.test(aborted),
    aborted,
  );

  check(
    "a safe Error message survives",
    friendlyThrown(new Error("That order is already paid"), "fallback") ===
      "That order is already paid",
  );
  check(
    "an unsafe Error message falls back",
    friendlyThrown(new Error("ReferenceError: x is not defined"), "fallback") === "fallback",
  );
}

/* -------------------------------------------------------------------------- */

const passed = results.filter((r) => r.ok).length;
const failed = results.length - passed;
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  console.log("\nFailures:");
  for (const r of results.filter((x) => !x.ok)) console.log(`  - ${r.name}: ${r.detail}`);
}
process.exit(failed ? 1 : 0);
