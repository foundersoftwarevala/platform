/**
 * Does the live page's code actually run?
 *
 * `verify-assets.sh` answers whether the files are served. This answers the
 * question after it: whether the browser could start the application with them.
 * The two are not the same, and the gap between them is where this site sat -
 * a complete, correct, 200 document that never became an application.
 *
 * It loads the page twice, once with JavaScript on and once with it off. What
 * is the same in both columns is what the server rendered; what only appears
 * with JavaScript on is what hydration added. If the two columns match, nothing
 * hydrated.
 *
 *   node scripts/ops/probe-hydration.mjs
 *   node scripts/ops/probe-hydration.mjs http://127.0.0.1:3000
 */
import { chromium } from "@playwright/test";

const url = process.argv[2] ?? "https://softwarevala.net/";

async function look(javaScriptEnabled) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ javaScriptEnabled });
  const page = await context.newPage();

  const failed = new Set();
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().includes("/assets/")) {
      failed.add(`${r.status()} ${r.url().split("/").pop()}`);
    }
  });

  await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
  const rail = page.locator("[data-product-row]").first();
  await rail.scrollIntoViewIfNeeded().catch(() => {});

  const immediate = await rail.locator(".sv-card-shell").count();
  // Long enough for the row to top itself up and for another page of rows to
  // arrive, if anything is going to.
  await page.waitForTimeout(12_000);
  const later = await rail.locator(".sv-card-shell").count();

  // TanStack Start deletes `$_TSR` once the router has hydrated and the stream
  // has ended. Still present means the router never started.
  const tsr = await page.evaluate(() => typeof window.$_TSR).catch(() => "n/a");
  const rails = await page.locator("[data-product-row]").count();

  await browser.close();
  return { immediate, later, tsr, rails, failed: [...failed] };
}

console.log(`probing ${url}\n`);
const results = {};
for (const js of [false, true]) {
  results[js] = await look(js);
  const r = results[js];
  console.log(`=== JavaScript ${js ? "ON" : "OFF"} ===`);
  console.log(`  rails on the page   : ${r.rails}`);
  console.log(`  cards in first rail : ${r.immediate} on load, ${r.later} after 12s`);
  console.log(`  window.$_TSR        : ${r.tsr}${js ? "   (undefined = hydrated)" : ""}`);
  console.log(`  assets that failed  : ${r.failed.length ? r.failed.join(", ") : "none observed"}`);
  console.log();
}

const off = results[false];
const on = results[true];
const grew = on.later > on.immediate || on.rails > off.rails;
console.log("=== verdict ===");
if (on.tsr === "undefined" && grew) {
  console.log("  hydrated: the page runs, rows page in and rails fill.");
  process.exit(0);
}
console.log("  NOT hydrated. The document renders and none of its code runs.");
console.log(`  With JavaScript off: ${off.rails} rails, ${off.later} cards in the first.`);
console.log(`  With JavaScript on : ${on.rails} rails, ${on.later} cards in the first.`);
console.log("  Search, favourites, Show more and every row past the first page are dead.");
process.exit(1);
