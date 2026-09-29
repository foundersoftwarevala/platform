import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
const SITE = "https://softwarevala.net";
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1500, height: 1100 } })).newPage();
p.on("pageerror", (e) => console.log("  pageerror:", String(e).slice(0, 300)));
p.on("console", (m) => { if (m.type() === "error") console.log("  console:", m.text().slice(0, 300)); });
p.on("response", (r) => { if (r.status() >= 400) console.log("  ", r.status(), r.url().replace(SITE, "").slice(0, 70)); });
await p.goto(`${SITE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(4000);
await p.fill('input[type="email"]', ops.SV_LOGIN_CONTROL_PANEL);
await p.fill('input[type="password"]', ops.SV_PW_CONTROL_PANEL);
await p.click('button[type="submit"]');
await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45000 });
await p.waitForTimeout(2000);
await p.goto(`${SITE}/product-demo-manager`, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(11000);
console.log("  url:", p.url().replace(SITE, ""));
console.log("  h1:", (await p.locator("h1").allInnerTexts()).join(" | ").slice(0, 120));
console.log("  inputs:", await p.locator("input").count(), "buttons:", await p.locator("button").count());
console.log("  body:", (await p.evaluate(() => (document.body.innerText || "").replace(/\n+/g, " | "))).slice(0, 300));
const item = p.getByText("Add Demo", { exact: true }).first();
console.log("  'Add Demo' found:", await item.count());
if (await item.count()) {
  await item.click({ timeout: 8000 }).catch((e) => console.log("  click failed:", String(e).slice(0, 80)));
  await p.waitForTimeout(7000);
  console.log("  after click h1:", (await p.locator("h1").allInnerTexts()).join(" | ").slice(0, 120));
  console.log("  after click inputs:", await p.locator("input").count());
}
await b.close();
