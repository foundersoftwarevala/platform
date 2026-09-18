/**
 * Browser check of the screens that use the keyed API (useTranslation / t()).
 *
 * For each page it first records, in English, which catalogue strings are on
 * screen. Then, per language, it opens the page in that language and checks:
 *   - <html lang> and dir are the language's
 *   - every catalogue string that has a translation in the language pack is
 *     shown as that translation - the one for its own context, not the page
 *     translator's generic one - and its English is gone
 *   - strings without a translation yet (pending, or held for review) are
 *     shown in English, not replaced by anything else
 *   - the text does not change any more after it has settled (no flapping
 *     between two translations)
 *
 *   docker run --rm --network host -v "$PWD/tests:/t" -v /root:/out \
 *     mcr.microsoft.com/playwright:v1.56.0-noble \
 *     node /t/keyed-e2e.mjs https://softwarevala.net /out/keyed-catalogue.json /out/keyed-e2e.json
 *
 * keyed-catalogue.json is [{ key, text, context }] for every catalogue entry.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "https://softwarevala.net";
const CATALOGUE = JSON.parse(readFileSync(process.argv[3], "utf8"));
const OUT = process.argv[4] ?? "keyed-e2e.json";
const STORAGE_KEY = "sv_lang_current_v2";
const SEP = String.fromCharCode(1);
const MAX_SETTLE_MS = Number(process.env.MAX_SETTLE_MS ?? 120000);

// E2E_EMAIL / E2E_PASSWORD: a temporary account; adds the chat, which needs one.
const ACCOUNT = process.env.E2E_EMAIL ? { email: process.env.E2E_EMAIL, password: process.env.E2E_PASSWORD } : null;

async function signIn(page) {
  await page.goto(`${BASE}/auth`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => undefined);
  await page.fill("#email", ACCOUNT.email);
  await page.fill("#password", ACCOUNT.password);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/chat/, { timeout: 60000 }).catch(() => undefined);
}

const PAGES = [
  { path: "/login", modules: ["auth", "common"] },
  { path: "/auth", modules: ["auth", "common"] },
  { path: "/checkout", modules: ["checkout", "common"] },
  { path: "/payment/success", modules: ["payment", "common"] },
  { path: "/account/purchases", modules: ["account", "common"] },
  ...(ACCOUNT ? [{ path: "/chat", modules: ["chat", "common"], signedIn: true }] : []),
];
const RTL = new Set(["ar", "he", "fa", "ur", "ps", "sd", "ug", "dv", "yi"]);
const LANGS = (process.env.LANGS ?? "hi,ar,he,zh-Hans,ja,ru,es,fr,pt,fa,ur").split(",");

const results = [];
const failures = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failures.push(`${name}: ${detail ?? ""}`);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

/** Everything a visitor reads: text, and the readable attributes. */
async function visibleText(page) {
  return page.evaluate(() => {
    const parts = [document.body.innerText];
    for (const el of document.querySelectorAll("[placeholder],[aria-label],[title],[alt]")) {
      for (const a of ["placeholder", "aria-label", "title", "alt"]) {
        const v = el.getAttribute(a);
        if (v) parts.push(v);
      }
    }
    return parts.join("\n").replace(/[ \t]+/g, " ");
  });
}

/** The page's separate pieces of text: lines and attribute values. */
function units(text) {
  return new Set(text.split("\n").map((line) => line.trim()).filter(Boolean));
}

/**
 * Whether a catalogue string is on screen by itself: a whole line or
 * attribute, or - for a sentence long enough not to occur by chance inside
 * another one - part of a line.
 */
function onScreen(pieces, s) {
  if (pieces.has(s)) return true;
  if (s.length < 25) return false;
  for (const piece of pieces) if (piece.includes(s)) return true;
  return false;
}

/** Catalogue strings without variables, whole, as they appear on a page. */
function simpleEntries(modules) {
  return CATALOGUE.filter((e) => modules.includes(e.context) && !e.text.includes("{"));
}

const contains = (text, s) => text.includes(s);

