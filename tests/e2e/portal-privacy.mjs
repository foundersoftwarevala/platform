/**
 * Checks that a customer's details never reach the error log.
 *
 * The client error monitor records the route a failure happened on, and the
 * query string is a genuinely useful part of that. But the payment return pages
 * are reached with whatever the provider chose to append, and PayU's field set
 * carries the buyer's first name, email and phone alongside a response hash.
 * Recording that verbatim writes a customer's contact details, and a provider's
 * signature, into `error_events` -- a table read through the Error Monitor and
 * kept for as long as the table is.
 *
 * This is worth testing directly because it is a privacy control, it is pure,
 * and every case is a URL that is awkward to arrive at on demand.
 *
 *   node tests/e2e/portal-privacy.mjs
 */

import { register } from "node:module";

register("./resolve-ts.mjs", import.meta.url);

// The module reads `window` at call time only, so a minimal stand-in is enough
// and is honest about what the function actually touches.
globalThis.window = { location: { pathname: "/", search: "" } };

const { safeRoute } = await import(
  new URL("../../src/lib/client-error-monitor.ts", import.meta.url).href
);

const results = [];
function check(name, condition, detail = "") {
  results.push({ name, ok: Boolean(condition), detail });
  console.log(`  ${condition ? "PASS" : "FAIL"}  ${name}${detail ? ` -- ${detail}` : ""}`);
}
function at(pathname, search) {
  globalThis.window.location = { pathname, search };
  return safeRoute();
}

console.log("What reaches the error log");

{
  // The real shape of a PayU return, which is what prompted this.
  const route = at(
    "/payment/success",
    "?txnid=SV12345&status=success&firstname=Ramesh&email=ramesh%40example.com&phone=919812345678&hash=9f2b1c",
  );
  check("the buyer's email is not logged", !route.includes("ramesh"), route);
  check("the buyer's phone is not logged", !route.includes("919812345678"), route);
  check("the buyer's name is not logged", !route.includes("Ramesh"), route);
  check("the provider's response hash is not logged", !route.includes("9f2b1c"), route);
  // The half that is diagnostic must survive, or the redaction has cost more
  // than it saved.
  check("the path survives", route.startsWith("/payment/success"), route);
  check("the reference survives, because it is how a payment is traced", route.includes("SV12345"), route);
  check("the key is kept so its presence is still visible", route.includes("email=%5Bredacted%5D") || route.includes("email=[redacted]"), route);
}

{
  const route = at("/marketplace/category/crm", "?sort=price&page=3");
  check("an ordinary query string is kept intact for diagnosis", route === "/marketplace/category/crm?sort=price&page=3", route);
}

{
  const route = at("/checkout", "");
  check("a page with no query string is just its path", route === "/checkout", route);
}

{
  const route = at("/checkout", "?");
  check("an empty query string is not rendered as a bare question mark", route === "/checkout", route);
}

{
  // A hand-crafted URL must not put kilobytes into every error row.
  const route = at("/payment/fail", "?blob=" + "x".repeat(5000));
  check("an absurdly long query string is dropped, keeping the path", route === "/payment/fail", route.slice(0, 60));
}

{
  const route = at("/login", "?access_token=abc123&code=xyz789&redirect=%2Fcheckout");
  check("an access token is never logged", !route.includes("abc123"), route);
  check("an OAuth code is never logged", !route.includes("xyz789"), route);
  check("the redirect the visitor asked for survives", route.includes("checkout"), route);
}

{
  // Case is the provider's choice, not ours.
  const route = at("/payment/success", "?Email=a%40b.com&PHONE=123456");
  check("redaction is case-insensitive, as provider field names are not", !route.includes("a%40b.com") && !route.includes("123456"), route);
}

{
  // The function runs inside the error reporter; a throw here would swallow the
  // report of another failure.
  globalThis.window.location = {
    get pathname() { return "/safe"; },
    get search() { throw new Error("blocked"); },
  };
  let threw = false;
  let route = "";
  try { route = safeRoute(); } catch { threw = true; }
  check("a location that will not be read does not throw inside the reporter", !threw, route);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log("Failed:");
  for (const f of failed) console.log(`  - ${f.name}${f.detail ? ` -- ${f.detail}` : ""}`);
}
process.exit(failed.length ? 1 : 0);
