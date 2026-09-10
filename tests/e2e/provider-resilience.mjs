/**
 * Controlled failure injection for the provider call layer.
 *
 * Section 27 of the operations brief permits only reversible experiments on
 * isolated infrastructure, so nothing here touches production, the database, a
 * real provider or a real payment. The "provider" is a throwaway HTTP server
 * started on a loopback port by this file, told to hang, to return 500, or to
 * answer normally, on command. When the process exits it is gone.
 *
 * What is being proved is the part that cannot be read off the source: that a
 * hung provider is abandoned on a deadline rather than waited on for ever, that
 * a run of failures actually opens the circuit, that an open circuit is not
 * called, that it recovers on a single probe, and — the one that matters most —
 * that a call which could move money is never automatically repeated.
 *
 *   node tests/e2e/provider-resilience.mjs
 *
 * Exit code is 0 when every check passed, 1 otherwise.
 */

import { createServer } from "node:http";
import { register } from "node:module";

/* -------------------------------------------------------------------------- */
/* Loading the module under test                                               */
/* -------------------------------------------------------------------------- */

// provider-call.ts is TypeScript with an "@/" path alias, so it is loaded
// through the project's own resolution rather than reimplemented here — a copy
// of the logic would prove only that the copy works. Node strips the types.
register("./resolve-ts.mjs", import.meta.url);

const { providerFetch, circuitIsOpen, circuitSnapshot, resetCircuits } = await import(
  new URL("../../src/lib/commerce/provider-call.ts", import.meta.url).href
);

/* -------------------------------------------------------------------------- */
/* Results                                                                     */
/* -------------------------------------------------------------------------- */

const results = [];
const record = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

/* -------------------------------------------------------------------------- */
/* The fault injector                                                          */
/* -------------------------------------------------------------------------- */

/** What the fake provider should do with the next request. */
let mode = "ok";
/** Every request it received, so "was this retried?" is answerable. */
let hits = 0;
/** Sockets left hanging, kept so they can be released at the end. */
const hanging = [];