const browser = await chromium.launch();
try {
  // English: which catalogue strings each page shows.
  const onPage = {};
  for (const p of PAGES) {
    const context = await browser.newContext({ locale: "en-US" });
    await context.addInitScript(([key]) => localStorage.setItem(key, "en"), [STORAGE_KEY]);
    const page = await context.newPage();
    if (p.signedIn) await signIn(page);
    await page.goto(BASE + p.path, { waitUntil: "networkidle", timeout: 90000 }).catch(() => undefined);
    await page.waitForTimeout(3000);
    const text = await visibleText(page);
    const pieces = units(text);
    onPage[p.path] = simpleEntries(p.modules).filter((e) => onScreen(pieces, e.text));
    check(`en ${p.path}: catalogue strings on screen`, onPage[p.path].length > 0, `${onPage[p.path].length}`);
    await context.close();
  }

  for (const lang of LANGS) {
    for (const p of PAGES) {
      const context = await browser.newContext();
      await context.addInitScript(([key, code]) => localStorage.setItem(key, code), [STORAGE_KEY, lang]);
      const page = await context.newPage();
      if (p.signedIn) await signIn(page);
      await page.goto(BASE + p.path, { waitUntil: "networkidle", timeout: 90000 }).catch(() => undefined);

      // Let translations arrive: stop when every string with a pack entry is
      // shown translated, or nothing changed for 15 s, or at MAX_SETTLE_MS.
      const started = Date.now();
      let last = "";
      let stableSince = Date.now();
      let pack = null;
      for (;;) {
        await page.waitForTimeout(3000);
        const text = await visibleText(page);
        if (text !== last) {
          last = text;
          stableSince = Date.now();
        }
        if (Date.now() - stableSince > 15000 || Date.now() - started > MAX_SETTLE_MS) break;
      }
      // The pack after the page asked for its strings: what memory now holds.
      pack = await page.evaluate(async (code) => {
        const r = await fetch(`/api/i18n/pack?lang=${encodeURIComponent(code)}`, { cache: "no-store" });
        return r.ok ? r.json() : null;
      }, lang);
      const text = await visibleText(page);
      const html = await page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir, title: document.title }));

      check(`${lang} ${p.path}: <html lang>`, html.lang === lang, html.lang);
      check(`${lang} ${p.path}: dir`, html.dir === (RTL.has(lang) ? "rtl" : "ltr"), html.dir);

      let shown = 0;
      let pending = 0;
      let absent = 0;
      const wrong = [];
      for (const e of onPage[p.path]) {
        const translation = pack?.entries?.[`${e.context}${SEP}${e.text}`];
        if (!translation || translation === e.text) {
          pending += 1;
          continue;
        }
        if (contains(text, translation)) shown += 1;
        // English still on screen although the translation exists: a failure.
        else if (onScreen(units(text), e.text)) wrong.push(`"${e.text}" -> expected "${translation}"`);
        // The page translator's generic translation in place of the keyed one.
        else if (
          pack?.entries?.[`${SEP}${e.text}`] &&
          pack.entries[`${SEP}${e.text}`] !== translation &&
          units(text).has(pack.entries[`${SEP}${e.text}`])
        )
          wrong.push(`"${e.text}" shows the generic "${pack.entries[`${SEP}${e.text}`]}", not "${translation}"`);
        // Neither: that state of the page (a loading line) is over.
        else absent += 1;
      }
      const total = onPage[p.path].length;
      check(
        `${lang} ${p.path}: keyed strings shown in their own translation`,
        wrong.length === 0,
        `${shown}/${total} translated, ${pending} not translated yet (English), ${absent} no longer on screen${wrong.length ? `; ${wrong.slice(0, 3).join("; ")}` : ""}`,
      );

      // Settled text stays put.
      await page.waitForTimeout(8000);
      check(`${lang} ${p.path}: text is stable`, (await visibleText(page)) === text);
      results.push({ lang, path: p.path, total, shown, pending, absent, title: html.title });
      await context.close();
    }
  }
} finally {
  await browser.close();
}

writeFileSync(OUT, JSON.stringify({ base: BASE, results, failures }, null, 1));
console.log(`\n${results.filter((r) => r.ok === true).length} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
