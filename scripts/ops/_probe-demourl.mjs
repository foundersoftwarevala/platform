import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
const SITE = "https://softwarevala.net";
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1600, height: 1100 } })).newPage();
p.on("console", (m) => { if (m.type() === "error") console.log("  console:", m.text().slice(0, 500)); });
await p.goto(`${SITE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(4000);
await p.fill('input[type="email"]', ops.SV_LOGIN_CONTROL_PANEL);
await p.fill('input[type="password"]', ops.SV_PW_CONTROL_PANEL);
await p.click('button[type="submit"]');
await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45000 });
await p.waitForTimeout(2000);
for (const [route, label] of [["/marketplace-manager", "Demo URLs"], ["/product-demo-manager", "Add Demo"]]) {
  await p.goto(`${SITE}${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(11000);
  const item = p.getByText(label, { exact: true }).first();
  const found = await item.count();
  if (found) { await item.click({ timeout: 8000 }).catch(() => {}); await p.waitForTimeout(8000); }
  const h1 = (await p.locator("h1").allInnerTexts()).join(" | ").slice(0, 70);
  const inputs = await p.locator("input").count();
  console.log(`  ${route} -> "${label}" found=${found} h1="${h1}" inputs=${inputs}`);
}
await b.close();
