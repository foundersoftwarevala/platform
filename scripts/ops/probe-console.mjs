/**
 * What the page says went wrong, in its own words.
 *
 * A page can hydrate and still end up with less on it than the server sent:
 * an error inside a section boundary is caught and the section renders its
 * fallback, which is often nothing at all. Nothing about that reaches the
 * network, so neither the asset check nor the hydration probe sees it. This
 * collects the console and every uncaught error instead.
 *
 *   node scripts/ops/probe-console.mjs [url]
 */
import { chromium } from "@playwright/test";

const url = process.argv[2] ?? "https://softwarevala.net/";
const browser = await chromium.launch();
const page = await browser.newPage();

const errors = [];
const warnings = [];
const failedRequests = [];

page.on("pageerror", (e) => errors.push(`UNCAUGHT  ${e.message}\n${(e.stack ?? "").split("\n").slice(1, 4).join("\n")}`));
page.on("console", (m) => {
  const t = m.type();
  if (t === "error") errors.push(`CONSOLE   ${m.text()}`);
  else if (t === "warning") warnings.push(m.text());
});
page.on("requestfailed", (r) => failedRequests.push(`${r.failure()?.errorText} ${r.url()}`));
page.on("response", (r) => {
  if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`);
});

await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
await page.waitForTimeout(8000);

const state = await page.evaluate(() => ({
  rails: document.querySelectorAll("[data-product-row]").length,
  cards: document.querySelectorAll(".sv-card-shell").length,
  loadingText: document.body.innerText.includes("Loading the marketplace"),
  errorText: document.body.innerText.includes("could not be read"),
  sectionFallbacks: document.body.innerText.match(/did not load|could not be read|Try again/g)?.length ?? 0,
  bodyChars: document.body.innerText.length,
}));

await browser.close();

console.log(`probing ${url}\n`);
console.log("after hydration:");
console.log(`  rails                 : ${state.rails}`);
console.log(`  cards                 : ${state.cards}`);
console.log(`  "Loading the marketplace" showing : ${state.loadingText}`);
console.log(`  "could not be read" showing       : ${state.errorText}`);
console.log(`  fallback/retry texts  : ${state.sectionFallbacks}`);
console.log(`  visible text length   : ${state.bodyChars}`);

console.log(`\nuncaught + console errors (${errors.length}):`);
for (const e of [...new Set(errors)].slice(0, 15)) console.log(`  ${e}`);

console.log(`\nfailed requests (${failedRequests.length}):`);
for (const f of [...new Set(failedRequests)].slice(0, 15)) console.log(`  ${f}`);

console.log(`\nwarnings (${warnings.length}):`);
for (const w of [...new Set(warnings)].slice(0, 6)) console.log(`  ${w}`);

process.exit(errors.length ? 1 : 0);
