/** What the approve button actually gets back. */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
const SITE = "https://softwarevala.net";
const NUMBER = process.argv[2];

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
p.on("response", async (r) => {
  if (!r.url().includes("/api/influencer/applications")) return;
  let t = "";
  try { t = (await r.text()).slice(0, 300); } catch {}
  console.log(`  ${r.request().method()} ${r.status()} ${t}`);
});

await p.goto(`${SITE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await p.waitForTimeout(4000);
await p.fill('input[type="email"]', ops.SV_LOGIN_CONTROL_PANEL);
await p.fill('input[type="password"]', ops.SV_PW_CONTROL_PANEL);
await p.click('button[type="submit"]');
await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 });
await p.waitForTimeout(2000);

await p.goto(`${SITE}/influencer-manager`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await p.waitForTimeout(9000);
await p.locator("button, a").filter({ hasText: /^\s*Applications\s*$/i }).first().click({ timeout: 8000 });
await p.waitForTimeout(7000);

const rows = await p.evaluate(() =>
  [...document.querySelectorAll("[data-application]")].map(
    (e) => `${e.getAttribute("data-application")}:${e.getAttribute("data-application-status")}`,
  ),
);
console.log("  queue:", rows.join(" "));

const target = NUMBER ?? (rows.find((r) => r.endsWith(":pending")) ?? "").split(":")[0];
if (!target) { console.log("  nothing pending to approve"); await b.close(); process.exit(0); }
console.log("  approving", target);

await p.locator(`[data-application="${target}"] [data-approve]`).first().click({ timeout: 8000 });
await p.waitForTimeout(8000);

const toast = await p.evaluate(() => {
  const el = document.querySelector("[data-sonner-toast], [role=status], .toaster");
  return el ? (el.innerText || "").slice(0, 200) : null;
});
console.log("  toast:", toast ?? "none");
const after = await p.evaluate(
  (n) => document.querySelector(`[data-application="${n}"]`)?.getAttribute("data-application-status") ?? "gone",
  target,
);
console.log("  status on screen after:", after);
await b.close();
