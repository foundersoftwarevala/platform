/**
 * The language selector itself, in a real browser: where it appears, what it
 * lists and how it behaves.
 *
 *   docker run --rm --network host -v "$PWD/tests:/t" -v /root:/out \
 *     mcr.microsoft.com/playwright:v1.56.0-noble \
 *     node /t/language-selector-e2e.mjs https://softwarevala.net /out/language-selector-e2e.json
 */
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "https://softwarevala.net";
const OUT = process.argv[3] ?? "language-selector-e2e.json";
const results = [];
const failures = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failures.push(`${name}: ${detail ?? ""}`);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const PAGES = [
  { path: "/", expect: "inline" },
  { path: "/login", expect: "inline" },
  { path: "/auth", expect: "inline" },
  { path: "/checkout", expect: "dock" },
  { path: "/payment/success", expect: "dock" },
  { path: "/account/purchases", expect: "dock" },
];

const browser = await chromium.launch();
try {
  for (const viewport of [
    { name: "desktop", width: 1366, height: 800 },
    { name: "phone", width: 390, height: 780 },
  ]) {
    for (const p of PAGES) {
      const context = await browser.newContext({ viewport, locale: "en-US" });
      await context.addInitScript(() => {
        if (!sessionStorage.getItem("init")) {
          localStorage.setItem("sv_lang_current_v2", "en");
          sessionStorage.setItem("init", "1");
        }
      });
      const page = await context.newPage();
      await page.goto(BASE + p.path, { waitUntil: "networkidle", timeout: 90000 }).catch(() => undefined);
      await page.waitForTimeout(1500);
      const where = await page.evaluate(() => ({
        visible: [...document.querySelectorAll("[data-language-selector]")].filter((el) => el.getBoundingClientRect().width > 0).length,
        dock: Boolean(document.querySelector("[data-language-dock]")),
      }));
      const name = `${viewport.name} ${p.path}`;
      check(`${name}: exactly one selector, ${p.expect}`, where.visible === 1 && where.dock === (p.expect === "dock"), JSON.stringify(where));

      const trigger = page.locator("[data-language-selector]:visible").first();
      const box = await trigger.boundingBox();
      check(`${name}: trigger is a comfortable size`, Boolean(box && box.height >= 28 && box.width >= 28), box ? `${Math.round(box.width)}x${Math.round(box.height)}` : "none");
      await trigger.click();
      const panel = page.locator("[data-radix-popper-content-wrapper]").first();
      await panel.waitFor({ timeout: 10000 });
      const info = await panel.evaluate((el) => {
        const list = el.querySelector("[role=listbox]");
        const all = [...el.querySelectorAll("[role=option][data-all]")];
        const names = all.map((o) => o.querySelector(".text-xs")?.textContent || o.querySelector(".font-medium")?.textContent || "");
        const rect = el.getBoundingClientRect();
        // Layout height: the open animation scales the panel (zoom-in-95), which
        // getBoundingClientRect would include.
        const rows = all.map((o) => o.offsetHeight);
        return {
          count: all.length,
          names,
          letters: [...el.querySelectorAll("[data-letter]")].map((h) => h.getAttribute("data-letter")),
          focusedInput: document.activeElement?.tagName === "INPUT",
          scrollable: list ? list.scrollHeight > list.clientHeight && getComputedStyle(list).overflowY === "auto" : false,
          smooth: list ? getComputedStyle(list).scrollBehavior : "",
          inViewport: rect.left >= 0 && rect.right <= innerWidth + 1 && rect.top >= 0 && rect.bottom <= innerHeight + 1,
          minRow: Math.min(...rows),
        };
      });
      const sorted = [...info.names].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
      check(`${name}: lists all 140 languages`, info.count === 140, `${info.count}`);
      check(`${name}: alphabetical (English name)`, JSON.stringify(sorted) === JSON.stringify(info.names), info.names.slice(0, 4).join(", "));
      check(`${name}: letter headings`, info.letters.length >= 20, info.letters.join(""));
      check(`${name}: search box focused on open`, info.focusedInput);
      check(`${name}: list scrolls smoothly inside the panel`, info.scrollable && info.smooth === "smooth", `smooth=${info.smooth}`);
      check(`${name}: panel fits the screen`, info.inViewport);
      check(`${name}: rows at least 44 px (touch)`, info.minRow >= 43.5, `${info.minRow}`);

      // Letter bar jumps the list.
      await panel.locator("button", { hasText: /^T$/ }).first().click();
      // Smooth scrolling takes a moment over a long distance: wait until it stops.
      let jumped = false;
      for (let i = 0; i < 20 && !jumped; i++) {
        await page.waitForTimeout(150);
        jumped = await panel.evaluate((el) => {
          const list = el.querySelector("[role=listbox]");
          const first = el.querySelector('[data-letter="T"] + [role=option]');
          const top = first.getBoundingClientRect().top - list.getBoundingClientRect().top;
          return top >= 0 && top < 80;
        });
      }
      check(`${name}: letter bar jumps to T`, jumped);

      // Search by the language's own name, then choose with the keyboard.
      const search = panel.locator("input");
      await search.fill("日本");
      const hits = await panel.locator("[role=option]").count();
      check(`${name}: search by native name`, hits === 1, `${hits} match`);
      await search.fill("espanol");
      const es = await panel.locator("[role=option]").allTextContents();
      check(`${name}: search ignores accents`, es.some((t) => t.includes("Spanish")), `${es.length} matches`);
      await search.fill("hebrew");
      await search.press("Enter");
      await page.waitForTimeout(1500);
      const html = await page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir }));
      check(`${name}: keyboard choice applies (Hebrew, rtl)`, html.lang === "he" && html.dir === "rtl", JSON.stringify(html));
      await page.reload({ waitUntil: "networkidle" }).catch(() => undefined);
      const after = await page.evaluate(() => document.documentElement.lang);
      check(`${name}: persists after reload`, after === "he", after);
      // RTL: the dock moves to the other corner.
      if (p.expect === "dock") {
        const dock = await page.locator("[data-language-dock]").boundingBox();
        check(`${name}: dock at the start corner in RTL (right)`, Boolean(dock && dock.x > viewport.width / 2), dock ? `x=${Math.round(dock.x)}` : "none");
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}
writeFileSync(OUT, JSON.stringify({ base: BASE, results, failures }, null, 1));
console.log(`\n${results.filter((r) => r.ok).length} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
