/**
 * Home, Marketplace and the buyer journey, checked against a running build.
 *
 *   node scripts/ops/marketplace-verify.mjs [base]
 *
 * Read-only against the database: it never pays, never creates an order and
 * never signs anybody in. What it proves is what a visitor and PayU's browser
 * return actually get from the server.
 */
import { chromium } from "@playwright/test";

const BASE = process.argv.find((a) => /^https?:/.test(a)) ?? "http://127.0.0.1:3203";
let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name.padEnd(84)} ${detail}`);
};
const get = (path, init) => fetch(`${BASE}${path}`, { redirect: "manual", ...init });

/* ------------------------------------------------------------ PayU return */
for (const path of ["/payment/success", "/payment/fail"]) {
  const response = await get(path, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ txnid: "SVPROBE123", status: "success", amount: "1.00", hash: "x" }),
  });
  check(`PayU's form POST to ${path} is accepted and sent on to the page`,
    response.status === 303 && response.headers.get("location") === `${path}?txnid=SVPROBE123`,
    `${response.status} -> ${response.headers.get("location")}`);
}
{
  const response = await get("/payment/success?txnid=SVPROBE123");
  check("the page the buyer lands on renders", response.status === 200, String(response.status));
}
{
  const response = await get("/api/payment/status?txnid=SVPROBE123");
  const body = await response.json();
  check("status of a transaction no order has is 'unknown', never 'paid'", body.status === "unknown", JSON.stringify(body));
}
{
  const response = await get("/api/payment/initiate", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: "x" }),
  });
  check("starting a payment without a configured provider or sign-in is refused", [401, 503].includes(response.status), String(response.status));
}
{
  const response = await get("/api/payment/webhook", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ txnid: "SVPROBE123", status: "success", amount: "1.00", hash: "forged" }),
  });
  check("a forged webhook is never answered with success", response.status !== 200, String(response.status));
}

/* --------------------------------------------------------------- search API */
{
  const response = await get(`/api/marketplace/search?q=${encodeURIComponent("school),id.eq.1,(name")}&limit=5`);
  const body = await response.json().catch(() => ({}));
  check("search treats filter syntax as text, not as a filter", response.status === 200 && Array.isArray(body.products),
    `${response.status}, ${Array.isArray(body.products) ? body.products.length : "?"} results`);
}

/* ---------------------------------------------------------------- browser */
const browser = await chromium.launch();
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e.message ?? e)));
    const response = await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(6000);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`home at ${width}px: loads, no page error, no sideways scroll`,
      response?.status() === 200 && errors.length === 0 && overflow <= 1,
      `${response?.status()}, errors ${errors.length}${errors[0] ? ` (${errors[0].slice(0, 80)})` : ""}, overflow ${overflow}`);

    if (width === 1440) {
      // The storefront assistant answers from the real catalogue.
      await page.getByRole("button", { name: /AI Chat/ }).first().click();
      await page.waitForTimeout(800);
      const box = page.getByPlaceholder(/Ask|Type/i).first();
      await box.fill("school");
      await box.press("Enter");
      const answered = await page.waitForFunction(
        () => /marketplace\/product\/|could not find/i.test(document.body.innerText),
        null, { timeout: 20_000 },
      ).then(() => true).catch(() => false);
      const reply = await page.evaluate(() => (document.body.innerText.match(/Here is what the catalogue has:[\s\S]{0,160}/) ?? [""])[0]);
      check("home AI Chat answers from the catalogue instead of hanging", answered && reply.includes("/marketplace/product/"),
        reply.replace(/\s+/g, " ").slice(0, 110));
      check("no page error while using AI Chat", errors.length === 0, errors[0]?.slice(0, 100) ?? "");
    }
    await context.close();
  }

  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e.message ?? e)));
    await page.goto(`${BASE}/marketplace`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(6000);
    check("marketplace loads without a page error", errors.length === 0, errors[0]?.slice(0, 100) ?? "");

    await page.goto(`${BASE}/payment/success?txnid=SVPROBE123`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const support = await page.locator('a[href="/contact"]').count();
    const staff = await page.locator('a[href="/support"]').count();
    check("payment page sends buyers to /contact, not the staff console", support === 1 && staff === 0, `contact ${support}, support ${staff}`);

    await page.goto(`${BASE}/account/purchases`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    check("purchases page sends buyers to /contact", (await page.locator('a[href="/support"]').count()) === 0);

    const contact = await page.goto(`${BASE}/contact`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    check("/contact is open to a visitor", contact?.status() === 200 && !/Access restricted/i.test(await page.content()), String(contact?.status()));

    // The product pages the home cards actually link to, spread across the page.
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(6000);
    for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 2500); await page.waitForTimeout(700); }
    const links = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href*="/marketplace/product/"]')].map((a) => new URL(a.href).pathname))]);
    const step = Math.max(1, Math.floor(links.length / 40));
    const sample = links.filter((_, i) => i % step === 0).slice(0, 40);
    const missing = [];
    for (const href of sample) {
      await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2200);
      if (/Product not found/i.test(await page.evaluate(() => document.body.innerText))) missing.push(href);
    }
    check(`every sampled home card opens its product page (${sample.length} of ${links.length} links)`,
      sample.length >= 20 && missing.length === 0, missing.slice(0, 4).join(" "));
    check("no page error across marketplace, payment, account and product pages", errors.length === 0, errors[0]?.slice(0, 100) ?? "");
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(`\n  ${failed ? `${failed} failed` : "all passed"}`);
process.exit(failed ? 1 : 0);
