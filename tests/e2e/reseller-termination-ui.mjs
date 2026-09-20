/** Reseller Manager UI: the terminated record offers no Approve; the new application is approved with the normal button. */
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
const BASE = "https://softwarevala.net";
const staff = JSON.parse(readFileSync(process.env.ACCOUNTS ?? "term-accts.json", "utf8")).find((x) => x.label === "staff");
const state = JSON.parse(readFileSync(process.env.STATE ?? "term-state.json", "utf8"));
const oldNum = state.r1.application_number, newNum = state.r2.application_number;
let pass = 0, total = 0;
const check = (name, ok, detail) => { total++; if (ok) pass++; console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`); };
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(`${BASE}/auth`, { waitUntil: "networkidle" });
await page.fill("#email", staff.email); await page.fill("#password", staff.password); await page.click("button[type=submit]");
await page.waitForTimeout(6000);
await page.goto(`${BASE}/reseller-manager`, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);
await page.getByRole("button", { name: /^Resellers$/ }).first().click();
await page.waitForTimeout(4000);
const rowFor = (num) => page.locator("div, li, tr").filter({ hasText: num }).filter({ has: page.locator("[data-terminated-final], button") }).last();
const oldRow = rowFor(oldNum);
check(`terminated ${oldNum} is listed with its history`, (await oldRow.count()) > 0);
check(`terminated ${oldNum} shows "final", no Approve button`,
  (await oldRow.locator("[data-terminated-final]").count()) === 1 && (await oldRow.getByRole("button", { name: /^Approve$/ }).count()) === 0);
const newRow = page.locator("div, li, tr").filter({ hasText: newNum }).filter({ has: page.getByRole("button", { name: /^Approve$/ }) }).last();
check(`new application ${newNum} is pending with an Approve button`, (await newRow.count()) > 0);
if (await newRow.count()) {
  const resp = page.waitForResponse((r) => r.url().includes("/_serverFn/") && r.request().method() === "POST", { timeout: 30000 }).catch(() => null);
  await newRow.getByRole("button", { name: /^Approve$/ }).click();
  const r = await resp;
  check("Approve on the new application succeeds", r?.status() === 200 && /"ok","reseller"/.test((await r.text()).slice(0, 200)));
  await page.waitForTimeout(3000);
}
console.log(`\n${pass}/${total} passed (ui)`);
await browser.close();
