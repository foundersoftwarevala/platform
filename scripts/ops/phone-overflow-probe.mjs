/**
 * Which elements make a page scroll sideways on a phone.
 *
 * Signs in as the Control Panel operator, opens each route at 390x844 (or
 * WIDTH=<px>) and
 * lists the elements whose right edge passes the viewport, outermost first,
 * with a short selector, so an overflow can be fixed where it starts rather
 * than hidden.
 *
 *   node scripts/ops/phone-overflow-probe.mjs [base] /route /route ...
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
const BASE = process.argv.find((a) => /^https?:/.test(a)) ?? "http://127.0.0.1:3203";
const ROUTES = process.argv.slice(2).filter((a) => a.startsWith("/") || a.startsWith("route:")).map((a) => a.replace(/^route:/, "/"));

const browser = await chromium.launch();
const WIDTH = Number(process.env.WIDTH ?? 390);
const context = await browser.newContext({ viewport: { width: WIDTH, height: 844 } });
const page = await context.newPage();
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
    const vw = window.innerWidth;
    const doc = document.documentElement.scrollWidth;
    const label = (el) => {
      const cls = typeof el.className === "string" ? el.className.split(/\s+/).slice(0, 6).join(".") : "";
      const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
      return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${cls ? `.${cls}` : ""} "${text}"`;
    };
    const out = [];
    for (const el of document.body.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= vw + 1) continue;
      // Skip anything inside a scroll container that clips it.
      let p = el.parentElement;
      let clipped = false;
      while (p && p !== document.body) {
        const s = getComputedStyle(p);
        if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) {
          const pr = p.getBoundingClientRect();
          if (pr.right <= vw + 1) { clipped = true; break; }
        }
        p = p.parentElement;
      }
      if (clipped) continue;
      // Report only the outermost offender of each branch.
      const parent = el.parentElement;
      const pr = parent?.getBoundingClientRect();
      if (parent && parent !== document.body && pr && pr.right > vw + 1) continue;
      out.push(`${Math.round(r.right)}px ${label(el)}`);
    }
    return { vw, doc, out: out.slice(0, 15) };
  });
  console.log(`\n${route}  viewport=${found.vw} scrollWidth=${found.doc}`);
  for (const line of found.out) console.log(`  ${line}`);
}
await browser.close();
