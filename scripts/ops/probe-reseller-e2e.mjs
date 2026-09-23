/**
 * A client added on the reseller dashboard, looked for in the reseller manager.
 *
 * This is the whole point of the two screens being connected, so it is walked
 * the way a person walks it: sign in as the reseller, open Clients, create one,
 * and then ask the manager endpoint - as the control panel - whether that row
 * is there. The row it creates is removed again at the end.
 *
 *   node scripts/ops/probe-reseller-e2e.mjs
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

function readEnv(file) {
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) out[match[1]] = match[2].trim().replace(/^'|'$/g, "");
  }
  return out;
}

const ops = readEnv(".env.ops");
const site = (ops.SV_SITE ?? "https://softwarevala.net").replace(/\/$/, "");
const marker = `E2E Client ${Date.now().toString(36)}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

console.log(`creating "${marker}" on the reseller dashboard\n`);

await page.goto(`${site}/login`, { waitUntil: "networkidle", timeout: 120_000 });
await page.locator('input[type="email"]').fill(ops.SV_LOGIN_RESELLER);
await page.locator('input[type="password"]').fill(ops.SV_PW_TEST);
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(8000);

await page.goto(`${site}/dashboard/reseller`, { waitUntil: "domcontentloaded", timeout: 120_000 });
await page.waitForTimeout(6000);

await page.getByRole("button", { name: "Clients", exact: true }).first().click();
await page.waitForTimeout(4000);
console.log(`clients module open: ${await page.getByText("Client Management").count() > 0}`);

await page.getByRole("button", { name: /New Client/i }).first().click();
await page.waitForTimeout(1500);
// The form's labels are not tied to their inputs, so each field is found
// by the label sitting above it rather than by getByLabel.
const field = (label) => page.locator(`div:has(> label:text-is("${label}")) > input`).first();
await field("Full name *").fill(marker);
await field("Company").fill("Software Vala E2E");
await field("Email").fill("e2e@softwarevala.test");
const created = page.getByRole("button", { name: "Create client" });
console.log(`name field holds : ${JSON.stringify(await field("Full name *").inputValue().catch(() => "(not found)"))}`);
console.log(`create button     : ${await created.count()} found, disabled=${await created.isDisabled().catch(() => "?")}`);
await created.click();
await page.waitForTimeout(1500);
const early = await page.locator("[data-sonner-toast]").allInnerTexts().catch(() => []);
console.log(`message right after clicking: ${JSON.stringify(early.slice(0, 3))}`);
await page.waitForTimeout(5000);

const inList = await page.getByText(marker).count();
console.log(`shown in the dashboard list: ${inList > 0}`);
const toast = await page.locator("[data-sonner-toast], [role='status'], .toaster li").allInnerTexts().catch(() => []);
console.log(`what the screen said: ${JSON.stringify(toast.slice(0, 3))}`);
console.log(`console errors: ${errors.length}`);
for (const e of [...new Set(errors)].slice(0, 4)) console.log(`  ${e.slice(0, 150)}`);
await browser.close();

// Now ask the manager, as the control panel, whether the row is really there.
const auth = await fetch(`${ops.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ops.SUPABASE_SERVICE_ROLE_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: ops.SV_LOGIN_CONTROL_PANEL, password: ops.SV_PW_CONTROL_PANEL }),
}).then((r) => r.json());

const res = await fetch(`${site}/api/manager/resource?resource=customers&limit=200`, {
  headers: { Authorization: `Bearer ${auth.access_token}` },
});
const payload = await res.json().catch(() => ({}));
const rows = payload.rows ?? payload.data ?? payload;
const found = Array.isArray(rows) ? rows.find((r) => r.contact_name === marker) : null;

console.log(`\nreseller manager, Customers: http ${res.status}, ${Array.isArray(rows) ? rows.length : "?"} rows`);
console.log(found ? `FOUND    the client created on the dashboard is in the manager` : `NOT THERE the manager cannot see it`);

if (found) {
  await fetch(`${ops.SUPABASE_URL}/rest/v1/crm_customers?id=eq.${found.id}`, {
    method: "DELETE",
    headers: { apikey: ops.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${ops.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  console.log("test client removed again");
}
