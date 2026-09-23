/**
 * Card → product page → demo → purchase, walked as a visitor walks it.
 *
 * Opens the home page, finds a named card, clicks its title, and reports what
 * the product page shows and where its buttons lead. Nothing is bought: the
 * walk stops at the point where signing in would be required.
 *
 *   node scripts/ops/probe-flow.mjs "<card name>" [url]
 */
import { chromium } from "@playwright/test";

const name = process.argv[2] ?? "Pathology Lab Software";
const site = process.argv[3] ?? "https://softwarevala.net";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(site, { waitUntil: "networkidle", timeout: 120_000 });
await page.waitForTimeout(4000);

let y = 0;
let found = false;
for (let i = 0; i < 400; i++) {
  const at = await page.evaluate((top) => {
    window.scrollTo(0, top);
    return { height: document.documentElement.scrollHeight, view: window.innerHeight };
  }, y);
  await page.waitForTimeout(300);
  if (await page.locator(`h3:text-is("${name}")`).count()) {
    found = true;
    break;
  }
  const next = y + Math.round(at.view * 0.7);
  if (next >= at.height - at.view) break;
  y = next;
}
if (!found) {
  await browser.close();
  console.log(`card "${name}" never appeared on the home page`);
  process.exit(1);
}

const title = page.locator(`h3:text-is("${name}")`).first();
await title.scrollIntoViewIfNeeded();
await title.click();
await page.waitForTimeout(4000);

const seen = await page.evaluate(() => ({
  url: location.pathname + location.search,
  status: document.title,
  h1: [...document.querySelectorAll("h1,h2")].map((h) => h.textContent.trim().slice(0, 60)).slice(0, 6),
  buttons: [
    ...new Set(
      [...document.querySelectorAll("button,a[href]")]
        .map((b) => (b.textContent ?? "").trim())
        .filter((t) => t && t.length < 30),
    ),
  ].slice(0, 25),
  bodyChars: document.body.innerText.length,
}));

await browser.close();

console.log(`card    : ${name}`);
console.log(`landed  : ${seen.url}`);
console.log(`title   : ${seen.status}`);
console.log(`text    : ${seen.bodyChars} characters`);
console.log(`\nheadings:`);
for (const h of seen.h1) console.log(`  ${h}`);
console.log(`\nbuttons and links:`);
for (const b of seen.buttons) console.log(`  ${b}`);
console.log(`\nconsole errors: ${errors.length}`);
for (const e of [...new Set(errors)].slice(0, 5)) console.log(`  ${e.slice(0, 160)}`);
