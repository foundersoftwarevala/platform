/**
 * The Applications section of Influencer Manager, looked at properly.
 *
 * It is not a wall: RoleApplicationsQueue renders a <ul> of <li data-application>,
 * so a probe that counts <tbody tr> reports zero however well it is working.
 * This counts what the screen actually renders, and separates the two cases
 * that look identical from outside - the queue saying it has nothing, and the
 * queue failing to read.
 *
 * It also switches the filter from "open" to "all", because the default only
 * shows pending and in_review.
 *
 *   node scripts/ops/_verify-applications.mjs
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
const SITE = "https://softwarevala.net";

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
const bad = [];
p.on("response", async (r) => {
  if (r.status() < 400) return;
  let t = "";
  try { t = (await r.text()).slice(0, 160); } catch {}
  bad.push(`${r.status()} ${r.url().replace(SITE, "").slice(0, 90)} ${t}`);
});
p.on("pageerror", (e) => bad.push(`pageerror ${String(e).slice(0, 120)}`));

await p.goto(`${SITE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(4000);
await p.fill('input[type="email"]', ops.SV_LOGIN_CONTROL_PANEL);
await p.fill('input[type="password"]', ops.SV_PW_CONTROL_PANEL);
await p.click('button[type="submit"]');
await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45000 });
await p.waitForTimeout(2500);

await p.goto(`${SITE}/influencer-manager`, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(8000);
bad.length = 0;
await p.locator("button, a").filter({ hasText: /^\s*Applications\s*$/i }).first().click({ timeout: 8000 });
await p.waitForTimeout(8000);

const read = () =>
  p.evaluate(() => {
    const text = document.body.innerText || "";
    return {
      queue: !!document.querySelector("[data-applications-queue]"),
      items: document.querySelectorAll("[data-application]").length,
      statuses: [...document.querySelectorAll("[data-application-status]")]
        .map((e) => e.getAttribute("data-application-status"))
        .join(","),
      says: text.slice(0, 400).replace(/\n+/g, " | "),
    };
  });

console.log("  filter=open  ", JSON.stringify(await read(), null, 0));

const select = p.locator("select").first();
if (await select.count()) {
  await select.selectOption("all").catch(() => {});
  await p.waitForTimeout(6000);
  console.log("  filter=all   ", JSON.stringify(await read(), null, 0));
}
bad.slice(0, 5).forEach((x) => console.log("  failed:", x));
await b.close();
