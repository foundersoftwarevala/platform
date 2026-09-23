/**
 * Browser end-to-end test for the language system.
 *
 * Runs a real Chromium against a running application and checks what a visitor
 * would actually see: the page translated by the platform's own engine, the
 * document's language and direction, the picker, persistence across a reload,
 * browser-language detection, and a retired code opening its replacement.
 *
 *   docker run --rm --network host -v "$PWD/tests:/t" -v "$PWD/reports:/out" \
 *     mcr.microsoft.com/playwright:v1.56.0-noble \
 *     node /t/browser-e2e.mjs http://127.0.0.1:3100 /out/browser-e2e.json
 *
 * Exit code is non-zero if any check fails.
 */
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://127.0.0.1:3100";
const OUT = process.argv[3] ?? "browser-e2e.json";
const STORAGE_KEY = "sv_lang_current_v2";
const LEGACY_KEY = "sv_lang_current_v1";
// How long to let the page fill in with translations before measuring.
const SETTLE_MS = Number(process.env.SETTLE_MS ?? 45000);

const LANGUAGES = [
  { code: "hi", dir: "ltr", script: /[ऀ-ॿ]/ },
  { code: "ar", dir: "rtl", script: /[؀-ۿ]/ },
  { code: "ur", dir: "rtl", script: /[؀-ۿ]/ },
  { code: "he", dir: "rtl", script: /[֐-׿]/ },
  { code: "fa", dir: "rtl", script: /[؀-ۿ]/ },
  { code: "sd", dir: "rtl", script: /[؀-ۿ]/ },
  { code: "ug", dir: "rtl", script: /[؀-ۿ]/ },
  { code: "dv", dir: "rtl", script: /[ހ-޿]/ },
  { code: "zh-Hant", dir: "ltr", script: /[一-鿿]/ },
  { code: "pt-BR", dir: "ltr", script: /[A-Za-zÀ-ÿ]/ },
  { code: "es-AR", dir: "ltr", script: /[A-Za-zÀ-ÿ]/ },
  { code: "ta", dir: "ltr", script: /[஀-௿]/ },
];

// LANGS=dv,he runs the per-language part for those languages only; the rest of
// the checks (baseline, picker, persistence, detection, retired codes) always
// run. Useful when re-checking one language without a full pass.
const ONLY = (process.env.LANGS ?? "")
  .split(",")
  .map((code) => code.trim())
  .filter(Boolean);
const SELECTED = ONLY.length ? LANGUAGES.filter((language) => ONLY.includes(language.code)) : LANGUAGES;

const results = [];
const failures = [];

function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failures.push(`${name}: ${detail ?? ""}`);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function bodyText(page) {
  return page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 200000));
}

/** Wait until the page stops gaining translated characters. */
// A page is judged once its text has stopped changing for this long, and never
// before MIN_SETTLE_MS: a handful of words (a clock, a rotating banner) can
// hold still for a few seconds while the first translation batch is still on
// its way, and measuring then reported a translated page as untranslated.
const STABLE_MS = 12000;
const MIN_SETTLE_MS = 20000;

async function settle(page, baselineText) {
  const started = Date.now();
  let previous = -1;
  let stableSince = Date.now();
  while (Date.now() - started < SETTLE_MS) {
    await page.waitForTimeout(3000);
    const text = await bodyText(page);
    const changed = differing(baselineText, text);
    if (changed !== previous) {
      previous = changed;
      stableSince = Date.now();
      continue;
    }
    const elapsed = Date.now() - started;
    if (changed > 0 && elapsed >= MIN_SETTLE_MS && Date.now() - stableSince >= STABLE_MS) break;
  }
  return previous;
}

/** How many words of the English baseline are no longer on the page. */
function differing(baseline, current) {
  const words = new Set(current.split(" "));
  const baseWords = baseline.split(" ").filter((w) => w.length > 3);
  const unique = new Set(baseWords);
  let gone = 0;
  for (const word of unique) if (!words.has(word)) gone += 1;
  return gone;
}

const browser = await chromium.launch();

