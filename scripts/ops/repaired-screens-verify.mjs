/**
 * The operator screens repaired in the Part 1 code <-> database
 * reconciliation, opened in a real browser as the admin test account.
 *
 *   node scripts/ops/repaired-screens-verify.mjs [base]
 *
 * Read-only: it signs in, opens each screen, and records page errors and every
 * database request (/rest/v1) that fails. A screen passes when it renders with
 * no page error and none of its data requests fail. Nothing is written.
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const ops = {};
for (const line of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
const BASE = process.argv.find((a) => /^https?:/.test(a)) ?? "http://127.0.0.1:3203";
const SCREENS = [
  "/ams/chat",
  "/affiliate-manager/affiliates",
  "/affiliate-manager/commissions",
  "/affiliate-manager/orders",
  "/affiliate-manager/payouts",
  "/affiliate-manager/referral-codes",
  "/affiliate-manager/affiliate-links",
  "/affiliate-manager/audit-log",
  "/affiliate-manager/coupons",
  "/affiliate-manager/customers",
  "/affiliate-manager/search",
  "/demo-ops",
  "/demo-manager",
  "/demo-workspace",
  "/dev-manager",
  "/product-demo-manager",
  "/manager",
];

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name.padEnd(44)} ${detail}`);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 90_000 });
await page.waitForTimeout(2500);
await page.fill('input[type="email"]', ops.SV_LOGIN_ADMIN);
await page.fill('input[type="password"]', ops.SV_PW_ADMIN ?? ops.SV_PW_TEST);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });

for (const path of SCREENS) {
  const errors = [];
  const badRequests = [];
  const onError = (e) => errors.push(String(e.message ?? e));
  const onResponse = (r) => {
    const url = r.url();
    if (url.includes("/rest/v1/") && r.status() >= 400) {
      badRequests.push(`${r.status()} ${new URL(url).pathname.replace("/rest/v1/", "")}`);
    }
  };
  page.on("pageerror", onError);
  page.on("response", onResponse);
  const response = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 90_000 }).catch(() => null);
  await page.waitForTimeout(7000);
  const text = await page.evaluate(() => document.body.innerText).catch(() => "");
  page.off("pageerror", onError);
  page.off("response", onResponse);
  const restricted = /Access restricted/i.test(text);
  check(path, response?.status() === 200 && !restricted && errors.length === 0 && badRequests.length === 0,
    [restricted ? "access restricted" : "", errors[0]?.slice(0, 70) ?? "", [...new Set(badRequests)].slice(0, 3).join(" ")].filter(Boolean).join(" | "));
}

await browser.close();
console.log(`\n  ${failed ? `${failed} failed` : "all passed"}`);
process.exit(failed ? 1 : 0);
