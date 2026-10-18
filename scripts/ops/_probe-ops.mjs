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
p.on("response", async (r) => {
  if (r.url().includes("/api/demo/ops")) {
    let t = ""; try { t = (await r.text()).slice(0, 200); } catch {}
    console.log("  GET /api/demo/ops ->", r.status(), t);
  }
});
p.on("console", (m) => { if (m.type() === "error") console.log("  console:", m.text().slice(0, 160)); });
await p.goto(`${SITE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(4000);
await p.fill('input[type="email"]', ops.SV_LOGIN_CONTROL_PANEL);
await p.fill('input[type="password"]', ops.SV_PW_CONTROL_PANEL);
await p.click('button[type="submit"]');
await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45000 });
await p.waitForTimeout(2000);
await p.goto(`${SITE}/demo-ops`, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(11000);
const tab = p.getByText("Re-process", { exact: true }).first();
console.log("  Re-process pill found:", await tab.count());
if (await tab.count()) { await tab.click({ timeout: 8000 }).catch(() => {}); await p.waitForTimeout(9000); }
console.log("  rows:", await p.locator("[data-reprocess]").count());
console.log("  text:", (await p.evaluate(() => document.body.innerText || "")).slice(0, 260).replace(/\n+/g, " | "));
await b.close();
