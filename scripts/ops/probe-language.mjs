/**
 * Does the language button actually reach the platform's language system?
 *
 * The top bar kept its own list of seventeen languages while the platform
 * supports 140, so a visitor whose language the platform can serve had no way
 * to choose it. This opens the button on a real page and checks four things
 * that together mean it is connected rather than merely present:
 *
 *   how many languages it offers      — should match the registry, not a copy
 *   whether choosing one changes the page
 *   whether the choice survives a reload
 *   whether anything is written twice — two language keys in storage would
 *                                       mean two systems keeping state
 *
 * It changes nothing on the server. The only thing it writes is the visitor's
 * own language preference, in its own throwaway browser profile.
 *
 *   node scripts/ops/probe-language.mjs [path] [languageName]
 */
import { chromium } from "@playwright/test";
import { LANGUAGE_REGISTRY } from "../../src/lib/i18n/registry.ts";

const SITE = (process.env.SV_SITE || "https://softwarevala.net").replace(/\/+$/, "");
const PATHNAME = process.argv[2] || "/";
const WANTED = process.argv[3] || "Hindi";

const expected = LANGUAGE_REGISTRY.filter((l) => l.enabled).length;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text().slice(0, 160));
});
page.on("pageerror", (e) => errors.push(`pageerror: ${String(e).slice(0, 160)}`));

console.log(`${SITE}${PATHNAME} — the registry has ${expected} enabled languages\n`);

await page.goto(`${SITE}${PATHNAME}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(6000);

const trigger = page.locator("button", { hasText: "Language" }).first();
if (!(await trigger.count())) {
  console.log("FAIL  no Language button on this page");
  await browser.close();
  process.exit(1);
}
await trigger.click({ timeout: 8000 });
await page.waitForTimeout(1500);

// The options are the buttons inside the open panel, each ending in its code.
const offered = await page.evaluate(() => {
  const panel = document.querySelector('[data-radix-popper-content-wrapper], [role="dialog"]');
  if (!panel) return null;
  return [...panel.querySelectorAll("button")]
    .map((b) => (b.textContent ?? "").trim())
    .filter((t) => t.length > 1);
});

if (!offered) {
  console.log("FAIL  the Language button did not open a panel");
  await browser.close();
  process.exit(1);
}

console.log(`  offers ${offered.length} language(s)`);
console.log(
  offered.length >= expected
    ? `  OK    matches the registry (${expected})`
    : `  FAIL  offers ${offered.length} of the registry's ${expected} — a second, smaller list`,
);

const before = await page.evaluate(() => document.body.innerText.slice(0, 4000));

const choice = page.locator("button", { hasText: WANTED }).last();
let switched = false;
if (await choice.count()) {
  await choice.click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(6000);
  const after = await page.evaluate(() => document.body.innerText.slice(0, 4000));
  switched = before !== after;
  console.log(
    switched
      ? `  OK    choosing ${WANTED} changed the page`
      : `  FAIL  choosing ${WANTED} changed nothing on the page`,
  );
} else {
  console.log(`  FAIL  ${WANTED} was not in the list`);
}

// Two keys holding a language would mean two systems keeping the same state.
const stored = await page.evaluate(() => {
  const out = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && /lang/i.test(key)) out[key] = String(localStorage.getItem(key)).slice(0, 24);
  }
  return out;
});
const keys = Object.keys(stored);
console.log(`  language keys in storage: ${keys.length ? keys.join(", ") : "none"}`);
for (const [k, v] of Object.entries(stored)) console.log(`      ${k} = ${v}`);

await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(6000);
const afterReload = await page.evaluate(() => ({
  lang: document.documentElement.lang,
  dir: document.documentElement.dir,
}));
console.log(`  after reload: <html lang="${afterReload.lang}" dir="${afterReload.dir}">`);

console.log(`\n  console errors: ${errors.length}`);
for (const e of errors.slice(0, 5)) console.log(`      ${e}`);

await browser.close();
process.exit(offered.length >= expected && switched && errors.length === 0 ? 0 : 1);