try {
  // English baseline.
  const base = await browser.newContext({ locale: "en-US" });
  const page = await base.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(4000);
  const englishText = await bodyText(page);
  const englishLang = await page.evaluate(() => document.documentElement.lang);
  check("english baseline renders", englishText.length > 500, `${englishText.length} chars`);
  check("english html lang", englishLang === "en", englishLang);
  await base.close();

  // Each language: stored choice is applied before paint, text is translated.
  for (const language of SELECTED) {
    const context = await browser.newContext({ locale: "en-US" });
    await context.addInitScript(
      ([key, code]) => window.localStorage.setItem(key, code),
      [STORAGE_KEY, language.code],
    );
    const p = await context.newPage();
    await p.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
    await p.waitForTimeout(3000);
    const lang = await p.evaluate(() => document.documentElement.lang);
    const dir = await p.evaluate(() => document.documentElement.dir);
    check(`${language.code}: html lang`, lang === language.code, lang);
    check(`${language.code}: direction`, dir === language.dir, dir);
    const changed = await settle(p, englishText);
    const text = await bodyText(p);
    const hasScript = language.script.test(text);
    check(`${language.code}: page translated`, changed > 5 && hasScript, `${changed} english words replaced, script ${hasScript}`);
    results.at(-1).sample = text.slice(0, 120);
    await context.close();
  }

  // A moment of outage must not end translation for the visit. The first
  // request for the language pack and the first translation request are
  // answered the way the server answers when the database or the engine is
  // unavailable (503); every later request reaches the real server. The page
  // has to fall back from the pack to translation requests and, after the
  // client's back-off (15 s for the first failure), come back translated.
  // Tamil has no entries in the reviewed UI dictionary, so any Tamil on the
  // page came from the server.
  {
    const context = await browser.newContext({ locale: "en-US" });
    await context.addInitScript(([key]) => window.localStorage.setItem(key, "ta"), [STORAGE_KEY]);
    // Both ways a page gets its text fail once: the language pack (so the
    // page has to fall back to asking string by string) and then the first
    // translation request (so it has to back off and ask again).
    let failed = 0;
    const failOnce = (path, body) => {
      let done = false;
      return context.route(path, async (route) => {
        if (!done) {
          done = true;
          failed += 1;
          await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify(body) });
          return;
        }
        await route.continue();
      });
    };
    await failOnce("**/api/i18n/pack*", {
      error: "Translations are not available right now.",
      reason: "service_error",
    });
    await failOnce("**/api/marketplace/translate", {
      error: "The translation engine is unavailable right now.",
      reason: "engine_unavailable",
    });
    const p = await context.newPage();
    await p.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
    let recovered = false;
    for (let waited = 0; waited < 90000 && !recovered; waited += 3000) {
      await p.waitForTimeout(3000);
      recovered = /[஀-௿]/.test(await bodyText(p));
    }
    check("translation resumes after an outage", failed === 2 && recovered, `pack and translate each failed once (${failed} failures), translated afterwards: ${recovered}`);
    await context.close();
  }

  // Retired code opens its replacement.
  {
    const context = await browser.newContext();
    await context.addInitScript(([key]) => window.localStorage.setItem(key, "yue"), [STORAGE_KEY]);
    const p = await context.newPage();
    await p.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
    await p.waitForTimeout(2500);
    const lang = await p.evaluate(() => document.documentElement.lang);
    check("retired yue opens zh-Hant", lang === "zh-Hant", lang);
    await context.close();
  }

  // A value written by the previous catalogue keeps its old meaning.
  {
    const context = await browser.newContext();
    await context.addInitScript(([key]) => window.localStorage.setItem(key, "AR5"), [LEGACY_KEY]);
    const p = await context.newPage();
    await p.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
    await p.waitForTimeout(2500);
    const lang = await p.evaluate(() => document.documentElement.lang);
    const stored = await p.evaluate(([key]) => window.localStorage.getItem(key), [STORAGE_KEY]);
    check("legacy AR5 migrates to es-AR", lang === "es-AR" && stored === "es-AR", `${lang} / ${stored}`);
    await context.close();
  }

  // Browser language detection, with nothing stored.
  for (const [locale, expected] of [["pt-BR", "pt-BR"], ["zh-TW", "zh-Hant"], ["de-AT", "de-AT"], ["en-GB", "en-GB"]]) {
    const context = await browser.newContext({ locale });
    const p = await context.newPage();
    await p.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
    await p.waitForTimeout(2500);
    const lang = await p.evaluate(() => document.documentElement.lang);
    check(`browser ${locale} detected as ${expected}`, lang === expected, lang);
    await context.close();
  }

  // The picker: every supported language, and choosing one persists.
  {
    const context = await browser.newContext({ locale: "en-US" });
    const p = await context.newPage();
    await p.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
    await p.waitForTimeout(3000);
    const trigger = p.locator('button:has-text("Language")').first();
    await trigger.click({ timeout: 60000 });
    await p.waitForTimeout(2000);
    const options = await p.evaluate(() => {
      // The picker renders in a popover; each entry shows its code.
      const scopes = document.querySelectorAll('[data-radix-popper-content-wrapper], [role="dialog"], body');
      const codes = new Set();
      for (const scope of scopes) {
        for (const button of scope.querySelectorAll("button")) {
          for (const span of button.querySelectorAll("span")) {
            const text = span.textContent?.trim() ?? "";
            if (/^[a-z]{2,3}(-[a-z]{2,4})?$/i.test(text)) codes.add(text.toLowerCase());
          }
        }
      }
      return Array.from(codes);
    });
    check("picker lists every language", options.length >= 140, `${options.length} entries`);

    const hindi = p.locator('button:has-text("हिन्दी")').first();
    await hindi.click({ timeout: 60000 });
    await p.waitForTimeout(3000);
    const afterPick = await p.evaluate(() => document.documentElement.lang);
    check("picking a language applies it", afterPick === "hi", afterPick);
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForTimeout(2500);
    const afterReload = await p.evaluate(() => document.documentElement.lang);
    const cookie = (await context.cookies()).find((c) => c.name === "sv_locale")?.value;
    check("choice survives a reload", afterReload === "hi", afterReload);
    check("choice is mirrored in a cookie", cookie === "hi", String(cookie));
    await context.close();
  }
} finally {
  await browser.close();
  writeFileSync(OUT, JSON.stringify({ base: BASE, results, failures }, null, 1));
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed`);
}

process.exit(failures.length === 0 ? 0 : 1);
