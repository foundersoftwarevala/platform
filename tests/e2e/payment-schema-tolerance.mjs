/**
 * Checks for the writes that must survive production's payment schema, and for
 * the sign-in redirect sanitiser.
 *
 * Production's CHECK constraints refuse several status values the payment code
 * writes (probed on 2026-09-11 without writing anything):
 *
 *   marketplace_orders       refuses payment_failed, payment_expired, pending
 *   finance_payment_intents  refuses succeeded, requires_review, requires_action
 *   finance_payments         refuses succeeded
 *
 * Every such write used to fail outright. writeTolerant now retries with the
 * value the table does accept, drops columns the table does not have, and
 * remembers both. These checks drive it with a fake PostgREST that answers the
 * way production does, so they need no database and write nothing.
 *
 *   node tests/e2e/payment-schema-tolerance.mjs
 *
 * Exit code is 0 when every check passed, 1 otherwise.
 */

import { register } from "node:module";

register("./resolve-ts.mjs", import.meta.url);

const { writeTolerant, acceptedStatus, isSettledIntentStatus, isStatusCheckViolation } =
  await import(new URL("../../src/lib/commerce/schema-tolerance.ts", import.meta.url).href);
const { safeRedirectPath } = await import(
  new URL("../../src/lib/auth/safe-redirect.ts", import.meta.url).href
);

const results = [];
function check(name, condition, detail = "") {
  results.push({ name, ok: Boolean(condition), detail });
  console.log(`  ${condition ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

/** A PostgREST stand-in that refuses what production refuses. */
function fakeTable({ table, refusedStatuses = [], missingColumns = [] }) {
  const calls = [];
  const send = async (body) => {
    calls.push(body);
    for (const column of missingColumns) {
      if (column in body) {
        return new Response(
          JSON.stringify({
            code: "PGRST204",
            message: `Could not find the '${column}' column of '${table}' in the schema cache`,
          }),
          { status: 400 },
        );
      }
    }
    if (typeof body.status === "string" && refusedStatuses.includes(body.status)) {
      return new Response(
        JSON.stringify({
          code: "23514",
          message: `new row for relation "${table}" violates check constraint "${table}_status_check"`,
        }),
        { status: 400 },
      );
    }
    return new Response("[]", { status: 200 });
  };
  return { send, calls };
}

/* -------------------------------------------------------------------------- */
console.log("Status values production refuses");

{
  const intents = fakeTable({
    table: "finance_payment_intents",
    refusedStatuses: ["succeeded", "requires_review", "requires_action"],
    missingColumns: ["settled_at"],
  });
  const response = await writeTolerant(
    "finance_payment_intents",
    { status: "succeeded", settled_at: "2026-09-11T00:00:00Z", provider_reference: "p1" },
    intents.send,
  );
  const last = intents.calls[intents.calls.length - 1];
  check("a settled intent is written as paid", response.ok && last.status === "paid", JSON.stringify(last));
  check("the missing settled_at column is dropped", !("settled_at" in last));
  check("the other columns survive", last.provider_reference === "p1");
  check(
    "the refusal is remembered for the next write",
    acceptedStatus("finance_payment_intents", "succeeded") === "paid",
  );

  const before = intents.calls.length;
  await writeTolerant("finance_payment_intents", { status: "succeeded" }, intents.send);
  check(
    "the next write goes straight to the accepted value",
    intents.calls.length === before + 1 && intents.calls[before].status === "paid",
  );
}

{
  const orders = fakeTable({
    table: "marketplace_orders",
    refusedStatuses: ["payment_failed", "payment_expired", "pending"],
    missingColumns: ["provider_status", "provider_payment_id"],
  });
  const response = await writeTolerant(
    "marketplace_orders",
    {
      status: "payment_failed",
      payment_gateway: "wise",
      provider_status: "failure",
      provider_payment_id: null,
    },
    orders.send,
  );
  const last = orders.calls[orders.calls.length - 1];
  check(
    "a failed payment leaves the order pending_payment, so the buyer can retry",
    response.ok && last.status === "pending_payment",
    JSON.stringify(last),
  );
  check("the gateway is still recorded", last.payment_gateway === "wise");
  check(
    "both absent provider columns are dropped",
    !("provider_status" in last) && !("provider_payment_id" in last),
  );
}

{
  const payments = fakeTable({ table: "finance_payments", refusedStatuses: ["succeeded"] });
  const response = await writeTolerant("finance_payments", { status: "succeeded", amount: 249 }, payments.send);
  check(
    "a payment row is written as paid",
    response.ok && payments.calls[payments.calls.length - 1].status === "paid",
  );
}

{
  const orders = fakeTable({ table: "marketplace_orders" });
  await writeTolerant("marketplace_orders", { status: "paid" }, orders.send);
  check("an accepted value is sent unchanged and once", orders.calls.length === 1 && orders.calls[0].status === "paid");
}

{
  // A CHECK violation on something other than status is not rewritten.
  const other = async () =>
    new Response(
      JSON.stringify({ code: "23514", message: 'violates check constraint "x_amount_check"' }),
      { status: 400 },
    );
  const response = await writeTolerant("finance_payments", { status: "succeeded", amount: -1 }, other);
  check("a non-status CHECK failure is returned, not retried forever", response.status === 400);
}

check("23514 on a status constraint is recognised", isStatusCheckViolation('{"code":"23514","message":"... \\"t_status_check\\""}'));
check("a missing column is not mistaken for a status refusal", !isStatusCheckViolation('{"code":"PGRST204"}'));
check("paid and succeeded both mean settled", isSettledIntentStatus("paid") && isSettledIntentStatus("succeeded"));
check("pending is not settled", !isSettledIntentStatus("pending"));

/* -------------------------------------------------------------------------- */
console.log("Sign-in redirect");

const origin = "https://softwarevala.net";
const cases = [
  ["/demo/edunex-pro", "/demo/edunex-pro"],
  ["/marketplace/product/x?buy=1#top", "/marketplace/product/x?buy=1#top"],
  ["//evil.com", undefined],
  ["/\\evil.com", undefined],
  ["/\\/evil.com", undefined],
  ["/.//evil.com", undefined],
  ["https://evil.com", undefined],
  ["javascript:alert(1)", undefined],
  ["", undefined],
];
for (const [asked, expected] of cases) {
  const got = safeRedirectPath(asked, origin);
  check(`redirect ${JSON.stringify(asked)} → ${JSON.stringify(expected)}`, got === expected, String(got));
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
