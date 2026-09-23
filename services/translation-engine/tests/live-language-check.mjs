/**
 * One live pass over language switching on production: every role (temporary
 * accounts), desktop and phone, console and network errors from the language
 * system, and the selector's own text in the chosen language.
 *
 *   ROLE_ACCOUNTS=/out/role-accounts.json docker run --rm --network host \
 *     -v "$PWD/tests:/t" -v /root:/out mcr.microsoft.com/playwright:v1.56.0-noble \
 *     node /t/live-language-check.mjs https://softwarevala.net /out/live-language-check.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "https://softwarevala.net";
const OUT = process.argv[3] ?? "live-language-check.json";
const ACCOUNTS = JSON.parse(readFileSync(process.env.ROLE_ACCOUNTS, "utf8"));
const results = [];
const failures = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failures.push(`${name}: ${detail ?? ""}`);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const LANGUAGE_URL = /\/api\/(i18n|marketplace\/translate)/;

function watch(page, bag) {
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    // Only what concerns the language system.
    if (/i18n|translat|language|LanguageSelector|useTranslation|sv_lang/i.test(text)) bag.push(`console: ${text.slice(0, 200)}`);
  });
  page.on("pageerror", (e) => bag.push(`pageerror: ${e.message.slice(0, 200)}`));
  page.on("response", (r) => {
    const url = r.url();
    if (LANGUAGE_URL.test(url) && r.status() >= 400 && r.status() !== 429) bag.push(`HTTP ${r.status()} ${url.slice(0, 120)}`);
    if (r.status() === 404 && r.request().resourceType() !== "image" && url.startsWith(BASE)) bag.push(`404 ${url.slice(0, 120)}`);
  });
}

const state = (page) =>
  page.evaluate(() => {
    const text = document.body.innerText;
    const letters = text.match(/\p{L}/gu)?.length ?? 1;
    return {
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      arabic: (text.match(/\p{Script=Arabic}/gu)?.length ?? 0) / letters,
      selectors: [...document.querySelectorAll("[data-language-selector]")].filter((el) => el.getBoundingClientRect().width > 0).length,
      dock: Boolean(document.querySelector("[data-language-dock]")),
      crashed: /This page didn't load/.test(text),
    };
  });

async function settleArabic(page) {
  for (let i = 0; i < 10; i++) {
    const s = await state(page);
    if (s.arabic >= 0.3) return s;
    await page.waitForTimeout(3000);
  }
  return state(page);
}

async function choose(page, query) {
  await page.locator("[data-language-selector]:visible").first().click();
  const panel = page.locator("[data-radix-popper-content-wrapper]").first();
  const search = panel.locator("input");
  await search.waitFor({ timeout: 10000 });
  const placeholder = await search.getAttribute("placeholder");
  await search.fill(query);
  await search.press("Enter");
  await page.waitForTimeout(1200);
  return placeholder;
}

async function signIn(page, a) {
  await page.goto(`${BASE}/auth`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.fill("#email", a.email);
  await page.fill("#password", a.password);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/chat/, { timeout: 60000 }).catch(() => undefined);
}

const browser = await chromium.launch();
try {
  for (const a of ACCOUNTS) {
    const [first, second] = a.routes;
    const viewport = a.phone ? { width: 390, height: 780 } : { width: 1366, height: 800 };
    const ctx = await browser.newContext({ viewport, locale: "en-US" });
    await ctx.addInitScript(() => {
      if (!sessionStorage.getItem("i")) {
        localStorage.setItem("sv_lang_current_v2", "en");
        sessionStorage.setItem("i", "1");
      }
    });
    const page = await ctx.newPage();
    const errors = [];
    watch(page, errors);
    const name = `${a.role}${a.phone ? " (phone)" : ""}`;
    try {
      if (a.email) await signIn(page, a);
      await page.goto(BASE + first, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForTimeout(2500);
      let s = await state(page);
      check(`${name} ${first}: page renders, one selector`, !s.crashed && s.selectors === 1, `${s.selectors} ${s.dock ? "dock" : "inline"}${s.crashed ? " CRASHED" : ""}`);
      await choose(page, "arabic");
      s = await settleArabic(page);
      check(`${name} ${first}: Arabic rtl + translated`, s.lang === "ar" && s.dir === "rtl" && s.arabic >= 0.15, `lang=${s.lang} dir=${s.dir} ${(s.arabic * 100).toFixed(0)}%`);
      await page.goto(BASE + second, { waitUntil: "domcontentloaded", timeout: 90000 });
      s = await settleArabic(page);
      check(`${name} ${second}: kept, translated, selector`, s.lang === "ar" && s.dir === "rtl" && s.arabic >= 0.15 && s.selectors === 1 && !s.crashed, `lang=${s.lang} ${(s.arabic * 100).toFixed(0)}% selectors=${s.selectors}`);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);
      s = await state(page);
      check(`${name}: persists after reload`, s.lang === "ar" && s.dir === "rtl", `lang=${s.lang}`);
      const placeholder = await choose(page, "hindi");
      check(`${name}: selector text in the chosen language`, Boolean(placeholder) && placeholder !== "Search languages", `placeholder "${placeholder}"`);
      s = await state(page);
      check(`${name}: back to left-to-right (Hindi)`, s.lang === "hi" && s.dir === "ltr", `lang=${s.lang} dir=${s.dir}`);
    } catch (error) {
      check(`${name}: run`, false, String(error).slice(0, 160));
    }
    check(`${name}: no language errors (console/network/404)`, errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
    await new Promise((r) => setTimeout(r, 8000));
  }
} finally {
  await browser.close();
}
writeFileSync(OUT, JSON.stringify({ results, failures }, null, 1));
console.log(`\n${results.filter((r) => r.ok).length} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
