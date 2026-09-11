/**
 * Checks for how the portal reads a payment provider's return URL.
 *
 * This is the least trustworthy input in the whole customer portal. The browser
 * can be sent to either return URL by anyone; every provider spells the
 * reference differently; several attach far more than the reference, including
 * the buyer's own email and phone number; and PayU returns the customer by
 * POSTing, so on a real successful payment the query string can be absent
 * altogether.
 *
 * These are worth testing directly rather than through a browser because every
 * case is a pure input and a pure output, and the interesting inputs are exactly
 * the ones that are awkward to produce on demand in a live session: a duplicated
 * parameter, a reference kilobytes long, a query string carrying a signature and
 * a phone number, a status field the server never promised.
 *
 *   node tests/e2e/payment-return.mjs
 *
 * Exit code is 0 when every check passed, 1 otherwise.
 */

import { register } from "node:module";

register("./resolve-ts.mjs", import.meta.url);

const { referenceFrom, cleanedReturnPath, settledStatus, REFERENCE_KEYS } = await import(
  new URL("../../src/lib/portal/payment-return.ts", import.meta.url).href
);

const results = [];
function check(name, condition, detail = "") {
  results.push({ name, ok: Boolean(condition), detail });
  console.log(`  ${condition ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

/* -------------------------------------------------------------------------- */
/* Reading the reference                                                       */
/* -------------------------------------------------------------------------- */

console.log("Reading the reference");

// Every provider that returns the customer with a query string, in its own
// spelling. One return page has to serve all of them.
check(
  "PayU's txnid is read",
  referenceFrom("?txnid=SV17250001") === "SV17250001",
  referenceFrom("?txnid=SV17250001"),
);
check(
  "Flutterwave's tx_ref is read",
  referenceFrom("?status=successful&tx_ref=SV-9001&transaction_id=44") === "SV-9001",
);
check(
  "Paystack's trxref is read",
  referenceFrom("?trxref=SV-7788&reference=SV-7788") === "SV-7788",
);
check("a leading question mark is optional", referenceFrom("txnid=SV-1") === "SV-1");

{
  // The bug this guards: PayU POSTs its result back rather than putting it in
  // the query string, so the return URL arrived with no parameters at all. The
  // page read an empty string, found nothing, and told the customer "We could
  // not identify that payment" for a payment that had gone through perfectly.
  // The reference is now put on the return URL when the payment is opened; this
  // check pins the behaviour the page falls back to when it is still absent.
  check("no query string yields no reference", referenceFrom("") === "");
  check("an unrelated query string yields no reference", referenceFrom("?utm_source=x") === "");
}

{
  // A duplicated parameter must give the first value, not "a,b". URLSearchParams
  // does this via get(); the check exists so a future rewrite using getAll or a
  // manual split cannot regress it.
  const value = referenceFrom("?txnid=FIRST&txnid=SECOND");
  check("a duplicated parameter yields the first value", value === "FIRST", value);
}

{
  // Empty and whitespace-only must not count as a reference: asking the server
  // about nothing produces "we could not identify that payment" through a
  // needless round trip, when the page can say it immediately.
  check("an empty parameter is not a reference", referenceFrom("?txnid=") === "");
  check("a whitespace parameter is not a reference", referenceFrom("?txnid=%20%20") === "");
  check(
    "an empty parameter does not shadow a later real one",
    referenceFrom("?txnid=&tx_ref=SV-42") === "SV-42",
  );
}

{
  // A hand-crafted URL must not be able to put kilobytes into a request URL, on
  // screen, and into the accessible label of the copy button.
  const huge = "A".repeat(5000);
  check(`a ${huge.length}-character reference is refused`, referenceFrom(`?txnid=${huge}`) === "");
  const atLimit = "B".repeat(120);
  check("a reference at the length limit is accepted", referenceFrom(`?txnid=${atLimit}`) === atLimit);
}

{
  // Malformed percent-encoding. URLSearchParams does not throw on this, but the
  // page must not either — this read happens before anything is painted, so a
  // throw here is a blank page rather than a message.
  let threw = false;
  let value = "";
  try {
    value = referenceFrom("?txnid=%E0%A4%A");
  } catch {
    threw = true;
  }
  check("malformed encoding does not throw", !threw, threw ? "it threw" : `gave ${JSON.stringify(value)}`);
}

check(
  "every documented provider spelling is covered",
  ["txnid", "tx_ref", "reference", "trxref", "transaction_id"].every((key) =>
    REFERENCE_KEYS.includes(key),
  ),
);

/* -------------------------------------------------------------------------- */
/* Cleaning the URL                                                            */
/* -------------------------------------------------------------------------- */

console.log("Cleaning the URL");

{
  // The reason this exists. PayU's own field set includes the buyer's firstname,
  // email and phone, and providers add a status and a response hash. All of it
  // ends up in the address bar, in browser history, in a screenshot sent to
  // support, and in the session the browser restores next time it opens. None of
  // it is needed once the reference has been read.
  const dirty =
    "?txnid=SV-500&status=success&hash=9f2c1&email=buyer%40example.com&phone=%2B919812345678&firstname=Asha";
  const cleaned = cleanedReturnPath("/payment/success", referenceFrom(dirty));
  check("the reference survives", cleaned === "/payment/success?txnid=SV-500", cleaned);
  check("the buyer's email does not", !cleaned.includes("example.com"));
  check("the buyer's phone does not", !cleaned.includes("9812345678"));
  check("the buyer's name does not", !cleaned.includes("Asha"));
  check("the response hash does not", !cleaned.includes("9f2c1"));
  check("the provider's own status claim does not", !cleaned.includes("status="));
}

check(
  "with no reference the path is left bare",
  cleanedReturnPath("/payment/fail", "") === "/payment/fail",
);
check(
  "a fragment is preserved",
  cleanedReturnPath("/payment/success", "SV-1", "#receipt") ===
    "/payment/success?txnid=SV-1#receipt",
);
{
  // A reference is put back through encoding, so one containing a delimiter
  // cannot forge a second parameter.
  const cleaned = cleanedReturnPath("/payment/success", "SV-1&admin=1");
  check(
    "a reference cannot smuggle a second parameter",
    cleaned === "/payment/success?txnid=SV-1%26admin%3D1",
    cleaned,
  );
}

/* -------------------------------------------------------------------------- */
/* Believing the status                                                        */
/* -------------------------------------------------------------------------- */

console.log("Believing the status");

check("paid is paid", settledStatus("paid") === "paid");
check("pending is pending", settledStatus("pending") === "pending");
check("failed is failed", settledStatus("failed") === "failed");
check("unknown is unknown", settledStatus("unknown") === "unknown");
check("case and padding do not matter", settledStatus("  PAID \n") === "paid");

{
  // The bug this replaced. The page compared the raw field against each literal
  // in turn, and anything unrecognised fell through to the verifying branch —
  // which ALSO stopped the poll, because the poll only continued on a literal
  // "pending". A status the server never promised therefore left the page
  // spinning "Verifying your payment" for ever with nothing behind it.
  //
  // null is the signal for "not a status we can read", and the page treats it
  // like pending: keep the bounded poll running, then end on the honest "still
  // verifying, your money is safe".
  for (const value of ["captured", "settled", "PENDING_VERIFICATION", "", "  "]) {
    check(
      `an unpromised status (${JSON.stringify(value)}) is not believed`,
      settledStatus(value) === null,
    );
  }
}

{
  // A JSON error body, or a proxy's response, arriving where an outcome was
  // expected. None of these may be read as an outcome.
  for (const value of [undefined, null, 0, 1, {}, [], true, { status: "paid" }]) {
    check(
      `a non-string status (${JSON.stringify(value) ?? String(value)}) is not believed`,
      settledStatus(value) === null,
    );
  }
}

check(
  "a status is never invented from nothing",
  settledStatus(undefined) === null && settledStatus(null) === null,
);

/* -------------------------------------------------------------------------- */

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("\nFailed:");
  for (const result of failed) console.log(`  - ${result.name}${result.detail ? ` (${result.detail})` : ""}`);
}
process.exit(failed.length ? 1 : 0);
