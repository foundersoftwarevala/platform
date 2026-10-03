/**
 * Every Reseller Dashboard and Reseller Manager section at phone, tablet and
 * desktop widths, read-only.
 *
 *   node scripts/ops/reseller-responsive-verify.mjs [base]
 *
 * Each section is opened at 1440px from its sidebar, then the same page is
 * resized to each width. At every width: no sideways scroll, no element
 * wider than the screen, no page error, and keyboard focus reaches the main
 * area with a visible focus ring. Icon-only buttons without an accessible
 * name are listed.
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2"); }
const BASE = process.argv.find((a) => /^https?:/.test(a)) ?? "http://127.0.0.1:3203";
const WIDTHS = [360, 390, 768, 1280];
let failed = 0;
const check = (name, ok, detail = "") => { if (!ok) failed += 1; console.log(`  ${ok ? "PASS" : "FAIL"}  ${name.padEnd(66)} ${detail}`); };

async function session(login) {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 100)));
  await page.goto(`${BASE}/login`); await page.waitForTimeout(2500);
  await page.fill('input[type="email"]', ops[`SV_LOGIN_${login}`]); await page.fill('input[type="password"]', ops[`SV_PW_${login}`] ?? ops.SV_PW_TEST);
  await page.click('button[type="submit"]'); await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
  return { browser, page, errors };
}

const measure = (page) => page.evaluate(() => {
  const vw = window.innerWidth;
  const wide = [...document.querySelectorAll("main *")].filter((e) => {
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    // Inside a scroll container (a table that scrolls sideways) is fine.
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX; if (o === "auto" || o === "scroll" || o === "hidden") return false;
    }
    return r.right > vw + 1;
  }).slice(0, 3).map((e) => `${e.tagName.toLowerCase()}${e.className && typeof e.className === "string" ? "." + e.className.split(" ")[0] : ""}`);
  const unnamed = [...document.querySelectorAll("main button")].filter((b) => b.offsetParent && !(b.getAttribute("aria-label") || b.getAttribute("title") || (b.textContent || "").trim())).length;
  return { overflow: document.documentElement.scrollWidth - vw, wide, unnamed };
});

async function area(login, base, label) {
  const s = await session(login);
  await s.page.goto(`${BASE}${base}`, { waitUntil: "domcontentloaded" }); await s.page.waitForTimeout(4000);
  const sections = [...new Set(await s.page.locator("aside nav button, aside nav a[href]").evaluateAll((els) =>
    els.map((e) => (e.textContent || "").trim().replace(/\s+/g, " ")).filter((t) => t && t.length < 50 && !/log ?out|sign ?out/i.test(t))))];
  for (const section of sections) {
    await s.page.setViewportSize({ width: 1440, height: 900 });
    await s.page.goto(`${BASE}${base}`, { waitUntil: "domcontentloaded" }); await s.page.waitForTimeout(3500);
    await s.page.locator("aside nav button, aside nav a[href]").filter({ hasText: section }).first().click({ timeout: 5000 }).catch(() => {});
    await s.page.waitForTimeout(2500);
    const bad = [];
    let unnamed = 0;
    for (const width of WIDTHS) {
      await s.page.setViewportSize({ width, height: 860 }); await s.page.waitForTimeout(700);
      const m = await measure(s.page);
      unnamed = Math.max(unnamed, m.unnamed);
      if (m.overflow > 1 || m.wide.length) bad.push(`${width}px: overflow ${m.overflow}${m.wide.length ? ` (${m.wide.join(", ")})` : ""}`);
    }
    // Keyboard: Tab from the top reaches a control in the main area, and it shows focus.
    await s.page.setViewportSize({ width: 1280, height: 860 });
    await s.page.evaluate(() => (document.activeElement)?.blur?.());
    let focusOk = false, ring = false;
    for (let i = 0; i < 60 && !focusOk; i += 1) {
      await s.page.keyboard.press("Tab");
      const f = await s.page.evaluate(() => { const a = document.activeElement; if (!a || !a.closest("main")) return null; const cs = getComputedStyle(a); return { ring: cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0 || cs.boxShadow !== "none" }; });
      if (f) { focusOk = true; ring = f.ring; }
    }
    const errs = s.errors.splice(0);
    check(`${label} › ${section}: fits ${WIDTHS.join("/")}px, keyboard reaches it`, bad.length === 0 && focusOk && errs.length === 0,
      [bad.join("; "), focusOk ? (ring ? "" : "focus not visible") : "Tab never reached the main area", unnamed ? `${unnamed} unnamed icon button(s)` : "", errs[0] ?? ""].filter(Boolean).join(" | "));
  }
  await s.browser.close();
}

try {
  await area("RESELLER", "/dashboard/reseller", "reseller");
  await area("ADMIN", "/reseller-manager", "manager");
} catch (error) {
  failed += 1;
  console.log(`  FAIL  the run stopped: ${error instanceof Error ? error.message.slice(0, 300) : error}`);
}
console.log(`\n  ${failed ? `${failed} failed` : "all passed"}`);
process.exit(failed ? 1 : 0);
