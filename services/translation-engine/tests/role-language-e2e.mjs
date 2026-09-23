/**
 * Language switching from every role, in a real browser.
 *
 * For each role: sign in with an account that has that role, open the role's
 * workspace, find the language selector (inline in the page, or the floating
 * dock), search for Arabic and choose it with the keyboard, and check
 *   - <html lang="ar" dir="rtl">
 *   - the screen is translated (share of Arabic letters in the page text)
 *   - a second module of the same role keeps the language and has a selector
 *   - a reload keeps the language
 *   - switching to Hindi gives lang="hi" dir="ltr"
 *
 *   ROLE_ACCOUNTS=/out/role-accounts.json docker run --rm --network host \
 *     -v "$PWD/tests:/t" -v /root:/out mcr.microsoft.com/playwright:v1.56.0-noble \
 *     node /t/role-language-e2e.mjs https://softwarevala.net /out/role-language-e2e.json
 *
 * role-accounts.json: [{ role, email, password, routes: [first, second] }].
 * The accounts are temporary and deleted afterwards by the caller.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "https://softwarevala.net";
const OUT = process.argv[3] ?? "role-language-e2e.json";
const ACCOUNTS = JSON.parse(readFileSync(process.env.ROLE_ACCOUNTS, "utf8"));
const SETTLE_MS = Number(process.env.SETTLE_MS ?? 60000);

const results = [];
const failures = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failures.push(`${name}: ${detail ?? ""}`);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function state(page) {
  return page.evaluate(() => {
    const text = document.body.innerText;
    const letters = text.match(/\p{L}/gu)?.length ?? 0;
    const arabic = text.match(/\p{Script=Arabic}/gu)?.length ?? 0;
    const devanagari = text.match(/\p{Script=Devanagari}/gu)?.length ?? 0;
    const selectors = [...document.querySelectorAll("[data-language-selector]")].filter(
      (el) => el.getBoundingClientRect().width > 0,
    ).length;
    return {
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      arabicShare: letters ? arabic / letters : 0,
      hindiShare: letters ? devanagari / letters : 0,
      selectors,
      dock: Boolean(document.querySelector("[data-language-dock]")),
      restricted: /Access restricted|تقييد الوصول/.test(text),
      path: location.pathname,
    };
  });
}

/** Poll until the page is mostly in the script, or the time is up. */
async function settle(page, key, target) {
  const started = Date.now();
  let last = await state(page);
  while (Date.now() - started < SETTLE_MS && last[key] < target) {
    await page.waitForTimeout(3000);
    last = await state(page);
  }
  return last;
}

async function choose(page, query) {
  const trigger = page.locator("[data-language-selector]:visible").first();
  await trigger.click();
  const search = page.locator("[data-radix-popper-content-wrapper] input").first();
  await search.waitFor({ timeout: 10000 });
  await search.fill(query);
  await search.press("Enter");
  await page.waitForTimeout(1500);
}

async function signIn(page, account) {
  await page.goto(`${BASE}/auth`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => undefined);
  await page.fill("#email", account.email);
  await page.fill("#password", account.password);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/chat/, { timeout: 60000 }).catch(() => undefined);
}

const browser = await chromium.launch();
try {
  for (const account of ACCOUNTS) {
    const role = account.role;
    const [first, second] = account.routes;
    const context = await browser.newContext({ locale: "en-US" });
    await context.addInitScript(() => {
      if (!sessionStorage.getItem("e2e-init")) {
        localStorage.setItem("sv_lang_current_v2", "en");
        sessionStorage.setItem("e2e-init", "1");
      }
    });
    const page = await context.newPage();
    try {
      if (account.email) await signIn(page, account);
      await page.goto(BASE + first, { waitUntil: "networkidle", timeout: 90000 }).catch(() => undefined);
      await page.waitForTimeout(2000);
      let s = await state(page);
      check(`${role} ${first}: a language selector is on screen`, s.selectors > 0, `${s.selectors} (${s.dock ? "dock" : "inline"})${s.restricted ? "; page says access restricted" : ""}`);

      await choose(page, "arabic");
      s = await settle(page, "arabicShare", 0.3);
      check(`${role} ${first}: Arabic chosen`, s.lang === "ar" && s.dir === "rtl", `lang=${s.lang} dir=${s.dir}`);
      check(`${role} ${first}: screen translated`, s.arabicShare >= 0.15, `Arabic letters ${(s.arabicShare * 100).toFixed(0)}%`);

      await page.goto(BASE + second, { waitUntil: "networkidle", timeout: 90000 }).catch(() => undefined);
      s = await settle(page, "arabicShare", 0.3);
      check(`${role} ${second}: language kept across modules`, s.lang === "ar" && s.dir === "rtl", `lang=${s.lang} dir=${s.dir}`);
      check(`${role} ${second}: selector on screen`, s.selectors > 0, `${s.selectors} (${s.dock ? "dock" : "inline"})${s.restricted ? "; page says access restricted" : ""}`);
      check(`${role} ${second}: screen translated`, s.arabicShare >= 0.15, `Arabic letters ${(s.arabicShare * 100).toFixed(0)}%`);

      await page.reload({ waitUntil: "networkidle", timeout: 90000 }).catch(() => undefined);
      s = await state(page);
      check(`${role}: language kept after reload`, s.lang === "ar" && s.dir === "rtl", `lang=${s.lang} dir=${s.dir}`);

      await choose(page, "hindi");
      s = await settle(page, "hindiShare", 0.3);
      check(`${role}: Hindi chosen (left to right)`, s.lang === "hi" && s.dir === "ltr", `lang=${s.lang} dir=${s.dir}, Devanagari ${(s.hindiShare * 100).toFixed(0)}%`);
      results.push({ role, first, second, done: true });
    } catch (error) {
      check(`${role}: run`, false, String(error).slice(0, 200));
    }
    await context.close();
    // One IP drives every role here; a pause keeps the run inside the
    // translate endpoint's per-address rate limit, as separate people would be.
    await new Promise((r) => setTimeout(r, Number(process.env.ROLE_PAUSE_MS ?? 20000)));
  }
} finally {
  await browser.close();
}

writeFileSync(OUT, JSON.stringify({ base: BASE, results, failures }, null, 1));
console.log(`\n${results.filter((r) => r.ok === true).length} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