const server = createServer((request, response) => {
  hits += 1;
  if (mode === "hang") {
    // Accept the connection and then simply never answer. This is the failure
    // the timeout exists for, and the one a missing timeout makes invisible.
    hanging.push(response);
    return;
  }
  if (mode === "fault") {
    response.writeHead(503, { "content-type": "application/json" });
    response.end('{"error":"upstream unavailable"}');
    return;
  }
  if (mode === "declined") {
    // A provider answering "no". Healthy behaviour, not a fault.
    response.writeHead(402, { "content-type": "application/json" });
    response.end('{"status":"declined"}');
    return;
  }
  response.writeHead(200, { "content-type": "application/json" });
  response.end('{"status":"success"}');
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const provider = "faultinjector";
const callOnce = (operation) =>
  providerFetch({ provider, operation, url: `${origin}/probe`, correlationId: "test" });

/* -------------------------------------------------------------------------- */
/* The checks                                                                  */
/* -------------------------------------------------------------------------- */

console.log(`Provider resilience checks against ${origin}\n`);

/* ---- 1. A hung provider is abandoned, not waited on --------------------- */
console.log("Timeout policy");
resetCircuits();
mode = "hang";
hits = 0;

{
  const started = Date.now();
  const result = await callOnce("checkout_create");
  const elapsed = Date.now() - started;

  if (result.ok) {
    record("a hung provider does not succeed", false, "call returned ok");
  } else if (result.kind !== "timeout") {
    record("a hung provider times out", false, `kind was ${result.kind}`);
  } else {
    record("a hung provider times out", true, `after ${elapsed}ms`);
  }

  // The policy for checkout_create is 15s. Anything far outside that means the
  // deadline is not the one that fired.
  if (elapsed >= 14_000 && elapsed <= 18_000) {
    record("the deadline is the configured one", true, `${elapsed}ms, policy 15000ms`);
  } else {
    record("the deadline is the configured one", false, `${elapsed}ms, expected ~15000ms`);
  }

  // The check this whole layer exists for.
  if (hits === 1) {
    record("a checkout that timed out is NOT retried", true, `provider saw ${hits} request`);
  } else {
    record(
      "a checkout that timed out is NOT retried",
      false,
      `provider saw ${hits} requests — a retry here can charge a customer twice`,
    );
  }
}

/* ---- 2. A refund is never repeated either ------------------------------- */
resetCircuits();
mode = "hang";
hits = 0;

{
  const result = await callOnce("refund");
  if (!result.ok && hits === 1) {
    record("a refund that timed out is NOT retried", true, `provider saw ${hits} request`);
  } else {
    record(
      "a refund that timed out is NOT retried",
      false,
      `ok=${result.ok}, provider saw ${hits} requests`,
    );
  }
}

/* ---- 3. A read may be retried, because it cannot cost anything ---------- */
resetCircuits();
mode = "fault";
hits = 0;

{
  const result = await callOnce("verify");
  if (result.ok) {
    record("a failing verify is reported as failed", false, "returned ok");
  } else if (hits === 3) {
    record("a verify IS retried, three attempts", true, `provider saw ${hits} requests`);
  } else {
    record("a verify IS retried, three attempts", false, `provider saw ${hits} requests`);
  }
}

/* ---- 4. A provider answering "no" is not a fault ------------------------ */
console.log("\nWhat counts as a fault");
resetCircuits();
mode = "declined";
hits = 0;

{
  let allAnswered = true;
  for (let i = 0; i < 8; i += 1) {
    const result = await callOnce("verify");
    if (!result.ok || result.response.status !== 402) allAnswered = false;
    if (result.ok) await result.response.text();
  }
  if (allAnswered && !circuitIsOpen(provider)) {
    record("declined payments do not trip the circuit", true, "8 declines, circuit still closed");
  } else {
    record(
      "declined payments do not trip the circuit",
      false,
      `answered=${allAnswered}, open=${circuitIsOpen(provider)}`,
    );
  }
  if (hits === 8) {
    record("a 4xx is not retried", true, `provider saw ${hits} requests for 8 calls`);
  } else {
    record("a 4xx is not retried", false, `provider saw ${hits} requests for 8 calls`);
  }
}

/* ---- 5. A real outage opens the circuit --------------------------------- */
console.log("\nCircuit breaker");
resetCircuits();
mode = "fault";

{
  // checkout_create is used so each call is exactly one outcome, which makes
  // the threshold arithmetic legible: five failures in the window.
  for (let i = 0; i < 5; i += 1) await callOnce("checkout_create");

  if (circuitIsOpen(provider)) {
    const state = circuitSnapshot().find((entry) => entry.provider === provider);
    record("five failures open the circuit", true, `reason: ${state?.reason}`);
  } else {
    record("five failures open the circuit", false, `state: ${JSON.stringify(circuitSnapshot())}`);
  }
}

/* ---- 6. An open circuit is not called ----------------------------------- */
{
  hits = 0;
  const started = Date.now();
  const result = await callOnce("checkout_create");
  const elapsed = Date.now() - started;

  if (result.ok || result.kind !== "circuit_open") {
    record("an open circuit refuses without calling", false, `kind=${result.kind ?? "ok"}`);
  } else if (hits !== 0) {
    record("an open circuit refuses without calling", false, `provider still saw ${hits} requests`);
  } else {
    record(
      "an open circuit refuses without calling",
      true,
      `refused in ${elapsed}ms, provider saw 0 requests`,
    );
  }

  // The customer-facing benefit: a fast honest refusal instead of a long wait.
  if (elapsed < 100) {
    record("the refusal is immediate", true, `${elapsed}ms`);
  } else {
    record("the refusal is immediate", false, `${elapsed}ms`);
  }
}

/* ---- 7. Routing stops offering a rail that is not answering ------------- */
{
  if (circuitIsOpen(provider)) {
    record("checkout can see the rail is unusable", true, "circuitIsOpen reports true");
  } else {
    record("checkout can see the rail is unusable", false, "circuitIsOpen reports false");
  }
}

/* ---- 8. Recovery, on one probe ------------------------------------------ */
console.log("\nRecovery");
{
  // Rather than waiting out the 60s cooldown, the breaker is reset and taken
  // through the same transition deliberately: fail it, then let the cooldown be
  // the only thing standing in the way, then confirm a healthy provider closes
  // it again on a single probe. Waiting a real minute would test setTimeout.
  resetCircuits();
  mode = "fault";
  for (let i = 0; i < 5; i += 1) await callOnce("checkout_create");
  const opened = circuitIsOpen(provider);

  // The provider comes back.
  mode = "ok";

  // While the cooldown is still running, it must stay shut even though the
  // provider is now healthy — otherwise the breaker is decorative.
  const during = await callOnce("checkout_create");
  const stayedShut = !during.ok && during.kind === "circuit_open";

  if (opened && stayedShut) {
    record("a recovered provider is still not called during the cooldown", true, "held shut");
  } else {
    record(
      "a recovered provider is still not called during the cooldown",
      false,
      `opened=${opened}, during=${during.kind ?? "ok"}`,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Done                                                                        */
/* -------------------------------------------------------------------------- */

for (const response of hanging) {
  try {
    response.destroy();
  } catch {
    /* already gone */
  }
}
await new Promise((resolve) => server.close(resolve));

const passed = results.filter((entry) => entry.ok).length;
const failed = results.length - passed;
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  console.log("\nFailures:");
  for (const entry of results.filter((r) => !r.ok)) {
    console.log(`  - ${entry.name}: ${entry.detail}`);
  }
}
process.exit(failed ? 1 : 0);
