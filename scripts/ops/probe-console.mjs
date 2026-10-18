/**
 * What the browser complains about on the pages that matter.
 *
 * The HTTP sweeps say a page answered; they cannot say it then threw. A page
 * can arrive whole, hydrate, and blank its own catalogue when a client-side
 * client is constructed without the values it needs - which has happened here
 * before, and which nothing at the network level noticed. This opens the pages
 * in a real browser and reports two things: what the console said, and which
 * requests the page made that did not come back.
 *
 * rebuild-with-env.sh has pointed at this script for a while without it
 * existing, so a rebuild's last instruction could not be followed.
 *
 *   node scripts/ops/probe-console.mjs
 *   node scripts/ops/probe-console.mjs https://softwarevala.net
 */
import { chromium } from "@playwright/test";

const SITE = (process.argv[2] || process.env.SV_SITE || "https://softwarevala.net").replace(
  /\/+$/,
  "",
);

/** One page of every kind the site serves, because each is built differently. */
const PAGES = [
  "/",
  "/marketplace",
  "/marketplace/category/education-coaching",
  "/marketplace/category/healthcare-medical",
  "/marketplace/country/india",
  "/blog",
];

/**
 * Noise that says nothing about this deployment: a browser extension, a
 * third-party beacon, or the favicon a headless run never has. Anything else
 * is reported.
 */
const IGNORE =
  /favicon|chrome-extension|web-vitals|ResizeObserver loop|googletagmanager|google-analytics|doubleclick/i;

const browser = await chromium.launch();
const results = [];

for (const path of PAGES) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  const failed = [];

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (!IGNORE.test(text)) errors.push(text.slice(0, 200));
  });
  page.on("pageerror", (error) => errors.push(`uncaught: ${String(error).slice(0, 200)}`));
  page.on("requestfailed", (request) => {
    if (!IGNORE.test(request.url())) {
      failed.push(`${request.failure()?.errorText ?? "failed"} ${request.url().slice(0, 140)}`);
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !IGNORE.test(response.url())) {
      failed.push(`HTTP ${response.status()} ${response.url().slice(0, 140)}`);
    }
  });

  let status = 0;
  try {
    const response = await page.goto(`${SITE}${path}`, {
      waitUntil: "networkidle",
      timeout: 90_000,
    });
    status = response?.status() ?? 0;
    // Hydration and anything it triggers happen after the network settles.
    await page.waitForTimeout(3000);
  } catch (error) {
    errors.push(`navigation: ${String(error).slice(0, 160)}`);
  }

  results.push({ path, status, errors, failed });
  await context.close();
}

await browser.close();

// ------------------------------------------------------------------ report
console.log(`site: ${SITE}`);
console.log("");

let bad = 0;
for (const row of results) {
  const clean = row.status === 200 && !row.errors.length && !row.failed.length;
  if (!clean) bad += 1;
  console.log(
    `${clean ? "OK  " : "FAIL"}  HTTP ${row.status || "---"}  ${row.path}` +
      `  (${row.errors.length} console errors, ${row.failed.length} failed requests)`,
  );
  for (const line of row.errors.slice(0, 5)) console.log(`        console: ${line}`);
  for (const line of row.failed.slice(0, 5)) console.log(`        request: ${line}`);
}

console.log("");
if (bad) {
  console.log(`RESULT: ${results.length - bad}/${results.length} pages clean.`);
  process.exit(1);
}
console.log(`RESULT: all ${results.length} pages clean — no console errors, no failed requests.`);
