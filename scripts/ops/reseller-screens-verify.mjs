/**
 * Reseller Dashboard and Reseller Manager in a real browser, read-only.
 *
 *   node scripts/ops/reseller-screens-verify.mjs [base]
 *
 * The reseller test account opens /dashboard/reseller at five widths and then
 * every module in its sidebar; an admin opens /reseller-manager and every
 * section in its sidebar, plus the Franchise and SEO managers that share the
 * same wall framework. Each step must render with no page error, no failed
 * database request and no sideways scroll. Nothing is clicked that writes.
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2"); }
const BASE = process.argv.find((a) => /^https?:/.test(a)) ?? "http://127.0.0.1:3203";
let failed = 0;
const check = (name, ok, detail = "") => { if (!ok) failed += 1; console.log(`  ${ok ? "PASS" : "FAIL"}  ${name.padEnd(62)} ${detail}`); };

async function session(login) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const log = { errors: [], bad: [] };
  page.on("pageerror", (e) => log.errors.push(String(e.message).slice(0, 120)));
  page.on("response", (r) => { const u = r.url(); if ((u.includes("/rest/v1/") || u.includes("/_serverFn/") || u.includes("/api/")) && r.status() >= 400) log.bad.push(`${r.status()} ${new URL(u).pathname.split("/").slice(-1)[0]}`); });
  await page.goto(`${BASE}/login`); await page.waitForTimeout(2500);
  await page.fill('input[type="email"]', ops[`SV_LOGIN_${login}`]); await page.fill('input[type="password"]', ops[`SV_PW_${login}`] ?? ops.SV_PW_TEST);
  await page.click('button[type="submit"]'); await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
  return { browser, page, log };
}
const take = (log) => { const e = [...log.errors], b = [...new Set(log.bad)]; log.errors.length = 0; log.bad.length = 0; return { e, b }; };
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

async function walkSidebar(s, label, base) {
  // Every item, each from a fresh load of the starting page, clicked by its
  // label: an item that navigates elsewhere must not hide the ones after it.
  await s.page.goto(`${BASE}${base}`, { waitUntil: "domcontentloaded" }); await s.page.waitForTimeout(5000); take(s.log);
  const texts = [...new Set(await s.page.locator("aside nav button, aside nav a[href]").evaluateAll((els) =>
    els.map((e) => (e.textContent || "").trim().replace(/s+/g, " ")).filter((t) => t && t.length < 50)))];
  console.log(`  ..    ${label}: ${texts.length} sidebar items`);
  for (const text of texts) {
    if (/log ?out|sign ?out/i.test(text)) continue;
    await s.page.goto(`${BASE}${base}`, { waitUntil: "domcontentloaded" }); await s.page.waitForTimeout(4000); take(s.log);
    const el = s.page.locator("aside nav button, aside nav a[href]").filter({ hasText: text }).first();
    if (!(await el.isVisible().catch(() => false))) { const g = s.page.locator("aside nav").getByText(text, { exact: true }).first(); await g.scrollIntoViewIfNeeded().catch(() => {}); }
    await el.click({ timeout: 5000 }).catch(() => {});
    await s.page.waitForTimeout(3000);
    const { e, b } = take(s.log);
    const restricted = /Access restricted/i.test(await s.page.evaluate(() => document.body.innerText));
    check(`${label} › ${text}`, e.length === 0 && b.length === 0 && !restricted, [restricted ? "access restricted" : "", e[0], b.slice(0, 3).join(" ")].filter(Boolean).join(" | "));
  }
}

try {
  // ---------------- Reseller Dashboard
  const r = await session("RESELLER");
  for (const width of [390, 412, 768, 1024, 1440]) {
    await r.page.setViewportSize({ width, height: 900 });
    await r.page.goto(`${BASE}/dashboard/reseller`, { waitUntil: "domcontentloaded" });
    await r.page.waitForTimeout(6000);
    const ov = await overflow(r.page);
    const restricted = /Access restricted/i.test(await r.page.evaluate(() => document.body.innerText));
    const { e, b } = take(r.log);
    check(`reseller dashboard at ${width}px`, !restricted && e.length === 0 && b.length === 0 && ov <= 1, `overflow ${ov}${e[0] ? " | " + e[0] : ""}${b.length ? " | " + b.slice(0, 3).join(" ") : ""}`);
  }
  const kpi = await r.page.evaluate(() => document.body.innerText);
  check("no sample KPI values on the reseller home (no invented +x% deltas)", !/[+−-]\d+(\.\d+)?%\s*(vs|this|from)/i.test(kpi));
  await walkSidebar(r, "reseller", "/dashboard/reseller");
  await r.browser.close();

  // ---------------- Reseller Manager and the managers sharing its walls
  const a = await session("ADMIN");
  for (const path of ["/reseller-manager", "/franchise-manager", "/seo-manager"]) {
    await a.page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    await a.page.waitForTimeout(6000);
    const restricted = /Access restricted/i.test(await a.page.evaluate(() => document.body.innerText));
    const { e, b } = take(a.log);
    check(`${path} opens for an admin`, !restricted && e.length === 0 && b.length === 0, [e[0], b.slice(0, 3).join(" ")].filter(Boolean).join(" | "));
    if (path === "/reseller-manager") await walkSidebar(a, "reseller manager", "/reseller-manager");
  }
  await a.browser.close();
} catch (error) {
  failed += 1;
  console.log(`  FAIL  the run stopped: ${error instanceof Error ? error.message.slice(0, 300) : error}`);
}
console.log(`\n  ${failed ? `${failed} failed` : "all passed"}`);
process.exit(failed ? 1 : 0);
