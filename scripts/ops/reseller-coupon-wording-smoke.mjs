/**
 * The reseller dashboard says what the coupon rule is: Software Vala issues
 * and manages company coupons, and a reseller neither creates nor edits them.
 *
 *   node scripts/ops/reseller-coupon-wording-smoke.mjs [base]
 *
 * As the reseller: none of the old creation wording appears anywhere on the
 * dashboard (every hero slide included); the coupon banner's button opens the
 * company-coupon note; no coupon feature offers "Configure"; the referral link
 * generator still opens; and nothing is written while doing so.
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
const BASE = process.argv.find((a) => /^https?:/.test(a)) ?? "http://127.0.0.1:3203";
let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name.padEnd(66)} ${detail}`);
};
const OLD = /Coupon Workshop|Coupon Generator|Create Discount Coupons|New coupon|Build promo codes|Discount Coupons|Campaign Coupons|Limited Time Coupons|coupons yet/i;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message ?? e)));
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(3500);
await page.fill('input[type="email"]', ops.SV_LOGIN_RESELLER);
await page.fill('input[type="password"]', ops.SV_PW_RESELLER ?? ops.SV_PW_TEST ?? ops.SV_PW_CONTROL_PANEL);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
const writes = [];
await context.route("**/*", (route) => {
  const r = route.request();
  const read = ["GET", "HEAD", "OPTIONS"].includes(r.method()) || /\/auth\/v1\/(token|user)/.test(r.url()) || /rpc\/mm_notifications/.test(r.url());
  if (!read) writes.push(`${r.method()} ${r.url().replace(BASE, "").split("?")[0]}`);
  return read ? route.continue() : route.abort();
});

await page.goto(`${BASE}/dashboard/reseller`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(6000);

// Every hero slide, read in turn.
const slides = [];
for (let i = 0; i < 10; i += 1) {
  await page.getByRole("button", { name: `Banner ${i + 1}`, exact: true }).click().catch(() => undefined);
  await page.waitForTimeout(300);
  slides.push(await page.locator("body").innerText().catch(() => ""));
}
const heroText = slides.join("\n");
check("no hero slide uses the old coupon-creation wording", !OLD.test(heroText), heroText.match(OLD)?.[0] ?? "");
check("the coupon slide says Software Vala issues every coupon", /Software Vala issues every coupon/.test(heroText));

// The coupon slide's button.
let found = false;
for (let i = 0; i < 10 && !found; i += 1) {
  await page.getByRole("button", { name: `Banner ${i + 1}`, exact: true }).click().catch(() => undefined);
  await page.waitForTimeout(300);
  const button = page.getByRole("button", { name: /How coupons work/ }).first();
  if (await button.isVisible().catch(() => false)) {
    await button.click();
    found = true;
  }
}
await page.waitForTimeout(3000);
let text = await page.locator("body").innerText();
check('"How coupons work" opens the company-coupon note', found && /Coupons are issued and managed by Software Vala only/.test(text));
check("the coupon note offers no Configure", !(await page.getByRole("button", { name: /^\s*Configure\s*$/ }).count()));
check("the coupon note does not say coupons are coming", !/yet/i.test(text.match(/Coupons are issued[^\n]*/)?.[0] ?? ""));

// The centre itself: every coupon feature, and the link generator.
await page.getByRole("button", { name: /^\s*Back\s*$/ }).first().click().catch(() => undefined);
await page.waitForTimeout(2000);
text = await page.locator("body").innerText();
check("the centre lists no coupon-creation feature", !OLD.test(text), text.match(OLD)?.[0] ?? "");
check('the centre shows the "Company Coupons" section', /Company Coupons/.test(text));
for (const label of ["Company Coupons", "Coupon Analytics", "Coupon Usage History"]) {
  const card = page.getByRole("button", { name: new RegExp(label) }).first();
  const opened = await card.click({ timeout: 4000 }).then(() => true).catch(() => false);
  await page.waitForTimeout(1500);
  const body = await page.locator("body").innerText();
  const configure = await page.getByRole("button", { name: /^\s*Configure\s*$/ }).count();
  check(`"${label}" opens the note and offers no Configure`, opened && /Coupons are issued and managed by Software Vala only/.test(body) && configure === 0);
  await page.getByRole("button", { name: /^\s*Back\s*$/ }).first().click().catch(() => undefined);
  await page.waitForTimeout(1200);
}
const generator = page.getByRole("button", { name: /Referral Link Generator/ }).first();
await generator.click({ timeout: 4000 }).catch(() => undefined);
await page.waitForTimeout(3500);
text = await page.locator("body").innerText();
check("the referral link generator still opens", /New link/.test(text));

check("no page error", errors.length === 0, errors.slice(0, 2).join(" | "));
check("nothing was written", writes.length === 0, writes.slice(0, 3).join(" ; "));
await browser.close();
console.log(`\n  ${failed ? `${failed} failed` : "all passed"}`);
process.exit(failed ? 1 : 0);
