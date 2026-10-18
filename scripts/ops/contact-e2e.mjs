/**
 * Does a customer's message from /contact actually become a support record?
 *
 * The chain: the public page -> /api/marketplace/contact -> support_tickets ->
 * the reference the customer is shown -> the acknowledgement the mailer either
 * sends or queues, reported honestly either way.
 *
 * It fills the real form on the real site as an anonymous visitor, so what it
 * proves is what a customer gets. It writes one ticket, clearly marked, and
 * removes nothing.
 *
 *   node scripts/ops/contact-e2e.mjs
 */
import { chromium } from "@playwright/test";

const SITE = (process.env.SV_SITE || "https://softwarevala.net").replace(/\/+$/, "");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));

await page.goto(`${SITE}/contact`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(8000);

await page.fill("#contact-name", "Automated check (not a customer)");
await page.fill("#contact-email", "hellosoftwarevala@gmail.com");
await page.fill("#contact-phone", "+91 83488 38383");
await page.selectOption("#contact-category", "technical");
await page.fill("#contact-subject", `Automated contact-form check ${stamp}`);
await page.fill(
  "#contact-message",
  "This ticket was raised by scripts/ops/contact-e2e.mjs to prove the public " +
    "contact form reaches support_tickets. It needs no reply.",
);

await page.click('button[type="submit"]');
await page.waitForTimeout(9000);

const result = await page.evaluate(() => {
  const text = document.body.innerText || "";
  return {
    accepted: /Your message is with us/i.test(text),
    reference: (text.match(/SV-\d{6}-[A-Z0-9]{5}/) || [])[0] ?? null,
    emailed: /A copy has been emailed/i.test(text),
    queued: /queued and will be emailed/i.test(text),
    error: (text.match(/We could not [^\n]{0,80}/) || [])[0] ?? null,
  };
});

console.log(`accepted      : ${result.accepted}`);
console.log(`reference     : ${result.reference ?? "none"}`);
console.log(`email         : ${result.emailed ? "sent" : result.queued ? "queued (no provider) - stated honestly" : "no statement"}`);
if (result.error) console.log(`error shown   : ${result.error}`);
console.log(`page errors   : ${errors.length}`);

await browser.close();
process.exit(result.accepted && result.reference ? 0 : 1);
