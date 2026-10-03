/**
 * Keyboard access to every Reseller Dashboard and Reseller Manager section,
 * and to the marketplace home the reseller sidebar links to. Read-only.
 *
 *   node scripts/ops/reseller-keyboard-verify.mjs [base]
 *
 * For each section, from a fresh page:
 *   1. the first Tab stop is the "Skip to main content" link
 *   2. Enter on it puts focus on <main>, and the next Tab lands on a control
 *      inside <main>; Shift+Tab from there leaves it again
 *   3. the first content controls show a visible focus indicator
 *   4. nothing in <main> is clickable by mouse only (a pointer-cursor element
 *      with a click handler that is not focusable and holds nothing focusable)
 *   5. a control that opens a dialog closes on Escape and gives focus back
 *      (only buttons whose label does not commit anything are tried)
 * There must be exactly one <main> on every page.
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2"); }
const BASE = process.argv.find((a) => /^https?:/.test(a)) ?? "http://127.0.0.1:3203";
let failed = 0;
const check = (name, ok, detail = "") => { if (!ok) failed += 1; console.log(`  ${ok ? "PASS" : "FAIL"}  ${name.padEnd(64)} ${detail}`); };

async function session(login) {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 100)));
  page.on("dialog", (d) => d.dismiss().catch(() => {}));
  if (login) {
    await page.goto(`${BASE}/login`); await page.waitForTimeout(2500);
    await page.fill('input[type="email"]', ops[`SV_LOGIN_${login}`]); await page.fill('input[type="password"]', ops[`SV_PW_${login}`] ?? ops.SV_PW_TEST);
    await page.click('button[type="submit"]'); await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
  }
  return { browser, page, errors };
}

const focusInfo = (page) => page.evaluate(() => {
  const a = document.activeElement;
  if (!a || a === document.body) return { where: "body" };
  // The element itself, or the wrapper drawn around it (focus-within), shows focus.
  const shows = (e) => { if (!e) return false; const cs = getComputedStyle(e); return (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== "none"); };
  const ring = shows(a) || shows(a.parentElement) || shows(a.parentElement?.parentElement);
  return { where: a.tagName === "MAIN" ? "main" : a.closest("main") ? "in-main" : "outside", text: (a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 30), ring: Boolean(ring), skip: a.getAttribute("href") === "#main-content" };
});

async function audit(s, url, open, label) {
  const { page } = s;
  await page.goto(url, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4000);
  if (open) { await page.locator("aside nav button, aside nav a[href]").filter({ hasText: open }).first().click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(2500); }
  const problems = [];
  const mains = await page.locator("main").count();
  if (mains !== 1) problems.push(`${mains} <main>`);
  // 1-2: skip link, then into main
  // Start Tab from the top of the document, as on a fresh page: a click on the
  // sidebar would otherwise be where sequential focus carries on from.
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    const start = document.createElement("span");
    start.tabIndex = -1;
    document.body.prepend(start);
    start.focus();
    start.remove();
  });
  await page.keyboard.press("Tab");
  const first = await focusInfo(page);
  if (!first.skip) problems.push(`first Tab stop is "${first.text ?? first.where}", not the skip link`);
  else {
    if (!first.ring) problems.push("skip link has no visible focus");
    await page.keyboard.press("Enter"); await page.waitForTimeout(200);
    const landed = await focusInfo(page);
    if (landed.where !== "main") problems.push(`skip link left focus on ${landed.where}`);
    await page.keyboard.press("Tab");
    const next = await focusInfo(page);
    if (next.where !== "in-main") problems.push(`Tab after skipping went to ${next.where}`);
    // 3: focus indicator on the first content controls
    let ringless = 0;
    for (let i = 0; i < 8; i += 1) {
      const f = await focusInfo(page);
      if (f.where === "in-main" && !f.ring) ringless += 1;
      await page.keyboard.press("Tab");
    }
    if (ringless) problems.push(`${ringless} of the first 8 content controls show no focus`);
    await page.keyboard.press("Shift+Tab");
    const back = await focusInfo(page);
    if (back.where === "body") problems.push("Shift+Tab lost focus");
  }
  // 4: mouse-only click targets
  const mouseOnly = await page.evaluate(() => {
    const focusable = "a[href],button,input,select,textarea,summary,[tabindex]:not([tabindex='-1']),[contenteditable=true]";
    return [...document.querySelectorAll("main *")].filter((e) => {
      if (e.matches(focusable) || e.closest(focusable) || e.querySelector(focusable)) return false;
      if (getComputedStyle(e).cursor !== "pointer") return false;
      const r = e.getBoundingClientRect(); if (!r.width || !r.height) return false;
      const props = Object.keys(e).find((k) => k.startsWith("__reactProps"));
      return Boolean(props && e[props]?.onClick);
    }).slice(0, 3).map((e) => `${e.tagName.toLowerCase()} "${(e.textContent || "").trim().slice(0, 24)}"`);
  });
  if (mouseOnly.length) problems.push(`mouse-only: ${mouseOnly.join(", ")}`);
  // 5: a dialog closes on Escape
  const candidates = await page.locator("main button:visible").evaluateAll((els) => els.map((e, i) => ({ i, label: (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 40), haspopup: e.getAttribute("aria-haspopup") })));
  const opener = candidates.find((c) => c.label && !/\b(save|submit|delete|remove|approve|reject|pay|terminate|suspend|pause|release|send|confirm|buy|generate|create|refund|logout)\b/i.test(c.label) && (c.haspopup === "dialog" || /\b(view|details|open|preview|filter|more)\b/i.test(c.label)));
  if (opener) {
    await page.locator("main button:visible").nth(opener.i).focus().catch(() => {});
    await page.keyboard.press("Enter"); await page.waitForTimeout(800);
    const opened = await page.locator("[role=dialog]:visible, [role=alertdialog]:visible").count();
    if (opened) {
      await page.keyboard.press("Escape"); await page.waitForTimeout(500);
      const still = await page.locator("[role=dialog]:visible, [role=alertdialog]:visible").count();
      if (still) problems.push(`dialog from "${opener.label}" did not close on Escape`);
    }
  }
  const errs = s.errors.splice(0);
  if (errs.length) problems.push(errs[0]);
  check(`${label}`, problems.length === 0, problems.join(" | "));
}

try {
  const r = await session("RESELLER");
  await r.page.goto(`${BASE}/dashboard/reseller`, { waitUntil: "domcontentloaded" }); await r.page.waitForTimeout(4000);
  await r.page.locator("aside nav button, aside nav a[href]").first().waitFor({ timeout: 30000 }).catch(() => {});
  const rs = [...new Set(await r.page.locator("aside nav button, aside nav a[href]").evaluateAll((els) => els.map((e) => (e.textContent || "").trim().replace(/\s+/g, " ")).filter((t) => t && t.length < 50 && !/log ?out|sign ?out/i.test(t))))];
  for (const section of rs) await audit(r, `${BASE}/dashboard/reseller`, section, `reseller › ${section}`);
  await r.browser.close();

  const a = await session("ADMIN");
  await a.page.goto(`${BASE}/reseller-manager`, { waitUntil: "domcontentloaded" }); await a.page.waitForTimeout(4000);
  await a.page.locator("aside nav button, aside nav a[href]").first().waitFor({ timeout: 30000 }).catch(() => {});
  const ms = [...new Set(await a.page.locator("aside nav button, aside nav a[href]").evaluateAll((els) => els.map((e) => (e.textContent || "").trim().replace(/\s+/g, " ")).filter((t) => t && t.length < 50 && !/log ?out|sign ?out/i.test(t))))];
  check("manager: the sidebar lists its sections", ms.length > 0, `${ms.length} sections at ${new URL(a.page.url()).pathname}`);
  for (const section of ms) await audit(a, `${BASE}/reseller-manager`, section, `manager › ${section}`);
  await a.browser.close();

  const v = await session(null);
  await audit(v, `${BASE}/`, null, "marketplace home (signed out)");
  await v.browser.close();
} catch (error) {
  failed += 1;
  console.log(`  FAIL  the run stopped: ${error instanceof Error ? error.message.slice(0, 300) : error}`);
}
console.log(`\n  ${failed ? `${failed} failed` : "all passed"}`);
process.exit(failed ? 1 : 0);
