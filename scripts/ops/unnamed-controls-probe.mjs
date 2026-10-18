/**
 * Buttons, links and form fields a screen reader cannot name, per route.
 *
 *   node scripts/ops/unnamed-controls-probe.mjs [base] /route ...
 *
 * Signs in as the Control Panel operator and prints, for each control with no
 * accessible name, its tag, classes and the icon inside it, so it can be given
 * a label where it is written.
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
const BASE = process.argv.find((a) => /^https?:/.test(a)) ?? "http://127.0.0.1:3203";
const ROUTES = process.argv.slice(2).filter((a) => a.startsWith("/"));
const WIDTH = Number(process.env.WIDTH ?? 1440);

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: WIDTH, height: 900 } })).newPage();
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(3500);
await page.fill('input[type="email"]', ops.SV_LOGIN_CONTROL_PANEL);
await page.fill('input[type="password"]', ops.SV_PW_CONTROL_PANEL);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });

for (const route of ROUTES) {
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(6000);
  const found = await page.evaluate(() => {
    const named = (el) => {
      if (el.getAttribute("aria-label")?.trim() || el.getAttribute("title")?.trim()) return true;
      const by = el.getAttribute("aria-labelledby");
      if (by && document.getElementById(by)?.textContent?.trim()) return true;
      if ((el.innerText ?? el.textContent ?? "").trim()) return true;
      if (el.querySelector("img[alt]:not([alt=''])")) return true;
      if (el.id && document.querySelector(`label[for="${el.id}"]`)) return true;
      if (el.closest("label")?.textContent?.trim()) return true;
      return false;
    };
    const out = [];
    for (const el of document.querySelectorAll("button, [role=button], a[href], select, input:not([type=hidden]), textarea")) {
      if (named(el)) continue;
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      const svg = el.querySelector("svg");
      const icon = svg ? [...svg.classList].find((c) => c.startsWith("lucide-")) : "";
      const cls = typeof el.className === "string" ? el.className.split(/\s+/).slice(0, 5).join(".") : "";
      out.push(`${el.tagName.toLowerCase()}${el.type ? `[${el.type}]` : ""} ${icon ?? ""} .${cls} @${Math.round(r.x)},${Math.round(r.y)}`);
    }
    return out;
  });
  console.log(`\n${route}  unnamed=${found.length}`);
  for (const line of found.slice(0, 30)) console.log(`  ${line}`);
}
await browser.close();
